# SoCal Experience Discovery Agent

This repository contains a production-oriented Node.js + TypeScript app for discovering unique Southern California experiences and persisting them to Airtable. The first version prioritizes Orange County, then Los Angeles, Temecula, and San Diego, and supports Activities, Restaurants, Nature, and Special Events.

The daily workflow reads SearchMetadata from Airtable, discovers candidates from curated official sources, can optionally add web-search discovery across all four categories, can enrich curated candidates with bounded public context, normalizes them into category-aware records, scores and filters them, deduplicates against Airtable, inserts up to five new items per category by default, and sends a summary email.

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

The implemented baseline behavior is captured in the main specs under [openspec/specs/experience-discovery-pipeline/spec.md](/C:/Users/shawn/Web%20Development/local-recommendations/openspec/specs/experience-discovery-pipeline/spec.md), [openspec/specs/airtable-control-plane/spec.md](/C:/Users/shawn/Web%20Development/local-recommendations/openspec/specs/airtable-control-plane/spec.md), and [openspec/specs/daily-email-summary/spec.md](/C:/Users/shawn/Web%20Development/local-recommendations/openspec/specs/daily-email-summary/spec.md). The current in-flight search expansion is defined in [openspec/changes/integrate-web-search-discovery/proposal.md](/C:/Users/shawn/Web%20Development/local-recommendations/openspec/changes/integrate-web-search-discovery/proposal.md).

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
- `CURATED_SOURCES_ENABLED`
- `DISABLED_CURATED_SOURCE_IDS`
- `WEB_SEARCH_ENABLED`
- `WEB_SEARCH_PROVIDER`
- `WEB_SEARCH_API_KEY`
- `WEB_SEARCH_GOOGLE_CX`
- `WEB_SEARCH_COUNTRY`
- `WEB_SEARCH_SEARCH_LANG`
- `WEB_SEARCH_UI_LANG`
- `WEB_SEARCH_MAX_RESULTS_PER_QUERY`
- `WEB_SEARCH_MAX_ENRICHMENT_RESULTS`
- `WEB_SEARCH_MAX_QUERIES_PER_CATEGORY`
- `WEB_SEARCH_PAGE_CACHE_ENABLED`
- `WEB_SEARCH_PAGE_CACHE_FILE`
- `WEB_SEARCH_ENABLE_ACTIVITIES`
- `WEB_SEARCH_ENABLE_RESTAURANTS`
- `WEB_SEARCH_ENABLE_NATURE`
- `WEB_SEARCH_ENABLE_SPECIAL_EVENTS`

For Airtable IDs, use only the base ID in `AIRTABLE_BASE_ID` and only the table name or table ID in each `AIRTABLE_TABLE_*` variable. Do not combine them into a single slash-delimited value.

Curated discovery controls:

- `CURATED_SOURCES_ENABLED=false` disables all curated HTML sources globally.
- `DISABLED_CURATED_SOURCE_IDS` accepts a comma-separated list of curated source `id` values, such as `visit-anaheim-restaurants,opentable-oc-restaurants`.

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
3. For each enabled category, fetch candidates from curated discovery sources and optional web-search providers.
4. Normalize candidate data into a shared domain model.
5. Optionally enrich curated-source candidates with bounded public context from web search while keeping curated facts canonical.
6. Score and filter candidates using metadata-driven focus terms, region priority, query-derived provenance, and event windows.
7. Deduplicate against existing Airtable records.
8. Insert up to the configured daily target per category.
9. Render and send a summary email, or preview it in dry-run mode.

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

Web-search query generation uses deterministic templates built from category, region priority, focus terms, audience bias, indoor/outdoor bias, price bias, exclude terms, and source-priority hints when search is enabled.

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

Dry-run mode performs discovery, optional search enrichment, normalization, scoring, filtering, and dedupe, then prints what would be inserted and previews the email summary without writing to Airtable or sending SMTP mail.

## Web Search

Web search is optional and disabled by default.

- `WEB_SEARCH_PROVIDER` currently supports `brave` and `google`.
- `WEB_SEARCH_GOOGLE_CX` is required when using `google`.
- Discovery can be enabled independently for `Activities`, `Restaurants`, `Nature`, and `SpecialEvents`.
- Search-page expansion caches hashed page content and previously extracted venue mentions in `WEB_SEARCH_PAGE_CACHE_FILE`; unchanged pages are reused instead of being reparsed.
- Search-derived candidates are marked in bot notes as web-search discoveries; curated candidates can also be enriched with bounded public context from search results.
- Nature search candidates must resolve to a specific place or city/area before they can insert.
- Special Events search candidates must produce a parseable date within the configured event window before they can insert.
- Search enrichment can add themes, audience hints, summary cues, and audit notes, but it cannot replace the curated source URL or core identity fields.
- Search failures degrade to warnings and do not block curated discovery for the category.

### Google Monitoring

If you use `WEB_SEARCH_PROVIDER=google`, monitor quota and throttling in Google Cloud Console:

1. Open `APIs & Services`.
2. Select `Custom Search API`.
3. Check the `Overview` page charts for traffic and errors.
4. Use `View metrics` to inspect traffic by response code and confirm whether `429` responses are occurring.
5. Open the `Quotas & System Limits` tab for the API and check current usage versus allowed quota.
6. In the broader `IAM & Admin > Quotas & System Limits` page, filter by the Custom Search API service if you need a project-wide quota view.

The app now emits explicit warnings for Google quota and rate-limit responses, including `HTTP 429`, the provider reason, and the query that triggered the issue, so dry runs and summary warnings can distinguish quota exhaustion from genuine zero-result searches.

## Source Flags

You can selectively turn off curated sources without editing code.

- Disable all curated sources:
```env
CURATED_SOURCES_ENABLED=false
```

- Disable specific curated sources by `id`:
```env
DISABLED_CURATED_SOURCE_IDS=visit-anaheim-restaurants,opentable-oc-restaurants
```

These flags only affect curated HTML sources. Web-search providers continue to run according to the `WEB_SEARCH_*` flags.

## Current Limitations

- V1 uses curated official-source HTML adapters, not browser automation.
- Generic HTML extraction will require source-by-source tuning as sites change.
- Search quality depends on provider result quality and domain/title rejection rules; some editorial or marketplace pages will still need source-by-source tuning.
- Event date extraction is conservative and will skip events outside the configured window or without a parseable date.
- Dedupe currently fetches existing table records instead of chunked formula lookups.

## Future Improvements

- Add more source-specific providers and extraction rules.
- Add scheduler and deployment packaging.
- Add richer retry telemetry and source health reporting.
- Move from table-wide dedupe fetches to chunked formula-based lookups for larger datasets.
