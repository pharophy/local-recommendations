import { describe, expect, it } from 'vitest';

import { createRuntimeConfig } from '../src/config/runtime.js';
import { createDiscoveryProviders } from '../src/discovery/providers/index.js';

function buildConfig(overrides: NodeJS.ProcessEnv = {}) {
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
    ...overrides,
  });
}

describe('createDiscoveryProviders', () => {
  it('omits curated html providers when curated sources are globally disabled', () => {
    const services = createDiscoveryProviders(
      buildConfig({
        CURATED_SOURCES_ENABLED: 'false',
      }),
    );

    expect(services.discoveryProviders).toHaveLength(0);
    expect(services.enrichers).toHaveLength(0);
  });

  it('keeps workflow provider creation valid when specific curated source ids are disabled', async () => {
    const services = createDiscoveryProviders(
      buildConfig({
        DISABLED_CURATED_SOURCE_IDS: 'visit-anaheim-restaurants,opentable-oc-restaurants',
      }),
    );

    expect(services.discoveryProviders).toHaveLength(1);
    expect(services.enrichers).toHaveLength(0);
  });
});
