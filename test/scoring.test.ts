import { describe, expect, it } from 'vitest';

import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';
import { scoreCandidate } from '../src/score/scoring.js';

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
        shortDescription: 'Outdoor taco stand with a lively patio and family-friendly seating.',
        whyUnique: 'A casual patio-first taco stop.',
        themes: ['patio dining'],
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
        shortDescription: 'An indoor prix fixe restaurant with a luxury tasting menu.',
        whyUnique: 'A formal fine-dining room.',
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
});
