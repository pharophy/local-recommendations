## MODIFIED Requirements

### Requirement: Discovery must preserve category-specific handling
The system SHALL use category-aware source selection, normalization, and field mapping for Activities, Restaurants, Nature, and SpecialEvents while keeping a shared pipeline for orchestration. All four categories SHALL be able to combine curated-source discovery with web-search discovery when search is enabled.

#### Scenario: Category-specific sources are used
- **WHEN** the daily workflow runs for a category
- **THEN** the system only queries discovery sources registered for that category

#### Scenario: Category-specific fields are preserved
- **WHEN** a normalized candidate is prepared for Airtable insertion
- **THEN** the system maps the candidate into the field set required by that category's Airtable table

#### Scenario: Activities can combine curated and search discovery
- **WHEN** the daily workflow runs for `Activities` with web search enabled
- **THEN** the workflow combines curated-source and search-derived candidates before scoring and deduplication

#### Scenario: Restaurants can combine curated and search discovery
- **WHEN** the daily workflow runs for `Restaurants` with web search enabled
- **THEN** the workflow combines curated-source and search-derived candidates before scoring and deduplication

#### Scenario: Nature can combine curated and search discovery
- **WHEN** the daily workflow runs for `Nature` with web search enabled
- **THEN** the workflow combines curated-source and search-derived candidates before scoring and deduplication

#### Scenario: Special events can combine curated and search discovery
- **WHEN** the daily workflow runs for `SpecialEvents` with web search enabled
- **THEN** the workflow combines curated-source and search-derived candidates before scoring and deduplication

#### Scenario: Curated candidates can be enriched before scoring
- **WHEN** a curated-source candidate is eligible for search enrichment
- **THEN** the workflow enriches the candidate with bounded search-derived context before final scoring and deduplication
