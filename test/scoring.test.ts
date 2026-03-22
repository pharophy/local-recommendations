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
});
