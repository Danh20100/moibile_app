# Handoff — V1 Backend Contracts Unblocking Android Frontend

**Owner of this closure pass:** Coordinator
**Date:** 2026-10-03
**Branch:** `backend/v1-frontend-unblock`
**Base staging SHA:** `2f67f7c0702c635e934dbbe3504aa2ec74da5f52`
**Current implementation SHA before this handoff commit:** `b9d65f6571e32a041cf6c7cbb93873a63d8522ba`

## 1. Purpose

This branch closes backend/API/read-model gaps that blocked Khánh Băng's Android V1 implementation. The branch does **not** invent OPEN policy and does not promote FUTURE capabilities.

Authority remains:

`docs/database/v1/canonical.md` > frozen Database v1 ERD/schema > contexts > V1 backlogs > generated OpenAPI > implementation.

---

## 2. Backend contracts now available to Android

### Room -> current Listing

`GET /api/v1/listings?roomId={roomId}`

- protected;
- caller must operate the Room;
- returns the current non-ARCHIVED Listing;
- `404` means the Room currently has no Listing;
- Android no longer needs to guess a Listing ID.

### Public spatial + price Search

`GET /api/v1/listings/public/search`

Query:

```tex
latitude      required
longitude     required
radiusMeters  required
minPrice      optional numeric(18,2)
maxPrice      optional numeric(18,2)
```

Properties:

- public endpoint;
- PostGIS query;
- only `PUBLISHED` Listings;
- location comes only from `Listing.publicLocationProjection`;
- exact operational Property address/location is never returned;
- optional price-range filtering uses exact decimal semantics;
- returns `distanceMeters` for list/map rendering.

This closes coordinate/radius location search. It does **not** invent a textual area/geocoder contract.

### Payment history by Tenancy

`GET /api/v1/finance/payments?tenancyId={tenancyId}`

- operator or historically linked participant can read according to `assertCanReadTenancy`;
- unrelated users are rejected;
- Payment remains separate from Billing, Allocation and Receipt.

### Incident timeline

`GET /api/v1/incidents/{incidentId}/events`

- returns append-only `IncidentEvent` history;
- source authorization is enforced;
- deterministic event ordering;
- Android can now render real ticket history instead of an empty timeline.

### Notification Center

Existing routes:

```tex
GET  /api/v1/notifications
GET  /api/v1/notifications/{id}
POST /api/v1/notifications/{id}/read
```

Notification responses now expose read-only derived navigation fields:

```tex
sourceType
sourceId
```

These are parsed from the authoritative `messageOrPayloadReference`. They do not become a second business source of truth.

### Dashboard read model

`GET /api/v1/organizations/{organizationId}/dashboard`

Current source-backed fields:

```tex
roomsByState
activeTenancyCoun
openIncidentCoun
outstandingReceivable = null
confirmedPaymentTotal = null
```

The two finance aggregate fields intentionally remain `null`: Canonical freezes the categories but does not freeze enough aggregation/window and charge-overallocation semantics to manufacture authoritative totals. Android must not reconstruct those totals locally.

### Deposit lifecycle projection

Routes:

```tex
POST /api/v1/finance/deposits
GET  /api/v1/finance/deposits?tenancyId={tenancyId}
GET  /api/v1/finance/deposits/{depositId}/events
POST /api/v1/finance/deposits/{depositId}/settlements
```

Projection:

```tex
id
tenancyId
requirementAmoun
fundedAmoun
settledAmoun
heldAmoun
state
blockedByOpenPolicy
```

Deposit requirement is derived from versioned Terms. Funding comes from DepositPaymentApplication. Settlement comes from DepositSettlement/DepositEvent.

When the unresolved `Deposit requirement change after partial funding` policy becomes relevant, the backend returns:

```tex
requirementAmount = null
state = null
blockedByOpenPolicy = true
```

instead of inventing policy.

### Former-rental history

`GET /api/v1/tenancies/{tenancyId}/history`

Authorized for operator or user with participant history. Projection composes existing source facts:

```tex
Tenancy
Terms versions
Payments + Receipts
Notices
Incidents + IncidentEvents
Deposit projection + DepositEvents
```

Incident has no canonical Tenancy foreign key. For this read projection only, Room Incidents are included when `Incident.createdAt` falls inside the Tenancy occupancy window. This does not create a new Incident -> Tenancy source relation.

Former tenants keep this historical read while losing current operational write permissions.

### Operator Room operational history

`GET /api/v1/rooms/{roomId}/history`

Operator-only projection composed from source facts:

```tex
Room current source record
all Listings for Room + ListingStatusEvents
all Tenancies for Room
BillingCycles per Tenancy
Payments + Receipts per Tenancy
Deposit projection/events where presen
Room Incidents + IncidentEvents
```

No duplicated history table was introduced.

---

## 3. Command contracts cleaned for Android

Android must no longer manufacture audit/provenance fields.

### Listing publish

`POST /api/v1/listings/{id}/publish`

Body: none.

Server derives `reasonCode`, `actorType`, `actorUserId`, and `trigger` from the command and verified principal.

### Listing unpublish

`POST /api/v1/listings/{id}/unpublish`

Body: none.

### Listing archive

`POST /api/v1/listings/{id}/archive`

