import type { ExperienceCategory } from '../../domain/categories.js';
import type { ExperienceCandidate } from '../../domain/experience.js';
import type { SearchMetadata } from '../../domain/search-metadata.js';

const CATEGORY_BASE_TERMS: Record<ExperienceCategory, readonly [string, ...string[]]> = {
  Activities: ['unique activities', 'things to do', 'hands-on experiences'],
  Restaurants: ['immersive dining', 'themed restaurant', 'hidden gem restaurant'],
  Nature: ['nature preserve', 'park trail', 'outdoors'],
  SpecialEvents: ['events', 'festival', 'limited-run event'],
};

const CATEGORY_QUALIFIERS: Record<ExperienceCategory, string> = {
  Activities: 'official site',
  Restaurants: 'official site',
  Nature: 'official site',
  SpecialEvents: 'official site',
};

export function buildDiscoveryQueries(
  metadata: SearchMetadata,
  maxQueries: number,
): string[] {
  if (metadata.tableName === 'Restaurants') {
    return buildRestaurantDiscoveryQueries(metadata, maxQueries);
  }

  const regions = metadata.regionPriority.slice(0, 2);
  const baseTerms = CATEGORY_BASE_TERMS[metadata.tableName];
  const focusTerms = [...metadata.searchFocus, ...metadata.includeTerms].slice(0, 2);
  const audienceTerms = metadata.audienceBias.slice(0, 1);
  const biasTerms = [metadata.indoorOutdoorBias, metadata.priceBias].filter(isNonEmptyString).slice(0, 2);
  const sourceHints = splitSourcePriorityNotes(metadata.sourcePriorityNotes).slice(0, 2);
  const queries: string[] = [];

  for (const region of regions) {
    for (const baseTerm of baseTerms) {
      queries.push(joinQueryParts([region, baseTerm, CATEGORY_QUALIFIERS[metadata.tableName]]));
    }

    for (const focusTerm of focusTerms) {
      queries.push(
        joinQueryParts([region, focusTerm, baseTerms[0], CATEGORY_QUALIFIERS[metadata.tableName]]),
      );
    }

    for (const audienceTerm of audienceTerms) {
      queries.push(joinQueryParts([region, audienceTerm, baseTerms[0], CATEGORY_QUALIFIERS[metadata.tableName]]));
    }

    for (const biasTerm of biasTerms) {
      queries.push(joinQueryParts([region, biasTerm, baseTerms[0], CATEGORY_QUALIFIERS[metadata.tableName]]));
    }

    for (const sourceHint of sourceHints) {
      queries.push(joinQueryParts([region, sourceHint, baseTerms[0], CATEGORY_QUALIFIERS[metadata.tableName]]));
    }
  }

  return finalizeQueries(queries, metadata.excludeTerms, maxQueries);
}

function buildRestaurantDiscoveryQueries(metadata: SearchMetadata, maxQueries: number): string[] {
  const regions = metadata.regionPriority.slice(0, 2);
  const experienceModes = [
    'immersive dining',
    'themed restaurant',
    'hidden gem restaurant',
    'dessert experience',
    'chef tasting menu',
    'speakeasy dining',
  ];
  const focusTerms = [...metadata.searchFocus, ...metadata.includeTerms].slice(0, 3);
  const audienceTerms = metadata.audienceBias.slice(0, 1);
  const sourceHints = splitSourcePriorityNotes(metadata.sourcePriorityNotes).slice(0, 1);
  const queries: string[] = [];

  for (const region of regions) {
    for (const mode of experienceModes) {
      queries.push(joinQueryParts([region, mode, 'official site']));
    }

    for (const focusTerm of focusTerms) {
      queries.push(joinQueryParts([region, focusTerm, 'restaurant', 'official site']));
      queries.push(joinQueryParts([region, focusTerm, 'hidden gem dining']));
    }

    queries.push(joinQueryParts([region, 'local favorite', 'restaurant', 'official site']));
    queries.push(joinQueryParts([region, 'outstanding dessert concept', 'official site']));

    for (const audienceTerm of audienceTerms) {
      queries.push(joinQueryParts([region, audienceTerm, 'immersive dining']));
    }

    for (const sourceHint of sourceHints) {
      queries.push(joinQueryParts([region, sourceHint, 'unique dining']));
    }
  }

  return finalizeQueries(queries, metadata.excludeTerms, maxQueries);
}

export function buildEnrichmentQueries(
  candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>,
  maxQueries: number,
): string[] {
  const baseParts = [`"${candidate.name}"`];
  const location = candidate.city || candidate.region;
  if (location) {
    baseParts.push(`"${location}"`);
  }
  const base = baseParts.join(' ');

  const queries = [
    `${base} reviews`,
    `${base} blog`,
    `${base} reddit`,
  ];

  return finalizeQueries(queries, [], maxQueries);
}

function finalizeQueries(queries: string[], excludeTerms: string[], maxQueries: number): string[] {
  const deduped = [...new Set(queries.map((query) => applyExcludeTerms(query, excludeTerms).trim()).filter(Boolean))];
  return deduped.slice(0, maxQueries);
}

function applyExcludeTerms(query: string, excludeTerms: string[]): string {
  if (excludeTerms.length === 0) {
    return query;
  }

  return `${query} ${excludeTerms.slice(0, 3).map((term) => `-"${term}"`).join(' ')}`.trim();
}

function joinQueryParts(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(' ');
}

function splitSourcePriorityNotes(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\n;|]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
