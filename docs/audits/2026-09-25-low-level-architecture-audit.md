# Backend Low-Level Architecture Audit

- Date: 2026-09-25
- Branch: `backend/low-level-architecture`
- Audited implementation HEAD: `a1fa1cd744749ba2e88e0791cb68168c6cd97635`
- Commit message: `feat: implement backend low-level architecture foundation`
- Author preserved: `duy anh <lenguyenduyanh2004@gmail.com>`

## 1. Scope and constraints

Audit này kiểm tra implementation hiện tại của backend low-level architecture so với các `ARCHITECTURE.md` đã tồn tại trên branch.

Ràng buộc thực hiện:

- không sửa implementation trong `src/**`;
- không thay đổi `package.json`, config hoặc dependency;
- chỉ bổ sung test dưới `tests/audit/low-level-architecture/`;
- chỉ bổ sung báo cáo Markdown này;
- các test contract được phép fail để ghi nhận khoảng cách giữa implementation hiện tại và architecture contract.

## 2. Files added by the audit

- `tests/audit/low-level-architecture/baseline.behavior.test.ts`
- `tests/audit/low-level-architecture/architecture.contract.test.ts`
- `tests/audit/low-level-architecture/boundary.validation.test.ts`
- `tests/audit/low-level-architecture/cross-module.integrity.test.ts`
- `tests/audit/low-level-architecture/lifecycle.edge-cases.test.ts`
- `tests/audit/low-level-architecture/access-boundary.static.test.ts`
- `tests/audit/low-level-architecture/runtime.access.test.ts`
- `tests/audit/low-level-architecture/test-discovery.static.test.ts`
- `tests/audit/low-level-architecture/README.md`
- `docs/audits/2026-09-25-low-level-architecture-audit.md`

Không có file nào trong `src/**` được chỉnh sửa trong audit này.

## 3. Baseline verification before audit tests

Các gate có sẵn của branch được chạy trước khi thêm test audit:

| Gate                | Result    |
| ------------------- | --------- |
| `pnpm typecheck`    | PASS      |
| `pnpm lint`         | PASS      |
| `pnpm format:check` | PASS      |
| `pnpm test`         | PASS, 9/9 |
| `pnpm build`        | PASS      |

Runtime smoke test:

| Check                 | Result   |
| --------------------- | -------- |
| Application bootstrap | PASS     |
| `GET /api/v1/health`  | HTTP 200 |
| `GET /docs`           | HTTP 200 |

Điều này cho thấy Nest bootstrap, routing, build toolchain và Google identity integration tests hiện tại đều hoạt động ở baseline.

## 4. Audit test results

Command:

```text
pnpm exec tsx --test tests/audit/low-level-architecture/*.test.ts
```

Result:

```text
tests: 36
pass: 13
fail: 23
cancelled: 0
skipped: 0
```

TypeScript check sau khi thêm toàn bộ audit tests:

```text
pnpm typecheck -> PASS
```

Built-in test suite vẫn giữ nguyên:

```text
pnpm test -> 9/9 PASS
```

Build sau audit tests:

```text
pnpm build -> PASS
```

### Baseline behavior tests

`baseline.behavior.test.ts`: **8/8 PASS**.

Đã xác nhận các flow cơ bản hiện tại chạy đúng theo state machine đã implement:

- room lifecycle;
- tenancy lifecycle;
- incident lifecycle;
- listing publish visibility;
- exact billing reconciliation;
- receipt single confirmation;
- onboarding duplicate room detection;
- subscription capability decision.

### Architecture contract tests

`architecture.contract.test.ts`: **1 PASS / 8 FAIL**.

Các failure được xem là evidence của architecture/behavior gap, không phải lỗi của test runner.

### Boundary validation tests

`boundary.validation.test.ts`: **2 PASS / 2 FAIL**.

### Cross-module reference integrity tests

`cross-module.integrity.test.ts`: **0 PASS / 8 FAIL**.

The suite boots the real Nest application context and obtains services from DI. Every tested bounded context currently accepts nonexistent upstream references instead of validating the documented relationship.

