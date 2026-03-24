import { describe, expect, it } from 'vitest';

import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';
import { passesFilters, scoreCandidate } from '../src/score/scoring.js';

describe('scoreCandidate', () => {
  it('boosts candidates that match focus and kid filters', () => {
    const metadata = buildDefaultSearchMetadata('Activities', {
      searchFocus: ['fantasy'],
      includeTerms: ['immersive'],
      kidFocus: true,
    });

    const score = scoreCandidate(
      {
        category: 'Activities',
        name: 'Immersive Fantasy Quest',
        region: 'Orange County',
        city: 'Anaheim',
        shortDescription: 'An immersive fantasy scavenger experience for families.',
        whyUnique: 'A themed interactive quest.',
        themes: ['fantasy', 'immersive'],
        audience: ['families'],
        kidFriendly: true,
        indoorOutdoor: 'Mixed',
        priceLevel: '$$',
        reservationRecommended: true,
        website: 'https://example.com',
        sourceName: 'Example',
        sourceUrl: 'https://example.com/source',
        canonicalUrl: 'https://example.com',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: 'fantasy',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
      metadata,
    );

    expect(score).toBeGreaterThan(15);
  });

  it('applies indoor, price, and source priority metadata boosts', () => {
    const metadata = buildDefaultSearchMetadata('Restaurants', {
      indoorOutdoorBias: 'Outdoor',
      priceBias: '$',
      sourcePriorityNotes: 'visit anaheim, opentable',
    });

    const preferred = scoreCandidate(
      {
        category: 'Restaurants',
        name: 'Patio Tacos',
        region: 'Orange County',
        city: 'Anaheim',
        shortDescription:
          'Outdoor taco stand with a lively patio, hidden-gem energy, and tableside salsa service.',
        whyUnique: 'Notable for a hidden-gem feel and theatrical presentation.',
        themes: ['patio dining', 'local favorite'],
        audience: [],
        kidFriendly: true,
        indoorOutdoor: 'Outdoor',
        priceLevel: '$',
        reservationRecommended: false,
        website: 'https://example.com/patio-tacos',
        sourceName: 'Visit Anaheim',
        sourceUrl: 'https://www.visitanaheim.org/restaurants/patio-tacos',
        canonicalUrl: 'https://example.com/patio-tacos',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
      metadata,
    );

    const nonPreferred = scoreCandidate(
      {
        category: 'Restaurants',
        name: 'Formal Dining Room',
        region: 'Orange County',
        city: 'Anaheim',
        shortDescription: 'An indoor restaurant guide entry covering popular brunch spots and price points.',
        whyUnique: 'Restaurant page lacks concrete evidence of a distinctive dining experience.',
        themes: ['fine dining'],
        audience: [],
        kidFriendly: false,
        indoorOutdoor: 'Indoor',
        priceLevel: '$$$$',
        reservationRecommended: true,
        website: 'https://example.com/formal-dining',
        sourceName: 'Generic News',
        sourceUrl: 'https://example.com/news/formal-dining',
        canonicalUrl: 'https://example.com/formal-dining',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
      metadata,
    );

    expect(preferred).toBeGreaterThan(nonPreferred);
  });

  it('filters out restaurants without concrete experience evidence', () => {
    const metadata = buildDefaultSearchMetadata('Restaurants');

    const shouldReject = passesFilters(
      {
        category: 'Restaurants',
        name: 'Downtown Grill',
        region: 'Orange County',
        city: 'Santa Ana',
        shortDescription: 'Steak and seafood served in a comfortable downtown dining room.',
        whyUnique: 'Restaurant page lacks concrete evidence of a distinctive dining experience.',
        themes: ['steakhouse'],
        audience: [],
        kidFriendly: false,
        indoorOutdoor: 'Indoor',
        priceLevel: '$$$',
        reservationRecommended: true,
        website: 'https://example.com/downtown-grill',
        sourceName: 'Example',
        sourceUrl: 'https://example.com/source',
        canonicalUrl: 'https://example.com/downtown-grill',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
        provenance: 'search',
      },
      metadata,
    );

    expect(shouldReject).toBe(false);
  });

  it('accepts search-derived restaurants when whyUnique has concrete evidence wording', () => {
    const metadata = buildDefaultSearchMetadata('Restaurants');

    const shouldPass = passesFilters(
      {
        category: 'Restaurants',
        name: 'Hidden Dessert Lab',
        region: 'Orange County',
        city: 'Costa Mesa',
        shortDescription: 'A dessert bar in Costa Mesa.',
        whyUnique: 'Notable for a standout dessert-driven concept.',
        themes: [],
        audience: [],
        kidFriendly: false,
        indoorOutdoor: 'Indoor',
        priceLevel: '$$',
        reservationRecommended: true,
        website: 'https://example.com/hidden-dessert-lab',
        sourceName: 'Example',
        sourceUrl: 'https://example.com/source',
        canonicalUrl: 'https://example.com/hidden-dessert-lab',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
        provenance: 'search',
      },
      metadata,
    );

    expect(shouldPass).toBe(true);
  });
});
