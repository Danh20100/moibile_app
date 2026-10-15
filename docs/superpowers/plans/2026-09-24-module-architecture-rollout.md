# Module Architecture Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phủ `ARCHITECTURE.md` theo chuẩn Contract-first + persistence-agnostic business flows cho toàn bộ module backend còn lại của TrọƠi, giữ đúng ownership, dependency và business flow hiện có trong từng `README.md`.

**Architecture:** Mỗi module giữ `README.md` làm mô tả business responsibility và thêm `ARCHITECTURE.md` làm tài liệu hành vi, boundary, ownership, dependency, persistence boundary và evolution. Mọi tài liệu dùng cùng 12 góc nhìn, không chứa source code, pseudo-code, DTO, interface, database schema, framework syntax hoặc provider implementation.

**Tech Stack:** Markdown documentation trong NestJS/TypeScript backend repository; không thay đổi runtime code hoặc dependency.

**Spec:** `docs/superpowers/specs/2026-09-24-module-architecture-contract-first-design.md`

## Global Constraints

- Dùng đúng nguyên tắc **Contract-first + persistence-agnostic business flows**.
- Business flow và business rule phải được mô tả trước persistence, framework, provider và transport.
- Database chỉ enrich/recover dữ liệu; database không định nghĩa business flow.
- Module khác chỉ biết public boundary của nhau, không biết internal implementation.
- Cross-module interaction ưu tiên ba dạng: reference, decision, event.
- Nếu dữ liệu chưa có nguồn có thẩm quyền thì giữ trạng thái chưa biết; không tạo placeholder hoặc giả định giá trị.
- Mỗi `ARCHITECTURE.md` phải có đủ 12 phần: Purpose; Architectural Principle; Knowledge Boundary; Business Flows; State & Invariants; Public Boundary; Cross-module Relationships; Ownership; Persistence Boundary; Events & Side Effects; Error & Testing View; Evolution.
- Không viết source code, interface, DTO, class, function signature, pseudo-code, database schema, ORM model, framework syntax hoặc provider-specific implementation trong `ARCHITECTURE.md`.
- Không dùng Mermaid hoặc fenced code block trong `ARCHITECTURE.md`; flow phải viết bằng prose hoặc chuỗi trạng thái dạng văn bản đơn giản.
- Không thay đổi `README.md` trừ khi phát hiện contradiction trực tiếp với spec; nếu có contradiction thì dừng và báo, không tự sửa business scope.
- `identity-access/ARCHITECTURE.md` và `incident/ARCHITECTURE.md` là hai reference draft đã tồn tại; không rewrite trừ consistency fix được phát hiện ở Task 11.

## Review Focus

- Ownership overlap: `room` không được sở hữu tenancy/billing/incident/listing state; `billing` không được sở hữu receipt; `subscription` không được lẫn với tenant billing.
- Cross-module leakage: tài liệu không được yêu cầu module lấy full object của module khác để tự suy luận business rule.
- Persistence leakage: không được mô tả table, ORM, query, schema hoặc database-driven transition.
- Unsupported invention: không thêm state, role, event, rule hoặc data field không có trong README/spec; chỗ chưa chốt phải được mô tả là chưa chốt.
- State coupling: lifecycle của room, tenancy, billing, incident và listing phải độc lập; liên kết bằng reference/decision/event thay vì gom vào một state chung.

---

### Task 1: Organization Architecture

**Files:**
- Create: `src/modules/organization/ARCHITECTURE.md`
- Read: `src/modules/organization/README.md`
- Reference: `src/modules/identity-access/ARCHITECTURE.md`

**Interfaces:**
- Consumes: identity/access decision từ `identity-access`, entitlement decision từ `subscription`.
- Produces: organization reference/scope cho `property` và các module vận hành liên quan.

- [ ] **Step 1:** Viết đủ 12 phần, giữ `organization` là phạm vi vận hành cấp cao nhất của owner/operator và nhóm nhiều property.
- [ ] **Step 2:** Knowledge Boundary phải nói rõ module chỉ cần organization identity/scope và references cần thiết; không sở hữu user profile, permission internals, property details hoặc subscription pricing.
- [ ] **Step 3:** State & Invariants không invent state machine mới; chỉ mô tả organization status ở mức business hiện đã có và ghi rõ lifecycle chi tiết chưa được chốt nếu cần.
- [ ] **Step 4:** Cross-module Relationships phải gồm `identity-access`, `property`, `subscription`, `audit-trust` và giữ ownership không đổi.
- [ ] **Step 5:** Chạy `rg -n "```|interface |class |DTO|schema|Prisma|TypeORM|Supabase" src/modules/organization/ARCHITECTURE.md`; expected: no matches.
- [ ] **Step 6:** Commit `docs: add organization architecture`.

