import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRuntimeConfig } from '../src/config/runtime.js';
import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';
import { GoogleCustomSearchProvider } from '../src/discovery/search/google-custom-search-provider.js';

function buildConfig() {
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
    DISCOVERY_CONCURRENCY: '4',
    WEB_SEARCH_ENABLED: 'true',
    WEB_SEARCH_PROVIDER: 'google',
    WEB_SEARCH_API_KEY: 'test-key',
    WEB_SEARCH_GOOGLE_CX: 'cx123',
    WEB_SEARCH_MAX_RESULTS_PER_QUERY: '5',
    WEB_SEARCH_MAX_ENRICHMENT_RESULTS: '3',
    WEB_SEARCH_MAX_QUERIES_PER_CATEGORY: '1',
    WEB_SEARCH_ENABLE_ACTIVITIES: 'false',
    WEB_SEARCH_ENABLE_RESTAURANTS: 'true',
    WEB_SEARCH_ENABLE_NATURE: 'false',
    WEB_SEARCH_ENABLE_SPECIAL_EVENTS: 'false',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GoogleCustomSearchProvider', () => {
  it('maps accepted discovery results into raw records and filters blocked domains', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                title: 'Vaca Official Site',
                link: 'https://www.vacarestaurant.com/',
                snippet: 'Spanish dining in Costa Mesa.',
              },
              {
                title: 'Best Restaurants in Orange County',
                link: 'https://example.com/best-restaurants',
                snippet: 'Listicle content.',
              },
              {
                title: 'Vaca on Yelp',
                link: 'https://www.yelp.com/biz/vaca-costa-mesa',
                snippet: 'Marketplace wrapper.',
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const provider = new GoogleCustomSearchProvider(buildConfig(), { timeoutMs: 1000, retryCount: 0 });
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const records = await provider.discover({
      metadata: buildDefaultSearchMetadata('Restaurants'),
      logger,
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      provenance: 'search',
      title: 'Vaca Official Site',
      url: 'https://www.vacarestaurant.com/',
    });
  });

  it('returns bounded enrichment from accepted public feedback and editorial pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                title: 'Reddit review of Vaca',
                link: 'https://www.reddit.com/r/orangecounty/comments/abc123/vaca_review/',
                snippet: 'A date night favorite with immersive service and family-friendly staff.',
                htmlSnippet: 'Great for date night and group-friendly dinners.',
              },
              {
                title: 'Local blog on Vaca',
                link: 'https://foodblog.example.com/vaca-costa-mesa',
                snippet: 'Rooftop-adjacent cocktails and immersive dining vibes.',
              },
              {
                title: 'Instagram post',
                link: 'https://www.instagram.com/p/example',
                snippet: 'Blocked result.',
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const provider = new GoogleCustomSearchProvider(buildConfig(), { timeoutMs: 1000, retryCount: 0 });
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const enrichment = await provider.enrich(
      {
        category: 'Restaurants',
        name: 'Vaca',
        region: 'Orange County',
        city: 'Costa Mesa',
        shortDescription: 'Spanish restaurant in Costa Mesa.',
        whyUnique: 'Unique.',
        themes: [],
        audience: [],
        kidFriendly: false,
        indoorOutdoor: 'Indoor',
        priceLevel: '$$$',
        reservationRecommended: true,
        website: 'https://www.vacarestaurant.com/',
        sourceName: 'OpenTable',
        sourceUrl: 'https://www.opentable.com/',
        canonicalUrl: 'https://www.vacarestaurant.com/',
        lastVerifiedAt: new Date().toISOString(),
        searchFocusSnapshot: '',
        discoveryNotes: '',
        status: 'New',
        createdByBotAt: new Date().toISOString(),
        visited: false,
      },
      {
        metadata: buildDefaultSearchMetadata('Restaurants', {
          searchFocus: ['immersive dining'],
          includeTerms: ['rooftop'],
        }),
        logger,
      },
    );

    expect(enrichment).not.toBeNull();
    expect(enrichment?.scoreBoost).toBe(2);
    expect(enrichment?.noteFragments).toEqual(['www.reddit.com', 'foodblog.example.com']);
    expect(enrichment?.themeHints).toEqual(expect.arrayContaining(['immersive dining', 'rooftop']));
    expect(enrichment?.audienceHints).toEqual(expect.arrayContaining(['date night', 'group-friendly']));
  });

  it('warns clearly when Google returns a 429 quota or rate-limit error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Quota exceeded for quota metric Queries per day',
              errors: [
                {
                  reason: 'rateLimitExceeded',
                  message: 'Quota exceeded for quota metric Queries per day',
                },
              ],
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429 },
        ),
      ),
    );

    const provider = new GoogleCustomSearchProvider(buildConfig(), { timeoutMs: 1000, retryCount: 0 });
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const records = await provider.discover({
      metadata: buildDefaultSearchMetadata('Restaurants'),
      logger,
    });

    expect(records).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
    const firstWarning = logger.warn.mock.calls[0] as
      | [string, { sourceId?: string; error?: string }]
      | undefined;
    expect(firstWarning?.[0]).toBe('Discovery source failed');
    expect(firstWarning?.[1].sourceId).toBe('web-search-google');
    expect(firstWarning?.[1].error).toContain('HTTP 429');
    expect(firstWarning?.[1].error).toContain('Check Google Cloud Console quota and usage');
  });
});
