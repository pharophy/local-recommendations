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

  it('filters restaurant and activity guide pages that are not a single entity', () => {
    const restaurantMetadata = buildDefaultSearchMetadata('Restaurants');
    const activityMetadata = buildDefaultSearchMetadata('Activities');

    const restaurantPasses = passesFilters(
      {
        category: 'Restaurants',
        name: "LA's Best Vegan Brunches",
        region: 'Los Angeles',
        city: 'Los Angeles',
        shortDescription: 'A guide to brunch options across the city.',
        whyUnique: 'Guide',
        themes: ['restaurants'],
        audience: [],
        kidFriendly: true,
        indoorOutdoor: 'Mixed',
        priceLevel: '$$',
        reservationRecommended: true,
        website: 'https://www.discoverlosangeles.com/eat-drink/the-best-vegan-brunches-in-los-angeles',
        sourceName: 'Example',
        sourceUrl: 'https://example.com',
        canonicalUrl: 'https://www.discoverlosangeles.com/eat-drink/the-best-vegan-brunches-in-los-angeles',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
      restaurantMetadata,
    );

    const activityPasses = passesFilters(
      {
        category: 'Activities',
        name: 'Orange County beaches',
        region: 'Orange County',
        city: 'Anaheim',
        shortDescription: 'Regional beach roundup.',
        whyUnique: 'Guide',
        themes: ['tourism'],
        audience: [],
        kidFriendly: true,
        indoorOutdoor: 'Outdoor',
        priceLevel: '$$',
        reservationRecommended: false,
        website: 'https://www.visitanaheim.org/things-to-do/orange-county-beaches/',
        sourceName: 'Example',
        sourceUrl: 'https://example.com',
        canonicalUrl: 'https://www.visitanaheim.org/things-to-do/orange-county-beaches/',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
      activityMetadata,
    );

    expect(restaurantPasses).toBe(false);
    expect(activityPasses).toBe(false);
  });

  it('filters restaurant opening/news articles when they are not stable venue pages', () => {
    const metadata = buildDefaultSearchMetadata('Restaurants');

    const passes = passesFilters(
      {
        category: 'Restaurants',
        name: 'A Famed Taiwan-Based Thai Restaurant Opens Its First U.S. Location in Los Angeles',
        region: 'Los Angeles',
        city: 'Los Angeles',
        shortDescription: 'News article about a new opening.',
        whyUnique: 'Opening coverage',
        themes: ['restaurants', 'openings'],
        audience: [],
        kidFriendly: true,
        indoorOutdoor: 'Mixed',
        priceLevel: '$$',
        reservationRecommended: true,
        website: 'https://la.eater.com/restaurant-openings/300479/very-thai-thai-food-restaurant-opening-century-city-los-angeles',
        sourceName: 'Example',
        sourceUrl: 'https://example.com',
        canonicalUrl: 'https://la.eater.com/restaurant-openings/300479/very-thai-thai-food-restaurant-opening-century-city-los-angeles',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
      metadata,
    );

    expect(passes).toBe(false);
  });

  it('filters special events that are inferred to be out of region', () => {
    const metadata = buildDefaultSearchMetadata('SpecialEvents');

    const passes = passesFilters(
      {
        category: 'SpecialEvents',
        name: 'Palm Springs Piano Men',
        region: 'Out of Region',
        city: 'Palm Springs',
        shortDescription: 'A dueling piano show in Palm Springs.',
        whyUnique: 'Unique',
        themes: ['live music'],
        audience: [],
        kidFriendly: false,
        indoorOutdoor: 'Indoor',
        priceLevel: '$$',
        reservationRecommended: true,
        website: 'https://feverup.com/m/222222',
        sourceName: 'Fever Los Angeles Food & Drink',
        sourceUrl: 'https://feverup.com/en/los-angeles/food',
        canonicalUrl: 'https://feverup.com/m/222222',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
        startDate: '2026-03-24T00:00:00.000Z',
        endDate: '2026-03-24T00:00:00.000Z',
      },
      metadata,
      new Date('2026-03-22T00:00:00.000Z'),
    );

    expect(passes).toBe(false);
  });
});
