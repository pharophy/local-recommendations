import { describe, expect, it, vi } from 'vitest';

import { buildDefaultSearchMetadata } from '../src/domain/search-metadata.js';
import type { DiscoveryProvider } from '../src/discovery/provider.js';
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
      repository as never,
      true,
      logger,
    );

    expect(result.inserted).toHaveLength(1);
    expect(result.warnings).toContain('Discovery source failed [example-source]: Timed out');
    expect(repository.insert).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
