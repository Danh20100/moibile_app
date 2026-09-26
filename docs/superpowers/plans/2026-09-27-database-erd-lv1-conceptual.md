# TrọƠi ERD LV1 Conceptual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng lại ERD LV1 Conceptual của TrọƠi từ Canonical v3.6, lưu snapshot reviewable trong repository và render một bản editable trên Lucid để review trực quan.

**Architecture:** `docs/database/canonical.md` là domain authority. Repository giữ JSON conceptual snapshot độc lập với visual-tool metadata; Lucid được tạo từ snapshot đó để collaboration/review, không được dùng để suy ngược hoặc thêm business rule mới.

**Tech Stack:** JSON, Git, PowerShell/Python validation, Lucidchart Standard Import.

**Spec:** `docs/superpowers/specs/2026-09-27-database-erd-lv1-conceptual-design.md`

## Global Constraints

- Trusted source duy nhất: `docs/database/canonical.md` — Canonical v3.6.
- Không đọc hoặc phục hồi ERD snapshot cũ làm input.
- LV1 chỉ chứa conceptual entity, relationship, cardinality/lifecycle note; không datatype/index/nullability/PostgreSQL constraint.
- Không đưa feature `[FUTURE]` vào conceptual core.
- `USER` không có global landlord/tenant role.
- Không đánh dấu LV1 là frozen trước khi user review bản Lucid.

## Review Focus

- Conceptual relationship không được biến thành physical FK semantics chưa được chốt.
- Max-1 current Listing, max-1 non-terminal Tenancy và Receipt current/history phải nhìn thấy.
- `TENANCY_PARTICIPANT` có thể chưa link `USER`.
- Payment/Deposit/Charge không được ngụ ý cross-Tenancy.
- Discovery/Trust phải hiện diện nhưng không kéo capability `[FUTURE]` vào LV1.

---

## File Structure

**Create**

- `docs/database/erd/trooi-erd-lv1-conceptual.json` — canonical-derived conceptual snapshot used for repository review and Lucid rendering.

**Modify only after visual review is approved**

- `docs/database/erd/README.md` — mark LV1 as reviewed/frozen and link the snapshot.

**Do not create yet**

- LV2/LV3 artifacts.
- DBML/schema/migration files.
- persistent Lucid-export metadata files.

## Snapshot Contract

The JSON root must contain:

```text
schemaVersion
title
level
status
source
zones
entities
relationships
constraints
deferredToLv2
excludedFuture
```

`source.path = docs/database/canonical.md`, `source.version = v3.6`, `level = LV1_CONCEPTUAL`, initial `status = DRAFT_REVIEW`.

## Task 1 — Create the LV1 conceptual snapshot

**Files:**
- Create: `docs/database/erd/trooi-erd-lv1-conceptual.json`

**Interfaces:**
- Consumes: `docs/database/canonical.md`, LV1 design spec.
- Produces: stable conceptual JSON consumed by Lucid rendering and later review.

- [ ] **Step 1: Write the exact entity set**

```text
USER
ORGANIZATION
PROPERTY
ROOM
LISTING
TENANCY
TENANCY_PARTICIPANT
TENANCY_TERMS
DEPOSIT
BILLING_CYCLE
CHARGE
PAYMENT
RECEIPT
INCIDENT
INCIDENT_EVENT
INQUIRY
REVIEW
TRUST_REPORT
```

Each entity stores only `id`, `name`, `zone`, `meaning`; no columns.

- [ ] **Step 2: Add conceptual zones**

```text
identity_operating
discovery
rental_lifecycle
financial
operations
trust
```

- [ ] **Step 3: Add conceptual relationships**

```text
USER → ORGANIZATION                  operates
ORGANIZATION → PROPERTY              contains / operates
PROPERTY → ROOM                      contains
ROOM → LISTING                       public projection
ROOM → TENANCY                       rental relationship
ROOM → INCIDENT                      operational issue
TENANCY → TENANCY_PARTICIPANT        participants
TENANCY_PARTICIPANT → USER           optional linked account
TENANCY → TENANCY_TERMS              versioned terms
TENANCY → DEPOSIT                    deposit lifecycle
TENANCY → BILLING_CYCLE              billing periods
BILLING_CYCLE → CHARGE               receivable lines
PAYMENT → TENANCY                    belongs to
PAYMENT → CHARGE                     allocates to (conceptual)
PAYMENT → DEPOSIT                    applies to (conceptual)
PAYMENT → RECEIPT                    produces evidence
INCIDENT → INCIDENT_EVENT            timeline
INQUIRY → LISTING                    concerns
REVIEW → TENANCY                     verified rental source
REVIEW → PROPERTY                    targets rental experience
TRUST_REPORT → LISTING               public-content target A
TRUST_REPORT → REVIEW                public-content target B
```

