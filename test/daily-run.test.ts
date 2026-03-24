import { describe, expect, it, vi } from 'vitest';

import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';
import type { DiscoveryProvider } from '../src/discovery/provider.js';
import { createRuntimeConfig } from '../src/config/runtime.js';
import { processCategory } from '../src/workflows/daily-run.js';

describe('processCategory', () => {
  it('carries source warnings into the category summary', async () => {
    const metadata = buildDefaultSearchMetadata('Activities');
    const provider: DiscoveryProvider = {
      async discover(context) {
        context.logger.warn('Discovery source failed', {
          sourceId: 'example-source',
          error: 'Timed out',
        });

        return [
          {
            category: 'Activities',
            source: {
              id: 'example-source',
              name: 'Example Source',
              url: 'https://example.com/source',
            },
            title: 'Example Activity',
            url: 'https://example.com/activity',
            summary: 'A hands-on outdoor activity for families in Anaheim.',
            city: 'Anaheim',
            region: 'Orange County',
            rawDateText: 'Example Activity',
          },
        ];
      },
    };

    const repository = {
      getExisting: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = await processCategory(
      metadata,
      [provider],
      [],
      repository as never,
      true,
      logger,
      createRuntimeConfig({
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
        HTTP_RETRY_COUNT: '2',
        DISCOVERY_CONCURRENCY: '4',
      }),
    );

    expect(result.inserted).toHaveLength(1);
    expect(result.warnings).toContain('Discovery source failed [example-source]: Timed out');
    expect(repository.insert).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
