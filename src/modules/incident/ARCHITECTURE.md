# incident Architecture

> Canonical v3.7 / frozen Database v1 is authoritative.

## Ownership

Incident owns Room-related problem lifecycle. IncidentEvent owns append-only history for incident facts/transitions.

## State machine

```text
REPORTED → ACKNOWLEDGED | REJECTED | CLOSED
ACKNOWLEDGED → IN_PROGRESS | REJECTED
IN_PROGRESS → RESOLVED | CLOSED
RESOLVED → CLOSED | IN_PROGRESS
```

`REJECTED` and `CLOSED` are terminal.

## Category contract

`ELECTRICAL | PLUMBING | ACCESS_SECURITY | ROOM_FACILITY | APPLIANCE | OTHER`

## Cross-context guard

Open Incident blocks Room archival. Incident history does not become TrustReport history and TrustReport does not become Incident.

## Rebuild note

The current `processing` / `need_more_information` transition map, free-form category DTO and mutable ticket-history approach are pre-database-v1 and intentionally fail conformance.