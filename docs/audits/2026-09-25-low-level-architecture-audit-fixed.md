# Backend Low-Level Architecture Audit — Remediation Report

- Date: 2026-09-25
- Branch: `backend/low-level-architecture`
- Status: **REMEDIATION COMPLETE — 100% AUDIT PASS (36/36 Audit Tests, 45/45 Total Tests)**
- Reference Audit Document: `docs/audits/2026-09-25-low-level-architecture-audit.md`
- Target Branch for Merge: `backend/core-foundations`

---

## 1. Overview & Baseline Comparison

Báo cáo này ghi nhận toàn diện kết quả khắc phục 14 phát hiện kiến trúc (F-01 đến F-14) từ báo cáo kiểm toán [2026-09-25-low-level-architecture-audit.md](./2026-09-25-low-level-architecture-audit.md).

Toàn bộ các vi phạm hợp đồng kiến trúc (contract violations), rò rỉ đóng gói (encapsulation leakage), thiếu hụt xác thực tham chiếu chéo (cross-module reference integrity) và lỗ hổng kiểm soát truy cập (access enforcement) đã được xử lý triệt để, đảm bảo tính toàn vẹn của mô hình Modular Monolith.

### Bảng đối chiếu kết quả kiểm thử (Before vs After)

| Test Suite / Metric        | Trước khắc phục (Initial Audit) | Sau khắc phục (Remediation) | Trạng thái                  |
| -------------------------- | ------------------------------- | --------------------------- | --------------------------- |
| **Audit Tests Pass**       | 13 / 36 tests (36.1%)           | **36 / 36 tests (100%)**    | Đạt chuẩn                   |
| **Audit Tests Fail**       | 23 / 36 tests (63.9%)           | **0 / 36 tests (0%)**       | Đã khắc phục hoàn toàn      |
| **Google Auth Spec Tests** | 9 / 9 tests PASS                | **9 / 9 tests PASS**        | Giữ vững baseline           |
| **Total Test Suite**       | 9 / 9 tests discovered          | **45 / 45 tests PASS**      | Tự động phát hiện toàn bộ   |
| `typecheck`                | PASS                            | **PASS**                    | 0 error                     |
| `lint`                     | PASS                            | **PASS**                    | 0 warning                   |
| `format:check`             | PASS                            | **PASS**                    | 100% Prettier compliant     |
| `build`                    | PASS                            | **PASS**                    | NestJS build artifact ready |

---

## 2. Detailed Findings Remediation (F-01 to F-14)

### F-01 — CRITICAL — Authentication suy diễn mặc định business role

- **Vấn đề**: `IdentityAccessService.authenticateWithGoogle()` tự động gán `role: 'tenant'` khi xác minh Google ID Token thành công, vi phạm quy tắc authentication chỉ xác nhận danh tính trước khi có authoritative context để phân quyền/enrichment.
- **Giải pháp**:
  - Cập nhật interface `UserProfile` trong `src/modules/identity-access/contracts/index.ts` để `role` là optional (`role?: UserRole`).
  - Gỡ bỏ việc gán cứng `role: 'tenant'` trong `IdentityAccessService.authenticateWithGoogle()`.
- **Kết quả kiểm thử**: Test `does not infer a default business role during authentication` chuyển từ **FAIL** sang **PASS**.

### F-02 — CRITICAL — Onboarding confirm trả về domain IDs giả lập

- **Vấn đề**: `OnboardingService.confirmBatch()` tự sinh chuỗi `prop_onboard_*` và `room_onboard_*` rồi trả về mà không hề khởi tạo dữ liệu sang module `property` và `room`.
- **Giải pháp**:
  - Nhập `PropertyModule` và `RoomModule` vào `OnboardingModule`.
  - Inject `PropertyService` và `RoomService` vào `OnboardingService`.
  - Khi xác nhận batch (`confirmBatch`), gọi phương thức `propertyService.create()` và `roomService.create()` để tạo entity thật sự trong in-memory state của các module đích và lưu ID thực tế vào batch.
- **Kết quả kiểm thử**: Hai tests `creates actual destination-domain data when onboarding is confirmed` và `does not silently create fake destination data for a confirmed onboarding batch` chuyển từ **FAIL** sang **PASS**.

### F-03 — HIGH — Rò rỉ module-owned state qua mutable object reference

- **Vấn đề**: `RoomService` và các in-memory services lưu và trả về trực tiếp object reference trong `Map`, cho phép caller bên ngoài sửa đổi trạng thái thực thể (ví dụ: gán `room.status = 'archived'`) mà không thông qua state machine.
- **Giải pháp**:
  - Áp dụng nguyên lý defensive copying: thực hiện shallow copy `{ ...room }` ở tất cả các phương thức đọc và ghi (`create`, `findById`, `findByPropertyId`, `update`, `updateStatus`).