Each relationship has stable `id`, `from`, `to`, `label`, and `cardinality`.

Use explicit cardinality only where Canonical v3.6 freezes it. Otherwise store `unspecified`; do not infer a minimum.

- [ ] **Step 4: Add frozen constraint notes with stable IDs**

Required constraint IDs:

```text
no_global_user_role
room_state_separate_lifecycle
listing_publish_guard
max_one_current_listing
max_one_nonterminal_tenancy
ending_blocks_next_draft
active_tenancy_primary_participant
participant_optional_user_link
terms_versioned_billing_provenance
billing_scope_rent_electricity_water
payment_single_tenancy
payment_no_cross_tenancy
deposit_requirement_owned_by_terms
receipt_confirmed_payment_history
open_incident_blocks_archive
trust_report_exactly_one_target
```

Each constraint stores `id`, concise `text`, and `sourceSection` from canonical.

- [ ] **Step 5: Record LV2 deferrals and FUTURE exclusions**

`deferredToLv2` must include Payment Allocation, Deposit Payment Application, Listing Status Event, Terms Acknowledgement, Tenancy Notice, Payment Claim, Utility Connection/Meter Reading, Notification delivery detail.

`excludedFuture` must include Subscription/Pricing, CSV/Excel import, advanced team/delegation, Room Asset Inventory, extra charge types, partner marketplace, AI/OCR, full realtime messaging, OTA/booking, proration, and public personal ratings.

## Task 2 — Validate and commit the review draft

**Files:**
- Test: `docs/database/erd/trooi-erd-lv1-conceptual.json`

**Interfaces:**
- Consumes: Task 1 snapshot.
- Produces: validated repository artifact safe for visualization.

- [ ] **Step 1: Verify JSON syntax**

```powershell
python -m json.tool docs/database/erd/trooi-erd-lv1-conceptual.json > $null
```

Expected: exit code `0`.

- [ ] **Step 2: Verify source metadata and exact entity set**

```powershell
@'
import json
from pathlib import Path
p = Path('docs/database/erd/trooi-erd-lv1-conceptual.json')
d = json.loads(p.read_text(encoding='utf-8'))
expected = {'USER','ORGANIZATION','PROPERTY','ROOM','LISTING','TENANCY','TENANCY_PARTICIPANT','TENANCY_TERMS','DEPOSIT','BILLING_CYCLE','CHARGE','PAYMENT','RECEIPT','INCIDENT','INCIDENT_EVENT','INQUIRY','REVIEW','TRUST_REPORT'}
names = [e['name'] for e in d['entities']]
assert d['source']['path'] == 'docs/database/canonical.md'
assert d['source']['version'] == 'v3.6'
assert d['level'] == 'LV1_CONCEPTUAL' and d['status'] == 'DRAFT_REVIEW'
assert len(names) == 18 and len(set(names)) == 18 and set(names) == expected
print('LV1 entity/source checks: PASS')
'@ | python -
```

Expected: `LV1 entity/source checks: PASS`.

- [ ] **Step 3: Verify relationship endpoints, IDs, and frozen constraint coverage**

```powershell
@'
import json
from pathlib import Path
d = json.loads(Path('docs/database/erd/trooi-erd-lv1-conceptual.json').read_text(encoding='utf-8'))
entity_ids = {e['id'] for e in d['entities']}
rels = d['relationships']
assert len({r['id'] for r in rels}) == len(rels)
assert all(r['from'] in entity_ids and r['to'] in entity_ids for r in rels)
required = {'no_global_user_role','room_state_separate_lifecycle','listing_publish_guard','max_one_current_listing','max_one_nonterminal_tenancy','ending_blocks_next_draft','active_tenancy_primary_participant','participant_optional_user_link','terms_versioned_billing_provenance','billing_scope_rent_electricity_water','payment_single_tenancy','payment_no_cross_tenancy','deposit_requirement_owned_by_terms','receipt_confirmed_payment_history','open_incident_blocks_archive','trust_report_exactly_one_target'}
constraint_ids = {c['id'] for c in d['constraints']}
assert required <= constraint_ids
print('LV1 relationship/constraint checks: PASS')
'@ | python -
```

Expected: `LV1 relationship/constraint checks: PASS`.

- [ ] **Step 4: Verify FUTURE scope guard**