Body: none.

### Manual Room operational transition

`POST /api/v1/rooms/{id}/operational-state`

Body:

```json
{ "operationalState": "vacant | maintenance | inactive" }
```

`OCCUPIED` remains owned by Tenancy activation and cannot be impersonated through this command.

### Tenancy activation

`POST /api/v1/tenancies/{id}/activate`

Body:

```json
{ "occurredAt": "ISO timestamp" }
```

Transition audit actor/provenance is server-derived.

### Terms acknowledgemen

`POST /api/v1/tenancies/{tenancyId}/terms/{termsId}/acknowledgements`

Body contains:

```tex
tenancyParticipantId
acknowledgedA
```

`userId` is derived from the verified principal. Client cannot spoof it.

### Tenancy Notice

Issue:

`POST /api/v1/tenancies/{tenancyId}/notices`

Body contains:

```tex
noticeType
contentOrNote
issuedA
```

`issuedByUserId` is server-derived and issuing is operator-owned.

Acknowledge:

`POST /api/v1/tenancies/{tenancyId}/notices/{noticeId}/acknowledge`

Body contains only:

```tex
occurredA
```

Acknowledging user is derived from the verified active linked participant.

---

## 4. Explicitly still blocked by authority — Android must not inven

### Textual public area / geocoder label

Canonical freezes public location projection and Location filtering, but does not define an authoritative textual area-label schema or geocoding provider. The backend now supports public coordinate/radius search. A field such as `publicAreaLabel = 'Thủ Đức'` remains unsupported until authority/provider semantics are frozen.

Status: `BLOCKED_BY_AUTHORITY`.

### Availability filter vocabulary/semantics

`Availability` is a frozen Search capability, and `PUBLISHED -> Room VACANT` is frozen. However Canonical does not define an independent availability field/vocabulary/query semantics. Adding `AVAILABLE`, dates, or future availability would invent policy.

Status: `BLOCKED_BY_AUTHORITY`.

### Room/property type filter

Canonical explicitly marks authoritative owner and vocabulary as `OPEN`.

Status: `BLOCKED_BY_OPEN_POLICY`.

### Terms nested object schemas

Canonical names these required Terms objects:

```tex
billingDayOrDueDateRule
electricityArrangemen
waterArrangemen
minimalRentalConditions
```

but does not freeze their inner JSON schema. Backend continues to round-trip them as opaque structured facts instead of inventing fields/enums.

Status: `BLOCKED_BY_AUTHORITY`.

### Dashboard finance totals

Categories are frozen, but authoritative aggregation semantics are not sufficiently frozen. Fields remain explicit nullable server fields, not client-computed guesses.

Status: `BLOCKED_BY_AUTHORITY`.

---

## 5. Commits in this backend-unblock branch

```tex
4e22fb9 feat(api): unblock v1 frontend backend contracts
615d352 feat(read-models): expose dashboard and notification sources
92abd98 feat(finance): expose deposit lifecycle projection
e52a324 feat(api): derive lifecycle command provenance server side
32b94c6 feat(history): expose rental and room operational projections
b9d65f6 feat(search): expose public radius and price filters
```

---

## 6. Verification evidence

Latest branch verification after history/search work:

```tex
pnpm openapi:generate                 PASS
pnpm lint                             PASS
pnpm e2e:coverage                     PASS
  83 atomic flows
  198 cases
  24 V1 backlog files
  8 frozen Notification use cases

pnpm test                             PASS
  284 / 284

pnpm test:conformance:database-v1     PASS
  57 / 57

pnpm build                            PASS
git diff --check                      PASS
```

PostGIS integration test was also run explicitly against local `trooi_test` only:

```tex
public spatial search returns only published in-range public projections and applies price range
1 / 1 PASS
```

---

## 7. What Khánh Băng should wire after integration

After this branch is reviewed and merged into staging, Android can replace the remaining read placeholders with backend authority:

1. populate `operatorListings` via `GET /listings?roomId=...` for each operated Room;
2. populate Payment history using `GET /finance/payments?tenancyId=...` rather than receipt-driven single-payment lookups;
3. populate Incident `timeline` from `/incidents/{id}/events`;
4. populate `dashboardByOrganization` from `/organizations/{organizationId}/dashboard`;
5. populate Notification Center and navigate from `sourceType/sourceId`;
6. populate Deposit screen from `/finance/deposits?tenancyId=...` and event history;
7. use `/tenancies/{id}/history` for former/current authorized rental history;
8. use `/rooms/{id}/history` for operator operational history;
9. use `/listings/public/search` for coordinate/radius + price Search/Map;
10. simplify publish/unpublish/archive/Room state/Tenancy activate/Terms ack/Notice request bodies to the server-owned contracts above.

Do not replace the still-blocked textual area, availability, room/property type, or nested Terms policies with local Android enums/defaults.

---

## 8. Integration status

```tex
BACKEND_CONTRACT_IMPLEMENTATION: GREEN
OPEN/FUTURE_BOUNDARIES: PRESERVED
ANDROID_CONSUMPTION: NOT YET WIRED TO THESE NEW CONTRACTS
MERGED_TO_STAGING: NO
MERGED_TO_MAIN: NO
```