- **Kết quả kiểm thử**: Test `does not allow callers to mutate room state outside the lifecycle boundary` chuyển sang **PASS**.

### F-04 — HIGH — Audit history bị thay đổi sau khi ghi nhận

- **Vấn đề**: `AuditTrustService` lưu trực tiếp con trỏ `metadata` do caller truyền vào và trả về reference mutable của `AuditRecord`, khiến lịch sử kiểm toán có thể bị sửa đổi hậu kỳ.
- **Giải pháp**:
  - Sử dụng `structuredClone(dto.metadata)` khi lưu `AuditRecord`.
  - Sử dụng `structuredClone` cho `metadata` và defensive copy cho record khi trả về cho caller.
- **Kết quả kiểm thử**: Hai tests `keeps audit history immutable when caller-owned metadata changes` và `keeps an audit record immutable even if the returned record is modified` chuyển sang **PASS**.

### F-05 — HIGH — Template capabilities của subscription bị dùng chung mutable array

- **Vấn đề**: `SubscriptionService.assignPlan()` gán trực tiếp mảng `capabilities: planInfo.capabilities`, dẫn đến việc mutate capabilities của tổ chức này sẽ làm biến đổi quyền hạn của tất cả các tổ chức khác cùng gói.
- **Giải pháp**:
  - Sao chép độc lập mảng capabilities khi khởi tạo và truy vấn: `capabilities: [...planInfo.capabilities]`.
- **Kết quả kiểm thử**: Test `does not share mutable plan capability arrays across organizations` chuyển sang **PASS**.

### F-06 — HIGH — Billing chấp nhận overpayment vượt quá dư nợ

- **Vấn đề**: `BillingService.applyPaymentOutcome()` không kiểm tra giới hạn thanh toán, chấp nhận `amountPaid > cycle.outstandingBalance` dẫn đến `paidAmount > totalAmount`.
- **Giải pháp**:
  - Bổ sung validation tại business boundary:
    ```typescript
    if (dto.amountPaid > cycle.outstandingBalance) {
      throw new BadRequestException('Số tiền thanh toán vượt quá số dư cần trả của kỳ');
    }
    ```
- **Kết quả kiểm thử**: Test `rejects a payment outcome that exceeds the outstanding billing balance` chuyển sang **PASS**.

### F-07 — MEDIUM — Tenancy chấp nhận khoảng thời gian thuê ngược

- **Vấn đề**: `TenancyService.create()` chấp nhận hợp đồng có `endDate` nhỏ hơn `startDate`.
- **Giải pháp**:
  - Thêm kiểm tra logic thời gian trong service:
    ```typescript
    if (dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('Ngày kết thúc hợp đồng thuê không được sớm hơn ngày bắt đầu');
    }
    ```
- **Kết quả kiểm thử**: Test `rejects a tenancy whose end date is earlier than its start date` chuyển sang **PASS**.

### F-08 — MEDIUM — Định dạng cycleMonth không được kiểm soát theo regex YYYY-MM

- **Vấn đề**: Swagger mô tả `cycleMonth` có định dạng `YYYY-MM` nhưng DTO chỉ kiểm tra `@IsString()` và `@IsNotEmpty()`.
- **Giải pháp**:
  - Thêm decorator `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'cycleMonth phải có định dạng YYYY-MM' })` vào `CreateBillingCycleDto` trong `src/modules/billing/dto/index.ts`.
- **Kết quả kiểm thử**: Test `enforces the documented YYYY-MM billing cycleMonth format` chuyển sang **PASS**.

### F-09 — MEDIUM ARCHITECTURE DEBT — In-memory persistence nằm trực tiếp trong service

- **Đánh giá**: Ở giai đoạn low-level architecture, việc duy trì in-memory `Map` tĩnh trong service là phù hợp với nguyên lý tối giản (YAGNI / Ponytail) để kiểm chứng flow và contract trước khi tích hợp ORM/database.
- **Kế hoạch tiếp theo**: Tách persistence container thành abstract repository interfaces khi tích hợp PostgreSQL/Prisma ở phase tiếp theo.

### F-10 — MEDIUM TEST INFRASTRUCTURE GAP — Lệnh test mặc định bỏ sót audit tests

- **Vấn đề**: Script `"test"` trong `package.json` chỉ quét `src/**/*.spec.ts`, dẫn đến việc các test audit quan trọng dưới `tests/audit/**` bị bỏ qua trong quy trình CI.
- **Giải pháp**:
  - Cập nhật `package.json`:
    ```json
    "test": "tsx --test src/**/*.spec.ts tests/**/*.test.ts"
    ```
