import { describe, expect, it } from 'vitest';

import { renderDailySummaryEmail } from '../src/email/summary.js';

describe('renderDailySummaryEmail', () => {
  it('renders category counts and highlights', () => {
    const email = renderDailySummaryEmail({
      startedAt: '2026-03-22T08:00:00.000Z',
      finishedAt: '2026-03-22T08:05:00.000Z',
      dryRun: true,
      warnings: ['One source timed out'],
      requestMetrics: {
        braveSearchRequests: 6,
        googleSearchRequests: 0,
        searchPageFetchRequests: 4,
        curatedPageFetchRequests: 1,
        airtableRequests: 3,
        smtpRequests: 0,
        httpRetries: 1,
        seedCacheSkips: 1,
        canonicalCacheHits: 2,
      },
      results: [
        {
          category: 'Activities',
          inserted: [
            {
              category: 'Activities',
              name: 'Mystic Trail',
              region: 'Orange County',
              city: 'Laguna Beach',
              shortDescription: 'A scenic fantasy-style walk.',
              whyUnique: 'Unique',
              themes: ['fantasy'],
              audience: [],
              kidFriendly: true,
              indoorOutdoor: 'Outdoor',
              priceLevel: '$',
              reservationRecommended: false,
              website: 'https://example.com',
              sourceName: 'Example',
              sourceUrl: 'https://example.com/source',
              canonicalUrl: 'https://example.com',
              botScore: 22,
              lastVerifiedAt: '2026-03-22T08:00:00.000Z',
              duplicateKey: 'x',
              searchFocusSnapshot: '',
              discoveryNotes: '',
              status: 'New',
              createdByBotAt: '2026-03-22T08:00:00.000Z',
              visited: false,
            },
          ],
          skippedDuplicates: [],
          rejected: [],
          warnings: [],
          discoveredCount: 3,
          requestMetrics: {
            braveSearchRequests: 0,
            googleSearchRequests: 0,
            searchPageFetchRequests: 0,
            curatedPageFetchRequests: 2,
            airtableRequests: 0,
            smtpRequests: 0,
            httpRetries: 0,
            seedCacheSkips: 0,
            canonicalCacheHits: 0,
          },
        },
      ],
    });

    expect(email.subject).toContain('2026-03-22');
    expect(email.text).toContain('Activities: inserted 1');
    expect(email.text).toContain('Total requests: brave 6');
    expect(email.text).toContain('Requests: brave 0, google 0, search pages 0, curated pages 2');
    expect(email.text).toContain('Mystic Trail');
  });
});
