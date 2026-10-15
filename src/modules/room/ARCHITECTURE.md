# room Architecture

> Canonical v3.7 / frozen Database v1 is authoritative.

## Ownership

Room owns rental-unit identity and dual-state lifecycle. Rent/price truth belongs to Terms/Listing, not Room.

## Invariants

- operational FSM is cause-aware and rejects every unspecified transition;
- HTTP manual mutation cannot impersonate `tenancy_activated` / `checkout_confirmed`;
- parent Property lifecycle is re-read from PropertyService, never cached inside Room;
- archive is a guarded record-lifecycle command, not an operational-state target.
