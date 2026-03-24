import type { ExperienceCandidate } from '../domain/experience.js';
import type { SearchMetadata } from '../domain/search-metadata.js';
import { isDateWithinDays, recencyBoost } from '../utils/dates.js';

const UNIQUENESS_TERMS = [
  'immersive',
  'themed',
  'hidden',
  'limited',
  'festival',
  'scenic',
  'waterfall',
  'cave',
  'overlook',
  'hands-on',
] as const;
const RESTAURANT_EXPERIENCE_TERMS = [
  'multi-sensory',
  'transportive',
  'tableside',
  'dramatic presentation',
  'dessert lab',
  'liquid nitrogen',
  'chef tasting',
  'omakase',
  'speakeasy',
  'storytelling',
  'interactive',
  'cult favorite',
  'local favorite',
  'one-of-a-kind',
] as const;
const RESTAURANT_GENERIC_TERMS = [
  'food news',
  'dining guides',
  'price points',
  'brunch spots',
  'latest',
  'tastiest',
  'restaurant guide',
] as const;

const NON_SPECIFIC_NAME_PATTERNS: Record<ExperienceCandidate['category'], RegExp[]> = {
  Activities: [
    /\bbeaches\b/i,
    /\bthings to do\b/i,
    /\bshopping\b/i,
    /\btheme parks\b/i,
    /\bguide\b/i,
  ],
  Restaurants: [
    /\bbest\b/i,
    /\bguide\b/i,
    /\brestaurants\b/i,
    /\bdishes\b/i,
    /\beat [&] drink\b/i,
    /\beat and drink\b/i,
    /\bbrunches\b/i,
    /\bwineries\b/i,
    /\bbreweries\b/i,
    /\bwhere to get\b/i,
    /\bhot .* openings\b/i,
    /\brestaurant openings?\b/i,
    /\bincoming[:\s]/i,
    /\bopens?\b/i,
    /\bopening\b/i,
    /\bbrings?\b/i,
    /\blands?\b/i,
    /\bheads?\b/i,
    /\bcelebrates?\b/i,
    /\.\.\.$/i,
  ],
  Nature: [
    /\bbeaches\b/i,
    /\bparks and trails\b/i,
  ],
  SpecialEvents: [],
};

const NON_SPECIFIC_URL_PATTERNS: Record<ExperienceCandidate['category'], RegExp[]> = {
  Activities: [/\/things-to-do\/$/i],
  Restaurants: [/\/the-guide-/i, /\/best-/i, /\/eat-drink\/the-/i],
  Nature: [],
  SpecialEvents: [],
};

export function filterAndScoreCandidates(
  candidates: Array<Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>>,
  metadata: SearchMetadata,
  now = new Date(),
): ExperienceCandidate[] {
  return candidates
    .filter((candidate) => passesFilters(candidate, metadata, now))
    .map((candidate) => ({
      ...candidate,
      botScore: scoreCandidate(candidate, metadata, now),
      duplicateKey: '',
    }))
    .sort((left, right) => right.botScore - left.botScore);
}

