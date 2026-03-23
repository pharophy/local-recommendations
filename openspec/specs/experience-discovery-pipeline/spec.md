## ADDED Requirements

### Requirement: Daily discovery targets are metadata-driven
The system SHALL execute a daily discovery workflow for Activities, Restaurants, Nature, and SpecialEvents, and SHALL determine each category's enabled state, daily target, focus terms, exclusions, and region priority from the SearchMetadata table with sensible defaults.

#### Scenario: Default target is applied
- **WHEN** a SearchMetadata row omits `DailyTargetNewItems`
- **THEN** the system uses a default daily target of 5 new items for that category

#### Scenario: Disabled categories are skipped
- **WHEN** a SearchMetadata row has `Enabled` set to false
- **THEN** the daily workflow skips discovery and insertion for that category

### Requirement: Discovery must preserve category-specific handling
The system SHALL use category-aware source selection, normalization, and field mapping for Activities, Restaurants, Nature, and SpecialEvents while keeping a shared pipeline for orchestration.

#### Scenario: Category-specific sources are used
- **WHEN** the daily workflow runs for a category
- **THEN** the system only queries discovery sources registered for that category

#### Scenario: Category-specific fields are preserved
- **WHEN** a normalized candidate is prepared for Airtable insertion
- **THEN** the system maps the candidate into the field set required by that category's Airtable table

### Requirement: Search metadata influences ranking and filtering
The system SHALL derive discovery queries, ranking boosts, and filters from `SearchFocus`, `IncludeTerms`, `ExcludeTerms`, `AudienceBias`, `KidFocus`, `IndoorOutdoorBias`, `PriceBias`, `RegionPriority`, `DateWindowDays`, and `SourcePriorityNotes`.

#### Scenario: Include and exclude terms affect scoring
- **WHEN** a candidate strongly matches include terms and does not match exclude terms
- **THEN** the candidate receives a higher ranking than a similar candidate without those matches

#### Scenario: Event window is enforced
- **WHEN** the category is `SpecialEvents`
- **THEN** the system excludes candidates whose event dates fall outside the configured lookahead window, defaulting to 30 days

### Requirement: Deduplication prevents duplicate inserts
The system SHALL compute a normalized duplicate key from category, normalized name, normalized city or region, and canonical URL or source URL fallback, and SHALL avoid inserting candidates already represented in Airtable or obvious duplicate name-plus-city pairs.

#### Scenario: Existing duplicate key is skipped
- **WHEN** a candidate duplicate key already exists in the corresponding Airtable table
- **THEN** the candidate is marked as skipped and is not inserted

#### Scenario: Obvious duplicate names are skipped
- **WHEN** a candidate has the same normalized name and city as an existing record
- **THEN** the candidate is treated as a duplicate even if the URLs differ

### Requirement: Dry-run preserves visibility without side effects
The system SHALL support a dry-run mode that performs discovery, scoring, filtering, and deduplication, reports intended inserts and skips, and MUST NOT write to Airtable or send email.

#### Scenario: Dry-run prints intended inserts
- **WHEN** the daily workflow is run with `--dry-run`
- **THEN** the output includes which records would be inserted and which were skipped

#### Scenario: Dry-run suppresses writes
- **WHEN** the daily workflow is run with `--dry-run`
- **THEN** no Airtable create requests or SMTP send operations occur

### Requirement: Failures allow partial success
The system SHALL continue processing remaining sources and categories when an individual source fetch or category step fails, and SHALL report warnings in logs and the daily summary.

#### Scenario: Source failure is isolated
- **WHEN** one discovery source times out or returns invalid content
- **THEN** the system records a warning and continues with the remaining sources for that category

#### Scenario: Category failure does not halt run
- **WHEN** one category cannot complete
- **THEN** the system continues running the other enabled categories and marks the failed category in the summary
