# tenancy Architecture

> Canonical v3.7 / frozen ERD3 is authoritative.

## Aggregate responsibility

Tenancy owns the rental relationship for one Room. Participation and agreed terms are separate first-class concepts inside the bounded context.

## Lifecycle

```text
DRAFT → ACTIVE
DRAFT → CANCELLED
ACTIVE → ENDING
ENDING → ACTIVE
ENDING → ENDED
```

`ENDED` and `CANCELLED` are terminal.

## Participants

`TenancyParticipant` is distinct from `User`. A participant may exist without a linked User. Active tenancy requires exactly one active `PRIMARY` participant and may have zero or more active `OCCUPANT` participants.

## Terms

`TenancyTerms` is versioned and owns rent, deposit requirement, tenancy dates, billing rules, utility rules and minimum-rental conditions. `TermsAcknowledgement` is version-specific. Financial changes take effect from the next billing boundary; MVP has no proration.

## Room coordination

- at most one non-terminal Tenancy per Room;
- no next DRAFT while current Tenancy is ENDING;
- confirmed checkout atomically performs Tenancy `ENDING → ENDED` and Room → `VACANT`.

## Rebuild note

The current direct `tenantId`, embedded terms object and old transition map are deliberately pre-ERD3 and must be replaced rather than adapted for compatibility.