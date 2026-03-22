import { describe, expect, it } from 'vitest';

import { parseEnv } from '../src/config/env.js';

describe('parseEnv', () => {
  it('parses required environment values', () => {
    const env = parseEnv({
      AIRTABLE_PAT: 'pat',
      AIRTABLE_BASE_ID: 'app',
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
    });

    expect(env.SMTP_PORT).toBe(587);
    expect(env.AIRTABLE_TABLE_ACTIVITIES).toBe('Activities');
  });
});
