# Backlogs

This folder contains only **current, explicitly scoped implementation work** for the integration baseline.

Backlog documents are execution aids, not product/domain authority. They must not override `docs/database/<current-version>/canonical.md`, silently resolve an `OPEN` policy, or promote a `FUTURE` capability into current scope.

## Current state

No legacy backend feature brief from `integration/backend-database` remains active here.

The eight former backend feature briefs for Listing, Inquiry, Tenancy, Tenancy Participant, Tenancy Terms, Terms Acknowledgement, Tenancy Notice, and Rental Lifecycle were implemented and later wired to PostgreSQL persistence. They are preserved as historical execution context under:

`docs/archives/backlogs/backend-wave-b/`

## Rules

- Add a file here only for work that is still pending and explicitly in scope.
- Keep one coherent capability/workstream per backlog file.
- Link the backlog item to the authority/contract it implements.
- Move delivered or superseded briefs out of the live backlog so this folder answers one question: **what still remains to be done?**
- Canonical `OPEN` and `FUTURE` entries do not automatically become backlog items; they require an explicit scope decision first.