### Task 2: Property Architecture

**Files:**
- Create: `src/modules/property/ARCHITECTURE.md`
- Read: `src/modules/property/README.md`

**Interfaces:**
- Consumes: organization reference/scope.
- Produces: property reference, location boundary và room grouping context.

- [ ] **Step 1:** Viết đủ 12 phần, xác định property là tài sản/khu trọ ở cấp địa điểm và là nguồn location nền.
- [ ] **Step 2:** Invariants phải giữ property state tách khỏi room state; property không sở hữu listing public content, tenancy, billing, receipt hoặc incident.
- [ ] **Step 3:** Public Boundary chỉ cho phép các capability ở mức property profile/location/grouping, không mô tả map provider hoặc geocoding implementation.
- [ ] **Step 4:** Cross-module Relationships phải gồm `organization`, `room`, `listing`, `audit-trust`.
- [ ] **Step 5:** Chạy forbidden-pattern scan như Task 1 trên file property; expected: no matches.
- [ ] **Step 6:** Commit `docs: add property architecture`.

### Task 3: Room Architecture

**Files:**
- Create: `src/modules/room/ARCHITECTURE.md`
- Read: `src/modules/room/README.md`

**Interfaces:**
- Consumes: property reference.
- Produces: room reference và room state cho tenancy, billing, incident, listing.

- [ ] **Step 1:** Viết đủ 12 phần, giữ room là operational anchor chứ không phải container cho mọi workflow.
- [ ] **Step 2:** State & Invariants phải giữ lifecycle hiện có: Draft, Vacant, Occupied, Maintenance, Archived; không thêm state mới.
- [ ] **Step 3:** Ghi rõ `room.status` độc lập với tenancy, billing debt, incident và listing state.
- [ ] **Step 4:** Cross-module Relationships phải gồm `property`, `tenancy`, `billing`, `incident`, `listing`, `audit-trust`.
- [ ] **Step 5:** Chạy forbidden-pattern scan và kiểm tra tài liệu có câu khẳng định state independence; expected: pass.
- [ ] **Step 6:** Commit `docs: add room architecture`.

### Task 4: Tenancy Architecture

**Files:**
- Create: `src/modules/tenancy/ARCHITECTURE.md`
- Read: `src/modules/tenancy/README.md`

**Interfaces:**
- Consumes: room reference, tenant identity/access context.
- Produces: tenancy reference, rental-term context cho billing và receipt.

- [ ] **Step 1:** Viết đủ 12 phần, giữ tenancy là quan hệ room + tenant + thời gian thuê + điều khoản vận hành.
- [ ] **Step 2:** State & Invariants phải giữ lifecycle Draft → Active → Ending → Ended và direct Active → Ended như README; không thêm state mới.
- [ ] **Step 3:** Knowledge Boundary phải nói rõ tenancy không cần profile đầy đủ của tenant để tồn tại; chỉ cần references/context cần thiết.
- [ ] **Step 4:** Ownership phải giữ billing cycle, debt calculation và receipt confirmation ngoài tenancy.
- [ ] **Step 5:** Cross-module Relationships phải gồm `room`, `identity-access`, `billing`, `receipt`, `audit-trust`.
- [ ] **Step 6:** Chạy forbidden-pattern scan; expected: no matches.
- [ ] **Step 7:** Commit `docs: add tenancy architecture`.

### Task 5: Billing Architecture

**Files:**
- Create: `src/modules/billing/ARCHITECTURE.md`
- Read: `src/modules/billing/README.md`

**Interfaces:**
- Consumes: tenancy terms/context, room reference, payment/receipt outcomes.
- Produces: billing-cycle state, receivable và outstanding-balance view.

- [ ] **Step 1:** Viết đủ 12 phần, giữ billing theo từng kỳ thay vì một cờ paid trên room.
- [ ] **Step 2:** State & Invariants phải giữ Upcoming, Due, Partial, Overdue, Paid theo README và không invent transition ngoài những đường đã mô tả.
- [ ] **Step 3:** Ghi rõ amount paid được đối chiếu từ receipt nhưng receipt record vẫn thuộc `receipt`.
- [ ] **Step 4:** Ownership phải loại payment gateway, subscription SaaS, tenancy lifecycle và room status.
- [ ] **Step 5:** Cross-module Relationships phải gồm `tenancy`, `room`, `receipt`, `audit-trust`.
- [ ] **Step 6:** Chạy forbidden-pattern scan; expected: no matches.
- [ ] **Step 7:** Commit `docs: add billing architecture`.

