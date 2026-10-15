# HANDOFF — BĂNG — COMPLETE MISSING V1 ANDROID APP FLOWS

> Date: 2026-10-02  
> Owner: Băng — Android Frontend  
> Working branch: `frontend/v1-app-completion`  
> Base branch: `integration/full-stack-sync-runtime-staging`  
> Base SHA at handoff: `97a3897a3cd64da4fe0c5fb3baadcdc50101a8f6`  
> Scope: Android app V1 functional completion only. Do not modify Canonical/domain policy to make the UI convenient.

---

## Master checklist

Use this as the single tracking source for the 3 app POVs:

`docs/designs/v1/app-pov-checklist.md`

Update the checklist while redesigning/implementing. Do not maintain a separate undocumented feature list.

## 1. Goal

Complete the missing Android V1 functionality that is already defined by the current Canonical/domain and, where available, the published OpenAPI contract.

This is not a "make the current screens prettier" task.

The current Android app has the correct backend-backed direction, but too much business functionality is either:

- read-only;
- grouped into overly broad placeholder screens;
- missing write actions;
- missing detail screens;
- missing lifecycle actions;
- missing cross-actor navigation;
- or blocked because the backend contract does not yet expose the required endpoint.

The target is a modular Android app that can support the later Figma redesign without rewriting business logic.

Do not invent business behavior to fill gaps.

---

## 2. Authority order

If sources disagree, use this order:

1. `docs/database/v1/canonical.md`
2. `docs/database/v1/erd/` + schema/migrations
3. `docs/contexts/`
4. `docs/backlogs/v1/`
5. `docs/api/openapi.json`
6. backend implementation/tests
7. Android implementation/tests

STOP and report instead of deciding yourself if:

- a Canonical item is marked OPEN;
- a capability is FUTURE;
- the requested UI requires a backend endpoint not present in the published OpenAPI;
- a proposed Android behavior would change a frozen lifecycle/invariant;
- a backend response is missing enough data to implement the UI truthfully.

---

## 3. Frozen rules that Android must preserve

### Identity / authorization

- `USER != TENANCY_PARTICIPANT`.
- Do not add global `LANDLORD` / `TENANT` role state.
- Navigation and actions come from real relationships:
  - `operatedOrganizationIds`
  - `linkedTenancyIds`

### Listing

Lifecycle:

```text
DRAFT
PUBLISHED
UNPUBLISHED
ARCHIVED
```

Rules:

- Discovery/Search only shows `PUBLISHED` Listing projection.
- Do not leak exact operational property address into public discovery.
- A Room has max 1 current/non-archived Listing.

### Tenancy

Lifecycle:

```text
DRAFT -> ACTIVE
DRAFT -> CANCELLED
ACTIVE -> ENDING
ENDING -> ACTIVE
ENDING -> ENDED
```

Do not implement direct:

```text
ACTIVE -> ENDED
```

A Room has max 1 non-terminal Tenancy:

```text
DRAFT | ACTIVE | ENDING
```

### Inquiry

- Inquiry is contact intent.
- Inquiry is not Booking.
- Inquiry is not a reservation.
- Inquiry is not required before Tenancy.

### Finance

Do not collapse:

```text
Billing != Payment
Payment Claim != Payment
Payment != Receipt
Deposit != Payment
```

Do not calculate authoritative finance truth from UI assumptions.

### Projection surfaces

Dashboard, Notification and History are not business source-of-truth.

Notification delivery must not mutate source business state.

---

## 4. Current Android app baseline

Current page-level routing is approximately:

```text
AuthWelcome
AuthLogin
AuthSignUp
AuthForgotPassword
Discovery
ListingDetail
TenantPortal
Account
OwnerDashboard
OwnerProperties
OwnerFinance
OwnerIncidents
```

Important current files:

```text
app/src/main/java/com/trooi/app/ui/TroOiApp.kt
app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt
app/src/main/java/com/trooi/app/features/auth/AuthScreens.kt
app/src/main/java/com/trooi/app/features/tenant/TenantScreens.kt
app/src/main/java/com/trooi/app/features/landlord/LandlordScreens.kt
app/src/main/java/com/trooi/app/core/network/BackendApi.kt
app/src/main/java/com/trooi/app/core/network/dto/
app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt
app/src/main/java/com/trooi/app/core/model/
```

