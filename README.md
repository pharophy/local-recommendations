# SoCal Experience Discovery Agent

This repository contains a production-oriented Node.js + TypeScript app for discovering unique Southern California experiences and persisting them to Airtable. The first version prioritizes Orange County, then Los Angeles, Temecula, and San Diego, and supports Activities, Restaurants, Nature, and Special Events.

The daily workflow reads SearchMetadata from Airtable, discovers candidates from curated official sources, normalizes them into category-aware records, scores and filters them, deduplicates against Airtable, inserts up to five new items per category by default, and sends a summary email.

## Architecture

- `src/config`: environment loading and runtime configuration.
- `src/domain`: shared category, metadata, and experience models.
- `src/discovery`: source definitions and provider adapters.
- `src/extract`: deterministic normalization from raw source records into common candidate models.
- `src/score`: ranking and category-aware filtering.
- `src/dedupe`: duplicate-key generation and obvious-duplicate checks.
- `src/airtable`: schema definitions, REST client, repository layer, and payload mapping.
- `src/email`: daily digest rendering and SMTP delivery.
- `src/workflows`: orchestration for the daily run.
- `src/cli`: CLI entrypoint and commands.
- `test`: focused unit tests for key behavior.

## OpenSpec

The feature is specified under [openspec/changes/socal-experience-discovery-agent/proposal.md](/C:/Users/shawn/Web%20Development/local-recommendations/openspec/changes/socal-experience-discovery-agent/proposal.md), [openspec/changes/socal-experience-discovery-agent/design.md](/C:/Users/shawn/Web%20Development/local-recommendations/openspec/changes/socal-experience-discovery-agent/design.md), and the capability specs in [openspec/changes/socal-experience-discovery-agent/specs/experience-discovery-pipeline/spec.md](/C:/Users/shawn/Web%20Development/local-recommendations/openspec/changes/socal-experience-discovery-agent/specs/experience-discovery-pipeline/spec.md).

Before making major feature changes, read the relevant OpenSpec artifacts and [AGENTS.md](/C:/Users/shawn/Web%20Development/local-recommendations/AGENTS.md).

## Setup

1. Use Node 20 or newer.
2. Copy `.env.example` to `.env`.
3. Fill in Airtable and SMTP credentials.
4. Install dependencies with `npm install`.

## Environment Variables

Required values are documented in `.env.example`.

- `AIRTABLE_PAT`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_ACTIVITIES`
- `AIRTABLE_TABLE_RESTAURANTS`
- `AIRTABLE_TABLE_NATURE`
- `AIRTABLE_TABLE_SPECIAL_EVENTS` default: `Special Events`
- `AIRTABLE_TABLE_SEARCH_METADATA` default: `Search Metadata`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `EMAIL_TO`
- `DEFAULT_REGION_PRIORITY`
- `DEFAULT_SPECIAL_EVENTS_WINDOW_DAYS`
- `LOG_LEVEL`
- `HTTP_TIMEOUT_MS`
- `HTTP_RETRY_COUNT`
- `DISCOVERY_CONCURRENCY`

For Airtable IDs, use only the base ID in `AIRTABLE_BASE_ID` and only the table name or table ID in each `AIRTABLE_TABLE_*` variable. Do not combine them into a single slash-delimited value.

## Commands

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run dev -- --help`
- `npm run daily`
- `npm run daily:dry`
- `npm run check:airtable`
- `npm run seed:metadata`
- `npm run docs:schema`

CLI commands:

- `daily-run`
- `check-airtable`
- `seed-search-metadata`
- `docs-airtable-schema`

## VS Code Debugging

VS Code launch configs are included under `.vscode/` for:

- `Daily Run (Dry Run)`
- `Daily Run`
- `Check Airtable`
- `Seed Search Metadata`
- `Docs Airtable Schema`

They run the TypeScript CLI directly with `node --import tsx`, use `${workspaceFolder}/.env`, and open in the integrated terminal. Put your Airtable and SMTP values in `.env`, then start a config from the Run and Debug panel.

## Daily Run Flow

1. Load and validate environment variables.
2. Fetch `SearchMetadata` from Airtable.
3. For each enabled category, fetch candidates from curated discovery sources.
4. Normalize candidate data into a shared domain model.
5. Score and filter candidates using metadata-driven focus terms, region priority, and event windows.
6. Deduplicate against existing Airtable records.
7. Insert up to the configured daily target per category.
8. Render and send a summary email, or preview it in dry-run mode.

## SearchMetadata Control Table

SearchMetadata is the control plane for discovery. Fields:

- `TableName`
- `Enabled`
- `DailyTargetNewItems`
- `SearchFocus`
- `IncludeTerms`
- `ExcludeTerms`
- `AudienceBias`
- `KidFocus`
- `IndoorOutdoorBias`
- `PriceBias`
- `RegionPriority`
- `DateWindowDays`
- `SourcePriorityNotes`
- `Notes`
- `UpdatedAt`

Behavior:

- The bot reads SearchMetadata before discovery begins.
- `SearchFocus`, `IncludeTerms`, `ExcludeTerms`, `AudienceBias`, `KidFocus`, `IndoorOutdoorBias`, `PriceBias`, `RegionPriority`, `DateWindowDays`, and `SourcePriorityNotes` influence discovery, ranking, or filtering.
- `RegionPriority` defaults to `Orange County, Los Angeles, Temecula, San Diego`.
- `SpecialEvents` default to a 30-day lookahead window.
- `DailyTargetNewItems` defaults to 5.

Example focuses supported by the scoring and filtering pipeline include fantasy themed, sci-fi, classic rock, immersive dining, kid STEM, gem mining, waterfalls, caves, scenic overlooks, pop-ups, and limited-run events.

## Airtable Tables

Use `npm run docs:schema` to print the schema from code. `npm run docs:schema -- --csv` prints CSV headers, and `npm run docs:schema -- --seed-json` prints example SearchMetadata rows.

Tables:

- `Activities`
- `Restaurants`
- `Nature`
- `Special Events`
- `Search Metadata`

Each experience table includes human feedback fields:

- `My Rating`
- `My Comments`
- `Tried On` for Activities, Restaurants, and Nature
- `Attended On` for Special Events

## Manual Airtable Setup

The app uses Airtable REST APIs for reads and writes, but table creation still needs to be done manually in Airtable:

1. Create a base.
2. Create the five tables listed above using `npm run docs:schema`.
3. Add the documented fields to each table.
4. Add a few SearchMetadata rows or run `npm run seed:metadata` after the table exists.

## Dry Run

Use `npm run daily:dry` or `npm run dev -- daily-run --dry-run`.

Dry-run mode performs discovery, normalization, scoring, filtering, and dedupe, then prints what would be inserted and previews the email summary without writing to Airtable or sending SMTP mail.

## Current Limitations

- V1 uses curated official-source HTML adapters, not browser automation.
- Generic HTML extraction will require source-by-source tuning as sites change.
- Event date extraction is conservative and will skip events outside the configured window or without a parseable date.
- Dedupe currently fetches existing table records instead of chunked formula lookups.

## Future Improvements

- Add more source-specific providers and extraction rules.
- Add scheduler and deployment packaging.
- Add richer retry telemetry and source health reporting.
- Move from table-wide dedupe fetches to chunked formula-based lookups for larger datasets.
