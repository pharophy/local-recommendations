import { describe, expect, it } from 'vitest';

import { createRuntimeConfig } from '../src/config/runtime.js';

describe('createRuntimeConfig', () => {
  it('builds disabled web search config by default', () => {
    const config = createRuntimeConfig({
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

    expect(config.webSearch.enabled).toBe(false);
    expect(config.webSearch.provider).toBe('none');
    expect(config.webSearch.enabledCategories.Activities).toBe(false);
    expect(config.curatedSources.enabled).toBe(true);
    expect(config.curatedSources.disabledSourceIds).toEqual([]);
  });

  it('parses curated source flags', () => {
    const config = createRuntimeConfig({
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
      CURATED_SOURCES_ENABLED: 'false',
      DISABLED_CURATED_SOURCE_IDS: 'visit-anaheim-restaurants, opentable-oc-restaurants ',
    });

    expect(config.curatedSources.enabled).toBe(false);
    expect(config.curatedSources.disabledSourceIds).toEqual([
      'visit-anaheim-restaurants',
      'opentable-oc-restaurants',
    ]);
  });

  it('requires an API key when Brave search is enabled', () => {
    expect(() =>
      createRuntimeConfig({
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
        WEB_SEARCH_ENABLED: 'true',
        WEB_SEARCH_PROVIDER: 'brave',
        WEB_SEARCH_ENABLE_ACTIVITIES: 'true',
      }),
    ).toThrow('WEB_SEARCH_API_KEY');
  });

  it('requires a cx value when Google Custom Search is enabled', () => {
    expect(() =>
      createRuntimeConfig({
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
        WEB_SEARCH_ENABLED: 'true',
        WEB_SEARCH_PROVIDER: 'google',
        WEB_SEARCH_API_KEY: 'test-key',
        WEB_SEARCH_ENABLE_ACTIVITIES: 'true',
      }),
    ).toThrow('WEB_SEARCH_GOOGLE_CX');
  });
});