Current production/backend-backed auth is Google Credential Manager + backend verification.

Do not add fake password/signup/reset APIs to backend-backed runtime.

---

## 5. Current published OpenAPI surface

At handoff, `docs/api/openapi.json` publishes 65 operations.

### Identity

```text
POST /identity-access/auth/google
GET  /identity-access/me
GET  /identity-access/users/{id}
```

### Organization

```text
POST  /organizations
GET   /organizations
GET   /organizations/{id}
PATCH /organizations/{id}
```

### Property

```text
POST  /properties
GET   /properties
GET   /properties/{id}
PATCH /properties/{id}
```

### Room

```text
POST  /rooms
GET   /rooms
GET   /rooms/{id}
PATCH /rooms/{id}
PATCH /rooms/{id}/operational-state
```

### Listing

```text
POST  /listings
GET   /listings/public
GET   /listings/{id}
PATCH /listings/{id}
POST  /listings/{id}/publish
POST  /listings/{id}/unpublish
POST  /listings/{id}/archive
```

### Inquiry

```text
POST /inquiries
GET  /inquiries
GET  /inquiries/{id}
```

### Tenancy / Rental lifecycle

```text
GET  /tenancies
POST /tenancies
GET  /tenancies/{id}
POST /tenancies/{id}/cancel
POST /tenancies/{id}/start-ending
POST /tenancies/{id}/resume
POST /tenancies/{id}/activate
POST /tenancies/{id}/checkout
```

### Participants

```text
POST /tenancies/{tenancyId}/participants
GET  /tenancies/{tenancyId}/participants
POST /tenancies/{tenancyId}/participants/{participantId}/leave
POST /tenancies/{tenancyId}/participants/{participantId}/link-user
```

### Terms

```text
POST /tenancies/{tenancyId}/terms
GET  /tenancies/{tenancyId}/terms
GET  /tenancies/{tenancyId}/terms/{termsId}
POST /tenancies/{tenancyId}/terms/{termsId}/acknowledgements
```

### Notices

```text
POST /tenancies/{tenancyId}/notices
GET  /tenancies/{tenancyId}/notices
POST /tenancies/{tenancyId}/notices/{noticeId}/acknowledge
```

### Billing / Payment

```text
POST /finance/cycles
GET  /finance/cycles
GET  /finance/cycles/{id}

POST /finance/payments
GET  /finance/payments/{id}
POST /finance/payments/{id}/allocations
POST /finance/payments/{id}/deposit-applications
```

### Receipts

```text
POST /receipts
GET  /receipts
GET  /receipts/{id}
POST /receipts/{id}/void
```

### Incidents

```text
POST  /incidents
GET   /incidents
GET   /incidents/{id}
PATCH /incidents/{id}/status
```

### Trust

```text
POST /audit-trust/facts
GET  /audit-trust/facts
POST /audit-trust/reports
GET  /audit-trust/reports
```

If an endpoint is not in current OpenAPI, do not invent it in Android.

---

## 6. Required frontend completion scope

The scope below is the Android work queue.

Status labels:

- IMPLEMENT = current contract/domain supports the UI work.
- PARTIAL = current code exists but needs proper screen/action/state completion.
- BLOCKED_BACKEND = domain capability exists, but the current published backend API is insufficient.
- BLOCKED_OPEN = Canonical policy is explicitly OPEN.
- FUTURE = do not implement.

---

## 7. Identity / Account

### IMPLEMENT

- Google sign-in screen/state.
- Session restore behavior where contract supports it.
- Account screen.
- Logout.
- Relationship-derived navigation.
- Auth loading / failure / retry.
- Unauthorized redirect behavior.

### Clean up

Backend-backed runtime should not present fake local password/signup/reset flows as real production capability.

If demo/debug screens remain, visually isolate them from backend-backed production behavior.

### Required states

- anonymous;
- authenticating;
- authenticated search-only user;
- authenticated tenant-linked user;
- authenticated operator-linked user;
- user who is both tenant and operator;
- expired/invalid session;
- network failure.