```powershell
@'
import json
from pathlib import Path
d = json.loads(Path('docs/database/erd/trooi-erd-lv1-conceptual.json').read_text(encoding='utf-8'))
names = {e['name'] for e in d['entities']}
banned = {'SUBSCRIPTION','IMPORT','ROOM_ASSET','PARTNER','BOOKING','MESSAGE_THREAD','PRORATION'}
assert names.isdisjoint(banned)
print('LV1 scope guard: PASS')
'@ | python -
```

Expected: `LV1 scope guard: PASS`.

- [ ] **Step 5: Review diff and whitespace**

```powershell
git diff --check
git diff -- docs/database/erd/trooi-erd-lv1-conceptual.json
```

Expected: no whitespace errors; diff contains conceptual data only.

- [ ] **Step 6: Commit the review draft**

```powershell
git add docs/database/erd/trooi-erd-lv1-conceptual.json
git commit -m "docs(database): add LV1 conceptual ERD draft"
```

Do not mark the snapshot frozen yet.

---

## Task 3 — Render the conceptual ERD in Lucid

**Files:**
- Consume: `docs/database/erd/trooi-erd-lv1-conceptual.json`
- No repository file modified by Lucid rendering.

**Interfaces:**
- Consumes: validated LV1 snapshot.
- Produces: editable Lucidchart document for human review.

- [ ] **Step 1: Read Lucid Standard Import specification**

Read `lucid://skills/diagram-specification` immediately before constructing the visual specification.

- [ ] **Step 2: Build the Lucid visual from the repository snapshot**

Use `lucid_create_diagram_from_specification`, not the table/FK-native ERD importer. LV1 relationships are conceptual and must not be falsified into physical foreign-key semantics.

Title: `TrọƠi — ERD LV1 Conceptual — Canonical v3.6`.

- [ ] **Step 3: Arrange six visible conceptual regions**

```text
Identity / Operating
Discovery
Rental Lifecycle
Financial
Operations
Trust
```

Layout intent:

```text
ROOM and TENANCY near the center
Identity/Operating on the left
Discovery near LISTING
Financial below/right of TENANCY
Operations near ROOM
Trust grouped around REVIEW / TRUST_REPORT
```

Keep relationship labels short. Cardinality notes must be legible without turning entity cards into table schemas.

- [ ] **Step 4: Preflight the Lucid specification**

Call `lucid_validate_diagram_specification` before creating the document.

Expected: structural `error_count = 0`.

Fix material layout warnings: overlapping cards, labels covering shapes, clipping, or unrelated connector crossings.

- [ ] **Step 5: Create the Lucidchart document**

Call `lucid_create_diagram_from_specification` only after structural validation succeeds.

- [ ] **Step 6: Export page 1 as PNG and inspect it**

Use `lucid_export_document_as_PNG`.

Expected: all 18 entities are visible; six regions are readable; no connector implies a relationship not present in the repository snapshot.

- [ ] **Step 7: Return the Lucid URL to the user**

Execution stops here. Do not start LV2 and do not mark LV1 frozen yet.

---

## Task 4 — Freeze LV1 only after user approval

**Files:**
- Modify: `docs/database/erd/trooi-erd-lv1-conceptual.json`
- Modify: `docs/database/erd/README.md`

**Interfaces:**
- Consumes: user-approved Lucid LV1.
- Produces: frozen repository snapshot and documented LV1 status.

- [ ] **Step 1: Apply approved corrections back to the repository snapshot**

Lucid is not a separate truth. Any accepted relationship/cardinality change must be reflected in JSON first. If it changes a `[FROZEN]` domain invariant, update/review `canonical.md` before continuing.

- [ ] **Step 2: Set snapshot status to `REVIEWED_FROZEN`**

Only after explicit user approval.

- [ ] **Step 3: Update `docs/database/erd/README.md`**

Record LV1 as reviewed/frozen and list `trooi-erd-lv1-conceptual.json` as the current LV1 artifact. LV2 remains not started.

- [ ] **Step 4: Re-run every Task 2 validation**

Expected: syntax, entity/source, relationship/constraint, and scope-guard checks all pass.

- [ ] **Step 5: Commit and push the freeze**

```powershell
git add docs/database/erd/trooi-erd-lv1-conceptual.json docs/database/erd/README.md
git commit -m "docs(database): freeze LV1 conceptual ERD"
git push origin database/schema-foundations
git status --short --branch
```

Expected: branch synced with remote and working tree clean.

## Execution Stop Condition

On the next execution pass, stop after Task 3 Step 7 and wait for the user to inspect Lucid. Task 4 runs only after explicit approval.
