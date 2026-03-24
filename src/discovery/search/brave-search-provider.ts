import { URL } from 'node:url';

import type { RuntimeConfig, WebSearchConfig } from '../../config/runtime.js';
import type { CandidateEnrichment, ExperienceCandidate, RawDiscoveryRecord } from '../../domain/experience.js';
import type { SearchMetadata } from '../../domain/search-metadata.js';
import { normalizeWhitespace } from '../../utils/strings.js';
import { fetchWithRetry, type HttpClientOptions } from '../../utils/http.js';
import type { CandidateEnricher, DiscoveryContext, DiscoveryProvider, EnrichmentContext } from '../provider.js';
import { buildDiscoveryQueries, buildEnrichmentQueries } from './query-builder.js';
import {
  buildDiscoveryRecordsFromSeed,
  scoreRestaurantCanonicalizationPriority,
  dedupeByUrl,
  extractDomain,
  isAcceptedCanonicalRestaurantResult,
  isAcceptedDiscoveryResult,
  isAcceptedEnrichmentResult,
  shouldCanonicalizeRestaurantRecord,
} from './search-discovery-helpers.js';
import { createDisabledSearchPageCache, type CachedCanonicalRestaurantEntry, type SearchPageCache } from './search-page-cache.js';

const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const BRAVE_SOURCE_NAME = 'Brave Web Search';

interface BraveWebSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  extra_snippets?: string[];
}

export class BraveSearchProvider implements DiscoveryProvider, CandidateEnricher {
  public constructor(
    private readonly config: RuntimeConfig,
    private readonly httpOptions: HttpClientOptions,
    private readonly searchPageCache: SearchPageCache = createDisabledSearchPageCache(),
  ) {}

  public async discover(context: DiscoveryContext): Promise<RawDiscoveryRecord[]> {
    if (!isSearchEnabledForCategory(this.config.webSearch, context.metadata)) {
      return [];
    }

    const queries = buildDiscoveryQueries(
      context.metadata,
      this.config.webSearch.maxQueriesPerCategory,
    );
    const records = await Promise.all(
      queries.map((query) => this.searchForDiscovery(query, context.metadata, context)),
    );

    return dedupeByUrl(records.flat());
  }

  public async enrich(
    candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>,
    context: EnrichmentContext,
  ): Promise<CandidateEnrichment | null> {
    if (!isSearchEnabledForCategory(this.config.webSearch, context.metadata)) {
      return null;
    }

    const queries = buildEnrichmentQueries(
      candidate,
      Math.min(3, this.config.webSearch.maxQueriesPerCategory),
    );
    const responses = await Promise.all(
      queries.map((query) => this.search(query, this.config.webSearch.maxEnrichmentResults, context)),
    );
    const accepted = responses
      .flat()
      .filter((result) => isAcceptedEnrichmentResult(result.url ?? '', result.title ?? ''));

    if (accepted.length === 0) {
      return null;
    }

    const snippets = accepted
      .flatMap((result) => [result.description ?? '', ...(result.extra_snippets ?? [])])
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean)
      .slice(0, 4);
    const domains = [...new Set(accepted.map((result) => extractDomain(result.url ?? '')).filter(Boolean))];
    const combined = snippets.join(' ').toLowerCase();
    const themeHints = extractThemeHints(combined, context.metadata);
    const audienceHints = extractAudienceHints(combined);

