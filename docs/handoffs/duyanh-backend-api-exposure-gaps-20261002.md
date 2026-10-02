# HANDOFF — DUY ANH — Backend/API Exposure Gaps Blocking Android V1

> Date: 2026-10-02  
> Owner: Duy Anh — Backend + Database  
> Working branch: `backend/v1-e2e-flow-closure`  
> Branch head when this handoff was created: `a77c48bb5e624a2a0d3bf0c5eb6401f0d50fc20a`  
> Shared staging baseline: `97a3897a3cd64da4fe0c5fb3baadcdc50101a8f6`  
> Frontend consumer: `frontend/v1-app-completion`  
> Scope: expose the missing V1 backend contracts/read models required by Android. Do not redesign the whole database.

---

## 1. Objective

The Android ↔ Backend plumbing is already established.

The remaining blocker is primarily that several V1 capabilities either:

- exist in the domain/database but are not exposed through an authorized read API;
- expose command DTOs whose actor/reason/trigger fields are too opaque for Android to populate safely;
- lack a projection suitable for UI consumption;
- or remain explicitly OPEN and therefore must stay blocked.

The goal of this handoff is to close **backend/API exposure gaps only**.

Do not add client workarounds. Do not expose private operational data to make a public feature work.

---

## 2. Authority

Use, in order:

1. `docs/database/v1/canonical.md`
2. ERD/schema/migrations
3. `docs/contexts/`
4. `docs/backlogs/v1/`
5. `docs/api/openapi.json`
6. backend tests/code
7. Android code

If a required behavior is OPEN, report it as blocked instead of freezing policy in code.

---

# 3. P0 — Contracts that unblock current Android V1

## P0.1 Room → current Listing discovery

### Current blocker

Android can:

```text
GET /listings/{id}
```

but cannot discover the current Listing for a Room unless it already knows the Listing ID.

Current frontend workaround is an input box for a known Listing ID. That is not acceptable final UX.

### Required backend exposure

Expose one authoritative way to discover current Listing from Room, for example either:

```http
GET /rooms/{roomId}/listing
```

or:

```http
GET /listings?roomId={roomId}
```

or include:

```text
currentListingId
```

in an authorized Room/operator projection.

### Rules

- preserve max one current/non-archived Listing per Room;
- archived history must not be mistaken for current Listing;
- operator authorization must derive from Organization/Property/Room relationships;
- do not expose private Room data through the public endpoint.

### Acceptance

- [ ] Operator can open Room → current Listing without typing an ID.
- [ ] No second current Listing is fabricated.
- [ ] 403/404/none-current cases are explicit.
- [ ] OpenAPI documents the response.

---

## P0.2 Public location search

### Current blocker

The public Listing contract exposes coordinates, but Android currently has no authoritative textual area/search field.

The frontend presently maps every Listing to:

```kotlin
publicAreaLabel = "Vị trí công khai"
```

so client-side text location search is not real search.

### Required backend exposure

Provide a public-safe location search contract.

Possible shape:

```http
GET /listings/public?location=Thu%20Duc
```

and/or a public-safe field such as:

```json
{
  "publicAreaLabel": "Phường ..., TP. Thủ Đức"
}
```

The exact field/query vocabulary must come from current product authority.

### Critical privacy rule

Never solve this by returning:

```text
operationalAddressText
operationalLocation
```

to public discovery.

### Acceptance

- [ ] Guest can search/filter by public-safe location.
- [ ] Public response does not leak operational address.
- [ ] Android no longer needs constant placeholder location text.
- [ ] Query/response is represented in OpenAPI.

---

## P0.3 Public availability filter

### Current blocker

V1 Discovery expects an availability capability, but current public Listing DTO/query exposes no availability contract.

Android must not infer availability from private operational Room state.

### Required backend exposure

Expose the V1-authoritative public availability semantics through the public Listing projection/query.

Do not invent the semantics if current authority does not define them precisely.

### Acceptance

- [ ] Public API supports the frozen V1 availability use case.
- [ ] No private operational state is leaked.
- [ ] Android does not reconstruct availability locally.
- [ ] OpenAPI documents the field/query semantics.

---

## P0.4 Payment history by Tenancy

### Current blocker

Current API supports:

```http
POST /finance/payments
GET  /finance/payments/{id}
```

but Android has no authorized Payment list by Tenancy.

The current UI can only open a Payment if a user already knows the Payment ID.

### Required backend exposure

