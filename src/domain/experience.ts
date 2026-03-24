import type { ExperienceCategory } from './categories.js';

export interface DiscoverySourceRef {
  id: string;
  name: string;
  url: string;
}

export interface RawDiscoveryRecord {
  category: ExperienceCategory;
  source: DiscoverySourceRef;
  title: string;
  url: string;
  summary?: string;
  city?: string;
  region?: string;
  venue?: string;
  tags?: string[];
  rawDateText?: string;
  provenance?: 'curated' | 'search';
}

export interface ExperienceCandidate {
  category: ExperienceCategory;
  name: string;
  region: string;
  city: string;
  neighborhoodOrArea?: string;
  shortDescription: string;
  whyUnique: string;
  themes: string[];
  audience: string[];
  kidFriendly: boolean;
  indoorOutdoor: string;
  priceLevel: string;
  reservationRecommended: boolean;
  website: string;
  sourceName: string;
  sourceUrl: string;
  canonicalUrl: string;
  botScore: number;
  lastVerifiedAt: string;
  duplicateKey: string;
  searchFocusSnapshot: string;
  discoveryNotes: string;
  status: string;
  createdByBotAt: string;
  visited: boolean;
  provenance?: 'curated' | 'search';
  enrichmentScoreBoost?: number;
  myRating?: number;
  myComments?: string;
  cuisine?: string;
  areaType?: string;
  features?: string[];
  difficulty?: string;
  outdoorType?: string;
  parkingNotes?: string;
  feeNotes?: string;
  bestTime?: string;
  venue?: string;
  startDate?: string;
  endDate?: string;
}

export interface ExistingExperienceRef {
  duplicateKey: string;
  name: string;
  city: string;
  region: string;
}

export interface RequestMetrics {
  braveSearchRequests: number;
  googleSearchRequests: number;
  searchPageFetchRequests: number;
  curatedPageFetchRequests: number;
  airtableRequests: number;
  smtpRequests: number;
  httpRetries: number;
  seedCacheSkips: number;
  canonicalCacheHits: number;
}

export interface CategoryDiscoveryResult {
  category: ExperienceCategory;
  inserted: ExperienceCandidate[];
  skippedDuplicates: ExperienceCandidate[];
  rejected: ExperienceCandidate[];
  warnings: string[];
  discoveredCount: number;
  requestMetrics: RequestMetrics;
}

export interface DailyRunSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  results: CategoryDiscoveryResult[];
  warnings: string[];
  requestMetrics: RequestMetrics;
}

export interface CandidateEnrichment {
  summaryFragments: string[];
  themeHints: string[];
  audienceHints: string[];
  noteFragments: string[];
  scoreBoost: number;
}

export function createEmptyRequestMetrics(): RequestMetrics {
  return {
    braveSearchRequests: 0,
    googleSearchRequests: 0,
    searchPageFetchRequests: 0,
    curatedPageFetchRequests: 0,
    airtableRequests: 0,
    smtpRequests: 0,
    httpRetries: 0,
    seedCacheSkips: 0,
    canonicalCacheHits: 0,
  };
}

export function addRequestMetrics(...metricsList: RequestMetrics[]): RequestMetrics {
  return metricsList.reduce(
    (accumulator, metrics) => ({
      braveSearchRequests: accumulator.braveSearchRequests + metrics.braveSearchRequests,
      googleSearchRequests: accumulator.googleSearchRequests + metrics.googleSearchRequests,
      searchPageFetchRequests: accumulator.searchPageFetchRequests + metrics.searchPageFetchRequests,
      curatedPageFetchRequests: accumulator.curatedPageFetchRequests + metrics.curatedPageFetchRequests,
      airtableRequests: accumulator.airtableRequests + metrics.airtableRequests,
      smtpRequests: accumulator.smtpRequests + metrics.smtpRequests,
      httpRetries: accumulator.httpRetries + metrics.httpRetries,
      seedCacheSkips: accumulator.seedCacheSkips + metrics.seedCacheSkips,
      canonicalCacheHits: accumulator.canonicalCacheHits + metrics.canonicalCacheHits,
    }),
    createEmptyRequestMetrics(),
  );
}
