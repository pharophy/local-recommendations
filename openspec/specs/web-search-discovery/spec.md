## ADDED Requirements

### Requirement: Web search can discover candidates for all four categories
The system SHALL support a web-search discovery provider for `Activities`, `Restaurants`, `Nature`, and `SpecialEvents` that returns candidate inputs compatible with the existing normalization pipeline.

#### Scenario: Search-backed activities discovery runs
- **WHEN** web search is enabled for `Activities`
- **THEN** the system issues one or more configured search queries for the category and returns raw discovery records for downstream normalization

#### Scenario: Search-backed restaurants discovery runs
- **WHEN** web search is enabled for `Restaurants`
- **THEN** the system issues one or more configured search queries for the category and returns raw discovery records for downstream normalization

#### Scenario: Search-backed nature discovery runs
- **WHEN** web search is enabled for `Nature`
- **THEN** the system issues one or more configured search queries for the category and returns raw discovery records for downstream normalization

#### Scenario: Search-backed special events discovery runs
- **WHEN** web search is enabled for `SpecialEvents`
- **THEN** the system issues one or more configured search queries for the category and returns raw discovery records for downstream normalization

### Requirement: Web search can enrich curated-source candidates
The system SHALL support a bounded search enrichment mode that uses web search to gather supplemental context for items already found through curated sources.

#### Scenario: Curated candidate is enriched from public coverage
- **WHEN** a curated-source candidate is eligible for enrichment
- **THEN** the system issues one or more search queries for that candidate and collects supporting context such as user feedback themes, blog coverage, or reputable editorial mentions

#### Scenario: Curated source remains canonical
- **WHEN** enrichment results are attached to a curated-source candidate
- **THEN** the candidate retains the curated source as its primary provenance and canonical URL

### Requirement: Search queries are built deterministically from metadata and category context
The system SHALL build search queries from category context, region priority, and relevant SearchMetadata fields using deterministic templates rather than opaque freeform generation.

#### Scenario: Region and focus terms shape the query
- **WHEN** SearchMetadata includes region priority and focus terms
- **THEN** the generated search queries include those signals in a deterministic order for the target category

#### Scenario: Exclude terms suppress noisy queries
- **WHEN** SearchMetadata includes exclude terms
- **THEN** the generated search queries avoid or explicitly negate those terms according to the configured query template rules

### Requirement: Search results must pass provenance and quality gates
The system SHALL prefer official and first-party result pages and SHALL reject low-quality search results such as ads, directories, social-only pages, marketplace wrappers, and broad non-entity pages before candidate normalization.

#### Scenario: First-party result is accepted
- **WHEN** a search result points to an official venue, destination, or operator page relevant to the category
- **THEN** the result is allowed to proceed into normalization

#### Scenario: Directory or ad result is rejected
- **WHEN** a search result points to an ad, generic directory, map/search wrapper, or obviously low-signal intermediary page
- **THEN** the result is rejected before candidate normalization

#### Scenario: Nature result lacks place precision
- **WHEN** a search result for `Nature` does not identify a specific park, preserve, trail, beach, or city/area with sufficient precision
- **THEN** the result is rejected before insertion

#### Scenario: Special event result lacks a valid in-window date
- **WHEN** a search result for `SpecialEvents` does not produce a parseable event date within the configured date window
- **THEN** the result is rejected before insertion

#### Scenario: Enrichment source is low quality
- **WHEN** a search result used for enrichment points to spam, scraped directories, ad-heavy low-signal pages, or unrelated content
- **THEN** the result is excluded from enrichment context

#### Scenario: Editorial or community restaurant pages act as seeds, not direct inserts
- **WHEN** a restaurant search result points to an editorial roundup, community thread, or similar recommendation page
- **THEN** the system may use that page as an extraction seed but MUST NOT insert the page itself as a restaurant candidate

#### Scenario: Extracted restaurant mentions require venue-level confidence
- **WHEN** a restaurant mention is extracted from an editorial or community seed page
- **THEN** the system only promotes the mention into normalization if the extracted name, location context, and surrounding text indicate a specific venue rather than a generic food term, city name, or page fragment

