import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    return value.toLowerCase() === 'true';
  });

const envSchema = z.object({
  AIRTABLE_PAT: z.string().min(1),
  AIRTABLE_BASE_ID: z.string().min(1),
  AIRTABLE_TABLE_ACTIVITIES: z.string().min(1).default('Activities'),
  AIRTABLE_TABLE_RESTAURANTS: z.string().min(1).default('Restaurants'),
  AIRTABLE_TABLE_NATURE: z.string().min(1).default('Nature'),
  AIRTABLE_TABLE_SPECIAL_EVENTS: z.string().min(1).default('Special Events'),
  AIRTABLE_TABLE_SEARCH_METADATA: z.string().min(1).default('Search Metadata'),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanSchema.default(false),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  EMAIL_TO: z.string().email().default('shawn.souto@gmail.com'),
  DEFAULT_REGION_PRIORITY: z
    .string()
    .min(1)
    .default('Orange County,Los Angeles,Temecula,San Diego'),
  DEFAULT_SPECIAL_EVENTS_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  HTTP_RETRY_COUNT: z.coerce.number().int().nonnegative().default(2),
  DISCOVERY_CONCURRENCY: z.coerce.number().int().positive().default(4),
  CURATED_SOURCES_ENABLED: booleanSchema.default(true),
  DISABLED_CURATED_SOURCE_IDS: z.string().default(''),
  WEB_SEARCH_ENABLED: booleanSchema.default(false),
  WEB_SEARCH_PROVIDER: z.enum(['none', 'brave', 'google']).default('none'),
  WEB_SEARCH_API_KEY: z.string().default(''),
  WEB_SEARCH_GOOGLE_CX: z.string().default(''),
  WEB_SEARCH_COUNTRY: z.string().min(2).default('US'),
  WEB_SEARCH_SEARCH_LANG: z.string().min(2).default('en'),
  WEB_SEARCH_UI_LANG: z.string().min(2).default('en-US'),
  WEB_SEARCH_MAX_RESULTS_PER_QUERY: z.coerce.number().int().positive().default(5),
  WEB_SEARCH_MAX_ENRICHMENT_RESULTS: z.coerce.number().int().positive().default(3),
  WEB_SEARCH_MAX_QUERIES_PER_CATEGORY: z.coerce.number().int().positive().default(6),
  WEB_SEARCH_PAGE_CACHE_ENABLED: booleanSchema.default(true),
  WEB_SEARCH_PAGE_CACHE_FILE: z.string().min(1).default('.cache/web-search-page-cache.json'),
  WEB_SEARCH_ENABLE_ACTIVITIES: booleanSchema.default(false),
  WEB_SEARCH_ENABLE_RESTAURANTS: booleanSchema.default(false),
  WEB_SEARCH_ENABLE_NATURE: booleanSchema.default(false),
  WEB_SEARCH_ENABLE_SPECIAL_EVENTS: booleanSchema.default(false),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(input);
}