Add an authorized list/read projection, for example:

```http
GET /finance/payments?tenancyId={tenancyId}
```

Return only Payments the authenticated actor may see.

### Preserve

```text
Billing != Payment
Payment Claim != Payment
Payment != Receipt
```

### Acceptance

- [ ] Tenant can read own Payment history.
- [ ] Operator can read Payment history only for operated rental scope.
- [ ] Cross-Tenancy reads return forbidden/not found according to current security conventions.
- [ ] Existing GET-by-ID remains valid.
- [ ] OpenAPI + tests updated.

---

## P0.5 Notification Center read contract

### Current state

This branch already implements Notification service/controller and the frozen event side effects.

That is useful, but Android still needs a stable authorized read contract.

### Required exposure

Ensure the final public contract supports:

```text
list notifications for authenticated recipient
notification detail
sourceType
sourceId
createdAt
read/unread presentation if and only if policy is frozen
authorized source navigation
```

Deep-link semantics should be representable without giving the client authority over the source record.

### OPEN boundary

Exact delivery channel remains OPEN.

Do not freeze:

```text
push
email
SMS
Zalo
```

as required product behavior.

If read/unread mutation policy is still OPEN, expose only what is currently authoritative and mark the mutation blocked.

### Acceptance

- [ ] Recipient cannot read another user's Notification.
- [ ] Notification identifies its source fact.
- [ ] Android can navigate to the source after normal source authorization.
- [ ] Reading a Notification does not mutate source business state.
- [ ] All eight frozen V1 event use cases remain represented.
- [ ] OpenAPI updated.

---

## P0.6 Incident event timeline

### Current blocker

Android can read current Incident status but cannot render a truthful lifecycle timeline.

### Required backend exposure

Expose the append-only Incident event/history projection for authorized actors, for example:

```http
GET /incidents/{id}/events
```

The response should contain only canonical event/history data already owned by backend/database authority.

### Acceptance

- [ ] Tenant/operator can read the same authorized Incident history.
- [ ] Timeline order is deterministic.
- [ ] Current Incident state remains source-authoritative.
- [ ] Client does not synthesize missing events.
- [ ] OpenAPI + tests updated.

---

## P0.7 Dashboard read model

### Current blocker

Android intentionally refuses to calculate authoritative KPIs from separate Room/Tenancy/Payment/Incident lists.

### Required backend exposure

Provide a server-owned dashboard/read model scoped to an operated Organization.

Minimum values should come from Canonical/backlog authority, not from this handoff.

Expected category examples are:

```text
Room-state summary
active tenancy summary
outstanding/finance summary
open incident summary
action-required summary
```

Do not treat the examples above as permission to invent unsupported KPI definitions.

### Acceptance

- [ ] Dashboard query is scoped to operated Organization.
- [ ] Server owns calculations.
- [ ] Android can render returned values without recomputing business truth.
- [ ] Empty/no-data semantics are explicit.
- [ ] OpenAPI + tests updated.

---

# 4. P1 — Make existing command contracts safe for Android

## P1.1 Listing publish / unpublish / archive command context

### Current blocker

Current DTOs require opaque fields such as:

```text
reasonCode
actorType
trigger
actorUserId (some transitions)
```

Android cannot safely invent these values.

### Required action

Choose one authority-safe approach:

- publish finite allowed values/enums and precise meaning in OpenAPI; or
- derive actor identity and fixed command context server-side; or
- create intent-specific endpoints whose body contains only user-entered business input.

Do not require Android to manufacture identity.

### Acceptance

- [ ] Android can call publish/unpublish/archive without guessing undocumented values.
- [ ] Server derives authenticated actor where possible.
- [ ] Invalid lifecycle transition remains server-rejected.
- [ ] OpenAPI documents allowed values.

---

## P1.2 Room manual operational-state transition

Current endpoint:

```http
PATCH /rooms/{id}/operational-state
```

requires opaque:

```text
reasonCode
actorType
trigger
operationalState
```

Expose/document a safe V1 command contract for:

```text
VACANT
MAINTENANCE
INACTIVE
```

Preserve:

- OCCUPIED is not a manual toggle;
- rental lifecycle owns occupancy;
- invalid OCCUPIED → MAINTENANCE/INACTIVE direct transitions remain rejected where frozen.

---

## P1.3 Tenancy activation

Current:

```http
POST /tenancies/{id}/activate
```

also requires opaque command context.

Android currently refuses to guess it.

