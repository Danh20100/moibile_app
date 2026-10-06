# TrọƠi V1 App — POV Master Checklist

> Purpose: single checklist for Product/Figma/Android/Backend/E2E tracking.  
> Scope: only the 3 user-facing POVs in the app — **Guest / Người thuê / Chủ trọ**.  
> Authority: `docs/database/v1/canonical.md` + current `docs/api/openapi.json`.

## Legend

- `[ ]` chưa hoàn tất
- `[x]` đã hoàn tất và có evidence
- **PARTIAL**: đã có một phần nhưng chưa đủ flow
- **BLOCKED_BACKEND**: không được fake ở client
- **OPEN**: Canonical chưa freeze policy; không tự chốt
- **FUTURE**: không làm trong V1

A feature chỉ được xem là hoàn tất khi phần liên quan đã có đủ:
- Figma/state design
- Android implementation
- Backend contract/behavior nếu cần
- Test/E2E evidence nếu flow executable

---

# POV 1 — Guest

## Auth / Account

- [ ] Google Sign-in — PARTIAL
- [ ] Auth loading / failure / retry
- [ ] Session context / capability restore
- [ ] Logout
- [ ] Account/profile surface
- [ ] Expired / invalid session handling

## Discovery

- [x] Public Listing feed — CURRENT
- [ ] Loading state
- [ ] Empty state
- [ ] Error / retry state
- [ ] Search by location — BLOCKED_BACKEND: public Listing DTO exposes coordinates but no textual area/search query. Removed the non-functional client-side area filter; do not derive public area from private operational address.
- [ ] Price filter — PARTIAL: inclusive numeric VND range on published public projection; no server query/E2E evidence yet.
- [ ] Availability filter — BLOCKED_BACKEND: public Listing OpenAPI currently has no availability field or query.
- [ ] Room/property type filter — **OPEN**
- [ ] Public Map view
- [ ] Map ↔ List synchronization
- [ ] Public location privacy check

## Listing

- [x] Listing detail screen — PARTIAL
- [ ] Stable Listing-card semantic/test target — PARTIAL: `public-listing-{id}` tag added to Compose and DISC-02 Maestro; emulator execution pending.
- [ ] Price presentation
- [ ] Amenities/public fields
- [ ] Public location only
- [ ] Listing unavailable state
- [ ] Back navigation stability

## Inquiry / Contact

- [x] Submit Inquiry — PARTIAL
- [ ] Inquiry composer validation
- [ ] Submitting state
- [ ] Submit error / retry
- [ ] Success state
- [ ] My Inquiry history
- [ ] Inquiry detail
- [ ] Open source Listing from Inquiry
- [ ] New-Inquiry Notification to Chủ trọ — **BLOCKED_BACKEND**

## Guest Notification

- [ ] Notification Center — **BLOCKED_BACKEND**
- [ ] Inquiry notification/deep-link — **BLOCKED_BACKEND**
- [ ] Read/unread state — **OPEN / BLOCKED_BACKEND**

---

# POV 2 — Người thuê

> Current tenant, ENDING tenant, and former tenant are states inside this POV — not separate roles.

## Tenant Home

- [ ] Tenant Home / việc cần xử lý
- [ ] Payment due summary
- [ ] Incident status summary
- [ ] Notice summary
- [ ] Terms acknowledgement reminder
- [ ] Move-out status summary

## My Rental

- [x] Linked rental projection — PARTIAL
- [ ] Rental detail
- [ ] Room detail inside rental context
- [ ] Tenancy lifecycle display
- [ ] Participant / người cùng ở list
- [ ] Former-rental read-only mode
- [ ] Rental history list

## Terms

- [ ] Terms list / version history
- [ ] Terms detail
- [ ] Current Terms indicator
- [ ] Version-specific acknowledgement
- [ ] Acknowledgement state/history
- [ ] Financial effective-date presentation
- [ ] No proration UX — **FUTURE**

## Billing

- [x] Billing projection — PARTIAL
- [ ] Billing Cycle list
- [ ] Billing Cycle detail
- [ ] RENT charge
- [ ] ELECTRICITY charge
- [ ] WATER charge
- [ ] Outstanding amount
- [ ] Due state
- [ ] Billing error / empty / loading

## Payment

- [x] Payment projection — PARTIAL
- [ ] Payment history
- [ ] Payment detail
- [ ] Confirmed-payment state
- [ ] Payment Claim entry — **OPEN**
- [ ] Payment Claim evidence/confirmation — **OPEN**