export function scoreCandidate(
  candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>,
  metadata: SearchMetadata,
  now = new Date(),
): number {
  const haystack = [
    candidate.name,
    candidate.shortDescription,
    candidate.whyUnique,
    candidate.themes.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  const uniqueness = UNIQUENESS_TERMS.reduce(
    (score, term) => (haystack.includes(term) ? score + 2 : score),
    5,
  );
  const restaurantExperienceBoost =
    candidate.category === 'Restaurants'
      ? RESTAURANT_EXPERIENCE_TERMS.reduce(
          (score, term) => (haystack.includes(term) ? score + 4 : score),
          0,
        )
      : 0;
  const restaurantGenericPenalty =
    candidate.category === 'Restaurants'
      ? RESTAURANT_GENERIC_TERMS.reduce(
          (score, term) => (haystack.includes(term) ? score - 5 : score),
          0,
        )
      : 0;
  const relevance = [...metadata.searchFocus, ...metadata.includeTerms].reduce(
    (score, term) => (haystack.includes(term.toLowerCase()) ? score + 3 : score),
    0,
  );
  const exclusionPenalty = metadata.excludeTerms.reduce(
    (score, term) => (haystack.includes(term.toLowerCase()) ? score - 6 : score),
    0,
  );
  const regionIndex = metadata.regionPriority.findIndex(
    (region) => region.toLowerCase() === candidate.region.toLowerCase(),
  );
  const regionBoost = regionIndex === -1 ? 0 : Math.max(0, 8 - regionIndex * 2);
  const familyBoost = metadata.kidFocus && candidate.kidFriendly ? 4 : 0;
  const indoorOutdoorBoost = scoreIndoorOutdoorBias(candidate.indoorOutdoor, metadata.indoorOutdoorBias);
  const priceBoost = scorePriceBias(candidate.priceLevel, metadata.priceBias);
  const sourceBoost = scoreSourcePriority(candidate, metadata.sourcePriorityNotes);
  const enrichmentBoost = Math.min(Math.max(candidate.enrichmentScoreBoost ?? 0, 0), 3);
  const vaguePenalty = candidate.shortDescription.length < 40 ? -4 : 0;
  const duplicateLikePenalty = candidate.name.length < 5 ? -6 : 0;
  const uniquenessEvidencePenalty =
    candidate.category === 'Restaurants' &&
    candidate.provenance === 'search' &&
    !hasStrongRestaurantExperienceEvidence(candidate)
      ? -10
      : 0;
  const eventBoost =
    candidate.category === 'SpecialEvents'
      ? recencyBoost(candidate.startDate, metadata.dateWindowDays ?? 30, now)
      : 0;

  return (
    uniqueness +
    restaurantExperienceBoost +
    restaurantGenericPenalty +
    relevance +
    exclusionPenalty +
    regionBoost +
    familyBoost +
    indoorOutdoorBoost +
    priceBoost +
    sourceBoost +
    enrichmentBoost +
    vaguePenalty +
    duplicateLikePenalty +
    uniquenessEvidencePenalty +
    eventBoost
  );
}

export function passesFilters(
  candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>,
  metadata: SearchMetadata,
  now = new Date(),
): boolean {
  const haystack = [
    candidate.name,
    candidate.shortDescription,
    candidate.whyUnique,
    candidate.themes.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  const excluded = metadata.excludeTerms.some((term) => haystack.includes(term.toLowerCase()));
  if (excluded) {
    return false;
  }

  if (
    candidate.category === 'SpecialEvents' &&
    !isDateWithinDays(candidate.startDate, metadata.dateWindowDays ?? 30, now)
  ) {
    return false;
  }

  if (candidate.category === 'SpecialEvents' && candidate.region === 'Out of Region') {
    return false;
  }

  if (!isSpecificCandidate(candidate)) {
    return false;
  }

  if (
    candidate.category === 'Restaurants' &&
    candidate.provenance === 'search' &&
    !hasStrongRestaurantExperienceEvidence(candidate)
  ) {
    return false;
  }

  return true;
}

function isSpecificCandidate(candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>): boolean {
  const name = candidate.name.trim();
  if (!name) {
    return false;
  }

  const lowerName = name.toLowerCase();
  const lowerWebsite = candidate.website.toLowerCase();

  if (
    lowerName.startsWith('eat & drink in ') ||
    lowerName.startsWith('eat and drink in ') ||
    lowerName.startsWith("la's best ") ||
    lowerName === 'food & drink'
  ) {
    return false;
  }

  return !(
    NON_SPECIFIC_NAME_PATTERNS[candidate.category].some((pattern) => pattern.test(name)) ||
    NON_SPECIFIC_URL_PATTERNS[candidate.category].some((pattern) => pattern.test(lowerWebsite))
  );
}

function scoreIndoorOutdoorBias(candidateValue: string, bias: string | null): number {
  if (!bias) {
    return 0;
  }

  const normalizedBias = normalizeBiasToken(bias);
  const normalizedCandidate = normalizeBiasToken(candidateValue);
  if (!normalizedBias || !normalizedCandidate) {
    return 0;
  }

  if (normalizedCandidate === normalizedBias) {
    return 3;
  }

  if (normalizedCandidate === 'mixed') {
    return 1;
  }

  return -2;
}

function scorePriceBias(candidateValue: string, bias: string | null): number {
  if (!bias) {
    return 0;
  }

  const normalizedBias = normalizePriceTier(bias);
  const normalizedCandidate = normalizePriceTier(candidateValue);
  if (!normalizedBias || !normalizedCandidate) {
    return 0;
  }

  if (normalizedBias === normalizedCandidate) {
    return 3;
  }

  if (Math.abs(normalizedBias - normalizedCandidate) === 1) {
    return 1;
  }

  return -2;
}

function scoreSourcePriority(
  candidate: Pick<ExperienceCandidate, 'sourceName' | 'sourceUrl'>,
  notes: string | null,
): number {
  if (!notes) {
    return 0;
  }

  const haystack = `${candidate.sourceName} ${candidate.sourceUrl}`.toLowerCase();
  const terms = notes
    .split(/[,\n;|]/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 3);

  if (terms.length === 0) {
    return 0;
  }

  const matches = terms.filter((term) => haystack.includes(term)).length;
  return Math.min(matches * 2, 6);
}

function normalizeBiasToken(value: string): 'indoor' | 'outdoor' | 'mixed' | null {
  const lower = value.trim().toLowerCase();
  if (!lower) {
    return null;
  }
  if (lower.includes('mixed')) {
    return 'mixed';
  }
  if (lower.includes('indoor')) {
    return 'indoor';
  }
  if (lower.includes('outdoor')) {
    return 'outdoor';
  }

  return null;
}

function normalizePriceTier(value: string): number | null {
  const lower = value.trim().toLowerCase();
  if (!lower) {
    return null;
  }
  if (lower.includes('free')) {
    return 0;
  }
  if (lower.includes('budget') || lower.includes('cheap')) {
    return 1;
  }
  if (lower.includes('moderate') || lower.includes('mid')) {
    return 2;
  }
  if (lower.includes('premium') || lower.includes('luxury') || lower.includes('splurge')) {
    return 4;
  }

  const dollarCount = (value.match(/\$/g) ?? []).length;
  if (dollarCount > 0) {
    return Math.min(dollarCount, 4);
  }

  return null;
}

function hasStrongRestaurantExperienceEvidence(
  candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>,
): boolean {
  if (candidate.category !== 'Restaurants') {
    return true;
  }

  const haystack = [
    candidate.name,
    candidate.shortDescription,
    candidate.whyUnique,
    candidate.themes.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  const strongSignals = [
    ...UNIQUENESS_TERMS,
    ...RESTAURANT_EXPERIENCE_TERMS,
    'hidden gem',
    'outstanding',
    'worth seeking out',
    'dessert experience',
    'theatrical',
    'experience-driven',
  ];
  const matched = strongSignals.filter((term) => haystack.includes(term)).length;

  return matched >= 2 || candidate.whyUnique.toLowerCase().startsWith('notable for ');
}