Expose/document safe activation intent while preserving all preconditions and atomic Room state effects.

### Acceptance

- [ ] DRAFT → ACTIVE is executable from Android with documented input.
- [ ] Backend remains final authority.
- [ ] Room occupancy change is server-controlled.
- [ ] No direct ACTIVE → ENDED is introduced.

---

## P1.4 Terms nested schema

### Current blocker

`CreateTenancyTermsDto` exposes several required values as opaque generic objects:

```text
billingDayOrDueDateRule
electricityArrangement
waterArrangement
minimalRentalConditions
```

Android cannot build a correct editor from `type: object` alone.

### Required action

Publish concrete nested schemas/components with validation and examples sourced from current Canonical/backlog.

Do not invent new billing models.

V1 Charge types remain:

```text
RENT
ELECTRICITY
WATER
```

Proration remains FUTURE.

### Acceptance

- [ ] OpenAPI fully describes each required nested object.
- [ ] Backend validates the schema.
- [ ] Android can render/create Terms without hard-coded hidden knowledge.
- [ ] Version/effective-cycle semantics remain intact.

---

## P1.5 Terms acknowledgement actor identity

Current acknowledgement DTO requires:

```text
tenancyParticipantId
userId
acknowledgedAt
```

Client-authoritative `userId` is undesirable where authenticated identity can be derived.

### Required action

Derive authenticated `userId` server-side where domain authority permits it.

If `tenancyParticipantId` is still required, backend must verify it is linked to the authenticated User and exact Tenancy/Terms version.

### Acceptance

- [ ] User cannot acknowledge on behalf of another User.
- [ ] Acknowledgement remains version-specific.
- [ ] No tenancy-wide `termsAccepted=true` shortcut.

---

## P1.6 Tenancy Notice actor identity

Current issue/ack DTOs require:

```text
issuedByUserId
userId
```

### Required action

Derive authenticated actor server-side where possible.

Keep Notice acknowledgement as evidence that the user acknowledged/viewed the Notice, not as a legal-validity claim.

### Acceptance

- [ ] Operator cannot issue Notice as another actor.
- [ ] Tenant cannot acknowledge as another user.
- [ ] Cross-Tenancy Notice access is rejected.
- [ ] OpenAPI updated.

---

# 5. P1 — Deposit exposure

## P1.7 Deposit lookup/projection

### Current blocker

Android may apply a Payment to Deposit only if it knows an authorized Deposit target ID.

Current UI has no authoritative Deposit lookup/read contract sufficient for this flow.

### Required backend exposure

Expose an authorized Deposit projection tied to the Tenancy/Terms relationship.

At minimum Android needs to know:

```text
deposit id
tenancy id
requirement derived from Terms
funded/applied amount
current authoritative state
```

Use existing source facts; do not create a second editable expected amount.

### Acceptance

- [ ] Android can discover Deposit target without guessing ID.
- [ ] Requirement traces to Terms.
- [ ] Payment application remains a separate fact from Payment.
- [ ] Cross-Tenancy apply is rejected.

---

## P1.8 Deposit settlement/history

Expose settlement/refund/retain only to the extent already frozen by Canonical.

If missing policy prevents a command, return `BLOCKED_BY_OPEN_POLICY` rather than inventing behavior.

The partially-held requirement-change policy remains OPEN.

---

# 6. P1 — History projections

## P1.9 Former-rental history

Android needs an authorized read-only history for linked former tenants.

Do not make the client reconstruct history from current records.

Provide a projection/API that supports current authority for:

```text
ENDED Tenancy
Terms versions
Payments
Receipts
Notices
Incidents
Deposit history where available
```

Only include fields authorized for that former participant.

---

## P1.10 Operator operational history

Provide backend-owned history for the operator where frozen:

```text
Room lifecycle/history
Listing lifecycle/history
Tenancy history
Incident history
Finance provenance/history
```

Prefer existing event/source facts and read models over duplicating business truth.

---

# 7. OPEN — do not close by implementation

These are not normal backend gaps.

Keep them blocked until authority freezes them:

- Payment Claim evidence format.
- Payment Claim confirmation permission.
- Charge over-allocation across multiple Payments.
- Deposit requirement changes after partial funding.
- Primary participant replacement.
- Review minimum occupancy.
- Review edit policy.
- Review moderation authority.
- Review target correction authority.
- Review rating dimensions.
- Review multiplicity.
- Trust Report login requirement.
- Trust Report rate limit.
- Trust Report evidence policy.
- Trust Report moderation permission.
- Notification delivery channels.
- Notification read-state policy if not yet frozen.
- Search room/property type vocabulary/owner.