### Task 6: Receipt Architecture

**Files:**
- Create: `src/modules/receipt/ARCHITECTURE.md`
- Read: `src/modules/receipt/README.md`

**Interfaces:**
- Consumes: receivable reference/context từ billing, tenancy reference, access decision.
- Produces: payment/receipt record outcome, confirmation/history facts.

- [ ] **Step 1:** Viết đủ 12 phần, giữ receipt là bản ghi thanh toán/biên nhận phục vụ đối chiếu vận hành.
- [ ] **Step 2:** State & Invariants không invent state machine nếu README chưa chốt tên state; chỉ nêu nguyên tắc record, confirmation, traceable history.
- [ ] **Step 3:** Ghi rõ receipt không tính tổng debt và không thay thế chứng từ pháp lý hoặc settlement ngân hàng.
- [ ] **Step 4:** Cross-module Relationships phải gồm `billing`, `tenancy`, `identity-access`, `audit-trust`.
- [ ] **Step 5:** Chạy forbidden-pattern scan; expected: no matches.
- [ ] **Step 6:** Commit `docs: add receipt architecture`.

### Task 7: Listing Architecture

**Files:**
- Create: `src/modules/listing/ARCHITECTURE.md`
- Read: `src/modules/listing/README.md`

**Interfaces:**
- Consumes: room reference/availability context, property location context.
- Produces: public listing state/content cho discovery/map.

- [ ] **Step 1:** Viết đủ 12 phần, giữ listing là public projection của room chứ không phải operational record.
- [ ] **Step 2:** State & Invariants phải giữ Draft → Published → Hidden ↔ Published và Published → Rented; listing state độc lập room state.
- [ ] **Step 3:** Knowledge Boundary phải tách public listing data khỏi room operational history.
- [ ] **Step 4:** Không mô tả map SDK/provider; chỉ mô tả discovery/map boundary dùng location từ property/listing.
- [ ] **Step 5:** Cross-module Relationships phải gồm `property`, `room`, `audit-trust`.
- [ ] **Step 6:** Chạy forbidden-pattern scan; expected: no matches.
- [ ] **Step 7:** Commit `docs: add listing architecture`.

### Task 8: Onboarding Architecture

**Files:**
- Create: `src/modules/onboarding/ARCHITECTURE.md`
- Read: `src/modules/onboarding/README.md`

**Interfaces:**
- Consumes: import/bulk input và validation context.
- Produces: confirmed creation requests vào module đích.

- [ ] **Step 1:** Viết đủ 12 phần, giữ flow Import/Bulk Input → Parse/Validate → Preview → Confirm → Create Domain Data.
- [ ] **Step 2:** Invariants phải yêu cầu preview/confirm trước khi tạo dữ liệu thật; không invent transaction semantics hoặc rollback rule chưa có trong README.
- [ ] **Step 3:** Ownership phải nói rõ sau khi tạo, `property`, `room`, `tenancy`, `billing` trở thành owner của dữ liệu tương ứng.
- [ ] **Step 4:** Ghi rõ AI/OCR production flow không thuộc MVP architecture hiện tại.
- [ ] **Step 5:** Cross-module Relationships phải gồm `property`, `room`, `tenancy`, `billing`, `audit-trust`.
- [ ] **Step 6:** Chạy forbidden-pattern scan; expected: no matches.
- [ ] **Step 7:** Commit `docs: add onboarding architecture`.

### Task 9: Subscription Architecture

**Files:**
- Create: `src/modules/subscription/ARCHITECTURE.md`
- Read: `src/modules/subscription/README.md`

**Interfaces:**
- Consumes: organization reference, requested capability context.
- Produces: entitlement decision.

- [ ] **Step 1:** Viết đủ 12 phần, giữ subscription theo capability/entitlement thay vì rải logic theo tên gói.
- [ ] **Step 2:** Không chốt entitlement name cuối cùng ngoài những ví dụ đã có; nêu rõ packaging/pricing có thể thay đổi.
- [ ] **Step 3:** State & Invariants không invent subscription state machine chưa được README định nghĩa.
- [ ] **Step 4:** Ownership phải tách tenant billing, receipt, payment gateway và business logic của feature module.
- [ ] **Step 5:** Cross-module Relationships phải gồm `organization`, `identity-access` và các feature module cần entitlement như `room`, `listing`, `onboarding`, nhưng subscription chỉ trả decision.
- [ ] **Step 6:** Chạy forbidden-pattern scan; expected: no matches.
- [ ] **Step 7:** Commit `docs: add subscription architecture`.

