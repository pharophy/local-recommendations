import { describe, expect, it } from 'vitest';

import { buildDiscoveryQueries, buildEnrichmentQueries } from '../src/discovery/search/query-builder.js';
import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';

describe('buildDiscoveryQueries', () => {
  it('builds deterministic queries from metadata across all categories', () => {
    const restaurants = buildDiscoveryQueries(
      buildDefaultSearchMetadata('Restaurants', {
        regionPriority: ['Orange County', 'Los Angeles'],
        searchFocus: ['immersive dining'],
        includeTerms: ['rooftop'],
        audienceBias: ['date night'],
        indoorOutdoorBias: 'Outdoor',
        priceBias: '$$',
        sourcePriorityNotes: 'opentable, eater',
        excludeTerms: ['chain'],
      }),
      8,
    );

    const nature = buildDiscoveryQueries(
      buildDefaultSearchMetadata('Nature', {
        regionPriority: ['Orange County'],
        searchFocus: ['waterfalls'],
      }),
      3,
    );

    const events = buildDiscoveryQueries(
      buildDefaultSearchMetadata('SpecialEvents', {
        regionPriority: ['Los Angeles'],
        includeTerms: ['fandom'],
      }),
      3,
    );

    expect(restaurants).toEqual([
      'Orange County immersive dining official site -"chain"',
      'Orange County themed restaurant official site -"chain"',
      'Orange County hidden gem restaurant official site -"chain"',
      'Orange County dessert experience official site -"chain"',
      'Orange County chef tasting menu official site -"chain"',
      'Orange County speakeasy dining official site -"chain"',
      'Orange County immersive dining restaurant official site -"chain"',
      'Orange County immersive dining hidden gem dining -"chain"',
    ]);
    expect(nature[0]).toBe('Orange County nature preserve official site');
    expect(events[0]).toBe('Los Angeles events official site');
  });
});

describe('buildEnrichmentQueries', () => {
  it('uses candidate name and location deterministically', () => {
    const queries = buildEnrichmentQueries(
      {
        category: 'Restaurants',
        name: 'Vaca',
        region: 'Orange County',
        city: 'Costa Mesa',
        shortDescription: 'Spanish restaurant',
        whyUnique: 'Unique',
        themes: [],
        audience: [],
        kidFriendly: false,
        indoorOutdoor: 'Indoor',
        priceLevel: '$$$',
        reservationRecommended: true,
        website: 'https://example.com/vaca',
        sourceName: 'OpenTable',
        sourceUrl: 'https://example.com/source',
        canonicalUrl: 'https://example.com/vaca',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
      3,
    );

    expect(queries).toEqual([
      '"Vaca" "Costa Mesa" reviews',
      '"Vaca" "Costa Mesa" blog',
      '"Vaca" "Costa Mesa" reddit',
    ]);
  });
});