### Lifecycle edge-case tests

`lifecycle.edge-cases.test.ts`: **0 PASS / 2 FAIL**.

The failures cover the documented `Upcoming` billing state and a negative payment outcome crossing the exported business-service boundary.

### Access-boundary tests

`access-boundary.static.test.ts`: **0 PASS / 1 FAIL**.

Static evidence finds Swagger bearer-auth declaration but no `APP_GUARD`, `useGlobalGuards`, `@UseGuards`, or `CanActivate` implementation in `src/**`.

`runtime.access.test.ts`: **2 PASS / 1 FAIL** after `pnpm build`.

Runtime evidence from the compiled Nest application confirms:

- `/api/v1/health` remains public (`200`);
- `/api/v1/listings/public` remains public (`200`);
- `/api/v1/organizations` is also reachable without authentication (`200`), while the audit contract expects `401/403` for private operational data.

### Test-discovery audit

`test-discovery.static.test.ts`: **0 PASS / 1 FAIL** because the default `pnpm test` command does not include `tests/**`.

## 5. Findings

### F-01 — CRITICAL — Authentication đang tự suy ra business role

Source:

- `src/modules/identity-access/services/identity-access.service.ts:62`

Implementation hiện tại gán trực tiếp:

```text
role: 'tenant'
```

sau khi Google identity được verify.

Điều này xung đột với `identity-access/ARCHITECTURE.md`, nơi authentication phải có thể thành công trước profile/role/scope enrichment và role không được tự suy ra khi chưa có authoritative context.

Failing test:

```text
does not infer a default business role during authentication
```

Observed result:

```text
'role' in authentication result === true
```

Expected architecture contract:

```text
authentication accepted first; role/profile enrichment later
```

### F-02 — CRITICAL — Onboarding confirm trả về domain IDs không tồn tại

Source:

- `src/modules/onboarding/services/onboarding.service.ts:57`
- `src/modules/onboarding/services/onboarding.service.ts:63`

Implementation tạo:

```text
mockPropertyId
mockRoomIds
```

rồi đánh dấu batch là `confirmed`, nhưng không đưa dữ liệu sang destination module `property` / `room`.

Hai failing tests:

```text
creates actual destination-domain data when onboarding is confirmed
does not silently create fake destination data for a confirmed onboarding batch
```

Observed evidence:

```text
PropertyService.findById(createdPropertyId)
-> NotFoundException
```

Điều này vi phạm boundary đã mô tả trong onboarding architecture: sau confirmation phải tạo domain data thông qua public boundary của destination module và ownership chuyển sang destination module.

### F-03 — HIGH — Module-owned state bị leak qua mutable object reference

Example source:

- `src/modules/room/services/room.service.ts:16`

Room state được lưu trong `Map`, và object được lưu cũng chính là object trả cho caller.

Failing test:

```text
does not allow callers to mutate room state outside the lifecycle boundary
```

Observed behavior:

```text
created.status = 'archived'
findById(created.id).status === 'archived'
```

Caller có thể bypass `updateStatus()` và state machine hoàn toàn.

Finding này không chỉ giới hạn ở Room: pattern trả/stored mutable references xuất hiện rộng trong các in-memory services và cần được xem như một class-level encapsulation risk.

### F-04 — HIGH — Audit history không immutable

Source:

- `src/modules/audit-trust/services/audit-trust.service.ts:19`

Hai dạng mutation đã reproduce được:

1. caller mutate `metadata` object sau `recordFact()`;
2. caller mutate object `AuditRecord` được trả về từ service.

Failing tests:

```text
keeps audit history immutable when caller-owned metadata changes
keeps an audit record immutable even if the returned record is modified
```

Observed result: dữ liệu history lưu bên trong thay đổi theo mutation từ bên ngoài.

Đây là xung đột trực tiếp với audit invariant: history quan trọng không được bị rewrite như chưa từng tồn tại.

### F-05 — HIGH — Subscription capability template bị shared mutable state giữa organizations

Source:

- `src/modules/subscription/services/subscription.service.ts:40`

Implementation assign trực tiếp:

