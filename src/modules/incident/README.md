# incident

> Authority: Canonical v3.7 / frozen ERD3 override this module and current code.

## Purpose

`incident` owns the problem lifecycle for a Room and append-only IncidentEvent history.

## Categories

`ELECTRICAL | PLUMBING | ACCESS_SECURITY | ROOM_FACILITY | APPLIANCE | OTHER`

## Lifecycle

- `REPORTED → ACKNOWLEDGED | REJECTED | CLOSED`
- `ACKNOWLEDGED → IN_PROGRESS | REJECTED`
- `IN_PROGRESS → RESOLVED | CLOSED`
- `RESOLVED → CLOSED | IN_PROGRESS`

`REJECTED` and `CLOSED` are terminal.

## Invariants

- meaningful history is append-only through IncidentEvent;
- a Room with an open Incident cannot be archived;
- Incident is distinct from TrustReport/moderation.

## Known pre-ERD3 code drift

Current code uses free-form categories plus `processing` / `need_more_information`, lacks `REJECTED`, lacks reopen from `RESOLVED`, and has no first-class append-only IncidentEvent model.