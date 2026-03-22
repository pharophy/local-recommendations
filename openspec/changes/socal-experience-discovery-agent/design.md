## Context

The repository currently has planning artifacts but no working application structure. The system needs a first runnable version that supports four content categories, metadata-driven search focus, Airtable persistence via REST, and an SMTP email digest. The design must stay maintainable because the discovery sources and heuristics will evolve as the catalog grows across Orange County, Los Angeles, Temecula, and San Diego.

## Goals / Non-Goals

**Goals:**

- Create a strict, testable TypeScript/Node ESM application with a usable CLI and clear module boundaries.
- Model the Airtable schema in code and keep record mapping deterministic.
- Make search metadata the control plane for daily targets, terms, region priorities, and event windows.
- Isolate discovery providers from extraction, scoring, dedupe, Airtable, and email concerns.
- Support dry-run, bounded concurrency, timeout and retry handling, and partial success reporting.

**Non-Goals:**

- Building a headless browser crawler or dynamic site automation in V1.
- Creating Airtable bases or tables automatically through unsupported APIs.
- Achieving perfect extraction quality for every curated source on day one.
- Adding a scheduler or deployment workflow beyond the CLI-driven daily command.

## Decisions

### 1. Use a modular pipeline with shared candidate models

The workflow will move through `discovery -> extract -> score -> dedupe -> persist -> email`, with small modules for each step. This keeps category-specific logic isolated while still using one shared candidate shape for orchestration and testing.

Alternative considered: separate per-category pipelines. Rejected because it would duplicate dedupe, Airtable, and email logic before category behavior is complex enough to justify it.

### 2. Use curated official-source definitions plus a generic HTML adapter

V1 will prefer curated first-party tourism, parks, museum, and event pages. A generic HTML adapter with selectors and heuristics is sufficient to demonstrate the full flow and is easy to extend with more source definitions or richer providers later.

Alternative considered: search-engine driven discovery. Rejected for V1 because it adds another integration and makes deterministic testing and source control weaker.

### 3. Keep Airtable integration behind a thin REST client and repository layer

The Airtable client will handle authenticated fetches, pagination, formulas, and record creation. Repositories will parse metadata rows, fetch existing records for dedupe, and map domain objects to Airtable fields.

Alternative considered: direct fetch calls inside workflow modules. Rejected because it would blur transport, schema, and business rules.

### 4. Score using deterministic heuristics informed by SearchMetadata

Scoring will combine base uniqueness, focus-term relevance, region priority, kid/family bias, and event recency. Filtering will remove duplicates and out-of-window events before insert. This keeps the system predictable and testable.

Alternative considered: a single opaque ranking function. Rejected because it would reduce explainability and make search metadata behavior harder to reason about.

### 5. Treat failures as warnings at the category or source level

The daily run will continue if one source fetch fails or one category cannot complete, then include warnings in logs and the summary email. Missing required environment variables remain a hard startup failure because the system cannot operate safely without them.

Alternative considered: fail the entire run on any source error. Rejected because daily discovery should degrade gracefully.

## Risks / Trade-offs

- [Generic HTML parsing will miss some site-specific structure] -> Keep source definitions isolated and easy to refine with selectors and source-level hints.
- [Fetching all existing Airtable records for dedupe may become slower as tables grow] -> Keep the repository abstraction narrow so formula-based chunked lookups can replace it later without changing workflow code.
- [Official pages may change markup frequently] -> Use conservative parsing, bounded concurrency, retries, and partial-failure handling.
- [Event date extraction from unstructured text is imperfect] -> Filter Special Events conservatively and only insert records whose window can be validated.

## Migration Plan

- No data migration is required because this is the first application version.
- Manual setup remains required for Airtable base/table creation and SMTP credentials.
- The `docs-airtable-schema` and `seed-search-metadata` commands provide bootstrap artifacts for the manual base setup.

## Open Questions

- Which curated sources should be promoted from generic adapters to source-specific adapters first after observing real run quality?
- Should future versions store per-source fetch telemetry in Airtable or a separate log sink?
