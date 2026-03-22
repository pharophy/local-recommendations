#!/usr/bin/env node
import { AirtableClient } from '../airtable/client.js';
import { SearchMetadataRepository } from '../airtable/repositories.js';
import {
  renderSchemaCsvHeaders,
  renderSchemaMarkdown,
  renderSeedMetadataJson,
} from '../airtable/schema.js';
import { createRuntimeConfig } from '../config/runtime.js';
import { isExperienceCategory } from '../domain/categories.js';
import { createLogger } from '../utils/logger.js';
import { runDailyWorkflow } from '../workflows/daily-run.js';

async function main(): Promise<void> {
  const [command = 'help', ...args] = process.argv.slice(2);

  if (command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  const config = createRuntimeConfig();
  const logger = createLogger(config.env.LOG_LEVEL);
  const client = new AirtableClient(config.env.AIRTABLE_PAT, config.env.AIRTABLE_BASE_ID, {
    timeoutMs: config.env.HTTP_TIMEOUT_MS,
    retryCount: config.env.HTTP_RETRY_COUNT,
  });

  if (command === 'daily-run') {
    const dryRun = args.includes('--dry-run');
    const summary = await runDailyWorkflow(config, logger, dryRun);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (command === 'check-airtable') {
    await client.verifyTable(config.tableNames.SearchMetadata);
    for (const category of ['Activities', 'Restaurants', 'Nature', 'SpecialEvents'] as const) {
      await client.verifyTable(config.tableNames[category]);
    }
    console.log('Airtable connection verified.');
    return;
  }

  if (command === 'seed-search-metadata') {
    const dryRun = args.includes('--dry-run');
    const repository = new SearchMetadataRepository(client, config);
    const seeded = await repository.seedDefaults(dryRun);
    console.log(JSON.stringify({ dryRun, seeded }, null, 2));
    return;
  }

  if (command === 'docs-airtable-schema') {
    if (args.includes('--csv')) {
      console.log(renderSchemaCsvHeaders());
      return;
    }
    if (args.includes('--seed-json')) {
      console.log(renderSeedMetadataJson());
      return;
    }
    console.log(renderSchemaMarkdown());
    return;
  }

  if (command === 'validate-category') {
    const category = args[0] ?? '';
    console.log(isExperienceCategory(category) ? 'valid' : 'invalid');
    return;
  }

  printHelp();
  process.exitCode = 1;
}

function printHelp(): void {
  console.log(`SoCal Discovery Agent

Commands:
  daily-run [--dry-run]
  check-airtable
  seed-search-metadata [--dry-run]
  docs-airtable-schema [--csv|--seed-json]

Scripts:
  npm run dev -- --help
  npm run daily
  npm run daily:dry
  npm run check:airtable
  npm run seed:metadata
  npm run docs:schema`);
}

await main();
