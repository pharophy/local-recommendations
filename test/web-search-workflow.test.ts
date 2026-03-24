import { describe, expect, it, vi } from 'vitest';

import { createRuntimeConfig } from '../src/config/runtime.js';
import type { CandidateEnricher, DiscoveryProvider } from '../src/discovery/provider.js';
import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';
import { processCategory } from '../src/workflows/daily-run.js';

function buildRuntimeConfig() {
  return createRuntimeConfig({
    AIRTABLE_PAT: 'pat',
    AIRTABLE_BASE_ID: 'app123',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    EMAIL_FROM: 'bot@example.com',
    EMAIL_TO: 'shawn.souto@gmail.com',
    DEFAULT_REGION_PRIORITY: 'Orange County,Los Angeles,Temecula,San Diego',
    DEFAULT_SPECIAL_EVENTS_WINDOW_DAYS: '30',
    LOG_LEVEL: 'info',
    HTTP_TIMEOUT_MS: '10000',
    HTTP_RETRY_COUNT: '1',
    DISCOVERY_CONCURRENCY: '2',
  });
}

function buildLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('web search workflow integration', () => {
  it('enriches curated candidates without overriding canonical facts', async () => {
    const metadata = buildDefaultSearchMetadata('Restaurants', {
      searchFocus: ['immersive dining'],
      includeTerms: ['rooftop'],
    });
    const provider: DiscoveryProvider = {
      async discover() {
        return [
          {
            category: 'Restaurants',
            source: {
              id: 'curated-source',
              name: 'OpenTable',
              url: 'https://www.opentable.com/',
            },
            title: 'Vaca',
            url: 'https://www.vacarestaurant.com/',
            summary: 'Spanish restaurant in Costa Mesa.',
            city: 'Costa Mesa',
            region: 'Orange County',
          },
        ];
      },
    };
    const enricher: CandidateEnricher = {
      async enrich() {
        return {
          summaryFragments: ['Public reviews mention immersive dining and rooftop cocktails.'],
          themeHints: ['immersive dining', 'rooftop'],
          audienceHints: ['date night'],
          noteFragments: ['reddit.com', 'foodblog.example.com'],
          scoreBoost: 5,
        };
      },
    };
    const repository = {
      getExisting: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processCategory(
      metadata,
      [provider],
      [enricher],
      repository as never,
      true,
      buildLogger(),
      buildRuntimeConfig(),
    );

    expect(result.inserted).toHaveLength(1);
    expect(result.inserted[0]?.canonicalUrl).toBe('https://www.vacarestaurant.com/');
    expect(result.inserted[0]?.sourceName).toBe('OpenTable');
    expect(result.inserted[0]?.discoveryNotes).toContain('Enriched via web search: reddit.com, foodblog.example.com');
    expect(result.inserted[0]?.whyUnique).toContain('Public feedback mentions immersive dining, rooftop.');
    expect(result.inserted[0]?.enrichmentScoreBoost).toBe(3);
  });

  it('rejects search-derived nature candidates without place precision', async () => {
    const provider: DiscoveryProvider = {
      async discover() {
        return [
          {
            category: 'Nature',
            source: {
              id: 'web-search-brave',
              name: 'Brave Web Search',
              url: 'https://search.brave.com/',
            },
            title: 'Scenic Nature Escape',
            url: 'https://example.com/nature-escape',
            summary: 'A scenic outdoors roundup in Southern California.',
            region: 'Orange County',
            provenance: 'search',
          },
        ];
      },
    };
    const repository = {
      getExisting: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processCategory(
      buildDefaultSearchMetadata('Nature'),
      [provider],
      [],
      repository as never,
      true,
      buildLogger(),
      buildRuntimeConfig(),
    );

    expect(result.discoveredCount).toBe(1);
    expect(result.inserted).toHaveLength(0);
    expect(repository.getExisting).toHaveBeenCalled();
  });

  it('rejects search-derived special events outside the configured date window', async () => {
    const provider: DiscoveryProvider = {
      async discover() {
        return [
          {
            category: 'SpecialEvents',
            source: {
              id: 'web-search-brave',
              name: 'Brave Web Search',
              url: 'https://search.brave.com/',
            },
            title: 'Future Expo',
            url: 'https://example.com/future-expo',
            summary: 'A limited-run fandom event.',
            city: 'Anaheim',
            region: 'Orange County',
            rawDateText: 'January 1, 2099',
            provenance: 'search',
          },
        ];
      },
    };
    const repository = {
      getExisting: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processCategory(
      buildDefaultSearchMetadata('SpecialEvents', { dateWindowDays: 30 }),
      [provider],
      [],
      repository as never,
      true,
      buildLogger(),
      buildRuntimeConfig(),
    );

    expect(result.discoveredCount).toBe(1);
    expect(result.inserted).toHaveLength(0);
    expect(repository.getExisting).toHaveBeenCalled();
  });

  it('rejects search-derived restaurant candidates that still point to community or editorial URLs', async () => {
    const provider: DiscoveryProvider = {
      async discover() {
        return [
          {
            category: 'Restaurants',
            source: {
              id: 'web-search-brave',
              name: 'Brave Web Search',
              url: 'https://search.brave.com/',
            },
            title: 'Orange County | Eater LA',
            url: 'https://la.eater.com/neighborhood/874/oc',
            summary: 'Food news and dining guides for Los Angeles, California.',
            provenance: 'search',
          },
        ];
      },
    };
    const repository = {
      getExisting: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processCategory(
      buildDefaultSearchMetadata('Restaurants'),
      [provider],
      [],
      repository as never,
      true,
      buildLogger(),
      buildRuntimeConfig(),
    );

    expect(result.discoveredCount).toBe(1);
    expect(result.inserted).toHaveLength(0);
    expect(repository.getExisting).toHaveBeenCalled();
  });

  it('treats local editorial restaurant roundups as seeds rather than direct inserts', async () => {
    const provider: DiscoveryProvider = {
      async discover() {
        return [
          {
            category: 'Restaurants',
            source: {
              id: 'web-search-brave',
              name: 'Brave Web Search',
              url: 'https://search.brave.com/',
            },
            title: "Food Trends: Exploring Orange County's Hidden Foodie Gems - Orange Coast",
            url: 'https://orangecoast.com/ocdining/food-trends-exploring-orange-countys-hidden-foodie-gems/',
            summary: 'A hidden foodie gems roundup from Orange Coast.',
            provenance: 'search',
          },
        ];
      },
    };
    const repository = {
      getExisting: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processCategory(
      buildDefaultSearchMetadata('Restaurants'),
      [provider],
      [],
      repository as never,
      true,
      buildLogger(),
      buildRuntimeConfig(),
    );

    expect(result.discoveredCount).toBe(1);
    expect(result.inserted).toHaveLength(0);
    expect(repository.getExisting).toHaveBeenCalled();
  });
});
