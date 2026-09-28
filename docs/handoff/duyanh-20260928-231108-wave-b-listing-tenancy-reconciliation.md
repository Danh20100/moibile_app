# HANDOFF — Wave B Listing + Tenancy Reconciliation

**Recipient:** `duyanh`
**Created:** `2026-09-28 23:11:08 +07:00`
**Repository:** `onsra520/TroOi-Project`
**Branch:** `backend/core-foundations`
**Baseline HEAD:** `2396af20115a9c5c34613978996cef5df3e62d07`
**Status:** `READY`

## Mission

Implement Wave B exactly from the approved design and implementation plan: reconcile Listing/Inquiry/Tenancy and their Room/Property coordination to Canonical v3.7 / frozen ERD semantics, make Wave B conformance GREEN, and leave later domains/persistence outside scope.

## Current State

Đã hoàn thành:

```text
- Core H0-H6 runtime freeze is GREEN.
- Wave B design spec is approved.
- Wave B implementation plan B0-B6 is written.
- Listing/Tenancy RED boundaries are already classified in the predecessor audit.
```

Chưa hoàn thành:

```text
- B0-B6 implementation.
- Listing/Inquiry reconciliation.
- Tenancy/Participant/Terms/Acknowledgement/Notice reconciliation.
- Cross-domain rental-lifecycle orchestration.
- Wave B completion audit.
```

Known issues:

```text
- Listing still uses hidden/rented, duplicates propertyId, and lacks first-class event history.
- Tenancy still embeds tenantId and mutable terms and lacks the frozen complete FSM/supporting entities.
- Public Room transition currently bypasses Listing invalidation.
- Finance/Incident/Trust remain intentionally RED for later waves.
```

## Required Reading

Đọc theo thứ tự:

```text
1. docs/database/canonical-v3.7.md
2. docs/database/erd/README.md + frozen ERD artifacts relevant to Wave B
3. docs/superpowers/specs/2026-09-28-wave-b-listing-tenancy-reconciliation-design.md
4. docs/superpowers/plans/2026-09-28-wave-b-listing-tenancy-reconciliation.md
5. docs/audits/2026-09-28-erd3-conformance-red-baseline.md
6. docs/handoff/reviews/README.md
```

## Scope

### IN

```text
- Listing, ListingStatusEvent, Inquiry
- Tenancy, TenancyParticipant, TenancyTerms, TermsAcknowledgement, TenancyNotice
- Listing <-> Room/Property eligibility
- Tenancy <-> Room activation/checkout causality
- synchronous Room-leaves-VACANT -> Listing unpublish
- focused tests, conformance, docs/audit required by observed evidence
```

### OUT

```text
- Finance/Payment/Deposit/Receipt/Utility
- Incident/Trust/Notification/read models
- auth/resource authorization
- PostgreSQL application wiring and Redis
- Search type vocabulary, ranking, recommendation
- viewing appointments, reservation/hold, saved search, proration, public personal ratings
```

Không mở rộng scope nếu chưa có owner decision.

## Non-negotiable Constraints

```text
- Canonical/frozen authority wins over stale backend behavior.
- Do not create compatibility adapters for superseded Listing/Tenancy contracts.
- USER has no global landlord/tenant role.
- Listing references Room only; do not restore authoritative propertyId.
- Do not close OPEN Inquiry status, Listing event actor/trigger, Notice type, or Search type policies.
- Participant history is append-preserving; do not invent destructive PRIMARY replacement.
- Use exact decimal strings for numeric(18,2) business money.
- Calendar dates remain YYYY-MM-DD semantics.
- In-memory Wave B does not claim production transaction safety.
- Every public Room path leaving VACANT must pass through orchestration and synchronously invalidate Published Listing.
- No force-push/history rewrite.
```

Nếu implementation hiện tại khác constraint, không tự assume đó là bug.
Kiểm tra evidence và review protocol trước.

## Execution

Thực hiện theo thứ tự:

```text
B0 — capture fresh Wave B baseline
B1 — Listing local contract/lifecycle/exact projection/event history
B2 — Inquiry discovery bridge
B3 — Tenancy core lifecycle/cardinality
B4 — Participant + Terms + Acknowledgement + Notice
B5 — cross-domain rental-lifecycle orchestration
B6 — full runtime freeze + completion evidence
```

Chi tiết execution nằm tại:

```text
docs/superpowers/plans/2026-09-28-wave-b-listing-tenancy-reconciliation.md
```

Không skip task hoặc verification gate.

## Verification

Các command bắt buộc cuối Wave B:

```bash
pnpm exec tsx --test tests/core/listing.behavior.test.ts tests/core/inquiry.behavior.test.ts tests/core/tenancy.behavior.test.ts tests/core/tenancy-support.behavior.test.ts tests/core/rental-lifecycle.behavior.test.ts
pnpm exec tsx --test tests/conformance/erd3/listing.contract.test.ts tests/conformance/erd3/tenancy.contract.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
pnpm test:conformance:erd3
pnpm test
```

Không report PASS nếu chưa có runtime evidence.

## Review / Deviation Rule

Nếu phát hiện code hiện tại khác spec/plan:

```text
1. Xác định observed fact.
2. Tìm evidence về rationale.
3. Không mặc định deviation = defect.
4. Nếu cần, tạo review trong docs/handoff/reviews/.
5. NEEDS_OWNER_DECISION => STOP nhánh quyết định đó.
```

## STOP Conditions

STOP và report nếu:

```text
- authority/spec mâu thuẫn nhau
- implementation có intentional deviation chưa rõ rationale
- cần thay đổi product/domain semantics
- test/harness lỗi không phải expected business RED
- cần quyết định kiến trúc ngoài scope
- cần tự đóng bất kỳ OPEN policy nào
```

## Completion Report

Khi hoàn thành, report:

```text
IMPLEMENTED:
- ...

VERIFIED:
- <command> -> PASS/FAIL

DEVIATIONS:
- ...

OPEN ISSUES:
- ...

COMMITS:
- <sha> <message>

FINAL HEAD:
<sha>
```