### Task 10: Audit & Trust Architecture

**Files:**
- Create: `src/modules/audit-trust/ARCHITECTURE.md`
- Read: `src/modules/audit-trust/README.md`

**Interfaces:**
- Consumes: business facts/events từ bounded context khác và internal report submissions.
- Produces: audit history/lookup và internal report state/result ở mức platform review.

- [ ] **Step 1:** Viết đủ 12 phần, giữ `audit-trust` là cross-cutting module nhận business facts thay vì sở hữu business logic của resource được audit.
- [ ] **Step 2:** Knowledge Boundary phải giới hạn audit ở actor/action/resource/timestamp metadata và dữ liệu cần đối chiếu; không tự suy luận ai đúng/sai.
- [ ] **Step 3:** Internal report phải được mô tả là report nội bộ, không phải public rating, adjudication, legal guarantee hoặc enforcement ngoài đời thực.
- [ ] **Step 4:** Cross-module Relationships phải bao phủ `identity-access`, `tenancy`, `billing`, `receipt`, `incident`, `onboarding`, `room` theo README.
- [ ] **Step 5:** Persistence Boundary phải nhấn mạnh traceability/history nhưng không invent database immutability mechanism.
- [ ] **Step 6:** Chạy forbidden-pattern scan; expected: no matches.
- [ ] **Step 7:** Commit `docs: add audit trust architecture`.

### Task 11: Cross-Module Consistency Review

**Files:**
- Review: `src/modules/*/ARCHITECTURE.md`
- Review: `src/modules/*/README.md`
- Reference: `docs/superpowers/specs/2026-09-24-module-architecture-contract-first-design.md`

**Interfaces:**
- Consumes: toàn bộ architecture docs.
- Produces: một bộ tài liệu nhất quán để agent implementation dùng làm boundary contract.

- [ ] **Step 1:** Xác nhận mọi module folder hiện có `ARCHITECTURE.md`, bao gồm hai draft đã có `identity-access` và `incident`.
- [ ] **Step 2:** Kiểm tra đủ 12 section bằng `rg -n "^## [0-9]+\." src/modules/*/ARCHITECTURE.md`; mỗi file phải có 12 section đánh số.
- [ ] **Step 3:** Chạy `rg -n "```|interface |class |DTO|schema|Prisma|TypeORM|Supabase|CREATE TABLE|SELECT |INSERT |UPDATE |DELETE " src/modules/*/ARCHITECTURE.md`; expected: no implementation/code leakage.
- [ ] **Step 4:** Review ownership matrix thủ công: organization → property → room → tenancy/billing/incident/listing; billing → receipt; subscription → entitlement only; audit-trust → audit only.
- [ ] **Step 5:** Review state independence: room, tenancy, billing, incident, listing không reuse state của nhau.
- [ ] **Step 6:** Review cross-module language: references, decisions, events; không có câu yêu cầu đọc internal object của module khác.
- [ ] **Step 7:** Review unsupported invention: mọi state/lifecycle cụ thể phải có nguồn trong README; nếu README không chốt thì architecture phải nói rõ chưa chốt.
- [ ] **Step 8:** Chạy `git diff --check`; expected: no whitespace errors.
- [ ] **Step 9:** Commit consistency fixes nếu có bằng `docs: align module architecture boundaries`.

### Task 12: Final Documentation Verification

**Files:**
- Verify only; không tạo product code.

**Interfaces:**
- Consumes: toàn bộ tài liệu sau Task 11.
- Produces: evidence rằng rollout đáp ứng spec.

- [ ] **Step 1:** Chạy `git status --short`; expected: clean sau commit cuối.
- [ ] **Step 2:** Chạy `git diff --check HEAD~1..HEAD` cho commit cuối và `git log --oneline --decorate -15` để kiểm tra chuỗi commit docs.
- [ ] **Step 3:** Kiểm tra không có file runtime mới hoặc dependency thay đổi: `git diff --name-only <base-before-rollout>..HEAD`; expected: chỉ `docs/superpowers/...` và `src/modules/*/ARCHITECTURE.md`.
- [ ] **Step 4:** Đọc ngẫu nhiên tối thiểu `room`, `billing`, `onboarding`, `audit-trust` cùng README tương ứng để xác nhận terminology và scope không bị drift.
- [ ] **Step 5:** Báo kết quả verification và các điểm còn intentionally unresolved để dành cho phase implementation sau.
