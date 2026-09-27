# TrọƠi ERD LV2 Logical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the approved LV1 baseline, build a repository-versioned ERD LV2 Logical snapshot from the approved LV2 design spec, validate its logical invariants and deferred reconciliation debt, then render an editable Lucid diagram for human review.

**Architecture:** `docs/database/canonical.md` v3.6 remains the trusted source and is not modified. LV1 becomes the reviewed conceptual baseline; LV2 may add logical attributes, junction/event entities, conditional relationships and logical invariants without introducing physical PostgreSQL details. Repository JSON is the review/versioning artifact; Lucid is only the collaboration surface.

**Tech Stack:** JSON, Markdown, Git, PowerShell/Python validation, Lucidchart diagram specification.

**Spec:** `docs/superpowers/specs/2026-09-27-database-erd-lv2-logical-design.md`

## Global Constraints

- Canonical remains `docs/database/canonical.md` v3.6; do not edit or bump it during LV2 execution.
- LV1 topology remains unchanged; freeze the already-approved LV1 before committing the first LV2 snapshot.
- LV2 contains logical entities/attributes/cardinality/uniqueness/state vocabularies/provenance, but no PostgreSQL datatype, index, SQL CHECK syntax, FK action, ORM mapping or migration.
- Exact logical entity inventory is 29 entities: 18 LV1 backbone entities + 11 LV2 supporting entities.
- Do not introduce `[FUTURE]` features into the current logical model.
- Preserve exactly two real `>> UPSTREAM-RECONCILE` debts: Deposit Event monetary ownership and Review historical Property-target semantics.
- `>>` markers are review debt, not new canonical authority; carry them forward until post-LV3 reconciliation cleanup.
- Do not start LV3 as part of this plan.

## Review Focus

- Deposit Event amount must remain aligned with Canonical v3.6 and be equality-locked to Application/Settlement provenance.
- Utility provenance is conditional: manual utility billing remains valid, but any recorded Connection/Reading references must resolve to the correct Tenancy Room/type/connection.
- Review Property target must remain historical, not silently live-synced to current Room→Property relation; correction authority stays OPEN.
- Payment correction and Payment Claim result links must remain same-Tenancy and preserve history.
- Open policies and FUTURE scope must not be accidentally converted into fixed logical constraints.

---
## File Structure

**Create**

- `docs/database/erd/trooi-erd-lv2-logical.json` — repository snapshot for LV2 review/versioning.

**Modify during LV1 freeze / status refresh**

- `docs/database/erd/trooi-erd-lv1-conceptual.json` — set approved LV1 status to `REVIEWED_FROZEN` only; no topology/semantic edits.
- `docs/database/erd/README.md` — mark LV1 frozen and LV2 in review.
- `docs/database/README.md` — replace stale “chưa dựng lại” status with actual LV1/LV2 state.

**Modify only after explicit LV2 visual approval**

- `docs/database/erd/trooi-erd-lv2-logical.json` — set `status = REVIEWED_FROZEN`.
- `docs/database/erd/README.md` and `docs/database/README.md` — mark LV2 reviewed/frozen.

**Do not create in this plan**

- `trooi-erd-lv3-physical.json`
- DBML/schema/migration files
- PostgreSQL implementation artifacts
- persistent Lucid-export metadata files

## LV2 Snapshot Contract

Root keys:

```text
schemaVersion
title
level
status
sources
zones
entities
relationships
invariants
openPolicies
excludedFuture
reconciliationMarkers
```

Required metadata:

```text
level = LV2_LOGICAL
status = DRAFT_REVIEW          # until explicit visual approval
sources.canonical.path = docs/database/canonical.md
sources.canonical.version = v3.6
sources.lv1.path = docs/database/erd/trooi-erd-lv1-conceptual.json
sources.lv1.requiredStatus = REVIEWED_FROZEN
```

Entity attributes use logical presence rather than physical nullability:

```text
name
presence = required | optional | conditional
vocabulary?              # closed business vocabulary when spec freezes it
meaning?
```

No datatype field is allowed at LV2.

Relationship objects use stable IDs and contain:

```text
id
from
to
label
cardinality
meaning
condition?               # only for conditional logical relationships
```

Invariant objects use stable semantic IDs plus the spec number so later LV3 checks can trace back to the approved logical rule.

