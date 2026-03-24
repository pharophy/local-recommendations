import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRuntimeConfig } from '../src/config/runtime.js';
import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';
import { BraveSearchProvider } from '../src/discovery/search/brave-search-provider.js';
import { createFileSearchPageCache } from '../src/discovery/search/search-page-cache.js';

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
    WEB_SEARCH_PROVIDER: 'brave',
    WEB_SEARCH_API_KEY: 'test-key',
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

describe('BraveSearchProvider', () => {
  it('maps accepted discovery results into raw records and filters blocked domains', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: 'Vaca Official Site',
                  url: 'https://www.vacarestaurant.com/',
                  description: 'Spanish dining in Costa Mesa.',
                  extra_snippets: ['Chef-driven restaurant near Segerstrom Center.'],
                },
                {
                  title: 'Best Restaurants in Orange County',
                  url: 'https://example.com/best-restaurants',
                  description: 'Listicle content.',
                },
                {
                  title: 'Vaca on Yelp',
                  url: 'https://www.yelp.com/biz/vaca-costa-mesa',
                  description: 'Marketplace wrapper.',
                },
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const provider = new BraveSearchProvider(buildConfig(), { timeoutMs: 1000, retryCount: 0 });
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
            web: {
              results: [
                {
                  title: 'Reddit review of Vaca',
                  url: 'https://www.reddit.com/r/orangecounty/comments/abc123/vaca_review/',
                  description: 'A date night favorite with immersive service and family-friendly staff.',
                  extra_snippets: ['Great for date night and group-friendly dinners.'],
                },
                {
                  title: 'Local blog on Vaca',
                  url: 'https://foodblog.example.com/vaca-costa-mesa',
                  description: 'Rooftop-adjacent cocktails and immersive dining vibes.',
                },
                {
                  title: 'Instagram post',
                  url: 'https://www.instagram.com/p/example',
                  description: 'Blocked result.',
                },
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const provider = new BraveSearchProvider(buildConfig(), { timeoutMs: 1000, retryCount: 0 });
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

  it('expands community restaurant pages into venue-level discovery records', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              web: {
                results: [
                  {
                    title: 'r/orangecounty on Reddit: Classic, old school eateries?',
                    url: 'https://www.reddit.com/r/orangecounty/comments/example/classic_old_school_eateries/',
                    description: 'El Adobe in San Juan Capistrano is very old Mexican restaurant.',
                    extra_snippets: ['Old Brea Chop House (Brea) serves steaks.'],
                  },
                ],
              },
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            `
              <html>
                <body>
                  <main>
                    <ul>
                      <li>El Adobe in San Juan Capistrano is a very old Mexican restaurant.</li>
                      <li>Old Brea Chop House (Brea) serves steaks.</li>
                    </ul>
                  </main>
                </body>
              </html>
            `,
            { status: 200 },
          ),
        ),
    );

    const provider = new BraveSearchProvider(buildConfig(), { timeoutMs: 1000, retryCount: 0 });
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

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'El Adobe',
          provenance: 'search',
          city: 'San Juan Capistrano',
        }),
        expect.objectContaining({
          title: 'Old Brea Chop House',
          provenance: 'search',
          city: 'Brea',
        }),
      ]),
    );
    expect(records.some((record) => record.title.includes('Reddit'))).toBe(false);
  });

  it('reuses cached page mentions when an indexed page returns 304 not modified', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'search-page-cache-'));
    const cache = createFileSearchPageCache(path.join(tempDir, 'page-cache.json'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: 'r/orangecounty on Reddit: Classic, old school eateries?',
                  url: 'https://www.reddit.com/r/orangecounty/comments/example/classic_old_school_eateries/',
                  description: 'El Adobe in San Juan Capistrano is very old Mexican restaurant.',
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `
            <html>
              <body>
                <main>
                  <ul>
                    <li>El Adobe in San Juan Capistrano is a very old Mexican restaurant.</li>
                  </ul>
                </main>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              etag: '"page-v1"',
              'last-modified': 'Mon, 24 Mar 2026 00:00:00 GMT',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: 'r/orangecounty on Reddit: Classic, old school eateries?',
                  url: 'https://www.reddit.com/r/orangecounty/comments/example/classic_old_school_eateries/',
                  description: 'El Adobe in San Juan Capistrano is very old Mexican restaurant.',
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: 'El Adobe de Capistrano | Official Site',
                  url: 'https://www.eladobedecapistrano.com/',
                  description: 'Historic Mexican restaurant in San Juan Capistrano.',
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 304,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: 'El Adobe de Capistrano | Official Site',
                  url: 'https://www.eladobedecapistrano.com/',
                  description: 'Historic Mexican restaurant in San Juan Capistrano.',
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const metadata = buildDefaultSearchMetadata('Restaurants');

    const firstProvider = new BraveSearchProvider(buildConfig(), { timeoutMs: 1000, retryCount: 0 }, cache);
    const firstRecords = await firstProvider.discover({ metadata, logger });
    expect(firstRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'El Adobe',
          city: 'San Juan Capistrano',
        }),
      ]),
    );

    const secondProvider = new BraveSearchProvider(buildConfig(), { timeoutMs: 1000, retryCount: 0 }, cache);
    const secondRecords = await secondProvider.discover({ metadata, logger });
    expect(secondRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'El Adobe de Capistrano',
          url: 'https://www.eladobedecapistrano.com/',
        }),
      ]),
    );
    await rm(tempDir, { recursive: true, force: true });
  });

  it('resolves extracted one-word restaurant brands to an official site and preserves uniqueness evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              web: {
                results: [
                  {
                    title: "Orange County hidden dessert gems",
                    url: 'https://orangecoast.com/ocdining/hidden-dessert-gems/',
                    description: 'A roundup of dessert and boba spots in Costa Mesa.',
                  },
                ],
              },
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            `
              <html>
                <body>
                  <main>
                    <p><strong>Elixir</strong> in Costa Mesa offers soft serve, boba, and a dessert-lab style presentation.</p>
                  </main>
                </body>
              </html>
            `,
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              web: {
                results: [
                  {
                    title: 'Elixir Costa Mesa Official Site',
                    url: 'https://www.elixirdessertbar.com/',
                    description: 'Dessert lab with soft serve and boba in Costa Mesa.',
                    extra_snippets: ['An interactive dessert experience with one-of-a-kind presentation.'],
                  },
                ],
              },
            }),
            { status: 200 },
          ),
        ),
    );

    const provider = new BraveSearchProvider(buildConfig(), { timeoutMs: 1000, retryCount: 0 });
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

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Elixir',
          url: 'https://www.elixirdessertbar.com/',
          city: 'Costa Mesa',
        }),
      ]),
    );
    const elixir = records.find((record) => record.title === 'Elixir');
    expect(elixir?.summary).toContain('Dessert lab with soft serve and boba in Costa Mesa.');
    expect(elixir?.summary).toContain('dessert-lab style presentation');
  });

});
