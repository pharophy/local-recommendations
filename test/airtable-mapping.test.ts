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

  it('writes improved user-facing restaurant fields without debug-style placeholders', () => {
    const experience: ExperienceCandidate = {
      category: 'Restaurants',
      name: 'TRUST',
      region: 'Orange County',
      city: 'Santa Ana',
      neighborhoodOrArea: 'Santa Ana',
      shortDescription: 'Chef-inspired tapas with sommelier pairings in an intimate 18-seat culinary theater.',
      whyUnique: 'Notable for a chef-led tasting format and an intimate experience-driven format.',
      themes: ['chef-driven tasting', 'cocktail-forward'],
      audience: ['date night'],
      kidFriendly: false,
      indoorOutdoor: 'Indoor',
      priceLevel: '$$$',
      reservationRecommended: true,
      website: 'https://trustdtsa.com/',
      sourceName: 'Brave Web Search',
      sourceUrl: 'https://api.search.brave.com/res/v1/web/search',
      canonicalUrl: 'https://trustdtsa.com/',
      botScore: 20,
      lastVerifiedAt: new Date().toISOString(),
      duplicateKey: 'restaurants::trust::santa-ana::https-trustdtsa-com',
      searchFocusSnapshot: 'Dinner, Drinks',
      discoveryNotes:
        'Selected from web search because the page shows a chef-led tasting format and an intimate experience-driven format. Primary source: Brave Web Search.',
      status: 'New',
      createdByBotAt: new Date().toISOString(),
      visited: false,
      cuisine: 'Small Plates',
    };

    const fields = experienceToAirtableFields('Restaurants', experience);
    expect(fields['Themes']).toBe('chef-driven tasting, cocktail-forward');
    expect(fields['Price Tier']).toBe('$$$');
    expect(fields['Meal Type']).toBe('Dinner, Drinks');
    expect(fields['Cuisine / Style']).toBe('Small Plates');
    expect(fields['Bot Notes']).toContain('because the page shows');
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
