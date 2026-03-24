import type { ExperienceCategory } from '../domain/categories.js';
import { parseEnv } from './env.js';
import path from 'node:path';

export interface WebSearchConfig {
  enabled: boolean;
  provider: 'none' | 'brave' | 'google';
  apiKey: string;
  googleCx: string;
  country: string;
  searchLang: string;
  uiLang: string;
  maxResultsPerQuery: number;
  maxEnrichmentResults: number;
  maxQueriesPerCategory: number;
  pageCacheEnabled: boolean;
  pageCacheFile: string;
  enabledCategories: Record<ExperienceCategory, boolean>;
}

export interface CuratedSourceConfig {
  enabled: boolean;
  disabledSourceIds: string[];
}

export interface RuntimeConfig {
  env: ReturnType<typeof parseEnv>;
  tableNames: Record<ExperienceCategory | 'SearchMetadata', string>;
  defaultRegionPriority: string[];
  curatedSources: CuratedSourceConfig;
  webSearch: WebSearchConfig;
}

export function createRuntimeConfig(input: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const env = parseEnv(input);
  const baseId = normalizeAirtableBaseId(env.AIRTABLE_BASE_ID);
  const curatedSources: CuratedSourceConfig = {
    enabled: env.CURATED_SOURCES_ENABLED,
    disabledSourceIds: env.DISABLED_CURATED_SOURCE_IDS
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
  const webSearch: WebSearchConfig = {
    enabled: env.WEB_SEARCH_ENABLED && env.WEB_SEARCH_PROVIDER !== 'none',
    provider: env.WEB_SEARCH_PROVIDER,
    apiKey: env.WEB_SEARCH_API_KEY,
    googleCx: env.WEB_SEARCH_GOOGLE_CX,
    country: env.WEB_SEARCH_COUNTRY,
    searchLang: env.WEB_SEARCH_SEARCH_LANG,
    uiLang: env.WEB_SEARCH_UI_LANG,
    maxResultsPerQuery: env.WEB_SEARCH_MAX_RESULTS_PER_QUERY,
    maxEnrichmentResults: env.WEB_SEARCH_MAX_ENRICHMENT_RESULTS,
    maxQueriesPerCategory: env.WEB_SEARCH_MAX_QUERIES_PER_CATEGORY,
    pageCacheEnabled: env.WEB_SEARCH_PAGE_CACHE_ENABLED,
    pageCacheFile: path.resolve(env.WEB_SEARCH_PAGE_CACHE_FILE),
    enabledCategories: {
      Activities: env.WEB_SEARCH_ENABLE_ACTIVITIES,
      Restaurants: env.WEB_SEARCH_ENABLE_RESTAURANTS,
      Nature: env.WEB_SEARCH_ENABLE_NATURE,
      SpecialEvents: env.WEB_SEARCH_ENABLE_SPECIAL_EVENTS,
    },
  };

  if (webSearch.enabled && webSearch.provider === 'brave' && webSearch.apiKey.trim().length === 0) {
    throw new Error('WEB_SEARCH_API_KEY is required when Brave web search is enabled.');
  }

  if (webSearch.enabled && webSearch.provider === 'google') {
    if (webSearch.apiKey.trim().length === 0) {
      throw new Error('WEB_SEARCH_API_KEY is required when Google Custom Search is enabled.');
    }
    if (webSearch.googleCx.trim().length === 0) {
      throw new Error('WEB_SEARCH_GOOGLE_CX is required when Google Custom Search is enabled.');
    }
  }

  return {
    env: {
      ...env,
      AIRTABLE_BASE_ID: baseId,
    },
    tableNames: {
      Activities: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_ACTIVITIES),
      Restaurants: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_RESTAURANTS),
      Nature: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_NATURE),
      SpecialEvents: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_SPECIAL_EVENTS),
      SearchMetadata: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_SEARCH_METADATA),
    },
    defaultRegionPriority: env.DEFAULT_REGION_PRIORITY.split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    curatedSources,
    webSearch,
  };
}

function normalizeAirtableBaseId(value: string): string {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.find((part) => part.startsWith('app')) ?? value.trim();
}

function normalizeAirtableTableIdentifier(value: string): string {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return value.trim();
  }

  return parts.find((part) => part.startsWith('tbl')) ?? parts.at(-1) ?? value.trim();
}
