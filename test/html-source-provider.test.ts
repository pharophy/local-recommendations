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
});
