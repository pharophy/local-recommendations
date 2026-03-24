import { URL } from 'node:url';

import type { RuntimeConfig, WebSearchConfig } from '../../config/runtime.js';
import type { CandidateEnrichment, ExperienceCandidate, RawDiscoveryRecord } from '../../domain/experience.js';
import type { SearchMetadata } from '../../domain/search-metadata.js';
import { fetchWithRetry, type HttpClientOptions } from '../../utils/http.js';
import { normalizeWhitespace } from '../../utils/strings.js';
import type { CandidateEnricher, DiscoveryContext, DiscoveryProvider, EnrichmentContext } from '../provider.js';
import { buildDiscoveryQueries, buildEnrichmentQueries } from './query-builder.js';
import {
  buildDiscoveryRecordsFromSeed,
  dedupeByUrl,
  extractDomain,
  isAcceptedCanonicalRestaurantResult,
  isAcceptedDiscoveryResult,
  isAcceptedEnrichmentResult,
  shouldCanonicalizeRestaurantRecord,
} from './search-discovery-helpers.js';
import { createDisabledSearchPageCache, type SearchPageCache } from './search-page-cache.js';

const GOOGLE_CUSTOM_SEARCH_ENDPOINT = 'https://customsearch.googleapis.com/customsearch/v1';
const GOOGLE_SOURCE_NAME = 'Google Custom Search';

interface GoogleCustomSearchResponse {
  items?: GoogleCustomSearchItem[];
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
    status?: string;
  };
}

interface GoogleCustomSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
  htmlSnippet?: string;
}

export class GoogleCustomSearchProvider implements DiscoveryProvider, CandidateEnricher {
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
      .filter((result) => isAcceptedEnrichmentResult(result.link ?? '', result.title ?? ''));

    if (accepted.length === 0) {
      return null;
    }

    const snippets = accepted
      .flatMap((result) => [result.snippet ?? '', result.htmlSnippet ?? ''])
      .map((value) => normalizeWhitespace(stripHtml(value)))
      .filter(Boolean)
      .slice(0, 4);
    const domains = [...new Set(accepted.map((result) => extractDomain(result.link ?? '')).filter(Boolean))];
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
      isAcceptedDiscoveryResult(result.link ?? '', result.title ?? '', metadata.tableName),
    );
    const source = {
      id: 'web-search-google',
      name: GOOGLE_SOURCE_NAME,
      url: GOOGLE_CUSTOM_SEARCH_ENDPOINT,
    } as const;
    const records = await Promise.all(
      accepted.map((result) =>
        buildDiscoveryRecordsFromSeed(
          {
            title: normalizeWhitespace(result.title ?? ''),
            url: result.link ?? '',
            summary: normalizeWhitespace(stripHtml(result.snippet ?? result.htmlSnippet ?? '')).slice(0, 320),
            rawDateText: normalizeWhitespace(
              [result.title ?? '', result.snippet ?? '', stripHtml(result.htmlSnippet ?? '')].join(' '),
            ),
          },
          metadata,
          source,
          this.httpOptions,
          context.logger,
          this.searchPageCache,
        ),
      ),
    );

    return this.canonicalizeRestaurantRecords(records.flat(), context);
  }

  private async search(
    query: string,
    count: number,
    context: DiscoveryContext | EnrichmentContext,
  ): Promise<GoogleCustomSearchItem[]> {
    try {
      const url = buildGoogleCustomSearchUrl(query, this.config.webSearch, count);
      const response = await fetchWithRetry(
        url,
        {
          headers: {
            Accept: 'application/json',
          },
        },
        this.httpOptions,
      );
      const json = (await response.json()) as GoogleCustomSearchResponse;
      if (!response.ok) {
        context.logger.warn('Discovery source failed', {
          sourceId: 'web-search-google',
          error: formatGoogleApiError(response.status, json, query),
        });
        return [];
      }

      return json.items ?? [];
    } catch (error) {
      context.logger.warn('Discovery source failed', {
        sourceId: 'web-search-google',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async canonicalizeRestaurantRecords(
    records: RawDiscoveryRecord[],
    context: DiscoveryContext,
  ): Promise<RawDiscoveryRecord[]> {
    const updated = await Promise.all(
      records.map(async (record) => {
        if (!shouldCanonicalizeRestaurantRecord(record)) {
          return record;
        }

        const match = await this.findCanonicalRestaurantMatch(record, context);

        if (!match?.link) {
          return record;
        }

        const officialSummary = normalizeWhitespace(stripHtml(match.snippet ?? match.htmlSnippet ?? ''));

        return {
          ...record,
          url: match.link,
          summary: normalizeWhitespace([officialSummary, record.summary ?? ''].filter(Boolean).join(' ')).slice(0, 320),
          tags: [...new Set([...(record.tags ?? []), 'canonicalized-official', extractDomain(match.link)])],
        };
      }),
    );

    return dedupeByUrl(updated);
  }

  private async findCanonicalRestaurantMatch(
    record: RawDiscoveryRecord,
    context: DiscoveryContext,
  ): Promise<GoogleCustomSearchItem | undefined> {
    for (const query of buildCanonicalRestaurantQueries(record)) {
      const results = await this.search(query, 3, context);
      const match = results.find((result) =>
        isAcceptedCanonicalRestaurantResult(
          result.link ?? '',
          result.title ?? '',
          normalizeWhitespace(stripHtml(result.snippet ?? result.htmlSnippet ?? '')),
          record.title,
        ),
      );
      if (match) {
        return match;
      }
    }

    return undefined;
  }
}

function buildGoogleCustomSearchUrl(query: string, config: WebSearchConfig, count: number): string {
  const url = new URL(GOOGLE_CUSTOM_SEARCH_ENDPOINT);
  url.searchParams.set('key', config.apiKey);
  url.searchParams.set('cx', config.googleCx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(Math.min(count, 10)));
  url.searchParams.set('safe', 'active');
  url.searchParams.set('gl', config.country.toLowerCase());
  url.searchParams.set('hl', config.uiLang);
  url.searchParams.set('lr', config.searchLang.startsWith('lang_') ? config.searchLang : `lang_${config.searchLang}`);
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

function extractAudienceHints(text: string): string[] {
  const hints = ['families', 'kids', 'date night', 'group-friendly', 'adults'];
  return hints.filter((hint) => text.includes(hint)).slice(0, 3);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function formatGoogleApiError(
  status: number,
  json: GoogleCustomSearchResponse,
  query: string,
): string {
  const reason = json.error?.errors?.[0]?.reason ?? json.error?.status ?? 'unknown_error';
  const message = json.error?.errors?.[0]?.message ?? json.error?.message ?? 'No error message returned.';
  const compactQuery = query.length > 120 ? `${query.slice(0, 117)}...` : query;

  if (status === 429 || reason.toLowerCase().includes('quota') || reason.toLowerCase().includes('rate')) {
    return `HTTP ${status} ${reason}: ${message} Query="${compactQuery}". Check Google Cloud Console quota and usage for the Custom Search JSON API.`;
  }

  return `HTTP ${status} ${reason}: ${message} Query="${compactQuery}"`;
}

function buildCanonicalRestaurantQueries(record: RawDiscoveryRecord): string[] {
  const location = record.city ?? record.region ?? 'Orange County';
  return [
    `"${record.title}" "${location}" restaurant official site`,
    `"${record.title}" "${location}" menu`,
    `"${record.title}" "${location}" dining`,
  ];
}
