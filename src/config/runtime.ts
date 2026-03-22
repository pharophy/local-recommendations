import type { ExperienceCategory } from '../domain/categories.js';
import { parseEnv } from './env.js';

export interface RuntimeConfig {
  env: ReturnType<typeof parseEnv>;
  tableNames: Record<ExperienceCategory | 'SearchMetadata', string>;
  defaultRegionPriority: string[];
}

export function createRuntimeConfig(input: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const env = parseEnv(input);
  const baseId = normalizeAirtableBaseId(env.AIRTABLE_BASE_ID);

  return {
    env: {
      ...env,
      AIRTABLE_BASE_ID: baseId,
    },
    tableNames: {
      Activities: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_ACTIVITIES),
      Restaurants: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_RESTAURANTS),
      Nature: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_NATURE),
      SpecialEvents: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_SPECIAL_EVENTS),
      SearchMetadata: normalizeAirtableTableIdentifier(env.AIRTABLE_TABLE_SEARCH_METADATA),
    },
    defaultRegionPriority: env.DEFAULT_REGION_PRIORITY.split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function normalizeAirtableBaseId(value: string): string {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.find((part) => part.startsWith('app')) ?? value.trim();
}

function normalizeAirtableTableIdentifier(value: string): string {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return value.trim();
  }

  return parts.find((part) => part.startsWith('tbl')) ?? parts.at(-1) ?? value.trim();
}