---

## 8. Discovery / Search / Map / Listing Detail

### PARTIAL -> COMPLETE

Current Discovery feed and detail exist, but complete the product surface.

Implement:

- public Listing feed;
- loading;
- empty;
- error;
- retry;
- Listing detail;
- public area/location projection only;
- asking price;
- amenities/available public fields;
- back navigation;
- Inquiry CTA;
- stable semantic/test tags for E2E.

### Search filters

Implement only filters that are frozen and supportable from contract.

Frozen capability:

- Location
- Price range
- Availability

Room/property type filter is BLOCKED_OPEN until authoritative owner/vocabulary is frozen.

### Map

If current backend projection contains public geo data, create a proper public map/list experience.

Never use exact operational address unless the public contract explicitly exposes it.

### Do not implement

- saved search;
- advanced favorites;
- AI matching;
- ranking engine;
- instant booking;
- reservation calendar.

Those are FUTURE.

---

## 9. Inquiry — Searcher -> Operator

### PARTIAL -> COMPLETE

Searcher side currently creates Inquiry.

Add Android surfaces for:

- Inquiry composer;
- validation;
- submit loading;
- submit failure/retry;
- submit success;
- operator Inquiry inbox/list;
- operator Inquiry detail;
- source Listing navigation;
- sender display only from backend-provided data;
- empty/error/loading states.

### Critical invariants

Submitting Inquiry must not:

- create Booking;
- create Tenancy;
- reserve the Room;
- change Room state;
- unpublish Listing.

### Backend gap

Cross-actor Notification side effect for new Inquiry is not currently complete.

Do not fake a notification in the Android client.

If backend work is not available yet:

```text
Inquiry write/list/detail UI = implement
Notification arrival = BLOCKED_BACKEND
```

---

## 10. Organization

### IMPLEMENT

Create dedicated screens and ViewModel actions for:

- Organization list;
- Organization detail;
- create Organization;
- edit Organization;
- loading/error/retry;
- authorization-denied handling.

Do not implement advanced team/staff/delegation.

That is FUTURE.

---

## 11. Property

### IMPLEMENT

Add:

- Property list under Organization;
- Property detail;
- create Property;
- edit Property;
- Room count/status summary if returned by backend;
- loading/error/retry.

### BLOCKED / verify contract

Archive Property is a domain capability but must only be exposed if backend publishes the command and guards.

Do not emulate archive locally.

---

## 12. Room

### PARTIAL -> COMPLETE

Add proper Room list/detail instead of nesting all data into one generic operator screen.

Implement:

- Room list by Property;
- Room detail;
- create Room;
- edit Room;
- current operational state;
- lifecycle state;
- Listing link;
- Tenancy link;
- Incident link;
- operational-state transition command from backend.

Allowed operational states:

```text
VACANT
OCCUPIED
MAINTENANCE
INACTIVE
```

Do not expose invalid transitions.

In particular:

```text
OCCUPIED -> MAINTENANCE
OCCUPIED -> INACTIVE
```

must not be shown as direct actions.

OCCUPIED comes from actual active rental state, not a manual UI toggle.

### BLOCKED_BACKEND

Room archive and some structural/history flows must stay unavailable unless the backend publishes explicit commands.

---

## 13. Listing management for operator

### IMPLEMENT

Add dedicated operator Listing screens:

- Listing list per Room;
- Listing detail/editor;
- create DRAFT;
- edit;
- publish;
- unpublish;
- archive;
- state-specific actions;
- validation/error handling.

UI must respect:

```text
DRAFT
PUBLISHED
UNPUBLISHED
ARCHIVED
```

Do not allow editing/action controls that contradict server state.

Never create a second current Listing for the same Room merely because the UI wants a new draft.

---

## 14. Tenancy

### IMPLEMENT

Build a dedicated tenancy workflow.

Screens/actions:

- Room -> Tenancy list/history;
- Tenancy detail;
- create DRAFT;
- cancel DRAFT;
- activate;
- start move-out;
- resume from ENDING;
- checkout;
- lifecycle history/presentation;
- error/denied/conflict states.

Lifecycle:

