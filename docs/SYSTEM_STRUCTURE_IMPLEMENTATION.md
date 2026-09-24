# Báo Cáo Triển Khai Cấu Trúc Hệ Thống Backend TrọƠi
*(System Structure Implementation Report)*

## 1. Tổng quan & Mục tiêu

Tài liệu này ghi nhận toàn bộ quá trình và chi tiết các thành phần đã xây dựng nhằm thiết lập **cấu trúc nền tảng (System Structure)** cho backend của dự án **TrọƠi**.

- **Định vị sản phẩm**: TrọƠi là sổ vận hành thuê trọ theo từng phòng/tài sản (*Post-rental operations*), phục vụ chủ trọ (*Payer / Operator*) và người thuê (*Tenant*).
- **Kiến trúc ứng dụng**: **Modular Monolith** xây dựng trên nền tảng **NestJS** và **TypeScript**.
- **Nguyên lý thiết kế**: **Contract-first** kết hợp **persistence-agnostic business flows**. Các luồng nghiệp vụ và ranh giới (*boundaries*) được định nghĩa trước khi có database/ORM cụ thể; các module chỉ trao đổi qua 3 nguyên ngữ: `reference`, `decision`, và `event`.

---

## 2. Các gói phụ thuộc & Tooling được bổ sung

Các thư viện chuẩn đã được cài đặt thông qua `pnpm`:

```json
"dependencies": {
  "@nestjs/common": "^12.0.0",
  "@nestjs/core": "^12.0.0",
  "@nestjs/platform-express": "^12.0.0",
  "@nestjs/swagger": "^12.0.2",
  "class-transformer": "^0.5.1",
  "class-validator": "^0.15.1",
  "google-auth-library": "^11.1.0",
  "reflect-metadata": "^0.2.2",
  "rxjs": "^7.8.2",
  "swagger-ui-express": "^5.0.1"
},
"devDependencies": {
  "@types/express": "^5.0.6",
  "@types/swagger-ui-express": "^4.1.8"
}
```

---

## 3. Tầng dùng chung (Common Foundation Layer)

Được đặt tại thư mục `src/common/` nhằm cung cấp các tiện ích, chuẩn hoá request/response và xử lý lỗi xuyên suốt ứng dụng:

- **`src/common/constants/index.ts`**:
  - `API_PREFIX = 'api/v1'`
  - Các tham số phân trang mặc định (`DEFAULT_PAGE = 1`, `DEFAULT_PAGE_LIMIT = 20`, `MAX_PAGE_LIMIT = 100`).
- **`src/common/dto/pagination.dto.ts`**:
  - `PaginationQueryDto`: Base DTO chứa `page`, `limit` và getter `skip` dùng cho các endpoint danh sách, tích hợp validation và Swagger docs.
- **`src/common/dto/api-response.dto.ts`**:
  - `BaseResponseDto<T>`: Schema chuẩn cho response thành công (`success`, `data`, `timestamp`).
  - `ErrorResponseDto`: Schema chuẩn cho response lỗi (`statusCode`, `timestamp`, `path`, `message`, `errors`).
- **`src/common/filters/http-exception.filter.ts`**:
  - `HttpExceptionFilter`: Global filter bắt toàn bộ ngoại lệ HTTP và lỗi hệ thống unhandled, chuẩn hóa format lỗi trả về client.
- **`src/common/interceptors/transform.interceptor.ts`**:
  - `TransformInterceptor`: Global interceptor bọc toàn bộ dữ liệu trả về theo format `{ success: true, data: ..., timestamp: ... }`.
- **`src/common/index.ts`**:
  - Re-export toàn bộ constants, DTOs, filters và interceptors.

---

## 4. Khởi tạo ứng dụng & Cấu hình OpenAPI (Swagger)

### Entry Point (`src/main.ts`)
- Kích hoạt Global Prefix: `/api/v1`.
- Kích hoạt Global `ValidationPipe` với cấu hình an toàn:
  - `whitelist: true` (loại bỏ field rác không khai báo trong DTO).
  - `transform: true` (tự động ép kiểu theo type/decorator).
  - `forbidNonWhitelisted: true` (ném lỗi nếu request chứa field không hợp lệ).
- Gắn Global `HttpExceptionFilter` và `TransformInterceptor`.
- Thiết lập tài liệu **Swagger OpenAPI** với đầy đủ metadata và tag cho 12 Bounded Contexts, được mount sẵn tại endpoint `/docs`.

