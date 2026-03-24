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

### Requirement: Enrichment effects are bounded
The system SHALL bound how much search enrichment can alter descriptive fields or ranking so that curated-source facts remain primary and noisy public sentiment cannot dominate candidate quality.

#### Scenario: Enrichment adds supporting context
- **WHEN** enrichment produces relevant supporting evidence for a candidate
- **THEN** the system may add themes, summary cues, or discovery notes derived from that evidence

#### Scenario: Enrichment does not override canonical facts
- **WHEN** enrichment conflicts with the curated source’s canonical name, URL, or basic location facts
- **THEN** the curated-source facts remain authoritative

### Requirement: Search behavior is bounded and configurable
The system SHALL make search enablement, credentials, query limits, and result limits configurable so search can be enabled gradually and run within bounded cost and latency limits.

#### Scenario: Search is disabled
- **WHEN** web search is not enabled in runtime configuration
- **THEN** the provider does not issue search requests and the workflow continues with curated sources only

#### Scenario: Search result count is capped
- **WHEN** a category has more matching search results than the configured limit
- **THEN** the provider returns only up to the configured maximum number of results for downstream processing

#### Scenario: Category-level search can be disabled independently
- **WHEN** web search is disabled for one category but enabled for others
- **THEN** only the enabled categories issue search requests

### Requirement: Search failures degrade gracefully
The system SHALL treat search-provider and per-query failures as warnings that do not prevent curated-source discovery or other categories from completing.

#### Scenario: Search query fails
- **WHEN** a search query request fails or times out
- **THEN** the system records a warning and continues processing the remaining queries, sources, or categories

#### Scenario: Search provider is misconfigured while disabled
- **WHEN** search-provider credentials are absent but search is disabled
- **THEN** the application starts successfully without requiring the search configuration