```text
DRAFT -> ACTIVE
DRAFT -> CANCELLED
ACTIVE -> ENDING
ENDING -> ACTIVE
ENDING -> ENDED
```

Do not expose direct ACTIVE -> ENDED.

On checkout, wait for backend success before showing:

```text
Tenancy = ENDED
Room = VACANT
```

Do not optimistically mark a Room vacant from the Android client.

---

## 15. Tenancy Participants

### IMPLEMENT

Add participant management UI:

- list active participants;
- add PRIMARY/OCCUPANT according to contract;
- link participant to User;
- occupant leave action;
- participant detail/state.

Important:

```text
USER != TENANCY_PARTICIPANT
```

Do not require a tenant to already have an account before the rental relationship exists.

### BLOCKED_OPEN

Primary replacement policy must not be invented if current contract/domain does not fully define the transition.

---

## 16. Terms

### IMPLEMENT

Add:

- Terms list/version history;
- Terms detail;
- create a new Terms version;
- version-specific acknowledgement;
- effective date information;
- acknowledgement status.

Do not implement tenancy-level:

```text
termsAccepted = true
```

Terms acknowledgement is version-specific.

Do not implement proration.

Proration is FUTURE.

---

## 17. Notices

### IMPLEMENT

Operator:

- Notice list;
- create/issue Notice;
- Notice detail.

Tenant:

- Notice list;
- Notice detail;
- acknowledge Notice.

Acknowledge means the user acknowledged/viewed the notice.

Do not present this as legal certification.

---

## 18. Tenant Portal redesign target

Current `V1TenantPortalScreen` compresses too many independent capabilities into one panel.

Break it into real screens/routes.

Minimum tenant areas:

```text
My Rental
Terms
Deposit
Billing
Payments
Receipts
Tickets / Incidents
Notices
Move-out
History
Find Rooms
```

Do not create ten bottom-nav items.

Use a small top-level tenant navigation and drill-down routes.

The final visual/navigation design will be governed by the Figma redesign, but business flows and screen contracts should be modular now.

---

## 19. Billing

### PARTIAL -> COMPLETE

Create real screens:

- Billing Cycle list;
- Billing Cycle detail;
- Charge breakdown;
- due/outstanding presentation;
- operator create Billing Cycle;
- tenant read-only view;
- error/loading/empty states.

Current V1 charge types:

```text
RENT
ELECTRICITY
WATER
```

Do not add:

- WiFi;
- parking;
- service fee;
- generic Other.

Those are FUTURE.

Do not calculate new authoritative totals in the client.

---

## 20. Payment

### PARTIAL -> COMPLETE

Operator:

- record Payment;
- Payment detail;
- allocate Payment to Charge;
- apply Payment to Deposit where allowed;
- display backend confirmation state;
- display allocation records.

Tenant:

- Payment history/detail if authorized.

Only backend-confirmed Payment is actual inflow.

Do not mark a payment successful from button press alone.

---

## 21. Payment Claim

### BLOCKED_OPEN

Payment Claim capability exists, but key policy is OPEN:

- evidence format;
- confirmation permission;
- handling details.

Do not design a behavior that silently freezes these decisions.

You may create a neutral placeholder entry only if needed for navigation architecture, but do not implement submit/approve semantics without frozen authority.

---

## 22. Deposit

### PARTIAL / BLOCKED_BACKEND

Current UI can show deposit projection.

Complete read surfaces:

- required amount from Terms;
- funded/held amount;
- settlement state/history if returned.

Payment -> Deposit Application is exposed and may be implemented for authorized operator flow.

Do not implement a fake editable `expected_amount` separate from Terms.

### BLOCKED_BACKEND / OPEN

Full settlement/refund/retain UI requires matching backend contracts.

Deposit requirement change after partially held is OPEN.

---

## 23. Receipt

### PARTIAL -> COMPLETE

Add:

- Receipt list/history;
- Receipt detail;
- issue Receipt from eligible confirmed Payment;
- void Receipt;
- reissued/history presentation when backend supplies it.

Receipt is evidence artifact from confirmed Payment.

Do not let Receipt create or replace Payment truth.

---