---
## Task 1 — Freeze approved LV1 and refresh database status

**Files:**
- Modify: `docs/database/erd/trooi-erd-lv1-conceptual.json`
- Modify: `docs/database/erd/README.md`
- Modify: `docs/database/README.md`

**Interfaces:**
- Consumes: user-approved LV1 Lucid/snapshot and Canonical v3.6.
- Produces: immutable reviewed conceptual baseline required by the LV2 snapshot.

- [ ] **Step 1: Assert the LV1 baseline before editing**

Run a Python check that requires:

```text
status = DRAFT_REVIEW
entities = 18
relationships = 25
constraints = 19
source.version = v3.6
```

Also assert the two Terms provenance relationships added during LV1 review still exist.

Expected: `LV1 pre-freeze checks: PASS`.

- [ ] **Step 2: Change only the LV1 status**

Set:

```text
status = REVIEWED_FROZEN
```

Do not add F3 Review semantics, new entities, relationships or constraints to LV1; deferred upstream reconciliation remains an LV2 debt by explicit project decision.

- [ ] **Step 3: Refresh the two README status sections**

`docs/database/erd/README.md` must state LV1 is reviewed/frozen and LV2 is the active logical-design stage.

`docs/database/README.md` current state must become:

```text
Canonical v3.6          FROZEN / TRUSTED
ERD LV1                 REVIEWED / FROZEN
ERD LV2                 design approved; snapshot pending/review
ERD LV3                 not started
Executable schema       not started
Migrations              not started
```

Do not imply LV2 is frozen yet.

- [ ] **Step 4: Verify the freeze diff**

Run:

```powershell
python -m json.tool docs/database/erd/trooi-erd-lv1-conceptual.json > $null
git diff --check
git diff -- docs/database/erd/trooi-erd-lv1-conceptual.json docs/database/erd/README.md docs/database/README.md
```

Expected: only LV1 status/documentation changes; no conceptual topology change.

- [ ] **Step 5: Run repository tests**