### Health Controller (`src/health.controller.ts`)
- Cung cấp endpoint `GET /api/v1/health` để kiểm tra trạng thái hoạt động của hệ thống (liveness check).

---

## 5. Cấu trúc chuẩn của 12 Bounded Modules

Tất cả 12 module trong `src/modules/` đều giữ nguyên vẹn `README.md` và `ARCHITECTURE.md` (12 phần đặc tả hành vi), đồng thời được scaffold thống nhất theo cấu trúc:

```text
src/modules/<module-name>/
├── <module-name>.module.ts       # Khai báo NestJS Module (controllers, providers, exports)
├── controllers/                  # HTTP boundary, routing RESTful, Swagger OpenAPI tags
│   └── <module-name>.controller.ts
├── services/                     # Business logic orchestration & in-memory state engine
│   └── <module-name>.service.ts
├── dto/                          # Request/Response DTOs tích hợp class-validator & Swagger
│   └── index.ts
├── contracts/                    # Public boundary: interfaces, references, decisions, enums
│   └── index.ts
├── README.md                     # Đặc tả phạm vi nghiệp vụ và sản phẩm
├── ARCHITECTURE.md               # Đặc tả kiến trúc 12 phần
└── index.ts                      # Public exports cho các module khác
```

### A. Chuỗi vận hành cốt lõi (Core Rental Operations Chain)

1. **`organization`**:
   - Quản lý phạm vi vận hành cấp cao nhất của chủ nhà/đơn vị quản lý.
   - Quản lý profile tổ chức, trạng thái hoạt động (`active`, `inactive`, `archived`).
   - Endpoints: `POST /api/v1/organizations`, `GET /api/v1/organizations`, `GET /api/v1/organizations/:id`, `PATCH /api/v1/organizations/:id`.

2. **`property`**:
   - Quản lý tài sản/khu trọ cấp địa điểm, địa chỉ nền, nhóm các phòng (`room`) trực thuộc.
   - Endpoints: `POST /api/v1/properties`, `GET /api/v1/properties`, `GET /api/v1/properties/:id`, `PATCH /api/v1/properties/:id`.

3. **`room`**:
   - Đơn vị cho thuê cốt lõi (*operational anchor*).
   - Kiểm soát chặt chẽ lifecycle độc lập: `draft -> vacant <-> occupied <-> maintenance -> archived`.
   - Endpoints: `POST /api/v1/rooms`, `GET /api/v1/rooms`, `GET /api/v1/rooms/:id`, `PATCH /api/v1/rooms/:id`, `PATCH /api/v1/rooms/:id/status`.

4. **`tenancy`**:
   - Quản lý kỳ thuê phòng giữa room và tenant, các điều khoản thuê (tiền thuê, tiền cọc, ngày nộp tiền).
   - Lifecycle độc lập: `draft -> active -> ending -> ended`.
   - Endpoints: `POST /api/v1/tenancies`, `GET /api/v1/tenancies`, `GET /api/v1/tenancies/:id`, `PATCH /api/v1/tenancies/:id/status`.

5. **`billing`**:
   - Quản lý chu kỳ thu tiền (`BillingCycle`), các khoản phí (*charges*), số tiền phải thu, đã thu và công nợ còn lại (*outstanding balance*).
   - Lifecycle theo kỳ: `upcoming -> due -> partial / overdue -> paid`.
   - Cung cấp API cập nhật đối soát từ thanh toán: `POST /api/v1/billings/cycles/:id/payment-outcome`.
   - Endpoints: `POST /api/v1/billings/cycles`, `GET /api/v1/billings/cycles`, `GET /api/v1/billings/cycles/:id`.

6. **`receipt`**:
   - Quản lý bản ghi thanh toán và biên nhận phục vụ đối chiếu vận hành (`recorded -> confirmed`).
   - Cung cấp outcome cho module billing đối soát công nợ mà không gộp chung dữ liệu.
   - Endpoints: `POST /api/v1/receipts`, `GET /api/v1/receipts`, `GET /api/v1/receipts/:id`, `POST /api/v1/receipts/:id/confirm`.

---

### B. Nhóm module năng lực bổ trợ (Supporting Capabilities)

7. **`identity-access`**:
   - Tích hợp trực tiếp với tầng infrastructure `src/integrations/google-identity` thông qua `createGoogleIdTokenVerifierFromEnv`.
   - Xác thực Google ID Token gửi từ Android Credential Manager và chuẩn hóa thành internal user profile.
   - Quản lý lời mời tham gia tổ chức (`Invitation`: `pending -> accepted / expired / revoked`).
   - Endpoints: `POST /api/v1/identity-access/auth/google`, `GET /api/v1/identity-access/users/:id`, `POST /api/v1/identity-access/invitations`, `POST /api/v1/identity-access/invitations/accept`.