## 24. Incident / Ticket

### PARTIAL -> COMPLETE

Tenant:

- report Incident;
- Incident list;
- Incident detail;
- timeline/history;
- current status.

Operator:

- Incident inbox/list;
- Incident detail;
- state transitions exposed by backend;
- timeline;
- source Room/Tenancy context.

Canonical states:

```text
REPORTED
ACKNOWLEDGED
IN_PROGRESS
RESOLVED
REJECTED
CLOSED
```

Do not change state locally before backend response.

Do not merge Incident with Trust Report.

---

## 25. Move-out

### IMPLEMENT from Tenancy lifecycle

Tenant/operator flow should clearly distinguish:

```text
request/start move-out
-> ENDING
```

from:

```text
operator confirms checkout
-> ENDED
-> Room VACANT
```

ENDING does not mean the room is free.

Do not show it as completed move-out.

Cross-actor Notification is backend-dependent; do not fake it client-side.

---

## 26. History

### BLOCKED_BACKEND / PARTIAL

Canonical requires operational/history access, including former-tenant read-only history.

If backend supplies the projection, implement:

- tenant own historical rentals;
- operator relevant operational history;
- read-only historical detail.

Do not reconstruct authoritative history from current client state.

---

## 27. Dashboard

### BLOCKED_BACKEND

Current Android screen intentionally only renders backend Dashboard read model.

Do not calculate dashboard business truth from Room/Payment/Incident lists in the client.

Until a proper backend read model exists:

- keep truthful empty/pending state;
- do not fabricate KPIs.

---

## 28. Notifications

### BLOCKED_BACKEND

Canonical freezes these V1 use cases:

1. new Inquiry
2. payment due
3. payment confirmed
4. new Incident
5. incident status changed
6. tenancy Notice
7. move-out
8. review/report moderation

But exact delivery channel is OPEN.

Android eventually needs:

- Notification Center;
- unread/read presentation;
- source type;
- source ID;
- deep-link to authorized source;
- loading/error/empty states.

Do not hardcode push/email/SMS/Zalo as product truth.

Do not synthesize Notification locally from another API response.

Wait for backend Notification contract.

---

## 29. Review

### BLOCKED_OPEN / BLOCKED_BACKEND

Verified Review capability exists.

Baseline eligibility concept:

```text
Tenancy = ENDED
+ eligible linked participant
```

However multiple Review policies remain OPEN:

- minimum occupancy duration;
- edit policy;
- moderation authority;
- target correction authority;
- rating dimensions;
- multiplicity.

Do not implement opinionated rating UX that freezes these policies.

---

## 30. Trust Report

Backend currently exposes report APIs, but policy is partially OPEN.

If implementing basic report UI, keep it within currently published contract only.

Do not decide:

- login requirement;
- rate limits;
- evidence policy;
- moderation permissions.

Report target is currently Listing or Review intent.

Do not turn this into personal landlord/tenant scoring.

---

## 31. Features explicitly NOT to build

These are FUTURE and must not enter V1 implementation:

```text
Subscription / Pricing tiers / quota gating
CSV / Excel import
advanced staff/team delegation
Room Asset Inventory
Service/WiFi/Parking/Other charges
partner marketplace
worker dispatch / commission
AI / OCR
predictive features
full realtime chat
saved search / advanced favorites
payment gateway dependency
OTA reservation / instant booking
nightly calendar / dynamic pricing
proration engine
public tenant rating
public personal landlord rating
```

If a proposed screen needs one of these, stop and mark it FUTURE instead of implementing it.

---

## 32. Recommended screen architecture before Figma visual pass

Do not keep all business functions in the current broad placeholder screens.

Suggested logical routing boundary:

### Public / Searcher

```text
Explore
Map
Listing Detail
Inquiry
Account
```

### Tenant

```text
Tenant Home / My Rental
Rental Detail
Terms
Billing
Payments
Receipts
Deposit
Incidents
Notices
Move-out
History
Account
```

### Operator

```text
Operations Home
Organization
Property
Room
Listing
Tenancy
Participants
Terms
Billing
Payment
Deposit
Receipt
Incident
Inquiry Inbox
Notices
History
Account
```