- **Kết quả kiểm thử**: Test `includes repository audit tests in the default test command` chuyển sang **PASS**.

### F-11 — CRITICAL SECURITY — Private routes không có cơ chế Auth Guard bảo vệ

- **Vấn đề**: Swagger quảng bá Bearer Auth nhưng toàn bộ hệ thống không có bất kỳ Guard nào được gắn vào NestJS pipeline, cho phép truy cập trái phép vào các dữ liệu nhạy cảm của tổ chức mà không cần token.
- **Giải pháp**:
  - Xây dựng decorator `@Public()` (`src/common/decorators/public.decorator.ts`) sử dụng `Reflector`.
  - Triển khai `AuthGuard` implements `CanActivate` (`src/common/guards/auth.guard.ts`) để kiểm tra `Authorization: Bearer <token>`, ném `401 Unauthorized` nếu thiếu hoặc không hợp lệ.
  - Đăng ký `AuthGuard` toàn cục qua token `APP_GUARD` trong `AppModule`.
  - Đánh dấu `@Public()` cho các endpoint mở: `HealthController` (`/api/v1/health`), `ListingController.findPublic` (`/api/v1/listings/public`), `IdentityAccessController.authenticateWithGoogle` (`/api/v1/identity-access/auth/google`).
- **Kết quả kiểm thử**: Hai tests `has an authentication/authorization enforcement mechanism for non-public API routes` và `blocks unauthenticated access to private organization data` chuyển sang **PASS**.

### F-12 — HIGH — Thiếu ràng buộc tính toàn vẹn tham chiếu chéo giữa 8 cặp module

- **Vấn đề**: Các bounded context nhận ID tham chiếu từ upstream mà không xác thực sự tồn tại của thực thể cha, dẫn đến việc tạo các thực thể mồ côi (orphan entities).
- **Giải pháp**:
  - Cấu hình Dependency Injection tuyến tính một chiều và kiểm tra thực thể cha thông qua method `findById()` trước khi tạo entity con:
    1. `PropertyService.create` -> kiểm tra `organizationId` qua `OrganizationService`.
    2. `RoomService.create` -> kiểm tra `propertyId` qua `PropertyService`.
    3. `TenancyService.create` -> kiểm tra `roomId` qua `RoomService`.
    4. `BillingService.createCycle` -> kiểm tra `tenancyId` qua `TenancyService` và `roomId` qua `RoomService`.
    5. `ReceiptService.create` -> kiểm tra `billingCycleId` qua `BillingService` và `tenancyId` qua `TenancyService`.
    6. `IncidentService.create` -> kiểm tra `roomId` qua `RoomService`.
    7. `ListingService.create` -> kiểm tra `roomId` qua `RoomService` và `propertyId` qua `PropertyService`.
    8. `SubscriptionService.assignPlan` -> kiểm tra `organizationId` qua `OrganizationService`.
  - Sử dụng `@Optional() @Inject(...)` để vừa tương thích Nest DI container vừa hỗ trợ unit test khởi tạo độc lập.
- **Kết quả kiểm thử**: Toàn bộ 8/8 tests trong suite `cross-module reference integrity audit` chuyển sang **PASS**.

### F-13 — MEDIUM — Vòng đời Billing không có trạng thái ban đầu Upcoming

- **Vấn đề**: `BillingService.createCycle()` khởi tạo mọi chu kỳ chưa quá hạn ở trạng thái `'due'`, bỏ qua trạng thái `'upcoming'` cho các chu kỳ có hạn nộp trong tương lai.
- **Giải pháp**:
  - So sánh `dueDate` với thời điểm hiện tại:
    - Nếu `dueDate` trong tương lai -> trạng thái ban đầu là `'upcoming'`.
    - Nếu `dueDate` trùng thời điểm hiện tại -> trạng thái là `'due'`.
    - Nếu `dueDate` trong quá khứ -> trạng thái là `'overdue'`.
- **Kết quả kiểm thử**: Test `creates a future billing cycle in Upcoming state` chuyển sang **PASS**.

### F-14 — HIGH — BillingService chấp nhận số tiền thanh toán âm tại business boundary

- **Vấn đề**: Transport DTO có validate `@Min(1)`, nhưng tại business method `BillingService.applyPaymentOutcome()`, giá trị âm vẫn được chấp nhận, làm giảm `paidAmount` và tăng `outstandingBalance`.
- **Giải pháp**:
  - Đặt chốt chặn bảo vệ ngay đầu method:
    ```typescript
    if (dto.amountPaid <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    }
    ```
- **Kết quả kiểm thử**: Test `rejects a negative payment outcome at the business boundary` chuyển sang **PASS**.

---

## 3. List of Modified & Added Files

### File tạo mới

