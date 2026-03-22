import type { ExperienceCandidate, RawDiscoveryRecord } from '../domain/experience.js';
import type { SearchMetadata } from '../domain/search-metadata.js';
import { parseLooseDate } from '../utils/dates.js';
import { normalizeText, normalizeWhitespace } from '../utils/strings.js';

export function normalizeCandidate(
  raw: RawDiscoveryRecord,
  metadata: SearchMetadata,
  now = new Date(),
): Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'> {
  const description = normalizeWhitespace(raw.summary ?? raw.title);
  const themes = [...new Set([...(raw.tags ?? []), ...matchThemeTerms(description, metadata)])];
  const startDate =
    raw.category === 'SpecialEvents' ? parseLooseDate(raw.rawDateText)?.toISOString() : undefined;

  const candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'> = {
    category: raw.category,
    name: raw.title,
    region: raw.region ?? metadata.regionPriority[0] ?? 'Orange County',
    city: raw.city ?? raw.region ?? 'Unknown',
    shortDescription: description.slice(0, 280),
    whyUnique: buildWhyUnique(description, themes),
    themes,
    audience: metadata.audienceBias,
    kidFriendly: metadata.kidFocus || themes.some((theme) => theme.includes('kid')),
    indoorOutdoor: metadata.indoorOutdoorBias ?? inferIndoorOutdoor(raw.category),
    priceLevel: metadata.priceBias ?? '$$',
    reservationRecommended: raw.category === 'Restaurants' || raw.category === 'SpecialEvents',
    website: raw.url,
    sourceName: raw.source.name,
    sourceUrl: raw.source.url,
    canonicalUrl: raw.url,
    lastVerifiedAt: now.toISOString(),
    searchFocusSnapshot: [
      ...metadata.searchFocus,
      ...metadata.includeTerms,
      ...metadata.excludeTerms.map((term) => `!${term}`),
    ].join(', '),
    discoveryNotes: `Discovered from ${raw.source.name}`,
    status: 'New',
    createdByBotAt: now.toISOString(),
    visited: false,
  };

  if (raw.city) {
    candidate.neighborhoodOrArea = raw.city;
  }
  if (raw.category === 'Restaurants') {
    candidate.cuisine = inferCuisine(description);
  }
  if (raw.category === 'Nature') {
    candidate.areaType = inferAreaType(description);
    candidate.features = themes;
    candidate.difficulty = inferDifficulty(description);
    candidate.outdoorType = 'Outdoor';
    candidate.parkingNotes = 'Check official site before visiting.';
    candidate.feeNotes = 'Fees may vary by trail or preserve.';
    candidate.bestTime = 'Morning or sunset';
  }
  if (raw.category === 'SpecialEvents') {
    const venue = raw.venue ?? raw.city ?? raw.region;
    if (venue) {
      candidate.venue = venue;
    }
    if (startDate) {
      candidate.startDate = startDate;
      candidate.endDate = startDate;
    }
  }

  return candidate;
}

function matchThemeTerms(description: string, metadata: SearchMetadata): string[] {
  const haystack = description.toLowerCase();
  return [...metadata.searchFocus, ...metadata.includeTerms].filter((term) =>
    haystack.includes(term.toLowerCase()),
  );
}

function buildWhyUnique(description: string, themes: string[]): string {
  if (themes.length > 0) {
    return `Matches discovery focus around ${themes.slice(0, 3).join(', ')}.`;
  }

  return `Stands out based on source description: ${description.slice(0, 120)}`;
}

function inferIndoorOutdoor(category: RawDiscoveryRecord['category']): string {
  if (category === 'Nature') {
    return 'Outdoor';
  }

  if (category === 'Restaurants') {
    return 'Mixed';
  }

  return 'Unknown';
}

function inferCuisine(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('taco') || lower.includes('mexic')) {
    return 'Mexican';
  }
  if (lower.includes('sushi') || lower.includes('ramen')) {
    return 'Japanese';
  }
  if (lower.includes('steak') || lower.includes('grill')) {
    return 'Steakhouse';
  }
  return 'Unknown';
}

function inferAreaType(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('trail')) {
    return 'Trail';
  }
  if (lower.includes('beach')) {
    return 'Beach';
  }
  if (lower.includes('park')) {
    return 'Park';
  }
  return 'Natural Area';
}

function inferDifficulty(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('easy')) {
    return 'Easy';
  }
  if (lower.includes('moderate')) {
    return 'Moderate';
  }
  if (lower.includes('hard')) {
    return 'Hard';
  }
  return 'Unknown';
}

export function normalizedNameForDedupe(name: string): string {
  return normalizeText(name);
}