    return {
      summaryFragments: snippets.slice(0, 2),
      themeHints,
      audienceHints,
      noteFragments: domains.slice(0, 3),
      scoreBoost: Math.min(accepted.length, 3),
    };
  }

  private async searchForDiscovery(
    query: string,
    metadata: SearchMetadata,
    context: DiscoveryContext,
  ): Promise<RawDiscoveryRecord[]> {
    const results = await this.search(query, this.config.webSearch.maxResultsPerQuery, context);
    const accepted = results.filter((result) =>
      isAcceptedDiscoveryResult(result.url ?? '', result.title ?? '', metadata.tableName),
    );
    const source = {
      id: 'web-search-brave',
      name: BRAVE_SOURCE_NAME,
      url: BRAVE_SEARCH_ENDPOINT,
    } as const;
    const records = await Promise.all(
      accepted.map((result) =>
        buildDiscoveryRecordsFromSeed(
          {
            title: normalizeWhitespace(result.title ?? ''),
            url: result.url ?? '',
            summary: normalizeWhitespace([result.description ?? '', ...(result.extra_snippets ?? [])].join(' ')).slice(0, 320),
            rawDateText: normalizeWhitespace([result.title ?? '', result.description ?? '', ...(result.extra_snippets ?? [])].join(' ')),
            extraSnippets: result.extra_snippets ?? [],
          },
          metadata,
          source,
          this.httpOptions,
          context.logger,
          this.searchPageCache,
          context.metrics,
        ),
      ),
    );

    return this.canonicalizeRestaurantRecords(records.flat(), context, metadata);
  }

  private async search(
    query: string,
    count: number,
    context: DiscoveryContext | EnrichmentContext,
  ): Promise<BraveWebResult[]> {
    try {
      const response = await fetchWithRetry(
        buildBraveUrl(query, this.config.webSearch, count),
        {
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': this.config.webSearch.apiKey,
          },
        },
        { ...this.httpOptions, metrics: context.metrics, requestCounterKey: 'braveSearchRequests' },
      );
      const json = (await response.json()) as BraveWebSearchResponse;
      return json.web?.results ?? [];
    } catch (error) {
      context.logger.warn('Discovery source failed', {
        sourceId: 'web-search-brave',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async canonicalizeRestaurantRecords(
    records: RawDiscoveryRecord[],
    context: DiscoveryContext,
    metadata: SearchMetadata,
  ): Promise<RawDiscoveryRecord[]> {
    const canonicalizationBudget = Math.max(metadata.dailyTargetNewItems * 2, 4);
    const prioritized = records
      .filter((record) => shouldCanonicalizeRestaurantRecord(record))
      .sort((left, right) => scoreRestaurantCanonicalizationPriority(right) - scoreRestaurantCanonicalizationPriority(left))
      .slice(0, canonicalizationBudget);
    const prioritizedUrls = new Set(prioritized.map((record) => record.url));
    const updated = await Promise.all(
      records.map(async (record) => {
        if (!prioritizedUrls.has(record.url)) {
          return record;
        }

        const match = await this.findCanonicalRestaurantMatch(record, context);

        if (!match?.url) {
          return record;
        }

        const officialSummary = normalizeWhitespace([
          match.description ?? '',
          ...(match.extra_snippets ?? []),
        ].join(' '));

        return {
          ...record,
          url: match.url,
          summary: normalizeWhitespace([officialSummary, record.summary ?? ''].filter(Boolean).join(' ')).slice(0, 320),
          tags: [...new Set([...(record.tags ?? []), 'canonicalized-official', extractDomain(match.url)])],
        };
      }),
    );

    return dedupeByUrl(updated);
  }

  private async findCanonicalRestaurantMatch(
    record: RawDiscoveryRecord,
    context: DiscoveryContext,
  ): Promise<BraveWebResult | undefined> {
    const cacheKey = buildCanonicalRestaurantCacheKey(record);
    const cached = await this.searchPageCache.getCanonical(cacheKey);
    if (isFreshCanonicalCacheEntry(cached)) {
      if (context.metrics) {
        context.metrics.canonicalCacheHits += 1;
      }
      if (!cached?.url) {
        return undefined;
      }
      return {
        title: record.title,
        url: cached.url,
      };
    }

    const query = buildCanonicalRestaurantQueries(record)[0] ?? '';
    const results = await this.search(query, 3, context);
    const match = results.find((result) =>
      isAcceptedCanonicalRestaurantResult(
        result.url ?? '',
        result.title ?? '',
        normalizeWhitespace([result.description ?? '', ...(result.extra_snippets ?? [])].join(' ')),
        record.title,
      ),
    );

    await this.searchPageCache.setCanonical({
      key: cacheKey,
      url: match?.url ?? null,
      updatedAt: new Date().toISOString(),
    });

    if (match) {
      return match;
    }

    return undefined;
  }
}

function buildBraveUrl(query: string, config: WebSearchConfig, count: number): string {
  const url = new URL(BRAVE_SEARCH_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(count, 20)));
  url.searchParams.set('country', config.country);
  url.searchParams.set('search_lang', config.searchLang);
  url.searchParams.set('ui_lang', config.uiLang);
  url.searchParams.set('extra_snippets', 'true');
  url.searchParams.set('safesearch', 'moderate');
  return url.toString();
}

function isSearchEnabledForCategory(config: WebSearchConfig, metadata: SearchMetadata): boolean {
  return config.enabled && config.enabledCategories[metadata.tableName];
}

function extractThemeHints(text: string, metadata: SearchMetadata): string[] {
  const metadataHints = [...metadata.searchFocus, ...metadata.includeTerms].filter((term) =>
    text.includes(term.toLowerCase()),
  );
  const genericHints = ['immersive', 'hidden gem', 'family-friendly', 'rooftop', 'scenic', 'festival']
    .filter((term) => text.includes(term));

  return [...new Set([...metadataHints, ...genericHints])].slice(0, 4);
}

function buildCanonicalRestaurantQueries(record: RawDiscoveryRecord): string[] {
  const location = record.city ?? record.region ?? 'Orange County';
  return [
    `"${record.title}" "${location}" restaurant official site`,
  ];
}

function buildCanonicalRestaurantCacheKey(record: RawDiscoveryRecord): string {
  return `${record.title.trim().toLowerCase()}::${(record.city ?? record.region ?? 'unknown').trim().toLowerCase()}`;
}

function isFreshCanonicalCacheEntry(entry: CachedCanonicalRestaurantEntry | null): boolean {
  if (!entry) {
    return false;
  }

  const updatedAt = Date.parse(entry.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return false;
  }

  const cacheWindowMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - updatedAt < cacheWindowMs;
}

function extractAudienceHints(text: string): string[] {
  const hints = ['families', 'kids', 'date night', 'group-friendly', 'adults'];
  return hints.filter((hint) => text.includes(hint)).slice(0, 3);
}
