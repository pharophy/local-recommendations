import { describe, expect, it } from 'vitest';

import { shouldIgnoreLink } from '../src/discovery/providers/html-source-provider.js';
import type { HtmlSourceDefinition } from '../src/discovery/source-definition.js';

const baseSource: HtmlSourceDefinition = {
  id: 'visit-anaheim-restaurants',
  name: 'Visit Anaheim Restaurants',
  category: 'Restaurants',
  url: 'https://www.visitanaheim.org/restaurants/',
  region: 'Orange County',
  includeUrlPatterns: ['/restaurants/'],
  excludeUrlPatterns: ['/partners/'],
  excludeTitlePatterns: ['featured'],
};

const ocSource: HtmlSourceDefinition = {
  id: 'opentable-oc-restaurants',
  name: 'OpenTable Orange County Restaurants',
  category: 'Restaurants',
  url: 'https://www.opentable.com/metro/orange-county-restaurants',
  region: 'Orange County',
  includeUrlPatterns: ['/r/'],
  allowedCities: ['Anaheim', 'Costa Mesa'],
};

describe('shouldIgnoreLink', () => {
  it('rejects menu and utility links', () => {
    expect(
      shouldIgnoreLink(
        baseSource,
        'https://www.visitanaheim.org/restaurants/anaheim-packing-district/',
        'The Packing District',
        'A nav menu item',
      ),
    ).toBe(true);
  });

  it('rejects self links and generic titles', () => {
    expect(
      shouldIgnoreLink(
        baseSource,
        'https://www.visitanaheim.org/restaurants/',
        'Restaurants',
        'main content',
      ),
    ).toBe(true);
  });

  it('keeps source-matching content links', () => {
    expect(
      shouldIgnoreLink(
        baseSource,
        'https://www.visitanaheim.org/restaurants/anaheim-packing-district/',
        'The Packing District',
        'content tile card',
      ),
    ).toBe(false);
  });

  it('keeps OpenTable result links while city filtering happens later', () => {
    expect(
      shouldIgnoreLink(
        ocSource,
        'https://www.opentable.com/r/vaca',
        'VACA',
        'jsonld itemlist',
      ),
    ).toBe(false);
  });

  it('rejects social share links', () => {
    expect(
      shouldIgnoreLink(
        baseSource,
        'https://twitter.com/share?url=https://example.com',
        'Tweet',
        'content tile card',
      ),
    ).toBe(true);
  });
});