#### Scenario: Canonical restaurant site resolution preserves entity identity
- **WHEN** the system resolves an extracted or seed-derived restaurant candidate to an official site
- **THEN** it only replaces the candidate URL if the resolved page still refers to the same venue identity and otherwise keeps the original candidate URL

#### Scenario: Restaurant website fields prefer first-party pages
- **WHEN** a restaurant candidate is inserted with an official or first-party website available
- **THEN** the candidate website and canonical URL use that first-party page instead of a directory, marketplace, or unrelated event/listing page

### Requirement: Enrichment effects are bounded
The system SHALL bound how much search enrichment can alter descriptive fields or ranking so that curated-source facts remain primary and noisy public sentiment cannot dominate candidate quality.

#### Scenario: Enrichment adds supporting context
- **WHEN** enrichment produces relevant supporting evidence for a candidate
- **THEN** the system may add themes, summary cues, or discovery notes derived from that evidence

#### Scenario: Enrichment does not override canonical facts
- **WHEN** enrichment conflicts with the curated source's canonical name, URL, or basic location facts
- **THEN** the curated-source facts remain authoritative

### Requirement: Search behavior is bounded and configurable
The system SHALL make search enablement, credentials, query limits, result limits, and category toggles configurable so search can be enabled gradually and run within bounded cost and latency limits.

#### Scenario: Search is disabled
- **WHEN** web search is not enabled in runtime configuration
- **THEN** the provider does not issue search requests and the workflow continues with curated sources only

#### Scenario: Search result count is capped
- **WHEN** a category has more matching search results than the configured limit
- **THEN** the provider returns only up to the configured maximum number of results for downstream processing

#### Scenario: Category-level search can be disabled independently
- **WHEN** web search is disabled for one category but enabled for others
- **THEN** only the enabled categories issue search requests

#### Scenario: Canonicalization uses a bounded finalist budget
- **WHEN** seed expansion yields more potential restaurant mentions than can be economically verified
- **THEN** the system only issues official-site resolution queries for a bounded, prioritized finalist pool

#### Scenario: Request usage is reported by request type
- **WHEN** a run completes
- **THEN** the workflow summary reports separate request counts for search API calls, page fetches, Airtable requests, SMTP sends, retries, and relevant cache outcomes

### Requirement: Search page processing uses local caching and conditional revalidation
The system SHALL cache indexed search seed pages and canonical restaurant lookups locally so repeat runs can avoid unnecessary reprocessing while still refreshing when content changes.

#### Scenario: Unchanged seed pages reuse cached extraction
- **WHEN** a previously indexed seed page is fetched again and its cached validators or content hash show it has not changed
- **THEN** the system reuses the cached extracted mentions instead of reparsing the page body

#### Scenario: Conditional HTTP validators reduce transfer
- **WHEN** a cached seed page has a stored `ETag` or `Last-Modified` value
- **THEN** the next fetch sends conditional request headers and reuses cached mentions immediately when the server responds `304 Not Modified`

#### Scenario: Canonical restaurant lookups are cached
- **WHEN** an official-site lookup has already been attempted recently for the same normalized restaurant name and location
- **THEN** the system reuses the cached positive or negative lookup result instead of issuing the same search request again

#### Scenario: Failed or empty seed pages cool down temporarily
- **WHEN** a seed page recently failed to fetch or produced no valid mentions
- **THEN** the system temporarily skips reprocessing that page until the cooldown window expires

### Requirement: Search failures degrade gracefully
The system SHALL treat search-provider and per-query failures as warnings that do not prevent curated-source discovery or other categories from completing.

#### Scenario: Search query fails
- **WHEN** a search query request fails or times out
- **THEN** the system records a warning and continues processing the remaining queries, sources, or categories

#### Scenario: Search provider is misconfigured while disabled
- **WHEN** search-provider credentials are absent but search is disabled
- **THEN** the application starts successfully without requiring the search configuration
