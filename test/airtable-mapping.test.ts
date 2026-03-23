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
    expect(fields['Cuisine / Style']).toBe('Fusion');
    expect(fields['Name']).toBe('The Starport');
    expect(fields['Why Unique']).toBe('Immersive decor.');
    expect(fields).not.toHaveProperty('WhyUnique');
    expect(fields).not.toHaveProperty('Tried On');
  });

  it('does not write a generic City field for nature records', () => {
    const experience: ExperienceCandidate = {
      category: 'Nature',
      name: 'Mystic Trail',
      region: 'Orange County',
      city: 'Laguna Beach',
      shortDescription: 'Coastal canyon trail.',
      whyUnique: 'Ocean overlook.',
      themes: ['trail'],
      audience: ['families'],
      kidFriendly: true,
      indoorOutdoor: 'Outdoor',
      priceLevel: '$',
      reservationRecommended: false,
      website: 'https://example.com/trail',
      sourceName: 'Example',
      sourceUrl: 'https://example.com/source',
      canonicalUrl: 'https://example.com/trail',
      botScore: 12,
      lastVerifiedAt: new Date().toISOString(),
      duplicateKey: 'nature::mystic-trail::laguna-beach::https-example-com-trail',
      searchFocusSnapshot: 'trail',
      discoveryNotes: '',
      status: 'New',
      createdByBotAt: new Date().toISOString(),
      visited: false,
      areaType: 'Trail',
    };

    const fields = experienceToAirtableFields('Nature', experience);
    expect(fields['City / Area']).toBe('Laguna Beach');
    expect(fields).not.toHaveProperty('City');
    expect(fields['Why Unique']).toBe('Ocean overlook.');
    expect(fields).not.toHaveProperty('Themes');
    expect(fields).not.toHaveProperty('Price Tier');
    expect(fields).not.toHaveProperty('Reservation Needed');
  });
});