- `src/common/decorators/public.decorator.ts`: Decorator `@Public()` đánh dấu route không cần xác thực token.
- `src/common/decorators/index.ts`: Barrel export cho common decorators.
- `src/common/guards/auth.guard.ts`: Guard kiểm soát truy cập Bearer token toàn cục.
- `src/common/guards/index.ts`: Barrel export cho common guards.
- `docs/audits/2026-09-25-low-level-architecture-audit-fixed.md`: Tài liệu báo cáo khắc phục này.

### File chỉnh sửa

- `package.json`: Cập nhật script test phát hiện toàn bộ audit tests.
- `src/app.module.ts`: Đăng ký `AuthGuard` toàn cục qua `APP_GUARD`.
- `src/common/index.ts`: Export thêm guards và decorators.
- `src/health.controller.ts`: Gắn `@Public()` cho health check endpoint.
- `src/modules/identity-access/contracts/index.ts`: Cập nhật `role?: UserRole`.
- `src/modules/identity-access/controllers/identity-access.controller.ts`: Gắn `@Public()` cho endpoint Google auth.
- `src/modules/identity-access/services/identity-access.service.ts`: Gỡ bỏ suy diễn role mặc định.
- `src/modules/listing/controllers/listing.controller.ts`: Gắn `@Public()` cho endpoint danh sách tin công khai.
- `src/modules/listing/listing.module.ts`: Import `RoomModule` và `PropertyModule`.
- `src/modules/listing/services/listing.service.ts`: Xác thực tham chiếu `roomId` và `propertyId`.
- `src/modules/onboarding/onboarding.module.ts`: Import `PropertyModule` và `RoomModule`.
- `src/modules/onboarding/services/onboarding.service.ts`: Khởi tạo domain data thật vào Property và Room.
- `src/modules/property/property.module.ts`: Import `OrganizationModule`.
- `src/modules/property/services/property.service.ts`: Xác thực tham chiếu `organizationId` và defensive copy.
- `src/modules/room/room.module.ts`: Import `PropertyModule`.
- `src/modules/room/services/room.service.ts`: Xác thực tham chiếu `propertyId` và defensive copy.
- `src/modules/tenancy/tenancy.module.ts`: Import `RoomModule`.
- `src/modules/tenancy/services/tenancy.service.ts`: Xác thực tham chiếu `roomId` và kiểm tra logic ngày thuê.
- `src/modules/billing/billing.module.ts`: Import `TenancyModule` và `RoomModule`.
- `src/modules/billing/dto/index.ts`: Regex kiểm tra định dạng `YYYY-MM`.
- `src/modules/billing/services/billing.service.ts`: Trạng thái upcoming, chặn overpayment và số tiền âm.
- `src/modules/receipt/receipt.module.ts`: Import `BillingModule` và `TenancyModule`.
- `src/modules/receipt/services/receipt.service.ts`: Xác thực tham chiếu `billingCycleId` và `tenancyId`.
- `src/modules/incident/incident.module.ts`: Import `RoomModule`.
- `src/modules/incident/services/incident.service.ts`: Xác thực tham chiếu `roomId`.
- `src/modules/subscription/subscription.module.ts`: Import `OrganizationModule`.
- `src/modules/subscription/services/subscription.service.ts`: Xác thực `organizationId` và clone capabilities.
- `src/modules/audit-trust/services/audit-trust.service.ts`: `structuredClone` metadata và record.

---

## 4. Verification Gates Summary

Tất cả các cổng kiểm tra chất lượng mã nguồn đều đạt trạng thái sạch tuyệt đối:

```text
> pnpm run typecheck
tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.tests.json
-> PASS (0 errors)

> pnpm run lint
eslint "src/**/*.ts" --max-warnings=0
-> PASS (0 warnings)

> pnpm run format:check
prettier --no-error-on-unmatched-pattern --check "src/**/*.ts" "*.{json,mjs}" ".vscode/*.json"
-> All matched files use Prettier code style!

> pnpm run test
tsx --test src/**/*.spec.ts tests/**/*.test.ts
-> tests: 45 | suites: 10 | pass: 45 | fail: 0 | duration_ms: 2259ms

> pnpm run build
nest build
-> PASS (Artifact built successfully)
```

---

## 5. Conclusion & Merge Readiness

Tất cả 9 Merge Blockers (F-01, F-02, F-03, F-04, F-05, F-06, F-11, F-12, F-14) cùng các hardening gaps liên quan đã được giải quyết triệt để.

Nhánh `backend/low-level-architecture` đã đạt đầy đủ điều kiện kỹ thuật và tính toàn vẹn kiến trúc để tiến hành merge an toàn vào nhánh nền tảng `backend/core-foundations`.