8. **`incident`**:
   - Quản lý ticket báo sự cố phòng trọ.
   - State transition: `reported -> acknowledged -> processing <-> need_more_information -> resolved -> closed`.
   - Endpoints: `POST /api/v1/incidents`, `GET /api/v1/incidents`, `GET /api/v1/incidents/:id`, `PATCH /api/v1/incidents/:id/status`.

9. **`listing`**:
   - Public projection của phòng phục vụ tìm kiếm/khám phá, hoàn toàn tách biệt với lịch sử vận hành nội bộ của room.
   - Lifecycle: `draft -> published <-> hidden / rented`.
   - Endpoints: `POST /api/v1/listings`, `GET /api/v1/listings/public`, `GET /api/v1/listings/:id`, `PATCH /api/v1/listings/:id`, `PATCH /api/v1/listings/:id/status`.

10. **`onboarding`**:
    - Điều phối quy trình nhập liệu nhanh hàng loạt tài sản & phòng cho chủ trọ mới.
    - Tuân thủ quy tắc bắt buộc: `Import -> Validate -> Preview -> Confirm -> Tạo domain data`.
    - Endpoints: `POST /api/v1/onboarding/preview`, `GET /api/v1/onboarding/:id`, `POST /api/v1/onboarding/confirm`.

11. **`subscription`**:
    - Quản lý gói sản phẩm của tổ chức (`free`, `starter`, `pro`).
    - Cung cấp quyết định cấp phép quyền hạn (`Entitlement Decision`) cho các feature module khác.
    - Endpoints: `POST /api/v1/subscriptions/assign`, `GET /api/v1/subscriptions/organizations/:organizationId`, `GET /api/v1/subscriptions/check-entitlement`.

12. **`audit-trust`**:
    - Module cross-cutting lưu vết business facts quan trọng (`actorId`, `action`, `resourceType`, `resourceId`, `metadata`, `timestamp`).
    - Tiếp nhận và theo dõi các báo cáo nội bộ (*internal reports*) phục vụ kiểm duyệt của nền tảng.
    - Endpoints: `POST /api/v1/audit-trust/facts`, `GET /api/v1/audit-trust/facts`, `POST /api/v1/audit-trust/reports`, `GET /api/v1/audit-trust/reports`.

---

## 6. Đăng ký Root Module (`src/app.module.ts`)

`AppModule` đã được cập nhật đăng ký đầy đủ tất cả 12 modules nghiệp vụ cùng `HealthController`:

```typescript
@Module({
  imports: [
    OrganizationModule,
    PropertyModule,
    RoomModule,
    TenancyModule,
    BillingModule,
    ReceiptModule,
    IdentityAccessModule,
    IncidentModule,
    ListingModule,
    OnboardingModule,
    SubscriptionModule,
    AuditTrustModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

---

## 7. Kết quả kiểm tra & Verification Gates

Tất cả các kiểm tra chất lượng mã nguồn đều đã chạy và vượt qua 100%:

| Lệnh kiểm tra | Mục đích | Kết quả |
|---|---|---|
| `pnpm typecheck` | Kiểm tra static type của TypeScript trên toàn dự án | **PASSED** (0 lỗi) |
| `pnpm lint` | Phân tích cú pháp theo ESLint Flat Config (`--max-warnings=0`) | **PASSED** (0 warning, 0 error) |
| `pnpm format:check` | Kiểm tra định dạng code thống nhất theo Prettier | **PASSED** (All files match) |
| `pnpm test` | Chạy bộ kiểm thử tự động (bao gồm Google Identity Verifier specs) | **PASSED** (9/9 tests pass) |
| `pnpm build` | Biên dịch TypeScript ra thư mục production `build/` | **PASSED** (Build thành công) |

---

## 8. Hướng dẫn chạy và sử dụng

1. **Khởi động ứng dụng chế độ phát triển**:
   ```bash
   pnpm start:dev
   ```
2. **Kiểm tra sức khỏe dịch vụ**:
   - Truy cập: `http://localhost:3000/api/v1/health`
3. **Xem tài liệu OpenAPI & Thử nghiệm API**:
   - Truy cập giao diện Swagger UI tại: `http://localhost:3000/docs`