Do not turn an OPEN item into an enum/default because Android needs a screen.

---

# 8. FUTURE — do not expose as V1 API

Do not add endpoints for these under this task:

```text
Subscription/pricing/quota
CSV/Excel import
advanced team/delegation
Room asset inventory
WiFi/Parking/Service/Other charges
partner marketplace / worker dispatch
AI/OCR/predictive features
full realtime chat
saved search / advanced favorites
instant booking / reservation / OTA
nightly calendar / dynamic pricing
proration engine
public tenant rating
public personal landlord rating
```

---

# 9. Database guidance

This task is **not** "redesign the database".

For each gap:

1. first check whether canonical source facts already exist;
2. prefer an authorized query/read model/projection when existing facts are sufficient;
3. only add schema/table/index/migration if the required fact truly does not exist;
4. never rewrite migration history;
5. if adding a projection table/materialized read model, document ownership and rebuild strategy.

A missing Android endpoint does not automatically mean a missing database table.

---

# 10. Required implementation checklist

For every contract you close:

- [ ] Canonical ownership verified.
- [ ] Authorization rule documented.
- [ ] DTO/OpenAPI updated.
- [ ] Backend implementation added.
- [ ] Unit/service tests added.
- [ ] Database/conformance tests added when source facts/query semantics change.
- [ ] Cross-scope access rejection tested.
- [ ] No client-authoritative identity added unnecessarily.
- [ ] No private public-discovery leakage.
- [ ] No OPEN/FUTURE behavior silently frozen.
- [ ] Frontend unblock note added to completion report/handoff.

---

# 11. Suggested implementation order

### Batch A — direct Android blockers

```text
Room → current Listing
Payment history by Tenancy
public location search
public availability
Incident event timeline
```

### Batch B — read models

```text
Notification Center
Dashboard
Former-rental history
Operator operational history
Deposit projection
```

### Batch C — command-contract cleanup

```text
Listing transitions
Room manual transitions
Tenancy activation
Terms nested schemas
Terms acknowledgement actor derivation
Notice actor derivation
```

### Batch D — only frozen Deposit settlement behavior

Do not implement OPEN policy.

---

# 12. Cross-branch integration rule

Do not consume Băng's branch directly.

Current overlapping files between Băng and this backend branch include:

```text
app/src/main/java/com/trooi/app/features/tenant/TenantScreens.kt
app/src/main/java/com/trooi/app/ui/TroOiApp.kt
tests/e2e/maestro/listing-detail.yaml
```

Backend work should remain on this branch.

After review, coordinator integrates backend contract changes into staging, then Băng syncs from staging.

This avoids silently overwriting:

- Băng's feature/navigation work;
- Duy Anh's DISC-02/ADB/Maestro hardening.

---

# 13. Verification gates

Run and record exact output/exit status:

```powershell
pnpm e2e:coverage
pnpm typecheck
pnpm test
pnpm test:conformance:database-v1
pnpm build
git diff --check
```

For any changed executable flow:

```powershell
pnpm e2e:flow <FLOW_ID>
```

Do not label service tests as Android E2E.

If OpenAPI changes, verify generated/documented contract matches implementation.

---

# 14. Required report update

Update/create backend report with:

```text
final SHA
staging SHA consumed
OpenAPI SHA
contracts added/changed
database changes (if any)
authorization rules
tests/gates
Android blockers closed
remaining backend blockers
OPEN policy blockers
FUTURE boundaries
cross-branch integration notes
READY_TO_MERGE: YES/NO
```

Do not set `READY_TO_MERGE: YES` merely because API unit tests pass.

---

# 15. Definition of done for this handoff

This backend/API exposure handoff is complete when:

- current Android V1 no longer requires known IDs/manual placeholders for normal supported navigation;
- required public-safe search/read projections are exposed;
- server-owned read models exist for dashboard/history/notifications where frozen;
- actor identity is server-derived wherever appropriate;
- command vocabularies are documented rather than guessed;
- OpenAPI is sufficient for a client to implement supported V1 flows without reading backend source code;
- remaining blockers are only explicit OPEN/FUTURE or external auth/E2E environment constraints;
- all relevant backend gates are green;
- branch is handed back for independent review without merging to staging/main.
