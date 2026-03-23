import type { ExistingExperienceRef, ExperienceCandidate } from '../domain/experience.js';
import { normalizeText } from '../utils/strings.js';

export function buildDuplicateKey(
  category: ExperienceCandidate['category'],
  name: string,
  city: string,
  region: string,
  canonicalUrl: string,
  sourceUrl: string,
): string {
  return [
    normalizeText(category),
    normalizeText(name),
    normalizeText(city || region),
    normalizeText(canonicalUrl || sourceUrl),
  ].join('::');
}

export function isObviousDuplicate(
  candidate: Pick<ExperienceCandidate, 'name' | 'city'>,
  existing: ExistingExperienceRef,
): boolean {
  return (
    normalizeText(candidate.name) === normalizeText(existing.name) &&
    normalizeText(candidate.city) === normalizeText(existing.city)
  );
}

export function applyDuplicateKeys(candidates: ExperienceCandidate[]): ExperienceCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    duplicateKey: buildDuplicateKey(
      candidate.category,
      candidate.name,
      candidate.city,
      candidate.region,
      candidate.canonicalUrl,
      candidate.sourceUrl,
    ),
  }));
}

export function partitionDuplicates(
  candidates: ExperienceCandidate[],
  existing: ExistingExperienceRef[],
): {
  unique: ExperienceCandidate[];
  duplicates: ExperienceCandidate[];
} {
  const unique: ExperienceCandidate[] = [];
  const duplicates: ExperienceCandidate[] = [];
  const seenDuplicateKeys = new Set(
    existing.map((row) => row.duplicateKey).filter((value): value is string => value.length > 0),
  );
  const seenNameCity = new Set(
    existing.map((row) => `${normalizeText(row.name)}::${normalizeText(row.city)}`),
  );

  for (const candidate of candidates) {
    const nameCityKey = `${normalizeText(candidate.name)}::${normalizeText(candidate.city)}`;
    const duplicate =
      seenDuplicateKeys.has(candidate.duplicateKey) || seenNameCity.has(nameCityKey);

    if (duplicate) {
      duplicates.push(candidate);
    } else {
      seenDuplicateKeys.add(candidate.duplicateKey);
      seenNameCity.add(nameCityKey);
      unique.push(candidate);
    }
  }

  return { unique, duplicates };
}
