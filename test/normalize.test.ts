import { describe, expect, it } from 'vitest';

import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';
import { normalizeCandidate } from '../src/extract/normalize.js';

describe('normalizeCandidate', () => {
  it('cleans noisy Fever event titles and infers supported cities from text', () => {
    const metadata = buildDefaultSearchMetadata('SpecialEvents');

    const candidate = normalizeCandidate(
      {
        category: 'SpecialEvents',
        source: {
          id: 'fever-la-food-drink',
          name: 'Fever Los Angeles Food & Drink',
          url: 'https://feverup.com/en/los-angeles/food',
        },
        title:
          'City Cruises Newport Beach South Boarding Champagne Brunch Cruise from Newport Beach4.7(144) 28 Mar - 16 May From $80.79',
        url: 'https://feverup.com/m/111785',
        summary:
          'City Cruises Newport Beach South Boarding Champagne Brunch Cruise from Newport Beach4.7(144) 28 Mar - 16 May From $80.79',
        region: 'Los Angeles',
        rawDateText:
          'City Cruises Newport Beach South Boarding Champagne Brunch Cruise from Newport Beach4.7(144) 28 Mar - 16 May From $80.79',
      },
      metadata,
      new Date('2026-03-22T00:00:00.000Z'),
    );

    expect(candidate.name).toBe('City Cruises Newport Beach South Boarding Champagne Brunch Cruise from Newport Beach');
    expect(candidate.city).toBe('Newport Beach');
    expect(candidate.region).toBe('Orange County');
  });

  it('collapses repeated event prefixes', () => {
    const metadata = buildDefaultSearchMetadata('SpecialEvents');

    const candidate = normalizeCandidate(
      {
        category: 'SpecialEvents',
        source: {
          id: 'fever-la-drinks-happy-hour',
          name: 'Fever Los Angeles Drinks & Happy Hour',
          url: 'https://feverup.com/en/los-angeles/drinks-afterwork',
        },
        title:
          "Autry Museum of the American West Autry Museum of the American West Cowboy Cocktail Hour with Caravan 222 and Same Ol' Smile 09 Apr From $5.00",
        url: 'https://feverup.com/m/471242',
        summary:
          "Autry Museum of the American West Autry Museum of the American West Cowboy Cocktail Hour with Caravan 222 and Same Ol' Smile 09 Apr From $5.00",
        region: 'Los Angeles',
        rawDateText:
          "Autry Museum of the American West Autry Museum of the American West Cowboy Cocktail Hour with Caravan 222 and Same Ol' Smile 09 Apr From $5.00",
      },
      metadata,
      new Date('2026-03-22T00:00:00.000Z'),
    );

    expect(candidate.name).toBe(
      "Autry Museum of the American West Cowboy Cocktail Hour with Caravan 222 and Same Ol' Smile",
    );
  });

  it('marks unsupported Fever locations as out of region instead of inheriting Los Angeles', () => {
    const metadata = buildDefaultSearchMetadata('SpecialEvents');

    const candidate = normalizeCandidate(
      {
        category: 'SpecialEvents',
        source: {
          id: 'fever-la-food-drink',
          name: 'Fever Los Angeles Food & Drink',
          url: 'https://feverup.com/en/los-angeles/food',
        },
        title: 'Palm Springs Piano Men: A Dueling Piano Show 24 Apr From $39.00',
        url: 'https://feverup.com/m/222222',
        summary: 'Palm Springs Piano Men: A Dueling Piano Show 24 Apr From $39.00',
        region: 'Los Angeles',
        rawDateText: 'Palm Springs Piano Men: A Dueling Piano Show 24 Apr From $39.00',
      },
      metadata,
      new Date('2026-03-22T00:00:00.000Z'),
    );

    expect(candidate.city).toBe('Palm Springs');
    expect(candidate.region).toBe('Out of Region');
  });

  it('infers a more precise Nature city or area from known park names', () => {
    const metadata = buildDefaultSearchMetadata('Nature');

    const candidate = normalizeCandidate(
      {
        category: 'Nature',
        source: {
          id: 'oc-parks-trails',
          name: 'OC Parks Trails',
          url: 'https://ocparks.com/parks-trails',
        },
        title: 'Carbon Canyon Regional Park',
        url: 'https://ocparks.com/parks/carbon-canyon-regional-park',
        summary: 'Explore trails, picnic areas, and redwoods at Carbon Canyon Regional Park.',
        region: 'Orange County',
        rawDateText: 'Carbon Canyon Regional Park',
      },
      metadata,
      new Date('2026-03-22T00:00:00.000Z'),
    );

    expect(candidate.city).toBe('Brea');
    expect(candidate.region).toBe('Orange County');
  });

  it('builds restaurant whyUnique from concrete experience evidence', () => {
    const metadata = buildDefaultSearchMetadata('Restaurants');

    const candidate = normalizeCandidate(
      {
        category: 'Restaurants',
        source: {
          id: 'elixir',
          name: 'Elixir',
          url: 'https://example.com/elixir',
        },
        title: 'Elixir',
        url: 'https://example.com/elixir',
        summary:
          'Costa Mesa dessert concept known for soft serve, boba, and a one-of-a-kind interactive presentation.',
        region: 'Orange County',
        city: 'Costa Mesa',
      },
      metadata,
      new Date('2026-03-22T00:00:00.000Z'),
    );

    expect(candidate.whyUnique).toContain('a standout dessert-driven concept');
    expect(candidate.whyUnique).toContain('an immersive concept');
  });
});
