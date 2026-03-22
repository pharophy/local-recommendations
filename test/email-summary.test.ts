import { describe, expect, it } from 'vitest';

import { renderDailySummaryEmail } from '../src/email/summary.js';

describe('renderDailySummaryEmail', () => {
  it('renders category counts and highlights', () => {
    const email = renderDailySummaryEmail({
      startedAt: '2026-03-22T08:00:00.000Z',
      finishedAt: '2026-03-22T08:05:00.000Z',
      dryRun: true,
      warnings: ['One source timed out'],
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
        },
      ],
    });

    expect(email.subject).toContain('2026-03-22');
    expect(email.text).toContain('Activities: inserted 1');
    expect(email.text).toContain('Mystic Trail');
  });
});