## Deposit

- [x] Deposit projection — PARTIAL
- [ ] Deposit requirement from Terms
- [ ] Funded / held amount
- [ ] Deposit state
- [ ] Settlement history — **BLOCKED_BACKEND**
- [ ] Requirement change after partial funding — **OPEN**

## Receipt

- [x] Receipt projection — PARTIAL
- [ ] Receipt list
- [ ] Receipt detail
- [ ] Issued / voided history

## Incident

- [ ] Report Incident
- [ ] Incident list
- [ ] Incident detail
- [ ] Incident timeline
- [ ] Current status
- [ ] Reopen visibility when allowed
- [ ] Error / retry / permission states
- [ ] New/status-change Notification — **BLOCKED_BACKEND**

## Notice

- [x] Notice projection — PARTIAL
- [ ] Notice list
- [ ] Notice detail
- [ ] Notice acknowledgement
- [ ] Acknowledgement state
- [ ] Notice Notification — **BLOCKED_BACKEND**

## Move-out

- [ ] Start move-out
- [ ] ACTIVE → ENDING state
- [ ] ENDING in-progress UX
- [ ] Resume to ACTIVE when allowed
- [ ] Checkout result
- [ ] ENDED read-only state
- [ ] Move-out Notification — **BLOCKED_BACKEND**

## Review

- [ ] Review eligibility UX — **OPEN / BLOCKED_BACKEND**
- [ ] Review form — **OPEN**
- [ ] Review history — **OPEN**
- [ ] Review edit behavior — **OPEN**
- [ ] Review moderation behavior — **OPEN**

## Tenant Notification

- [ ] Notification Center — **BLOCKED_BACKEND**
- [ ] Payment due
- [ ] Payment confirmed
- [ ] Incident status changed
- [ ] Notice issued
- [ ] Move-out event
- [ ] Deep-link to authorized source
- [ ] Read/unread — **OPEN**

---

# POV 3 — Chủ trọ

> Owner / operator / người vận hành are one user-facing POV: **Chủ trọ**.

## Dashboard

- [ ] Operator Dashboard — **BLOCKED_BACKEND**
- [ ] Room status summary — **BLOCKED_BACKEND**
- [ ] Active Tenancy summary — **BLOCKED_BACKEND**
- [ ] Outstanding summary — **BLOCKED_BACKEND**
- [ ] Confirmed Payment summary — **BLOCKED_BACKEND**
- [ ] Open Incident summary — **BLOCKED_BACKEND**
- [ ] Việc cần xử lý / action queue — **BLOCKED_BACKEND**

## Organization

- [ ] Organization list
- [ ] Organization detail
- [ ] Create Organization
- [ ] Edit Organization
- [ ] Loading / error / forbidden states
- [ ] Advanced team/staff/delegation — **FUTURE**

## Property

- [x] Property read projection — PARTIAL
- [ ] Property list
- [ ] Property detail
- [ ] Create Property
- [ ] Edit Property
- [ ] Public vs operational location presentation
- [ ] Archive Property — **BLOCKED_BACKEND**

## Room

- [x] Room read projection — PARTIAL
- [ ] Room list
- [ ] Room detail
- [ ] Create Room
- [ ] Edit Room
- [ ] VACANT state/action
- [ ] MAINTENANCE transition
- [ ] INACTIVE transition
- [ ] OCCUPIED derived from Tenancy
- [ ] Invalid-transition disabled UX
- [ ] Archive Room — **BLOCKED_BACKEND**
- [ ] Property assignment correction — **BLOCKED_BACKEND / verify contract**

## Listing Management

- [ ] Listing list by Room
- [ ] Operator Listing detail
- [ ] Create DRAFT
- [ ] Edit Listing
- [ ] Publish
- [ ] Unpublish
- [ ] Republish
- [ ] Archive
- [ ] State-specific actions
- [ ] Validation / conflict states
- [ ] Max 1 current/non-archived Listing invariant

## Inquiry

- [ ] Inquiry inbox
- [ ] Inquiry list
- [ ] Inquiry detail
- [ ] Source Listing context
- [ ] Sender information from backend
- [ ] Start Tenancy flow from Inquiry context
- [ ] New Inquiry Notification — **BLOCKED_BACKEND**

## Tenancy

