import type { ExperienceCandidate, RawDiscoveryRecord } from '../domain/experience.js';
import type { SearchMetadata } from '../domain/search-metadata.js';
import { parseLooseDate } from '../utils/dates.js';
import { normalizeRegionLabel, normalizeText, normalizeWhitespace } from '../utils/strings.js';

export function normalizeCandidate(
  raw: RawDiscoveryRecord,
  metadata: SearchMetadata,
  now = new Date(),
): Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'> {
  const inferredLocation =
    raw.category === 'SpecialEvents'
      ? inferLocationFromText(`${raw.title} ${raw.summary ?? ''} ${raw.url}`)
      : raw.category === 'Nature'
        ? inferNatureLocation(raw)
        : undefined;
  const normalizedTitle =
    raw.category === 'SpecialEvents' ? normalizeEventTitle(raw.title) : normalizeWhitespace(raw.title);
  const description = normalizeWhitespace(raw.summary ?? raw.title);
  const themes = [...new Set([...(raw.tags ?? []), ...matchThemeTerms(description, metadata)])];
  const startDate =
    raw.category === 'SpecialEvents' ? parseLooseDate(raw.rawDateText)?.toISOString() : undefined;
  const city = raw.city ?? inferredLocation?.city ?? raw.region ?? 'Unknown';
  const region =
    normalizeRegionLabel(
      inferredLocation?.region ??
      inferRegionFromCity(city) ??
      raw.region ??
      metadata.regionPriority[0] ??
      'Orange County',
    );

  const candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'> = {
    category: raw.category,
    name: normalizedTitle,
    region,
    city,
    shortDescription: description.slice(0, 280),
    whyUnique: buildWhyUnique(raw.category, normalizedTitle, description, themes),
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
    discoveryNotes:
      raw.provenance === 'search'
        ? `Discovered via web search from ${raw.source.name}`
        : `Discovered from ${raw.source.name}`,
    status: 'New',
    createdByBotAt: now.toISOString(),
    visited: false,
    provenance: raw.provenance ?? 'curated',
    enrichmentScoreBoost: 0,
  };

  if (city) {
    candidate.neighborhoodOrArea = city;
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

interface InferredLocation {
  city?: string;
  region?: string;
}

const CITY_REGION_MAP: Record<string, string> = {
  anaheim: 'Orange County',
  'aliso viejo': 'Orange County',
  brea: 'Orange County',
  'buena park': 'Orange County',
  'costa mesa': 'Orange County',
  'coto de caza': 'Orange County',
  cypress: 'Orange County',
  'dana point': 'Orange County',
  'fountain valley': 'Orange County',
  fullerton: 'Orange County',
  'garden grove': 'Orange County',
  'huntington beach': 'Orange County',
  irvine: 'Orange County',
  'laguna beach': 'Orange County',
  'laguna niguel': 'Orange County',
  'lake forest': 'Orange County',
  'los alamitos': 'Orange County',
  'mission viejo': 'Orange County',
  'newport beach': 'Orange County',
  orange: 'Orange County',
  'rancho santa margarita': 'Orange County',
  silverado: 'Orange County',
  'san clemente': 'Orange County',
  'san juan capistrano': 'Orange County',
  'santa ana': 'Orange County',
  'seal beach': 'Orange County',
  'trabuco canyon': 'Orange County',
  tustin: 'Orange County',
  westminster: 'Orange County',
  'yorba linda': 'Orange County',
  'beverly hills': 'Los Angeles',
  burbank: 'Los Angeles',
  'downtown los angeles': 'Los Angeles',
  glendale: 'Los Angeles',
  hollywood: 'Los Angeles',
  'long beach': 'Los Angeles',
  'los angeles': 'Los Angeles',
  'marina del rey': 'Los Angeles',
  'monterey park': 'Los Angeles',
  pasadena: 'Los Angeles',
  'santa monica': 'Los Angeles',
  'west hollywood': 'Los Angeles',
  temecula: 'Temecula',
  carlsbad: 'San Diego',
  'la jolla': 'San Diego',
  oceanside: 'San Diego',
  'san diego': 'San Diego',
};

const OUT_OF_REGION_CITY_MAP: Record<string, string> = {
  'big bear lake': 'Out of Region',
  coachella: 'Out of Region',
  'cathedral city': 'Out of Region',
  indio: 'Out of Region',
  'las vegas': 'Out of Region',
  'palm desert': 'Out of Region',
  'palm springs': 'Out of Region',
  'rancho mirage': 'Out of Region',
  'santa barbara': 'Out of Region',
};

const LOCATION_REGION_MAP = {
  ...CITY_REGION_MAP,
  ...OUT_OF_REGION_CITY_MAP,
};

const LOCATION_NAMES = Object.keys(LOCATION_REGION_MAP).sort((left, right) => right.length - left.length);

const NATURE_AREA_HINTS: Array<{ pattern: RegExp; city: string }> = [
  { pattern: /\baliso(?: and)? wood canyons\b/i, city: 'Laguna Niguel' },
  { pattern: /\bcarbon canyon\b/i, city: 'Brea' },
  { pattern: /\bcaspers\b/i, city: 'San Juan Capistrano' },
  { pattern: /\bcraig regional park\b/i, city: 'Fullerton' },
  { pattern: /\bfeatherly regional park\b/i, city: 'Anaheim' },
  { pattern: /\bharriett m(?:\.|rs)? wieder\b/i, city: 'Huntington Beach' },
  { pattern: /\birvine lake\b/i, city: 'Silverado' },
  { pattern: /\blaguna coast\b/i, city: 'Laguna Beach' },
  { pattern: /\bmason regional park\b/i, city: 'Irvine' },
  { pattern: /\bmile square\b/i, city: 'Fountain Valley' },
  { pattern: /\boak canyon nature center\b/i, city: 'Anaheim' },
  { pattern: /\bo[’']?neill regional park\b/i, city: 'Trabuco Canyon' },
  { pattern: /\bpeters canyon\b/i, city: 'Orange' },
  { pattern: /\briley wilderness\b/i, city: 'Coto de Caza' },
  { pattern: /\bupper newport bay\b/i, city: 'Newport Beach' },
  { pattern: /\bwhiting ranch\b/i, city: 'Lake Forest' },
  { pattern: /\byorba regional park\b/i, city: 'Anaheim' },
];

function inferCityFromText(text: string): string | undefined {
  const lower = normalizeLocationText(text);
  const match = LOCATION_NAMES.find((city) => lower.includes(city));
  return match ? toTitleCase(match) : undefined;
}

function inferRegionFromCity(city: string | undefined): string | undefined {
  if (!city) {
    return undefined;
  }

  return LOCATION_REGION_MAP[city.toLowerCase()];
}

function inferLocationFromText(text: string): InferredLocation | undefined {
  const city = inferCityFromText(text);
  if (!city) {
    return undefined;
  }

  const region = inferRegionFromCity(city);
  return region ? { city, region } : { city };
}

function inferNatureLocation(raw: RawDiscoveryRecord): InferredLocation | undefined {
  const baseText = `${raw.title} ${raw.summary ?? ''} ${raw.url}`;
  const inferred = inferLocationFromText(baseText);
  if (inferred?.city && inferred.region !== 'Out of Region') {
    return inferred;
  }

  const lower = normalizeLocationText(baseText);
  const hinted = NATURE_AREA_HINTS.find((hint) => hint.pattern.test(lower));
  if (!hinted) {
    return inferred;
  }

  const region = inferRegionFromCity(hinted.city);
  return region ? { city: hinted.city, region } : { city: hinted.city };
}

function normalizeEventTitle(title: string): string {
  let cleaned = normalizeWhitespace(title);

  cleaned = cleaned.replace(/^([^:]{3,80}?)\s+\1:\s*/i, '$1: ');
  cleaned = collapseRepeatedPrefix(cleaned);
  cleaned = cleaned.replace(/\d\.\d\(\d+\)/g, '');
  cleaned = cleaned.replace(/\bfrom \$\d+(?:\.\d{2})?\b/gi, '');
  cleaned = cleaned.replace(/\$\d+(?:\.\d{2})?\b/g, '');
  cleaned = cleaned.replace(
    /\b\d{1,2}(?:\s*-\s*\d{1,2})?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b(?:\s*-\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b)?/gi,
    '',
  );
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned.replace(/\s+[:,-]\s*$/, '').trim();
}

function collapseRepeatedPrefix(value: string): string {
  const words = value.split(' ');
  const maxPrefixSize = Math.min(Math.floor(words.length / 2), 8);

  for (let size = maxPrefixSize; size >= 2; size -= 1) {
    const first = words.slice(0, size).join(' ');
    const second = words.slice(size, size * 2).join(' ');
    if (first.toLowerCase() === second.toLowerCase()) {
      return [first, ...words.slice(size * 2)].join(' ').trim();
    }
  }

  return value;
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeLocationText(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[-_/]+/g, ' ');
}

function matchThemeTerms(description: string, metadata: SearchMetadata): string[] {
  const haystack = description.toLowerCase();
  return [...metadata.searchFocus, ...metadata.includeTerms].filter((term) =>
    haystack.includes(term.toLowerCase()),
  );
}

function buildWhyUnique(
  category: RawDiscoveryRecord['category'],
  title: string,
  description: string,
  themes: string[],
): string {
  if (category === 'Restaurants') {
    const evidence = extractRestaurantExperienceEvidence(title, description, themes);
    if (evidence.length > 0) {
      return `Notable for ${evidence.slice(0, 2).join(' and ')}.`;
    }

    return 'Restaurant page lacks concrete evidence of a distinctive dining experience.';
  }

  if (themes.length > 0) {
    return `Matches discovery focus around ${themes.slice(0, 3).join(', ')}.`;
  }

  return `Stands out based on source description: ${description.slice(0, 120)}`;
}

function extractRestaurantExperienceEvidence(
  title: string,
  description: string,
  themes: string[],
): string[] {
  const haystack = `${title} ${description} ${themes.join(' ')}`.toLowerCase();
  const evidence: string[] = [];

  if (haystack.includes('immersive') || haystack.includes('transportive') || haystack.includes('interactive')) {
    evidence.push('an immersive concept');
  }
  if (
    haystack.includes('themed') ||
    haystack.includes('storytelling') ||
    haystack.includes('five-element') ||
    haystack.includes('tiki')
  ) {
    evidence.push('a strongly themed atmosphere');
  }
  if (
    haystack.includes('soft serve') ||
    haystack.includes('boba') ||
    haystack.includes('dessert lab') ||
    haystack.includes('ice cream') ||
    haystack.includes('liquid nitrogen')
  ) {
    evidence.push('a standout dessert-driven concept');
  }
  if (haystack.includes('speakeasy') || haystack.includes('hidden gem') || haystack.includes('hidden bar')) {
    evidence.push('a hidden-gem feel');
  }
  if (
    haystack.includes('chef tasting') ||
    haystack.includes('tasting menu') ||
    haystack.includes('culinary theater') ||
    (haystack.includes('omakase') &&
      (haystack.includes('counter') || haystack.includes('intimate') || haystack.includes('multi-course')))
  ) {
    evidence.push('a chef-led tasting format');
  }
  if (haystack.includes('tableside') || haystack.includes('dramatic presentation') || haystack.includes('theatrical')) {
    evidence.push('theatrical presentation');
  }
  if (
    haystack.includes('panoramic views') ||
    haystack.includes('waterfront') ||
    haystack.includes('hilltop') ||
    haystack.includes('rooftop')
  ) {
    evidence.push('a destination-worthy setting');
  }
  if (
    haystack.includes('18-seat') ||
    haystack.includes('chef-inspired') ||
    haystack.includes('sommelier pairings') ||
    haystack.includes('hidden lounge')
  ) {
    evidence.push('an intimate experience-driven format');
  }
  if (haystack.includes('one-of-a-kind') || haystack.includes('cult favorite') || haystack.includes('local favorite')) {
    evidence.push('a hard-to-find local favorite reputation');
  }

  return [...new Set(evidence)];
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
