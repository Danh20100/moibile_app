# room Architecture

> Canonical v3.7 / frozen ERD3 is authoritative.

## Aggregate responsibility

Room owns identity and two separate dimensions:

- `operational_state`: `VACANT | OCCUPIED | MAINTENANCE | INACTIVE`
- `record_lifecycle`: `ACTIVE | ARCHIVED`

Do not collapse archive into operational state.

## Valid semantic rules

- `OCCUPIED → MAINTENANCE` is invalid.
- `OCCUPIED → INACTIVE` is invalid.
- Room archive requires `INACTIVE` and no non-terminal Tenancy/open Incident.
- Listing publication is coupled to Room vacancy; leaving `VACANT` synchronously unpublishes the current Listing.
- Confirmed checkout coordinates Tenancy `ENDING → ENDED` with Room → `VACANT` in one transaction boundary.

## Ownership exclusions

Room does not own:

- agreed rent/deposit/billing terms;
- public Listing price/content;
- Tenancy participants;
- Payment/Receipt facts;
- Incident history.

## Rebuild note

The pre-ERD3 `VALID_TRANSITIONS` map and `basePrice` contract are intentionally incompatible with this architecture and should be removed during the core rebuild.