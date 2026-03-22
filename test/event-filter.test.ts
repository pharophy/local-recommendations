import { describe, expect, it } from 'vitest';

import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';
import { passesFilters } from '../src/score/scoring.js';

describe('passesFilters', () => {
  it('filters events outside the configured date window', () => {
    const metadata = buildDefaultSearchMetadata('SpecialEvents', {
      dateWindowDays: 7,
    });

    const passes = passesFilters(
      {
        category: 'SpecialEvents',
        name: 'Future Expo',
        region: 'Orange County',
        city: 'Anaheim',
        shortDescription: 'A limited-run fandom event.',
        whyUnique: 'Unique',
        themes: ['fandom'],
        audience: [],
        kidFriendly: true,
        indoorOutdoor: 'Indoor',
        priceLevel: '$$',
        reservationRecommended: true,
        website: 'https://example.com',
        sourceName: 'Example',
        sourceUrl: 'https://example.com/source',
        canonicalUrl: 'https://example.com',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
        startDate: '2099-01-01T00:00:00.000Z',
        endDate: '2099-01-01T00:00:00.000Z',
      },
      metadata,
      new Date('2026-03-22T00:00:00.000Z'),
    );

    expect(passes).toBe(false);
  });
});