Do not make each item a bottom-navigation destination.

Use nested navigation.

---

## 33. Figma integration rule

A separate Figma redesign is planned.

Therefore:

- separate business state/actions from visual composition;
- avoid hardcoding one-off screen logic into composables;
- build reusable screen contracts/components;
- keep route/state modeling explicit;
- use stable semantic/test tags;
- do not spend time polishing placeholder styling that will be replaced;
- when Figma is handed off, apply visual/system changes without rewriting domain/data logic.

If a Figma screen conflicts with Canonical/domain truth, Canonical wins and the design must be corrected.

---

## 34. Architecture expectations

Keep:

```text
Compose UI
-> ViewModel
-> Repository
-> BackendApi/OpenAPI
-> NestJS
-> PostgreSQL/PostGIS
```

Do not:

- access DB from Android;
- create local business truth;
- create fake success responses;
- use demo fallback in backendDebug/release;
- bypass backend authorization;
- send client-authoritative actor/user IDs where backend must derive identity.

Prefer feature-scoped packages rather than continuing to grow giant files.

Suggested direction:

```text
features/
  discovery/
  inquiry/
  organization/
  property/
  room/
  listing/
  tenancy/
  participant/
  terms/
  billing/
  payment/
  deposit/
  receipt/
  incident/
  notice/
  history/
  account/
```

Shared models/network stay in `core/`.

Do not reorganize everything in one destructive commit.

Refactor incrementally with tests.

---

## 35. E2E/test authority

Current V1 test inventory:

```text
83 atomic flows
198 test cases
24 V1 backlog files
8 frozen Notification use cases
```

Primary sources:

```text
tests/e2e/flow-catalog.yaml
tests/e2e/flows/
tests/e2e/cases/
tests/e2e/journeys/
tests/e2e/assertions/
```

At handoff:

- DISC-01 is executable/green.
- DISC-02 exists but is flaky on Maestro navigation targeting.
- authenticated flows require real Google session where specified.
- many flows are currently specification/contract coverage, not executable UI E2E.

Do not claim V1 complete because the static matrix exists.

---

## 36. Testing required for Android changes

At minimum run relevant Android gates.

Use Android Studio JBR on Windows.

Expected gate set:

```powershell
.\gradlew.bat testDebugUnitTest
.\gradlew.bat lintDebug
.\gradlew.bat lintBackendDebug
.\gradlew.bat assembleDebug
.\gradlew.bat assembleBackendDebug
.\gradlew.bat assembleDebugAndroidTest
.\gradlew.bat bundleRelease
```

For backend-backed runtime, use the current local API base URL mechanism; do not commit machine-specific URLs/secrets.

For new E2E-ready flows:

- add stable Compose semantics/test tags;
- update Maestro only when the real screen/action exists;
- verify UI + HTTP + DB/invariants through the project E2E harness where applicable.

Do not use coordinate taps if a stable semantic target can be exposed.

---

## 37. Required UI states per business screen

Every real screen should handle relevant states instead of only happy-path rendering.

Consider:

- loading;
- empty;
- data;
- validation error;
- backend error;
- timeout;
- offline;
- retry;
- unauthorized 401;
- forbidden 403;
- not found 404;
- conflict/invariant rejection;
- submitting;
- submit success;
- submit failure;
- disabled action when lifecycle disallows it;
- historical/read-only mode.

Do not map all failures to one generic "something went wrong".

---

## 38. Implementation phases

### Phase A — routing + feature decomposition

1. Sync this branch with current staging only if new staging commits appear.
2. Split route/state architecture so features can have dedicated screens.
3. Preserve existing DISC-01 behavior.
4. Fix semantic target for DISC-02 while touching Listing detail/navigation.
5. No business expansion yet.

### Phase B — current API-supported operator setup

Implement:

```text
Organization
-> Property
-> Room
-> Listing
```

including create/edit/read/state actions supported by OpenAPI.

### Phase C — rental lifecycle

Implement:

```text
Tenancy
-> Participants
-> Terms
-> Terms acknowledgement
-> Notice
-> Move-out
-> Checkout
```

### Phase D — finance

Implement current contract-supported:

