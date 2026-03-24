import pLimit from 'p-limit';

import { AirtableClient } from '../airtable/client.js';
import { ExperienceRepository, SearchMetadataRepository } from '../airtable/repositories.js';
import type { RuntimeConfig } from '../config/runtime.js';
import type { CandidateEnricher, DiscoveryProvider } from '../discovery/provider.js';
import { createDiscoveryProviders } from '../discovery/providers/index.js';
import type { CategoryDiscoveryResult, DailyRunSummary, ExperienceCandidate } from '../domain/experience.js';
import type { SearchMetadata } from '../domain/search-metadata.js';
import { applyDuplicateKeys, partitionDuplicates } from '../dedupe/duplicates.js';
import { sendEmail } from '../email/mailer.js';
import { renderDailySummaryEmail } from '../email/summary.js';
import { normalizeCandidate } from '../extract/normalize.js';
import { filterAndScoreCandidates } from '../score/scoring.js';
import { isDateWithinDays } from '../utils/dates.js';
import type { Logger } from '../utils/logger.js';
import { isRejectedRestaurantCandidateUrl } from '../discovery/search/search-discovery-helpers.js';

export async function runDailyWorkflow(
  config: RuntimeConfig,
  logger: Logger,
  dryRun: boolean,
): Promise<DailyRunSummary> {
  const client = new AirtableClient(config.env.AIRTABLE_PAT, config.env.AIRTABLE_BASE_ID, {
    timeoutMs: config.env.HTTP_TIMEOUT_MS,
    retryCount: config.env.HTTP_RETRY_COUNT,
  });
  const metadataRepository = new SearchMetadataRepository(client, config);
  const experienceRepository = new ExperienceRepository(client, config);
  const discoveryServices = createDiscoveryProviders(config);
  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const metadataRows = await metadataRepository.getMetadata();
  const limit = pLimit(config.env.DISCOVERY_CONCURRENCY);

  const enabledRows = metadataRows.filter((row) => row.enabled);
  const results = await Promise.all(
    enabledRows.map((metadata) =>
      limit(() =>
        processCategory(
          metadata,
          discoveryServices.discoveryProviders,
          discoveryServices.enrichers,
          experienceRepository,
          dryRun,
          logger,
          config,
        ),
      ),
    ),
  );

  for (const result of results) {
    warnings.push(...result.warnings);
  }

  const summary: DailyRunSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun,
    results,
    warnings,
  };

  await sendEmail(config.env, renderDailySummaryEmail(summary), dryRun, logger);
  return summary;
}