```powershell
npm test
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit the LV1 freeze**

```powershell
git add docs/database/erd/trooi-erd-lv1-conceptual.json docs/database/erd/README.md docs/database/README.md
git commit -m "docs(database): freeze reviewed LV1 conceptual ERD"
```

---

## Task 2 — Create the LV2 logical snapshot

**Files:**
- Create: `docs/database/erd/trooi-erd-lv2-logical.json`

**Interfaces:**
- Consumes: `REVIEWED_FROZEN` LV1 snapshot and approved LV2 design spec.
- Produces: deterministic `DRAFT_REVIEW` LV2 repository artifact for validation and Lucid rendering.

- [ ] **Step 1: Write metadata, zones and exact 29-entity inventory**

Preserve the six LV1 zones:

```text
identity_operating
discovery
rental_lifecycle
financial
operations
trust
```

Place `NOTIFICATION` in a delivery/support role without making it a seventh business-truth domain.

Exact entity names:

```text
USER
ORGANIZATION
PROPERTY
ROOM
LISTING
LISTING_STATUS_EVENT
INQUIRY
TENANCY
TENANCY_PARTICIPANT
TENANCY_TERMS
TERMS_ACKNOWLEDGEMENT
TENANCY_NOTICE
BILLING_CYCLE
CHARGE
UTILITY_CONNECTION
METER_READING
PAYMENT
PAYMENT_ALLOCATION
PAYMENT_CLAIM
RECEIPT
DEPOSIT
DEPOSIT_PAYMENT_APPLICATION
DEPOSIT_SETTLEMENT
DEPOSIT_EVENT
INCIDENT
INCIDENT_EVENT
REVIEW
TRUST_REPORT
NOTIFICATION
```

- [ ] **Step 2: Encode logical attributes from spec Sections 5–13**

Use only attributes explicitly defined by the approved spec. Preserve `?` semantics as `presence = optional`; conditional utility references use `presence = conditional`.

Key non-negotiable fields include:

```text
PAYMENT.replacement_payment_id?
PAYMENT_CLAIM.resulting_payment_id?
REVIEW.property_id
CHARGE.utility_connection_id?
CHARGE.start_meter_reading_id?
CHARGE.end_meter_reading_id?
DEPOSIT_EVENT.amount
```

Do not add physical types or implementation-only columns.

- [ ] **Step 3: Encode explicit junction/event entities instead of conceptual shortcuts**

LV2 must show:

```text
PAYMENT → PAYMENT_ALLOCATION → CHARGE
PAYMENT → DEPOSIT_PAYMENT_APPLICATION → DEPOSIT
DEPOSIT → DEPOSIT_SETTLEMENT
DEPOSIT → DEPOSIT_EVENT
LISTING → LISTING_STATUS_EVENT
TENANCY_TERMS → TERMS_ACKNOWLEDGEMENT
INCIDENT → INCIDENT_EVENT
```

The LV1 conceptual Payment→Charge/Deposit shortcuts must not be copied as direct authoritative logical relationships.

- [ ] **Step 4: Encode logical relationships and conditional utility provenance**

Required relationship families:

```text
USER → ORGANIZATION → PROPERTY → ROOM
ROOM → LISTING / TENANCY / INCIDENT / UTILITY_CONNECTION
TENANCY → PARTICIPANT / TERMS / NOTICE / BILLING_CYCLE / DEPOSIT / PAYMENT / PAYMENT_CLAIM
BILLING_CYCLE → TENANCY_TERMS / CHARGE
PAYMENT → PAYMENT_ALLOCATION → CHARGE
PAYMENT → DEPOSIT_PAYMENT_APPLICATION → DEPOSIT
PAYMENT → RECEIPT
PAYMENT → replacement PAYMENT
UTILITY_CONNECTION → METER_READING
LISTING → STATUS_EVENT / INQUIRY
REVIEW → TENANCY / USER / PARTICIPANT / PROPERTY
TRUST_REPORT → LISTING xor REVIEW
USER → NOTIFICATION
```

Utility relationship semantics must remain conditional:

```text
UTILITY CHARGE may reference 0..1 UTILITY_CONNECTION
start/end METER_READING may be present only with that connection
```

Do not encode `max 1 active utility connection / room / type`.

- [ ] **Step 5: Encode all 37 approved logical invariants**

Each invariant stores:

```text
id        # semantic stable ID
number    # 1..37 from spec
text
scope
```

Ensure invariant #20 contains Payment replacement same-Tenancy semantics; #24–25 retain Deposit Event amount equality; #33 contains conditional utility Room/type/reading integrity; #36 captures Review historical target semantics; #37 enforces Payment Claim resulting Payment same-Tenancy.

- [ ] **Step 6: Encode OPEN and FUTURE lists without resolving them**

Copy the approved spec's `openPolicies` and `excludedFuture` lists exactly in meaning.

Do not invent values for payment unallocated policy, claim evidence/permission, partially-held deposit requirement change, review correction authority, review moderation/edit policy, trust-report moderation/rate/evidence policy, or notification channels.

- [ ] **Step 7: Carry exactly two real reconciliation markers**

`reconciliationMarkers` must contain exactly two entries, each text beginning with `>> UPSTREAM-RECONCILE:`:

1. reconsider Deposit Event amount single-owner design after LV3 review;
2. decide whether Review historical Property-target semantics should be promoted upstream after LV3 review.

Status for both:

```text
DEFERRED_UNTIL_POST_LV3_RECONCILIATION
```

No F2/F4/F5 marker is allowed.

---
## Task 3 — Validate and commit the LV2 review draft

**Files:**
- Test: `docs/database/erd/trooi-erd-lv2-logical.json`

**Interfaces:**
- Consumes: Task 2 snapshot.
- Produces: validated logical artifact safe for Lucid rendering.

- [ ] **Step 1: Verify JSON syntax and source gate**

Run `python -m json.tool` and assert:

```text
level = LV2_LOGICAL
status = DRAFT_REVIEW
canonical.version = v3.6
LV1.requiredStatus = REVIEWED_FROZEN
actual LV1.status = REVIEWED_FROZEN
```

Expected: `LV2 source/status checks: PASS`.

- [ ] **Step 2: Verify exact entity contract**

A Python assertion must verify:

```text
entity count = 29
unique IDs = 29
unique names = 29
entity names exactly equal the approved inventory
no entity attribute has a datatype key
```

Expected: `LV2 entity contract: PASS`.

- [ ] **Step 3: Verify relationship endpoint integrity**

Assert every relationship endpoint exists and relationship IDs are unique.

Also require explicit edge coverage for:

```text
Payment→PaymentAllocation→Charge
Payment→DepositPaymentApplication→Deposit
Payment replacement self-link
BillingCycle→Terms
Charge→optional UtilityConnection/MeterReading
Review→Tenancy/User/Participant/Property
PaymentClaim→resulting Payment
TrustReport XOR target pair
```

Expected: `LV2 relationship contract: PASS`.

- [ ] **Step 4: Verify invariant and reconciliation debt coverage**

Assert:

```text
invariant numbers = exactly 1..37
invariant IDs unique
#20 mentions replacement payment + same Tenancy
#24/#25 mention Deposit Event amount equality
#33 mentions conditional utility Room/type/reading consistency
#36 mentions Review target not live-synced
#37 mentions resulting Payment same Tenancy
real reconciliation marker count = 2
all real markers begin with >> UPSTREAM-RECONCILE:
```

Expected: `LV2 invariant/debt checks: PASS`.

- [ ] **Step 5: Verify OPEN/FUTURE scope guard**

Check that every approved OPEN policy is represented and no `[FUTURE]` concept appears as an LV2 entity.

Banned current entity examples:

```text
SUBSCRIPTION
ROOM_ASSET
PARTNER_MARKETPLACE
MESSAGE_THREAD
BOOKING
PRORATION
PUBLIC_TENANT_RATING
```

Expected: `LV2 scope guard: PASS`.

- [ ] **Step 6: Verify three-way spec consistency**

For the five review-sensitive topics, check `entity attributes ↔ relationships ↔ invariants`:

```text
Deposit provenance/amount
Payment replacement
Review Property target
Utility provenance
Payment Claim result
```

Do not accept a rule that appears only as prose in one layer.

- [ ] **Step 7: Run whitespace and repository regression checks**

```powershell
git diff --check
npm test
```

Expected: no whitespace errors; existing test suite passes.

- [ ] **Step 8: Commit the LV2 review draft**

```powershell
git add docs/database/erd/trooi-erd-lv2-logical.json
git commit -m "docs(database): add LV2 logical ERD draft"
```

Do not set `REVIEWED_FROZEN` yet.

---

## Task 4 — Render and visually preflight LV2 in Lucid

**Files:**
- Consume: `docs/database/erd/trooi-erd-lv2-logical.json`
- No repository file modified by Lucid rendering.

**Interfaces:**
- Consumes: validated LV2 JSON only; do not re-derive semantics from memory.
- Produces: editable Lucid LV2 diagram for user review.

- [ ] **Step 1: Read the Lucid diagram-specification skill immediately before rendering**

Use the current Lucid specification contract; do not assume LV1 rendering syntax remains unchanged.

- [ ] **Step 2: Render one logical ERD page with six domain regions**

Title:

```text
TrọƠi — ERD LV2 Logical — Canonical v3.6 / LV1 Frozen
```

Use the six existing domain regions and visually distinguish:

```text
LV1 backbone entity
LV2 supporting/junction/event entity
conditional relationship
>> reconciliation debt note
```

Do not use physical datatype/FK table styling that implies LV3 decisions.

- [ ] **Step 3: Place high-connectivity nodes to minimize crossings**

Layout priorities:

```text
ROOM near PROPERTY / LISTING / TENANCY / INCIDENT / UTILITY_CONNECTION
TENANCY central to PARTICIPANT / TERMS / NOTICE / BILLING / PAYMENT / DEPOSIT
PAYMENT between PAYMENT_ALLOCATION and DEPOSIT_PAYMENT_APPLICATION
REVIEW near TENANCY + PROPERTY but visually inside Trust
NOTIFICATION peripheral as delivery side effect
```

Use elbow/orthogonal routing for long cross-zone lines when it improves readability.

- [ ] **Step 4: Show logical attributes without physical noise**

Each entity card should show the entity name and its approved logical attributes/state vocabulary. Do not show SQL types, indexes, PK/FK syntax or ON DELETE behavior.

Keep long rationale/invariant prose out of cards; use concise relationship labels and a compact legend.

- [ ] **Step 5: Surface the two `>>` debts visibly**

Add two small callouts:

```text
>> Deposit Event amount ownership — reconcile after LV3
>> Review historical Property target — reconcile after LV3
```

These callouts must not visually imply Canonical v3.6 has already changed.

- [ ] **Step 6: Preflight visual structure before sharing**

Validate the diagram specification before creation. Material problems to fix before user review:

```text
overlapping entity cards
labels covering cards
cross-zone lines cutting through unrelated entities
clipped attributes/state vocabularies
unreadable density around TENANCY/PAYMENT/REVIEW
```

A smart/unpinned connector warning is acceptable only when endpoints are intentionally auto-routed and the exported PNG remains readable.

- [ ] **Step 7: Export PNG and inspect the full page plus dense regions**

Inspect at least:

```text
full LV2 page
Tenancy/Financial cluster
Review/Trust cluster
Utility/Charge cluster
```

If any semantic link is visually ambiguous, fix layout/routing without changing repository semantics.

- [ ] **Step 8: Verify all 29 entity names and the two debt callouts exist in Lucid**

Use document search/fetch to confirm no entity disappeared during rendering.

Expected: 29 entity matches and both `>>` callouts present.

- [ ] **Step 9: Stop at the human review gate**

Share the editable Lucid link and summarize validation evidence.

Do **not** freeze LV2, update status to `REVIEWED_FROZEN`, or begin LV3 until the user explicitly approves the LV2 visual/semantics.

---

## Task 5 — Freeze LV2 after explicit user approval

**Files:**
- Modify: `docs/database/erd/trooi-erd-lv2-logical.json`
- Modify: `docs/database/erd/README.md`
- Modify: `docs/database/README.md`

**Interfaces:**
- Consumes: user-approved Lucid LV2 and repository JSON.
- Produces: reviewed/frozen LV2 baseline for the future LV3 plan.

- [ ] **Step 1: Apply any approved semantic corrections JSON-first**

If user review changes entity/attribute/relationship/invariant semantics, update JSON first and re-run Task 3 validation before touching Lucid again.

If a requested change contradicts Canonical v3.6, do not silently apply it; add/revise a `>> UPSTREAM-RECONCILE` debt unless the user explicitly chooses to update upstream authority.

- [ ] **Step 2: Mark the approved LV2 snapshot frozen**

Set only after user approval:

```text
status = REVIEWED_FROZEN
```

The two unresolved `>> UPSTREAM-RECONCILE` entries remain present even in the frozen LV2 artifact because they are intentionally deferred to post-LV3 cleanup.

- [ ] **Step 3: Refresh database README status**

Update both README files to reflect:

```text
Canonical v3.6          FROZEN / TRUSTED
ERD LV1                 REVIEWED / FROZEN
ERD LV2                 REVIEWED / FROZEN
ERD LV3                 not started
```

Document that two upstream-reconciliation debts remain intentionally deferred until after LV3 review.

- [ ] **Step 4: Re-run full Task 3 validation plus repository tests**

Expected differences from draft validation:

```text
status = REVIEWED_FROZEN
real reconciliation marker count remains 2
```

Also run:

```powershell
git diff --check
npm test
```

Expected: all checks pass.

- [ ] **Step 5: Commit and push the LV2 freeze**

```powershell
git add docs/database/erd/trooi-erd-lv2-logical.json docs/database/erd/README.md docs/database/README.md
git commit -m "docs(database): freeze reviewed LV2 logical ERD"
git push origin database/schema-foundations
```

- [ ] **Step 6: Fresh sync verification**

```powershell
git status --short --branch
git log -1 --oneline --decorate
```

Expected: clean worktree; local branch synchronized with `origin/database/schema-foundations`.

Stop here. LV3 requires a separate approved design/spec/plan cycle.

---

## Completion Criteria

The plan is complete only when:

```text
LV1 status = REVIEWED_FROZEN
LV2 JSON exists and has exactly 29 logical entities
LV2 JSON passes relationship/invariant/OPEN/FUTURE/debt validation
Lucid LV2 is editable and visually reviewed
LV2 status = REVIEWED_FROZEN only after explicit user approval
exactly 2 real >> UPSTREAM-RECONCILE debts remain
Canonical v3.6 is unchanged
LV3 has not started
branch is clean and synced
```