```text
Billing Cycle
-> Payment
-> Allocation
-> Deposit Application
-> Receipt
```

Keep OPEN/backend-blocked capabilities blocked.

### Phase E — operations

Implement:

```text
Incident create/read/update/timeline
Inquiry operator inbox/detail
```

### Phase F — tenant decomposition

Replace monolithic tenant portal with dedicated routes using the same underlying projections/actions.

### Phase G — Figma application

After the Figma source is handed off:

- apply the final design system;
- update navigation composition;
- preserve business contracts;
- do not regress tests.

---

## 39. Commit discipline

Work only on:

```text
frontend/v1-app-completion
```

Rules:

- do not merge to staging/main without explicit authorization;
- do not force-push;
- do not rewrite migration history;
- do not edit Canonical to fit client implementation;
- make focused commits by feature/domain group;
- do not mix unrelated cleanup with business implementation;
- before handoff back, fetch origin and report divergence from staging.

Suggested commit grouping:

```text
feat(android): decompose v1 feature navigation
feat(android): complete organization property room flows
feat(android): complete listing management flows
feat(android): complete tenancy participant terms flows
feat(android): complete billing payment receipt flows
feat(android): complete incident and inquiry flows
feat(android): decompose tenant portal flows
test(android): add v1 screen and lifecycle coverage
docs(android): report v1 frontend completion status
```

Do not force this exact list if a feature needs smaller commits.

---

## 40. What to do when backend is missing

Do not patch around backend gaps.

For each missing backend capability, record:

```text
FEATURE:
SCREEN/FLOW:
REQUIRED API/READ MODEL:
CURRENT OPENAPI:
WHY UI CANNOT TRUTHFULLY COMPLETE:
BLOCKER OWNER: backend
```

Examples expected to remain backend-blocked until contract exists:

- Dashboard read model;
- Notification Center/source delivery API;
- some history projection;
- complete Deposit settlement;
- Review flow;
- some Trust moderation;
- cross-actor Notification side effects.

If Duy Anh pushes backend support to another branch, do not consume it directly unless coordinator/user authorizes the integration path. Prefer staging as the shared source.

---

## 41. Definition of Done for Băng's frontend branch

Do not report "done" merely because screens compile.

Frontend completion report may only say READY_TO_REVIEW when:

- all current OpenAPI-supported V1 Android screens/actions in this handoff are implemented;
- backend-blocked items are explicitly listed and not faked;
- OPEN policy items remain OPEN;
- FUTURE items remain absent;
- navigation uses relationship-derived access;
- no global LANDLORD/TENANT role is introduced;
- no backendDebug/release DemoData fallback is introduced;
- public Listing does not leak private operational address;
- lifecycle actions are server-authoritative;
- Android tests/gates are green;
- existing DISC-01 remains green;
- DISC-02 is stabilized if Listing UI/navigation changed;
- a completion report exists.

---

## 42. Completion report required

Create:

```text
app/docs/v1-app-completion-report-<YYYYMMDD>.md
```

Include:

- branch;
- final SHA;
- staging SHA consumed;
- OpenAPI blob/SHA consumed;
- feature groups completed;
- screens/routes added;
- repository/API methods added;
- exact blocked backend capabilities;
- exact OPEN-policy blockers;
- FUTURE boundaries verified;
- Android gate commands + exit/result;
- E2E flows run;
- failures/root causes fixed;
- known gaps;
- files intentionally untouched;
- commits;
- READY_TO_REVIEW: YES/NO.

Do not use vague statements like "all tests passed" without exact commands/results.

---

## 43. Immediate first tasks

Start here:

1. Fetch latest staging and verify this branch still starts from the expected source.
2. Run baseline Android tests/build.
3. Inventory existing routes/components once more against this handoff.
4. Decompose the monolithic Tenant and Operator screens.
5. Add stable Listing card semantic target and close DISC-02 flakiness without coordinate tapping.
6. Complete Organization -> Property -> Room -> Listing write flows.
7. Continue through Tenancy -> Finance -> Incident/Inquiry.
8. Record backend blockers instead of inventing behavior.

Do not merge when finished. Hand back branch + report for review.
