## Why

The current discovery system depends on curated sources, which limits coverage when new venues, parks, and time-bounded events appear outside the maintained source list. Adding a controlled web-search layer now improves freshness and breadth across Activities, Restaurants, Nature, and Special Events without replacing the deterministic pipeline that already works in production.

## What Changes

- Add a web-search-backed discovery path for all four categories: `Activities`, `Restaurants`, `Nature`, and `SpecialEvents`.
- Add a search-backed enrichment step for curated-source candidates so the pipeline can gather supporting context from public reviews, blog posts, and other relevant coverage before scoring and insertion.
- Extend discovery configuration so metadata can influence search query construction, source allowlists, and how many search results are inspected per category.
- Add deterministic filtering and provenance rules so search-derived candidates prefer official or first-party pages and reject low-quality directories, ads, and generic list pages, with stricter event-date and nature-location validation where required.
- Preserve dry-run, partial-failure, and bounded-concurrency behavior when web search is enabled.
- Update documentation and test coverage for the new search-backed discovery flow.

## Capabilities

### New Capabilities
- `web-search-discovery`: Search-backed discovery providers, query building, result filtering, provenance handling, and enrichment lookups for all four experience categories.

### Modified Capabilities
- `experience-discovery-pipeline`: Discovery requirements change so all four categories can use both curated-source and web-search inputs within the shared pipeline.

## Impact

- Affected code in `src/discovery`, `src/workflows`, `src/config`, and scoring/filtering modules.
- New environment and runtime configuration for the search provider, category enablement, and per-category query/result limits.
- Additional tests for query generation, result filtering, enrichment behavior, failure isolation, and search-provider integration.
- No Airtable schema change is required if search-derived candidates continue to normalize into the existing experience model.
