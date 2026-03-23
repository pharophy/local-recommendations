## ADDED Requirements

### Requirement: SearchMetadata is the discovery control plane
The system SHALL read SearchMetadata before discovery work begins and SHALL use the row for each target table to drive daily discovery behavior.

#### Scenario: Metadata is loaded first
- **WHEN** the daily workflow starts
- **THEN** the system fetches SearchMetadata before discovering candidates for any category

#### Scenario: Default region priority is applied
- **WHEN** `RegionPriority` is blank in SearchMetadata
- **THEN** the system uses `Orange County, Los Angeles, Temecula, San Diego`

### Requirement: Airtable schema is represented in code and documentation
The system SHALL define each table's field list in code, expose schema documentation through a command, and document the schema in the repository README.

#### Scenario: Schema docs can be generated
- **WHEN** the schema documentation command is run
- **THEN** the system prints a table-by-table field listing and example CSV headers

#### Scenario: Human feedback fields are preserved
- **WHEN** the system inserts a new record
- **THEN** the record includes writable human fields such as `My Rating`, `My Comments`, and visit-date fields like `Tried On` or `Attended On` without overwriting them later

### Requirement: Airtable writes are bounded and category-specific
The system SHALL write at most the configured number of new records per category per daily run and SHALL only insert records into the corresponding Airtable table.

#### Scenario: Insert count is capped
- **WHEN** more than the target number of non-duplicate candidates are available
- **THEN** the system inserts only the top-ranked records up to the category target

#### Scenario: Category table mapping is honored
- **WHEN** a Restaurant candidate is ready for persistence
- **THEN** the system inserts it into the Restaurants table and not another category table
