## Context

The current discovery workflow is intentionally deterministic: curated sources are fetched, normalized, scored, deduped, and written into Airtable. That keeps the pipeline understandable, but it also means all four categories only improve when curated source coverage is maintained by hand. A web-search layer adds broader discovery coverage, but it also introduces lower-quality result sets, ads, directories, and result volatility, so the design must preserve the repo’s current quality controls, dry-run behavior, and partial-failure guarantees. Nature and Special Events also have stricter correctness requirements around location and dates than Activities and Restaurants, so the design must support category-specific gating. Search can also be valuable after discovery, as a bounded enrichment step that adds public context to curated-source candidates before scoring.

## Goals / Non-Goals

**Goals:**

- Add web-search discovery for `Activities`, `Restaurants`, `Nature`, and `SpecialEvents` without changing Airtable schemas or the shared candidate model.
- Keep search-provider logic isolated behind a provider adapter so the rest of the pipeline continues to work on normalized candidates.
- Allow curated-source candidates to trigger a bounded search enrichment step that can improve summaries, themes, and scoring context without replacing the original source of truth.
- Prefer official and first-party pages, then clearly bounded editorial pages, while rejecting obvious low-quality search results.
- Make search usage configurable by environment and metadata so it can be enabled gradually and tuned without rewriting the workflow.
- Preserve dry-run, bounded concurrency, retries, and category/source failure isolation.
- Apply category-specific safety checks for event dates and nature location precision before search-derived candidates can be inserted.

**Non-Goals:**

- Replacing curated sources for any category.
- Building a browser crawler, SERP scraper, or LLM-only extraction path.
- Changing Airtable table structures or email templates beyond existing summary behavior.

## Decisions

### 1. Add a dedicated web-search provider interface and keep search separate from HTML extraction

The system will add a `WebSearchProvider` adapter that returns search result records for all four categories. The workflow will combine curated-source candidates and search-derived candidates before normalization/scoring, but search transport and query logic will remain isolated from HTML source parsing.

Alternative considered: extending the existing HTML provider to also perform search. Rejected because search transport, result ranking, and provenance rules are conceptually different from page scraping and would blur responsibilities.

### 2. Search results will be query-driven and metadata-aware, but only through deterministic templates

Search queries will be built from category, region priority, `SearchFocus`, `IncludeTerms`, `ExcludeTerms`, and optional source-priority hints. Query generation will use deterministic templates such as `"<region> immersive dining official site"`, `"<region> unusual park preserve official"`, or `"<region> limited-run event official"` rather than opaque freeform prompt generation.

Alternative considered: hand-authored per-category query lists in code only. Rejected because it would underuse the existing SearchMetadata control plane and make tuning less flexible.

### 3. Search results will pass through a provenance gate before candidate creation

Before search results become discovery candidates, the provider will classify them as preferred official/first-party, allowed editorial, or rejected. The provider will reject ads, map/search result wrappers, directories, social-only pages, marketplace noise, and broad listicles by URL/domain/title rules. Allowed editorial pages remain possible, but only if they survive the existing entity-specific filtering. Nature and Special Events will apply stricter post-search validation: nature records must infer a specific place/city, and event records must produce a valid in-window date or be rejected.

Alternative considered: letting the downstream scoring and filters clean all search results. Rejected because bad search results are cheaper to discard at the provider boundary and would otherwise create unnecessary normalization and dedupe noise.

### 4. Search will support both discovery mode and enrichment mode

The search layer will support two bounded uses:
- discovery mode: search results become new raw candidates
- enrichment mode: search queries are issued for an already discovered curated candidate to collect supporting snippets, source domains, and lightweight sentiment/context signals

Enrichment mode will not replace the curated candidate’s canonical URL or primary source. Instead, it will attach supplemental context that can influence `whyUnique`, `themes`, `discoveryNotes`, and optionally score boosts when the supporting evidence comes from allowed sources.

Alternative considered: using search only for discovery. Rejected because curated-source candidates often have thin summaries, and enrichment from real user feedback or blog coverage can improve ranking and human usefulness without requiring a schema change.

### 5. Search integration will be additive and configurable per category

All four categories will be able to use both curated sources and web search in the same run. Runtime configuration will control whether search is enabled globally and per category, which provider implementation is used, the maximum results per query, and a per-category cap on how many search-derived candidates can reach scoring.

Alternative considered: replacing curated sources entirely when search is enabled. Rejected because curated sources are currently the most reliable, high-signal inputs and should remain the baseline.

### 6. Search failures will be treated like source failures, not startup failures

If a search query or provider request fails, the system will record a warning and continue with the rest of that category and the remaining categories. Missing required search configuration will only be a startup failure if web search is explicitly enabled.

Alternative considered: failing the entire category when search is unavailable. Rejected because curated sources should still provide useful results and because this change is intended to improve coverage, not create a new single point of failure.

## Risks / Trade-offs

- [Search results can degrade quality if filters are too permissive] -> Apply first-party preference, domain/title rejection rules, and existing single-entity filtering before records reach Airtable.
- [Search APIs vary across providers and may change contracts] -> Keep a small provider interface and isolate vendor-specific request/response mapping in one module.
- [More discovery inputs can increase duplicates and noisy ranking] -> Preserve duplicate-key checks and add explicit provenance fields or notes to make search-derived records auditable.
- [Enrichment can overfit to noisy editorial chatter or low-signal reviews] -> Bound enrichment sources, cap how much enrichment can affect scoring, and preserve curated-source facts as canonical.
- [Metadata-driven query building can become hard to reason about] -> Use a fixed query template set and cover it with unit tests.
- [Search cost and latency can grow quickly] -> Bound query count, result count, and concurrency, and let metadata disable search by category when needed.
- [Nature and event search results can look relevant but still be structurally unusable] -> Require place precision for Nature and parseable in-window dates for Special Events before insertion.

## Migration Plan

- Add environment variables for search-provider enablement and credentials, defaulting search to off.
- Introduce the web-search provider and query builder behind the discovery interface.
- Enable search category by category after dry-run validation, starting with Activities/Restaurants and extending to Nature/Special Events once quality gates are verified.
- Roll out enrichment separately from discovery if needed, so curated-source augmentation can be validated before broadening new-candidate search.
- Roll back by disabling the search feature flag; curated-source discovery continues unchanged.

## Open Questions

- Which search provider should be the first production implementation for this repo: a generic JSON search API, a custom search engine, or another provider?
- Should SearchMetadata gain an explicit `SearchEnabled`/`SearchSeedDomains` field later, or is environment-plus-existing metadata sufficient for V1?
- Do we want summary output to distinguish curated versus web-search inserts explicitly, or is provenance in bot notes enough for the first release?
- How much should enrichment affect score and descriptive fields before it becomes too opinionated or too dependent on noisy public sentiment?
