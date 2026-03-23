## 1. Repository Foundation

- [x] 1.1 Scaffold strict TypeScript, ESM, npm, lint, test, and build configuration.
- [x] 1.2 Add repository instructions, environment example, ignore files, formatting config, and README scaffolding.

## 2. OpenSpec Artifacts

- [x] 2.1 Create proposal, design, and capability specs for the discovery pipeline, Airtable control plane, and daily email summary.
- [x] 2.2 Align implementation structure and command surface with the OpenSpec requirements.

## 3. Core Domain and Configuration

- [x] 3.1 Model categories, search metadata, candidate experiences, Airtable schema fields, and runtime configuration.
- [x] 3.2 Add environment validation, logging, timeout/retry helpers, and shared utility functions.

## 4. Airtable and Discovery

- [x] 4.1 Implement Airtable REST client and repositories for metadata, dedupe checks, inserts, and schema docs.
- [x] 4.2 Implement curated sources, generic HTML discovery providers, extraction, normalization, scoring, and deduplication.

## 5. Workflow, Email, and CLI

- [x] 5.1 Implement the daily workflow with dry-run support, partial-success handling, and email summary generation/sending.
- [x] 5.2 Add CLI commands and npm scripts for daily runs, Airtable checks, metadata seeding, and schema documentation.

## 6. Verification and Documentation

- [x] 6.1 Add tests for configuration, metadata parsing, scoring, dedupe, Airtable mapping, event filtering, and email rendering.
- [x] 6.2 Finish the README with setup, architecture, Airtable schema, command usage, limitations, and next steps.

## 7. Post-Launch Quality Hardening

Status: 8 of 8 hardening tasks complete.

- [x] 7.1 Pull the live Airtable schema, align write mappings to production field names, and fix live SMTP transport behavior.
- [x] 7.2 Tighten curated-source and scoring filters to reject generic listicles, category pages, social/share links, and same-run duplicate inserts.
- [x] 7.3 Normalize noisy event titles, add partial city inference for event records, and clean the worst pre-filter Airtable rows.
- [x] 7.4 Improve event location inference so out-of-region or mislabeled Fever-style events do not inherit `Los Angeles` incorrectly.
- [x] 7.5 Improve Nature city/area precision so parks and preserves do not default to broad region labels like `Orange County`.
- [x] 7.6 Make the remaining `SearchMetadata` controls influence discovery ranking, including `IndoorOutdoorBias`, `PriceBias`, and `SourcePriorityNotes`.
- [x] 7.7 Surface source-level discovery failures in category warnings and the daily summary email instead of logging them only.
- [x] 7.8 Align the Airtable behavior spec and README with the production human-feedback fields (`My Rating`, `My Comments`, `Tried On`, `Attended On`).