- [ ] Tenancy list/history
- [ ] Tenancy detail
- [ ] Create DRAFT
- [ ] Cancel DRAFT
- [ ] Activate
- [ ] ACTIVE state
- [ ] Start move-out → ENDING
- [ ] Resume ENDING → ACTIVE
- [ ] Checkout ENDING → ENDED
- [ ] Room VACANT only after checkout
- [ ] Direct ACTIVE → ENDED must never appear
- [ ] Conflict/concurrency rejection UX

## Participants

- [ ] Participant list
- [ ] Add PRIMARY
- [ ] Add OCCUPANT
- [ ] Link participant to USER
- [ ] OCCUPANT leave
- [ ] Participant history
- [ ] PRIMARY replacement — **OPEN**

## Terms

- [ ] Terms list/version history
- [ ] Terms detail
- [ ] Create new Terms version
- [ ] Acknowledgement status
- [ ] Terms effective-date display
- [ ] No mid-cycle proration — **FUTURE**

## Billing

- [x] Finance read projection — PARTIAL
- [ ] Billing Cycle list
- [ ] Billing Cycle detail
- [ ] Create Billing Cycle
- [ ] RENT Charge
- [ ] ELECTRICITY input/Charge
- [ ] WATER input/Charge
- [ ] Outstanding view
- [ ] No unsupported service/WiFi/parking/Other Charges — **FUTURE**

## Payment

- [ ] Record confirmed Payment
- [ ] Payment detail
- [ ] Payment history
- [ ] Allocate Payment → Charge
- [ ] Apply Payment → Deposit
- [ ] Allocation records
- [ ] Void/correction presentation where supported
- [ ] Cross-Tenancy guard UX
- [ ] Charge over-allocation behavior — **OPEN**

## Deposit

- [x] Deposit read projection — PARTIAL
- [ ] Deposit detail
- [ ] Requirement from Terms
- [ ] Funded amount
- [ ] Deposit application
- [ ] Deposit events/history
- [ ] Refund / retain / settlement — **BLOCKED_BACKEND**
- [ ] Requirement change after partial funding — **OPEN**

## Receipt

- [ ] Receipt list
- [ ] Receipt detail
- [ ] Issue Receipt
- [ ] Void Receipt
- [ ] Reissue/history presentation
- [ ] Only confirmed Payment may issue Receipt

## Incident

- [x] Operator Incident read surface — PARTIAL
- [ ] Incident inbox/list
- [ ] Incident detail
- [ ] Timeline
- [ ] REPORTED → ACKNOWLEDGED
- [ ] ACKNOWLEDGED → IN_PROGRESS
- [ ] IN_PROGRESS → RESOLVED
- [ ] Reject
- [ ] Close
- [ ] Reopen RESOLVED → IN_PROGRESS
- [ ] Server-authoritative actions only
- [ ] New Incident Notification — **BLOCKED_BACKEND**
- [ ] Incident status Notification — **BLOCKED_BACKEND**

## Notice

- [ ] Notice list
- [ ] Notice detail
- [ ] Create / issue Notice
- [ ] Tenant acknowledgement status
- [ ] Notice Notification — **BLOCKED_BACKEND**
- [ ] No legal-certification wording

## Move-out / Checkout

- [ ] Move-out task list
- [ ] ENDING tenancy context
- [ ] Checkout action
- [ ] Checkout confirmation
- [ ] Atomic ENDED + Room VACANT result
- [ ] Move-out Notification — **BLOCKED_BACKEND**

## Operational History

- [ ] Room history — **BLOCKED_BACKEND / verify contract**
- [ ] Listing lifecycle history — **BLOCKED_BACKEND / verify contract**
- [ ] Tenancy history
- [ ] Incident event history
- [ ] Finance provenance/history
- [ ] History remains read-only projection

## Trust / Review

- [ ] Trust Report list/basic surface
- [ ] Submit Report within published contract
- [ ] Review response — **OPEN / BLOCKED_BACKEND**
- [ ] Moderation — **OPEN**
- [ ] No public personal tenant/landlord score — **FUTURE**

## Chủ trọ Notification

- [ ] Notification Center — **BLOCKED_BACKEND**
- [ ] New Inquiry
- [ ] New Incident
- [ ] Move-out
- [ ] Review/report moderation
- [ ] Deep-link to authorized source
- [ ] Read/unread — **OPEN**

---

# Cross-POV flows

