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

export interface CategoryDiscoveryResult {
  category: ExperienceCategory;
  inserted: ExperienceCandidate[];
  skippedDuplicates: ExperienceCandidate[];
  rejected: ExperienceCandidate[];
  warnings: string[];
  discoveredCount: number;
}

export interface DailyRunSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  results: CategoryDiscoveryResult[];
  warnings: string[];
}