```text
capabilities: planInfo.capabilities
```

Nhiều subscription cùng plan giữ cùng array reference.

Failing test:

```text
does not share mutable plan capability arrays across organizations
```

Reproduction:

```text
org_1 free capabilities.push('api_access')
org_2 free subscription sau đó cũng chứa 'api_access'
```

Đây là cross-organization state contamination.

### F-06 — HIGH — Billing chấp nhận overpayment làm `paidAmount > totalAmount`

Source:

- `src/modules/billing/services/billing.service.ts:63`

Implementation tính:

```text
newPaidAmount = currentPaidAmount + amountPaid
outstandingBalance = max(0, totalAmount - newPaidAmount)
```

nhưng không reject hoặc normalize amount vượt outstanding balance.

Failing test:

```text
rejects a payment outcome that exceeds the outstanding billing balance
```

Observed behavior: payment lớn hơn balance được accept; cycle trở thành `paid` trong khi `paidAmount` có thể lớn hơn `totalAmount`.

### F-07 — MEDIUM — Tenancy chấp nhận time range ngược

Failing test:

```text
rejects a tenancy whose end date is earlier than its start date
```

Reproduction:

```text
startDate: 2026-10-01
endDate:   2026-09-30
```

`TenancyService.create()` hiện accept dữ liệu này.

DTO chỉ validate từng field là date string, chưa validate quan hệ giữa hai mốc thời gian.

### F-08 — MEDIUM — `cycleMonth` documentation và validation không khớp

Source:

- `src/modules/billing/dto/index.ts`

Swagger description nói `cycleMonth` có format `YYYY-MM`, nhưng validation hiện chỉ là string + non-empty.

Failing test:

```text
enforces the documented YYYY-MM billing cycleMonth format
```

Observed behavior:

```text
cycleMonth: 'not-a-month'
```

không tạo validation error cho field `cycleMonth`.

### F-09 — MEDIUM ARCHITECTURE DEBT — Persistence implementation nằm trực tiếp trong service

Structural audit tìm thấy `new Map(...)` trực tiếp trong toàn bộ 12 service groups:

- audit-trust;
- billing;
- identity-access;
- incident;
- listing;
- onboarding;
- organization;
- property;
- receipt;
- room;
- subscription;
- tenancy.

In-memory persistence tự nó không phải lỗi ở phase này. Vấn đề là persistence container đang nằm trực tiếp trong business service thay vì sau một replaceable persistence boundary.

Điều này làm cho claim `persistence-agnostic business flows` chưa được thể hiện rõ ở implementation structure hiện tại.

Không có implementation change nào được thực hiện trong audit để xử lý finding này.

### F-10 — MEDIUM TEST INFRASTRUCTURE GAP — `pnpm test` không chạy `tests/**`

Source:

- `package.json:18`

Current script:

```text
"test": "tsx --test src/**/*.spec.ts"
```

Do đó audit tests dưới `tests/audit/**` không được chạy khi gọi `pnpm test`.

Audit giữ nguyên script này theo constraint "không sửa code/config". Audit suite phải được chạy explicit bằng:

```text
pnpm exec tsx --test tests/audit/low-level-architecture/*.test.ts
```

### F-11 — CRITICAL SECURITY — Private operational routes have no authentication enforcement

Static source audit found no `APP_GUARD`, `useGlobalGuards`, `@UseGuards`, or `CanActivate` implementation under `src/**`. `main.ts` advertises bearer auth in Swagger, but that declaration does not enforce access control.

Failing tests:

```text
has an authentication/authorization enforcement mechanism for non-public API routes
blocks unauthenticated access to private organization data
```

Runtime evidence from the compiled application:

```text
GET /api/v1/organizations
without Authorization header
-> HTTP 200
```

Control checks stayed green:

```text
GET /api/v1/health -> 200
GET /api/v1/listings/public -> 200
```

This demonstrates that the problem is not general routing failure: public routes work as expected, while private operational data is not protected.

### F-12 — HIGH — Cross-module reference invariants are not enforced