These are not extra roles. They connect the 3 POVs.

## Guest → Chủ trọ

- [ ] Guest submits Inquiry
- [ ] Inquiry persists
- [ ] Chủ trọ receives Notification — **BLOCKED_BACKEND**
- [ ] Chủ trọ opens exact Inquiry
- [ ] No Booking/Reservation/Tenancy side effect

## Người thuê → Chủ trọ → Người thuê

- [ ] Người thuê reports Incident
- [ ] Chủ trọ receives Notification — **BLOCKED_BACKEND**
- [ ] Chủ trọ updates Incident
- [ ] Người thuê receives status Notification — **BLOCKED_BACKEND**
- [ ] Both open the same source Incident

## Chủ trọ → Người thuê

- [ ] Chủ trọ issues Notice
- [ ] Người thuê receives Notification — **BLOCKED_BACKEND**
- [ ] Người thuê opens Notice
- [ ] Người thuê acknowledges
- [ ] Chủ trọ sees acknowledgement state

## Người thuê ↔ Chủ trọ — Move-out

- [ ] Move-out starts
- [ ] Tenancy becomes ENDING
- [ ] Counterparty receives Notification — **BLOCKED_BACKEND**
- [ ] Chủ trọ confirms checkout
- [ ] Tenancy becomes ENDED
- [ ] Room becomes VACANT

## Chủ trọ → Người thuê — Payment

- [ ] Billing reaches due condition
- [ ] Người thuê receives due Notification — **BLOCKED_BACKEND**
- [ ] Chủ trọ records confirmed Payment
- [ ] Người thuê receives confirmed-payment Notification — **BLOCKED_BACKEND**
- [ ] Receipt is issued only from confirmed Payment

---

# Global V1 checks

## Must remain true

- [ ] Only 3 user-facing POVs: Guest / Người thuê / Chủ trọ
- [ ] No global LANDLORD/TENANT user role
- [ ] `USER != TENANCY_PARTICIPANT`
- [ ] Guest/Public Discovery reads only PUBLISHED Listing
- [ ] No operational exact address leaked publicly
- [ ] Inquiry != Booking
- [ ] Inquiry is not required before Tenancy
- [ ] No direct ACTIVE → ENDED
- [ ] Max 1 non-terminal Tenancy per Room
- [ ] Max 1 current/non-archived Listing per Room
- [ ] Dashboard/History/Notification are not source-of-truth
- [ ] Notification never mutates business state
- [ ] Billing != Payment != Receipt
- [ ] Payment Claim != Payment
- [ ] Deposit requirement comes from Terms
- [ ] No fake backend success in Android
- [ ] No DemoData fallback in backendDebug/release

## Explicit FUTURE — do not implement

- [ ] Subscription / pricing tiers / quota gating — FUTURE
- [ ] CSV / Excel import — FUTURE
- [ ] Advanced staff/team/delegation — FUTURE
- [ ] Room Asset Inventory — FUTURE
- [ ] Service/WiFi/Parking/Other Charges — FUTURE
- [ ] Partner marketplace / worker dispatch / commission — FUTURE
- [ ] AI / OCR / predictive features — FUTURE
- [ ] Full realtime chat — FUTURE
- [ ] Saved search / advanced favorites — FUTURE
- [ ] OTA reservation / instant booking — FUTURE
- [ ] Nightly calendar / dynamic pricing — FUTURE
- [ ] Proration engine — FUTURE
- [ ] Public tenant rating — FUTURE
- [ ] Public personal landlord rating — FUTURE

---

# Definition of Done for this checklist

For every item marked complete:

- [ ] Figma state exists when user-facing
- [ ] Android implementation exists when in app scope
- [ ] Backend contract exists when required
- [ ] Lifecycle/invariant is Canonical-compliant
- [ ] Loading/empty/error/permission states are handled
- [ ] Tests exist at appropriate layer
- [ ] E2E evidence exists when flow is executable
- [ ] No OPEN policy was silently frozen
- [ ] No FUTURE capability leaked into V1

This file is the master product-app checklist. Update it during redesign and implementation instead of maintaining separate undocumented task lists.

## Android design artifact rewrite — 2026-10-04

This section records design-artifact coverage only. It does not complete the Android, backend, Figma, or executable E2E items above.

