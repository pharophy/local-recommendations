# Repository Instructions

- Read the relevant OpenSpec artifacts in `openspec/changes/` before making large feature changes.
- Prefer `npm` for package management and scripts.
- Run `npm run lint`, `npm run test`, and `npm run build` before considering work complete.
- Preserve Airtable schema compatibility when changing field names or payload mapping.
- Keep scraping and fetch logic isolated behind discovery providers and source adapters.
- Never hardcode secrets or production credentials.
- Prefer deterministic parsing and transforms over fragile LLM-only extraction.
- Favor official and first-party sources before editorial or aggregator sources.
- Keep region priority ordered as `Orange County > Los Angeles > Temecula > San Diego` unless metadata overrides it.
- Keep daily workflow behavior safe for partial failure: one category failing must not block the others.
- Maintain dry-run behavior for commands that write to Airtable or send email.
