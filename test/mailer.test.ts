import { describe, expect, it } from 'vitest';

import type { AppEnv } from '../src/config/env.js';
import { buildSmtpOptions } from '../src/email/mailer.js';

function buildEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    AIRTABLE_PAT: 'pat',
    AIRTABLE_BASE_ID: 'app123',
    AIRTABLE_TABLE_ACTIVITIES: 'Activities',
    AIRTABLE_TABLE_RESTAURANTS: 'Restaurants',
    AIRTABLE_TABLE_NATURE: 'Nature',
    AIRTABLE_TABLE_SPECIAL_EVENTS: 'Special Events',
    AIRTABLE_TABLE_SEARCH_METADATA: 'Search Metadata',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_SECURE: true,
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    EMAIL_FROM: 'bot@example.com',
    EMAIL_TO: 'user@example.com',
    DEFAULT_REGION_PRIORITY: 'Orange County,Los Angeles,Temecula,San Diego',
    DEFAULT_SPECIAL_EVENTS_WINDOW_DAYS: 30,
    LOG_LEVEL: 'info',
    HTTP_TIMEOUT_MS: 10000,
    HTTP_RETRY_COUNT: 2,
    DISCOVERY_CONCURRENCY: 4,
    CURATED_SOURCES_ENABLED: true,
    DISABLED_CURATED_SOURCE_IDS: '',
    WEB_SEARCH_ENABLED: false,
    WEB_SEARCH_PROVIDER: 'none',
    WEB_SEARCH_API_KEY: '',
    WEB_SEARCH_GOOGLE_CX: '',
    WEB_SEARCH_COUNTRY: 'US',
    WEB_SEARCH_SEARCH_LANG: 'en',
    WEB_SEARCH_UI_LANG: 'en-US',
    WEB_SEARCH_MAX_RESULTS_PER_QUERY: 5,
    WEB_SEARCH_MAX_ENRICHMENT_RESULTS: 3,
    WEB_SEARCH_MAX_QUERIES_PER_CATEGORY: 6,
    WEB_SEARCH_PAGE_CACHE_ENABLED: true,
    WEB_SEARCH_PAGE_CACHE_FILE: '.cache/web-search-page-cache.json',
    WEB_SEARCH_ENABLE_ACTIVITIES: false,
    WEB_SEARCH_ENABLE_RESTAURANTS: false,
    WEB_SEARCH_ENABLE_NATURE: false,
    WEB_SEARCH_ENABLE_SPECIAL_EVENTS: false,
    ...overrides,
  };
}

describe('buildSmtpOptions', () => {
  it('uses STARTTLS on port 587 even if SMTP_SECURE is true in env', () => {
    const options = buildSmtpOptions(buildEnv({ SMTP_PORT: 587, SMTP_SECURE: true }));

    expect(options.secure).toBe(false);
    expect(options.requireTLS).toBe(true);
  });

  it('uses implicit TLS on port 465', () => {
    const options = buildSmtpOptions(buildEnv({ SMTP_PORT: 465, SMTP_SECURE: true }));

    expect(options.secure).toBe(true);
    expect(options.requireTLS).toBe(false);
  });
});