export async function processCategory(
  metadata: SearchMetadata,
  providers: DiscoveryProvider[],
  enrichers: CandidateEnricher[],
  repository: ExperienceRepository,
  dryRun: boolean,
  logger: Logger,
  config: RuntimeConfig,
): Promise<CategoryDiscoveryResult> {
  const warnings: string[] = [];
  const categoryLogger = createWarningCapturingLogger(logger, warnings);

  try {
    const rawItems = (
      await Promise.all(
        providers.map((provider) =>
          provider.discover({
            metadata,
            logger: categoryLogger,
          }),
        ),
      )
    ).flat();

    const normalized = rawItems
      .map((raw) => normalizeCandidate(raw, metadata))
      .filter((candidate) => validateSearchDerivedCandidate(candidate, metadata));
    const enriched = await enrichCandidates(normalized, enrichers, metadata, categoryLogger, config);
    const scored = applyDuplicateKeys(filterAndScoreCandidates(enriched, metadata));
    const existing = await repository.getExisting(metadata.tableName);
    const { unique, duplicates } = partitionDuplicates(scored, existing);
    const inserted = unique.slice(0, metadata.dailyTargetNewItems);
    const rejected = unique.slice(metadata.dailyTargetNewItems);

    if (!dryRun) {
      await repository.insert(metadata.tableName, inserted);
    }

    logger.info('Category processed', {
      category: metadata.tableName,
      discovered: rawItems.length,
      inserted: inserted.length,
      duplicates: duplicates.length,
      rejected: rejected.length,
      dryRun,
    });

    return {
      category: metadata.tableName,
      inserted,
      skippedDuplicates: duplicates,
      rejected,
      warnings,
      discoveredCount: rawItems.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(message);
    logger.error('Category processing failed', {
      category: metadata.tableName,
      error: message,
    });
    return {
      category: metadata.tableName,
      inserted: [],
      skippedDuplicates: [],
      rejected: [],
      warnings,
      discoveredCount: 0,
    };
  }
}

function validateSearchDerivedCandidate(
  candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>,
  metadata: SearchMetadata,
): boolean {
  if (candidate.provenance !== 'search') {
    return true;
  }

  if (
    candidate.category === 'Nature' &&
    (
      !candidate.city ||
      candidate.city === 'Unknown' ||
      candidate.city === candidate.region
    )
  ) {
    return false;
  }

  if (
    candidate.category === 'SpecialEvents' &&
    !isDateWithinDays(candidate.startDate, metadata.dateWindowDays ?? 30, new Date(candidate.createdByBotAt))
  ) {
    return false;
  }

  if (
    candidate.category === 'Restaurants' &&
    isRejectedRestaurantCandidateUrl(candidate.website, candidate.name)
  ) {
    return false;
  }

  return true;
}

async function enrichCandidates(
  candidates: Array<Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>>,
  enrichers: CandidateEnricher[],
  metadata: SearchMetadata,
  logger: Logger,
  config: RuntimeConfig,
): Promise<Array<Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>>> {
  if (enrichers.length === 0) {
    return candidates;
  }

  const limit = pLimit(config.env.DISCOVERY_CONCURRENCY);
  return Promise.all(
    candidates.map((candidate) =>
      limit(async () => {
        if (candidate.provenance === 'search') {
          return candidate;
        }

        let current = candidate;
        for (const enricher of enrichers) {
          const enrichment = await enricher.enrich(current, { metadata, logger });
          if (!enrichment) {
            continue;
          }
          current = applyCandidateEnrichment(current, enrichment);
        }
        return current;
      }),
    ),
  );
}

function applyCandidateEnrichment(
  candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>,
  enrichment: {
    summaryFragments: string[];
    themeHints: string[];
    audienceHints: string[];
    noteFragments: string[];
    scoreBoost: number;
  },
): Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'> {
  const summary = [candidate.shortDescription, ...enrichment.summaryFragments]
    .filter(Boolean)
    .join(' ')
    .slice(0, 280);
  const themes = [...new Set([...candidate.themes, ...enrichment.themeHints])];
  const audience = [...new Set([...candidate.audience, ...enrichment.audienceHints])];
  const notes = enrichment.noteFragments.length > 0
    ? `${candidate.discoveryNotes} | Enriched via web search: ${enrichment.noteFragments.join(', ')}`
    : candidate.discoveryNotes;
  const whyUnique =
    enrichment.themeHints.length > 0
      ? `${candidate.whyUnique} Public feedback mentions ${enrichment.themeHints.slice(0, 3).join(', ')}.`
      : candidate.whyUnique;

  return {
    ...candidate,
    shortDescription: summary,
    themes,
    audience,
    discoveryNotes: notes,
    whyUnique,
    enrichmentScoreBoost: Math.min((candidate.enrichmentScoreBoost ?? 0) + enrichment.scoreBoost, 3),
  };
}

function createWarningCapturingLogger(logger: Logger, warnings: string[]): Logger {
  return {
    ...logger,
    warn(message, context = {}) {
      warnings.push(formatWarning(message, context));
      logger.warn(message, context);
    },
  };
}

function formatWarning(message: string, context: Record<string, unknown>): string {
  const sourceId =
    typeof context['sourceId'] === 'string' && context['sourceId'].length > 0
      ? context['sourceId']
      : null;
  const error =
    typeof context['error'] === 'string' && context['error'].length > 0 ? context['error'] : null;

  if (sourceId && error) {
    return `${message} [${sourceId}]: ${error}`;
  }

  if (error) {
    return `${message}: ${error}`;
  }

  return message;
}
