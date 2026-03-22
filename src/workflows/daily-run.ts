import pLimit from 'p-limit';

import { AirtableClient } from '../airtable/client.js';
import { ExperienceRepository, SearchMetadataRepository } from '../airtable/repositories.js';
import type { RuntimeConfig } from '../config/runtime.js';
import { createDiscoveryProviders } from '../discovery/providers/index.js';
import type { CategoryDiscoveryResult, DailyRunSummary } from '../domain/experience.js';
import type { SearchMetadata } from '../domain/search-metadata.js';
import { applyDuplicateKeys, partitionDuplicates } from '../dedupe/duplicates.js';
import { sendEmail } from '../email/mailer.js';
import { renderDailySummaryEmail } from '../email/summary.js';
import { normalizeCandidate } from '../extract/normalize.js';
import { filterAndScoreCandidates } from '../score/scoring.js';
import type { Logger } from '../utils/logger.js';

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
  const providers = createDiscoveryProviders(config);
  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const metadataRows = await metadataRepository.getMetadata();
  const limit = pLimit(config.env.DISCOVERY_CONCURRENCY);

  const enabledRows = metadataRows.filter((row) => row.enabled);
  const results = await Promise.all(
    enabledRows.map((metadata) =>
      limit(() => processCategory(metadata, providers, experienceRepository, dryRun, logger)),
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

async function processCategory(
  metadata: SearchMetadata,
  providers: ReturnType<typeof createDiscoveryProviders>,
  repository: ExperienceRepository,
  dryRun: boolean,
  logger: Logger,
): Promise<CategoryDiscoveryResult> {
  const warnings: string[] = [];

  try {
    const rawItems = (
      await Promise.all(
        providers.map((provider) =>
          provider.discover({
            metadata,
            logger,
          }),
        ),
      )
    ).flat();

    const normalized = rawItems.map((raw) => normalizeCandidate(raw, metadata));
    const scored = applyDuplicateKeys(filterAndScoreCandidates(normalized, metadata));
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
