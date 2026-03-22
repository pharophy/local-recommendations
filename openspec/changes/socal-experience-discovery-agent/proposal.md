## Why

The repository needs a production-quality foundation for a daily discovery agent that can find unique SoCal experiences, persist curated recommendations to Airtable, and deliver a daily summary email. Building the first version now creates a maintainable baseline for expanding providers, themes, and regions without rewriting the core workflow later.

## What Changes

- Add a strict TypeScript + Node.js ESM project scaffold with linting, testing, build, and CLI entrypoints.
- Define Airtable-backed domain models for Activities, Restaurants, Nature, Special Events, and SearchMetadata control records.
- Implement a daily workflow that loads search metadata, discovers candidates from curated sources, normalizes and scores them, deduplicates against Airtable, inserts up to the configured daily target, and sends a summary email.
- Add dry-run support, logging, bounded concurrency, timeout and retry handling, and partial-failure behavior.
- Add documentation, schema export helpers, and metadata seed/bootstrap commands.

## Capabilities

### New Capabilities
- `experience-discovery-pipeline`: Daily category-aware discovery, normalization, scoring, filtering, and deduplication for SoCal experiences.
- `airtable-control-plane`: Airtable schema modeling, metadata-driven configuration, dedupe checks, and record persistence for each experience table.
- `daily-email-summary`: Daily digest generation and SMTP delivery, including dry-run previews and partial-success reporting.

### Modified Capabilities

- None.

## Impact

- Adds a full TypeScript application under `src/` with modular discovery, Airtable, scoring, dedupe, email, and CLI layers.
- Introduces runtime dependencies for parsing, validation, email, concurrency control, and dates.
- Establishes OpenSpec artifacts, repository instructions, README guidance, and a documented Airtable schema.
