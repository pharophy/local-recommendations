import { describe, expect, it } from 'vitest';

import { experienceToAirtableFields } from '../src/airtable/repositories.js';
import type { ExperienceCandidate } from '../src/domain/experience.js';

describe('experienceToAirtableFields', () => {
  it('maps restaurant specific fields', () => {
    const experience: ExperienceCandidate = {
      category: 'Restaurants',
      name: 'The Starport',
      region: 'Los Angeles',
      city: 'Los Angeles',
      neighborhoodOrArea: 'Arts District',
      shortDescription: 'Sci-fi themed dining room.',
      whyUnique: 'Immersive decor.',
      themes: ['sci-fi'],
      audience: ['adults'],
      kidFriendly: false,
      indoorOutdoor: 'Indoor',
      priceLevel: '$$$',
      reservationRecommended: true,
      website: 'https://example.com',
      sourceName: 'Example',
      sourceUrl: 'https://example.com/source',
      canonicalUrl: 'https://example.com',
      botScore: 30,
      lastVerifiedAt: new Date().toISOString(),
      duplicateKey: 'restaurants::the-starport::los-angeles::https-example-com',
      searchFocusSnapshot: 'sci-fi',
      discoveryNotes: '',
      status: 'New',
      createdByBotAt: new Date().toISOString(),
      visited: false,
      cuisine: 'Fusion',
    };

    const fields = experienceToAirtableFields('Restaurants', experience);
    expect(fields['Cuisine']).toBe('Fusion');
    expect(fields['Name']).toBe('The Starport');
  });
});
