import { describe, expect, it } from 'vitest';

import { buildDuplicateKey, partitionDuplicates } from '../src/dedupe/duplicates.js';

describe('buildDuplicateKey', () => {
  it('builds a stable normalized key', () => {
    const key = buildDuplicateKey(
      'Activities',
      'Fantasy Tavern',
      'Anaheim',
      'Orange County',
      'https://example.com/fantasy',
      'https://source.com/page',
    );

    expect(key).toBe('activities::fantasy-tavern::anaheim::https-example-com-fantasy');
  });

  it('treats duplicate candidates in the same run as duplicates', () => {
    const duplicateKey = buildDuplicateKey(
      'SpecialEvents',
      'The Obscure',
      'Los Angeles',
      'Los Angeles',
      'https://feverup.com/m/169678',
      'https://feverup.com/en/los-angeles/food',
    );

    const candidates = [
      {
        category: 'SpecialEvents' as const,
        name: 'The Obscure',
        region: 'Los Angeles',
        city: 'Los Angeles',
        shortDescription: 'Cocktail experience.',
        whyUnique: 'Immersive',
        themes: ['immersive'],
        audience: [],
        kidFriendly: false,
        indoorOutdoor: 'Indoor',
        priceLevel: '$$',
        reservationRecommended: true,
        website: 'https://feverup.com/m/169678',
        sourceName: 'Fever',
        sourceUrl: 'https://feverup.com/en/los-angeles/food',
        canonicalUrl: 'https://feverup.com/m/169678',
        botScore: 12,
        lastVerifiedAt: new Date().toISOString(),
        duplicateKey,
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
      {
        category: 'SpecialEvents' as const,
        name: 'The Obscure',
        region: 'Los Angeles',
        city: 'Los Angeles',
        shortDescription: 'Cocktail experience.',
        whyUnique: 'Immersive',
        themes: ['immersive'],
        audience: [],
        kidFriendly: false,
        indoorOutdoor: 'Indoor',
        priceLevel: '$$',
        reservationRecommended: true,
        website: 'https://feverup.com/m/169678',
        sourceName: 'Fever',
        sourceUrl: 'https://feverup.com/en/los-angeles/drinks-afterwork',
        canonicalUrl: 'https://feverup.com/m/169678',
        botScore: 11,
        lastVerifiedAt: new Date().toISOString(),
        duplicateKey,
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
    ];

    const { unique, duplicates } = partitionDuplicates(candidates, []);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
  });
});
