# Wave B Entry Baseline

**Status:** RUNTIME-VERIFIED entry baseline  
**Branch:** `backend/core-foundations`  
**SHA tested:** `12e32ce06be40da72bf27d4cb6d4a2762b450074`  
**Authority:** approved Wave B spec + Canonical v3.7 / frozen ERD authority

## Predecessor gate

```text
focused core + conformance: PASS — 55/55
pnpm typecheck: PASS
python database validators: PASS — 45/45
```

The GREEN predecessor boundaries remain Identity, Organization, Property, Room, and the FUTURE runtime boundary.

## Focused Wave B baseline

Command:

```bash
pnpm exec tsx --test \
  tests/conformance/erd3/listing.contract.test.ts \
  tests/conformance/erd3/tenancy.contract.test.ts
```

Observed: `15 tests`, `1 pass`, `14 fail`.
### Listing — EXPECTED RED

```text
LISTING lifecycle is DRAFT PUBLISHED UNPUBLISHED ARCHIVED only
LISTING no longer uses hidden or rented states
LISTING does not duplicate Property ownership beside Room ownership
publishing is coupled to Room vacancy and active Property eligibility
Room leaving VACANT has an explicit synchronous unpublish workflow
Room has at most one current non-archived Listing
listing status change has a first-class event history concept
```

### Tenancy — EXPECTED RED

```text
TENANCY lifecycle matches frozen ERD3 transitions
TENANCY does not embed tenantId as participant truth
TenancyParticipant is a first-class concept with optional USER link
TenancyTerms is first-class and versioned rather than embedded mutable terms
Terms acknowledgement is version-specific
Room has at most one non-terminal Tenancy
ENDING tenancy blocks creation of a next DRAFT tenancy for the Room
```

The source-level checkout coordination assertion already passes because Core H6 exposes the Room `checkout_confirmed` cause. Full checkout orchestration remains Wave B ownership.
## Known stale source facts at entry

```text
Listing: hidden/rented lifecycle, duplicate propertyId, no first-class status event history.
Tenancy: embedded tenantId + mutable terms, incomplete FSM, no first-class Participant/Terms/Acknowledgement/Notice services.
Room HTTP: manual operational-state route can currently bypass Listing invalidation.
```

## Explicitly outside the Wave B entry gate

```text
Finance — Wave C
Incident / Trust — Wave D
Auth/resource authorization — Wave E
PostgreSQL application wiring / transaction locking — database lane
Redis — after PostgreSQL persistence plan
```

No failure in those later boundaries is reclassified as a Wave B defect by this baseline.