The architecture documents repeatedly require valid references across bounded contexts. The deep audit exercised services through the real Nest DI container and confirmed that invalid references are accepted across the main operational chain.

Failing tests cover:

```text
property -> nonexistent organization
room -> nonexistent property
tenancy -> nonexistent room
billing -> nonexistent tenancy / room
receipt -> nonexistent billing / tenancy
incident -> nonexistent room
listing -> nonexistent room / property
subscription -> nonexistent organization
```

Observed behavior: each create/assign operation resolves successfully instead of rejecting the orphan reference.

This is a systemic integrity gap rather than eight unrelated bugs. A handoff fix should introduce reference validation through explicit public contracts/decisions without collapsing module ownership boundaries.

### F-13 — MEDIUM — Billing lifecycle never enters documented `Upcoming` state

`billing/ARCHITECTURE.md` explicitly defines:

```text
Upcoming -> Due
```

However `BillingService.createCycle()` initializes every non-overdue cycle as `due`, including cycles whose due date is far in the future.

Failing test:

```text
creates a future billing cycle in Upcoming state
```

Observed behavior:

```text
future dueDate -> status === 'due'
```

Expected documented behavior:

```text
future billing cycle -> 'upcoming'
```

### F-14 — HIGH — Exported BillingService accepts negative payment outcomes

HTTP DTO validation rejects non-positive `amountPaid`, but `BillingService` is exported from `BillingModule` and can be called by other modules without passing through the HTTP validation pipe.

Failing test:

```text
rejects a negative payment outcome at the business boundary
```

Observed behavior: a negative amount is accepted by `applyPaymentOutcome()`, allowing `paidAmount` to decrease and `outstandingBalance` to grow beyond the original receivable.

This means the financial invariant currently exists only at the transport DTO boundary, not at the reusable business boundary.

## 6. Positive observations

Các phần sau có behavior tốt trong phạm vi đã test:

- state transition guards của Room;
- state transition guards của Tenancy;
- state transition guards của Incident;
- Listing chỉ expose `published` entries qua `findPublic()`;
- Billing exact-payment path tính total/outstanding đúng;
- Receipt ngăn confirm lần hai;
- Onboarding phát hiện duplicate room number trong một batch;
- Subscription capability check hoạt động cho path thông thường;
- Global TypeScript build/typecheck/lint/format baseline sạch;
- Nest application bootstrap thành công;
- health endpoint và Swagger UI reachable.

## 7. Merge assessment

Framework/scaffolding baseline đang compile và boot được, nhưng implementation branch hiện có các contract violations và state-integrity defects đã reproduce tự động.

Các finding nên được xem là merge blockers trước khi đưa toàn bộ low-level implementation vào `backend/core-foundations`:

1. F-01 Identity role inference;
2. F-02 fake onboarding domain creation;
3. F-03 mutable module state exposure;
4. F-04 mutable audit history;
5. F-05 subscription cross-organization shared mutable state;
6. F-06 billing overpayment handling;
7. F-11 missing authentication/authorization enforcement;
8. F-12 systemic cross-module reference-integrity gap;
9. F-14 negative payment outcome accepted at the exported business boundary.

F-07, F-08, F-09, F-10 và F-13 là các hardening/architecture gaps còn lại đã được codify trong audit suite.

## 8. Git state note

Local worktree:

```text
D:\Projects\TroOi-Project\.worktrees\low-level-architecture
```

Local branch HEAD đã được amend chỉ để đổi commit message, giữ nguyên original author:

```text
a1fa1cd744749ba2e88e0791cb68168c6cd97635
Author: duy anh <lenguyenduyanh2004@gmail.com>
Committer: Onsra <trtien520@gmail.com>
```

Tại thời điểm audit bắt đầu, branch local hiển thị `ahead 1, behind 1` so với remote vì remote vẫn giữ pre-amend commit object `798a889...`.

Audit không merge vào `backend/core-foundations` và không sửa implementation. Khi bàn giao, branch audit được push bằng `--force-with-lease` vì commit message của implementation commit đã được amend từ pre-amend SHA `798a889...` sang audited SHA `a1fa1cd...`.
