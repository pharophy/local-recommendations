## ADDED Requirements

### Requirement: Daily summary email reports run outcomes
The system SHALL produce a daily summary email after each run that includes the run timestamp, inserted counts per category, skipped or duplicate counts, highlights, and warnings or failures.

#### Scenario: Summary includes category counts
- **WHEN** the daily workflow completes
- **THEN** the summary email includes the number of inserted records per category and the number of skipped duplicates

#### Scenario: Summary includes warnings
- **WHEN** one or more sources or categories fail during the run
- **THEN** the summary email includes those warnings or failures

### Requirement: SMTP delivery is configurable and previewable
The system SHALL use SMTP configuration from environment variables, default the recipient to `shawn.souto@gmail.com`, and support a dry-run preview that prints the rendered digest without sending it.

#### Scenario: Default recipient is used
- **WHEN** `EMAIL_TO` is not overridden
- **THEN** the summary email is addressed to `shawn.souto@gmail.com`

#### Scenario: Dry-run preview is printed
- **WHEN** the daily workflow runs in dry-run mode
- **THEN** the rendered email subject and body are printed to stdout instead of being sent
