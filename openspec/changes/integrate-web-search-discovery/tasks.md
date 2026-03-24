## 1. Search Configuration

- [x] 1.1 Add runtime and environment configuration for enabling web search, provider selection, credentials, and bounded query/result limits.
- [x] 1.2 Extend discovery metadata/config helpers so all four categories can derive deterministic search queries from existing SearchMetadata fields.

## 2. Search Provider

- [x] 2.1 Add a web-search provider interface and a first provider implementation that maps search responses into raw discovery records.
- [x] 2.2 Add deterministic query-building utilities for all four categories using category, region priority, focus terms, exclude terms, and category-specific templates.
- [x] 2.3 Add provenance and quality filters that prefer official/first-party pages and reject ads, directories, social-only pages, and broad list pages.
- [x] 2.4 Add category-specific validation for Nature place precision and Special Events date-window enforcement on search-derived candidates.
- [x] 2.5 Add a search-enrichment path for curated candidates that gathers bounded supporting context from public feedback and blog/editorial coverage.

## 3. Workflow Integration

- [x] 3.1 Integrate web-search discovery into the shared workflow so all four categories can combine curated and search-derived candidates.
- [x] 3.2 Preserve dry-run, bounded concurrency, warning propagation, and partial-success behavior for search queries and provider failures.
- [x] 3.3 Carry search provenance into discovery notes or equivalent audit fields without changing Airtable schemas.
- [x] 3.4 Enrich curated-source candidates before final scoring while keeping curated-source facts canonical and limiting enrichment score impact.

## 4. Verification and Documentation

- [x] 4.1 Add tests for query generation, provider result mapping, enrichment behavior, provenance filtering, category-specific validation, and workflow failure isolation.
- [x] 4.2 Update README and operational guidance for search configuration, enrichment behavior, category rollout, and search-specific limitations.
