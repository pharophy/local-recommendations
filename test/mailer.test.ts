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