- [x] Product research: contexts, full Canonical v3.7, ERD, current OpenAPI, V1 backlogs, and Compose implementation evidence.
- [x] Replace the phone renderer, component family, CSS, navigation presentation, viewer, Master Map and Screen Atlas previews.
- [x] Representative gate: Session, Guest Home, Listing Detail, Tenant Home, Billing / Payment, Incident Detail, Landlord Dashboard, Room Ledger, Landlord Finance, Context Switcher.
- [x] Migrate all **85 inventory items**, preserving stable IDs and documentation metadata, with approved scope totals: **63 V1 / 5 OPEN / 17 FUTURE** (optional MoMo promotion approved 2026-10-05; stable IDs unchanged).
- [x] Derive each miniature from the same renderer as its full phone screen.
- [x] Keep startup/auth pre-shell; use context-specific root navigation and nested back-stack presentation.
- [x] Preserve financial distinctions, source provenance, participant identity, room-derived occupancy and tenancy ending / checkout semantics.
- [x] Preserve explicit policy/contract gates for rental Review, Payment Claim, Inquiry Activity, Review reporting and moderation; optional MoMo and authenticated Listing-only reporting are approved V1 scope, while runtime DoD stays independent.
- [x] Validate HTML parsing, JS syntax, unique inventory IDs, relations, rendered route targets, bottom-nav targets, all-screen rendering and miniature/full-screen parity.
- [x] Browser captures and overflow checks at desktop, 390px and 360px workbench widths; light/dark representative phone captures.
- [x] Independent Impeccable finish review; both requested context/label fixes scored resolved, disposition `ship` for the HTML artifact.
- [x] Remove old visual helpers/styles and unused authored UI styles; no raw coordinate inputs in Guest phone UI or iPhone shell elements.

### Evidence and boundaries

The canonical artifact exposes a dependency-free check in the browser console:

```js
window.TroOiAtlas.verify() // { screens: 85, errors: [] }
```

Validation used headless Chrome against the local HTML, not an Android emulator. The artifact has sample records, labeled room-media and map placeholders, and preview-only actions. It does not call APIs or record money, contact requests, incident updates or lifecycle transitions.

Current public-search contract supports location/radius and price bounds. Textual geocoding, room-type and availability filters remain unavailable. Payment Claim has no committed endpoint. Provider launch does not confirm Payment; optional MoMo is current V1 and general provider/platform expansion remains FUTURE. Review eligibility/moderation remain unresolved; authenticated Listing-only Trust submission is current V1, while Review reporting and report listing/moderation remain gated. These limitations are presented separately from approved V1 / OPEN / FUTURE inventory classification.


## Native Compose implementation — 2026-10-04

This section records implementation evidence on branch `frontend/v1-app-ui-redesign`. It does not rewrite the historical HTML-artifact evidence above.

- [x] Port Room Ledger light/dark semantic palette into the Compose theme.
- [x] Port typography, 8/10/12/20dp shape hierarchy, flat paper surfaces and 48dp action targets.
- [x] Add native Room Ledger primitives: room plate, state label, attention row, amount/context block, media placeholder, chronology event, ledger navigation and divider.
- [x] Guest root navigation matches `Trang chủ / Bản đồ / Hoạt động / Tài khoản`.
- [x] Tenant root navigation matches `Trang chủ / Nhà tôi / Thanh toán / Sự cố / Tài khoản`.
- [x] Landlord root navigation matches `Tổng quan / Phòng / Tài chính / Sự cố / Tài khoản`.
- [x] Expanded windows (>=600dp) use a native NavigationRail instead of stretching phone bottom navigation.
- [x] Edge-to-edge Activity is preserved; Scaffold uses safe-drawing insets and app content uses IME padding.
- [x] Native Context Switcher renders Discovery / Tenant / Operations from backend-derived relationships, not a global role.
- [x] Guest Home and Listing Detail use public projection only; operational address remains private.
- [x] Tenant Home is room-first and attention-first with source-backed Charge, Payment, Notice and Incident facts.
- [x] Tenant Finance keeps Billing / Payment / Deposit / Receipt visually and semantically distinct.
- [x] Tenant Incident surfaces use backend Incident / IncidentEvent chronology.
- [x] Landlord Dashboard is attention-first and renders only authoritative Dashboard / Incident projections.
- [x] Landlord Room detail uses the six-part Room Ledger hierarchy while keeping existing backend command boundaries.
- [x] Room history is read-only chronology composed from Listing, Tenancy, Payment, Receipt, Deposit and Incident source records.
- [x] Landlord Finance keeps owed / received / deposit / receipt lanes separate.
- [x] Billing detail renders period, Terms provenance and individual Charges without inventing aggregate/outstanding semantics.
- [x] Incident detail renders authoritative state plus append-only event chronology; transitions remain backend commands.
- [x] Google-auth in-progress UI uses the Session/pre-shell visual language without claiming persistent session restore.
- [x] Source-level Room Ledger regression tests protect palette, component family, 3-POV navigation, representative surfaces, adaptive rail and insets.
- [x] Android gates: `:app:testDebugUnitTest`, `:app:assembleDebug`, `:app:assembleBackendDebug`, `:app:lintDebug` all pass.
- [x] Backend default suite remains green: 284/284.
- [x] `git diff --check` passes.

