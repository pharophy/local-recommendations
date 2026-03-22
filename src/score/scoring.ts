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
  const vaguePenalty = candidate.shortDescription.length < 40 ? -4 : 0;
  const duplicateLikePenalty = candidate.name.length < 5 ? -6 : 0;
  const eventBoost =
    candidate.category === 'SpecialEvents'
      ? recencyBoost(candidate.startDate, metadata.dateWindowDays ?? 30, now)
      : 0;

  return (
    uniqueness +
    relevance +
    exclusionPenalty +
    regionBoost +
    familyBoost +
    vaguePenalty +
    duplicateLikePenalty +
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

  return true;
}
