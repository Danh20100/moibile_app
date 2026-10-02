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
- [ ] Search by location — PARTIAL: client-side public area search on loaded PUBLISHED listings; no server search parameters or E2E evidence yet.
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