### Native implementation boundaries still open

- [ ] Real native map provider / interactive map picker is not wired. Do not replace it with raw latitude/longitude inputs.
- [ ] Process-restart session reacquisition is required V1 acceptance and remains unverified; the current `AuthTokenProvider` is in-memory. Keep Google ID tokens in memory; reacquire credential, verify /me, restore non-secret user-scoped hints, validate capabilities, then route.
- [ ] Fresh Google sign-in and full Guest / Tenant / Landlord / Notification physical-device journeys have not been captured after this redesign.
- [ ] TalkBack traversal, large font-scale behavior and predictive-Back animation have not been physically verified after this redesign.
- [ ] Map/geocoder textual area semantics, Availability vocabulary and other canonical OPEN items remain OPEN.

### Payment / MoMo promotion into current V1

- [ ] Promote MoMo/payment gateway into the current V1 authority before treating it as an active V1 flow: update design/product scope so `tenant-momo` and gateway placement are no longer OPEN/FUTURE-only.
- [ ] Preserve the finance invariant during promotion: opening MoMo creates a checkout session, not a Payment; only provider-verified success creates `Payment(source=GATEWAY, verification=PROVIDER_VERIFIED)`.
- [ ] Fix the payment branch merge gates: backend `typecheck` and `build` must pass; MoMo request/response validation must meet provider contract (including amount bounds, `extraData` encoding, and create-response signature verification).
- [ ] Port payment changes onto `integration/v1-current` without overwriting the newer Android redesign; resolve RentalViewModel/RentalWorkspace/TenantScreens conflicts deliberately.
- [ ] Re-run backend, database-conformance, Android unit/build/lint, and payment runtime/E2E gates after integration before marking MoMo V1 complete.


### Task 1–6 acceptance clarification — 2026-10-04

Superseded by approved V1 scope on 2026-10-05: native map-provider/picker integration and process-restart session reacquisition **are required V1 acceptance gates**. TalkBack/font-scale and predictive-Back physical quality follow-up remain separate and do not exempt navigation, map or session behavior.

Remaining V1 acceptance evidence includes fresh Google authentication, process-restart/session and route reconciliation, native public-map/picker, optional MoMo sandbox/signed-IPN and safe authenticated Listing-report journeys, plus real-device Guest, Tenant, Landlord and Notification journeys. At the latest check the physical device was not visible to ADB, so those items remain unverified rather than failed.

### Approved integration authority — 2026-10-05

The original staged MoMo promotion checklist above is preserved as unchecked implementation history. Scope alignment alone does not complete any runtime DoD. Manual operator recording accepts MANUAL_CASH / MANUAL_TRANSFER with server-derived USER_RECORDED; only verified payment-success IPN creates GATEWAY / PROVIDER_VERIFIED Payment. Checkout, Charge, Claim, Deposit and Receipt remain distinct, with no automatic allocation/funding/issuance. Notice and acknowledgement are Tenancy-scoped. Authenticated Listing-only report submission derives reporter identity on the server; Review/report listing/moderation, Claim and Inquiry Activity remain gated. Missing Android, Google, Maps, database or MoMo/IPN evidence stays UNVERIFIED and READY_TO_MERGE: NO.

### Integration tasks 18–23 — 2026-10-06

Android now has the listing-report form, explicit payment-to-deposit action, and Settings/Help. No checklist row is ticked by this note. Device, Google, Maps, `TEST_DATABASE_URL`, and MoMo sandbox evidence remain UNVERIFIED. READY_TO_MERGE: NO. See `docs/testing/v1-integration-evidence-20261005.md`.
