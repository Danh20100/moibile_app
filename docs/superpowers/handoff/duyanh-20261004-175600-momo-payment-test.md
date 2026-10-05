# Handoff — Test kênh thanh toán MoMo cho Duy Anh

## 1. Trạng thái bàn giao

- Owner tiếp theo: **Duy Anh**.
- Repo: `TroOi-Project` (workspace `backend`).
- Working branch: `backend/payment`.
- HEAD đã commit tại thời điểm handoff: `41ca82b922c99e3f0d9cdff4cf7f1c000aa4f49f` (`docs(design): add interactive product universe prototype`).
- **WIP chưa commit** trên branch này: module `src/modules/payment-gateway/`, migration `000003_gateway_checkouts`, Android handoff, tests, OpenAPI, `.env.example`. Test live phải checkout đúng branch và **có đủ WIP này** (commit trước khi audit độc lập nếu reviewer cần exact SHA).
- Không merge vào `staging` / `main`.
- Không force-push / rebase lịch sử chung.
- Không sửa local WIP coordinator: `gradle.properties`, `gradle/gradle-daemon-jvm.properties`.
- Gateway = **FUTURE** trong freeze V1. `READY_TO_MERGE` V1 = **NO** cho tới khi authority nhận capability này.

## 2. Mục tiêu

Người nhận **test được** kênh MoMo xuyên suốt bốn lớp, không chỉ API 2xx:

```text
Android UI
→ HTTP / OpenAPI
→ NestJS
→ PostgreSQL
→ invariant (checkout ≠ Payment; Deposit/Receipt/Allocation không tự đổi)
```

Câu domain bắt buộc:

> V1 billing gồm RENT + ELECTRICITY + WATER. Billing = khoản phải thu, Payment = tiền đã thực nhận, Claim = người thuê báo đã chuyển, Deposit = cọc, Receipt = biên nhận. MoMo chỉ là kênh chuyển tiền; chỉ khi backend/provider xác nhận thì mới thành Payment.

Không đóng policy OPEN. Không thêm charge FUTURE (WiFi / Parking / Service / Other). Không implement Claim REST.

## 3. Authority

Đọc theo thứ tự:

1. `docs/database/v1/canonical.md` §16–18
2. `docs/backlogs/v1/billing.md`
3. `docs/backlogs/v1/payment.md`
4. `docs/backlogs/v1/payment-claim.md`
5. `docs/api/openapi.json` (paths `/finance/checkouts*`)
6. code/tests

Không chỉnh Canonical. Không invent `Payment.status = PENDING`.

### Ranh giới

```text
Billing / Charge     = phải thu (RENT | ELECTRICITY | WATER)
GatewayCheckout      = phiên mở MoMo (không phải Payment)
Payment              = tiền thực nhận — chỉ sau IPN verified
Payment Allocation   = gán tiền vào Charge (API operator sẵn có; MoMo không làm)
Deposit Application  = gán tiền vào cọc (MoMo không làm)
Receipt              = biên nhận từ confirmed Payment (MoMo không làm)
Payment Claim        ≠ Payment; REST/evidence/confirm vẫn OPEN
```

Mở MoMo hoặc user bấm chuyển **không** tạo Payment, **không** đổi outstanding, **không** Receipt, **không** Deposit funded.

Outstanding về 0 chỉ khi đã có Confirmed Payment **và** Allocation đủ Charge.

## 4. Scope đã có trong WIP

### Backend

- Schema `gateway.gateway_checkouts` — migration [`database/migrations/000003_gateway_checkouts.ts`](../../../database/migrations/000003_gateway_checkouts.ts). Không thêm bảng vào catalog V1 `public` (parity vẫn 29 bảng).
- Module [`src/modules/payment-gateway/`](../../../src/modules/payment-gateway/).
- Tách khỏi [`billing.service.ts`](../../../src/modules/billing/services/billing.service.ts) `recordPayment`.

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/v1/finance/checkouts` | Bearer; `assertCanAccessTenancy` |
| GET | `/api/v1/finance/checkouts/:id` | Bearer; `assertCanReadTenancy` |
| POST | `/api/v1/finance/checkouts/momo/ipn` | Public; **chỉ HMAC** |

IPN `resultCode == 0` + amount khớp + chữ ký đúng → insert Payment `source=GATEWAY`, `verification=PROVIDER_VERIFIED`, `confirmedAt`, notify `PAYMENT_CONFIRMED`. Idempotent theo `orderId`. Sai chữ ký / sai amount / resultCode khác 0 → không Payment.

Response wrap `{ success, data }` **bỏ qua** đúng path IPN (`TransformInterceptor`) để MoMo nhận `{ resultCode, message }` ở root.

### Android

- [`V1RentalGateway.kt`](../../../app/src/main/java/com/trooi/app/features/shared/V1RentalGateway.kt): `createGatewayCheckout` / `gatewayCheckout` / `payments(tenancyId)`. `recordPayment` **vẫn chặn** `GATEWAY`.
- [`RentalWorkspace.kt`](../../../app/src/main/java/com/trooi/app/features/tenancy/RentalWorkspace.kt): hiện Charge; nút Mở MoMo với amount user nhập; copy “chưa phải Confirmed Payment”; poll checkout.
- Deep link resume: `trooi://payment/momo` trong `AndroidManifest.xml`.

### Env

Xem [`.env.example`](../../../.env.example):

```text
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_IPN_URL=
MOMO_REDIRECT_URL=trooi://payment/momo
```

Không commit secret.

## 5. Chưa hoàn thành / blocker test live

- Chưa có sandbox `partnerCode` / `accessKey` / `secretKey`.
- `MOMO_IPN_URL` phải **public** (ngrok / Cloudflare tunnel). Emulator gọi MoMo được; MoMo gọi lại máy dev thì không, nếu URL là localhost.
- Chưa có E2E Maestro / emulator MoMo trên CI.
- Payment Claim REST chưa có.
- Payout chủ trọ / refund / đối soát kế toán: ngoài scope.
- `READY_TO_MERGE` V1: **NO**.

## 6. Evidence đã chạy (máy implement)

```powershell
pnpm exec tsx --test tests/core/momo-hmac.test.ts tests/core/payment-gateway.behavior.test.ts
```

Kỳ vọng: **6 PASS**

- HMAC create/IPN ổn định
- Tạo checkout **không** insert Payment
- IPN verified → đúng 1 Payment `GATEWAY` + `PROVIDER_VERIFIED`; IPN trùng không tạo bản hai
- Sai chữ ký → không Payment
- Sai amount → checkout `FAILED`, không Payment
- Deposit funded không đổi khi chỉ checkout/IPN

Cũng đã chạy lúc implement: `tsc --noEmit` (`tsconfig.json` + `tsconfig.tests.json`), `pnpm openapi:generate`.

Không claim live sandbox GREEN. Không claim Android assemble trên máy này.

## 7. Cách test — đủ độc lập

### 7.1 Chuẩn bị

```powershell
git checkout backend/payment
# bảo đảm WIP payment-gateway còn trên tree
pnpm db:dev:up
pnpm db:migrate
```

Migration `000003` phải lên. Thiếu schema `gateway` thì IPN/create sẽ fail SQL.

Điền `.env` sandbox. `MOMO_IPN_URL` dạng:

```text
https://<tunnel>/api/v1/finance/checkouts/momo/ipn
```

```powershell
pnpm start
```

API prefix: `/api/v1`.

### 7.2 Unit (không cần MoMo / Docker)

```powershell
pnpm exec tsx --test tests/core/momo-hmac.test.ts tests/core/payment-gateway.behavior.test.ts
```

PASS bắt buộc trước khi tốn thời gian sandbox.

### 7.3 HTTP live — mở MoMo chưa phải Payment

Tiền đề: user Google thật (không fake principal); Tenancy mà user operate hoặc đang participate; amount VND nguyên, ví dụ `4470000.00`.

```text
POST /api/v1/finance/checkouts
Authorization: Bearer <google-id-token>
{ "tenancyId": "<id>", "amount": "4470000.00" }
```

Kỳ vọng:

| Lớp | PASS khi |
| --- | --- |
| API | 201; `status=CREATED`; có `referenceCode`, `deeplink` và/hoặc `payUrl`; **không** `resultingPaymentId` |
| API | `GET /api/v1/finance/payments?tenancyId=<id>` không thêm dòng vì bước này |
| DB | `gateway.gateway_checkouts` 1 dòng `CREATED`; `public.payments` không thêm |
| Invariant | không allocation, không receipt, không deposit event |

Thiếu env MoMo: 503 rõ (`MOMO_PARTNER_CODE` / keys / `MOMO_IPN_URL`). Đó là fail cấu hình, không phải fail domain.

### 7.4 Android UI

1. Mở rental workspace Tenancy (tenant hoặc operator).
2. Vào Payment: thấy từng Charge RENT / ELECTRICITY / WATER; cọc không cộng ngầm vào amount.
3. Nhập amount tường minh → **Mở MoMo**.
4. UI nói đang chờ xác nhận. **Không** hiện “đã thanh toán”.
5. Quay lại app (`trooi://payment/momo` hoặc thủ công) → **Làm mới trạng thái checkout**.
6. `GET payments` / list Payment trên UI vẫn trống cho tới IPN.

`recordPayment` tay với `GATEWAY` phải bị chặn local (contract test `forbiddenFutureChargeAndGatewayPaymentsAreRejectedLocally`).

### 7.5 IPN → Payment

Sau khi user trả trên MoMo sandbox (hoặc IPN giả **chỉ** khi chữ ký HMAC đúng secret đang chạy):

```text
POST /api/v1/finance/checkouts/momo/ipn
```

Public, không Bearer. Body theo MoMo v2; chữ ký `accessKey&amount&...&transId`.

Kỳ vọng success:

| Lớp | PASS khi |
| --- | --- |
| API | `{ "resultCode": 0, "message": "success" }` ở **root** (không bọc `data`) |
| API | checkout `SUCCEEDED` + `resultingPaymentId` |
| API | đúng **một** Payment: `GATEWAY` + `PROVIDER_VERIFIED` |
| DB | `payments` 1 dòng; `resulting_payment_id` unique; IPN trùng không insert thêm |
| Notify | `PAYMENT_CONFIRMED` tới linked tenant nếu có participant |
| Invariant | không auto-allocate; Deposit `fundedAmount` không đổi; chưa có Receipt trừ khi operator `POST /receipts` |

Kỳ vọng fail:

- Sai `signature` → 401; không Payment.
- `amount` IPN ≠ amount checkout → checkout `FAILED`; không Payment.
- `resultCode != 0` → `FAILED`; không Payment.

### 7.6 Sau Payment (ngoài scope MoMo — chỉ xác nhận không bị phá)

Operator (API hiện có):

```text
POST /api/v1/finance/payments/:id/allocations
POST /api/v1/finance/payments/:id/deposit-applications
POST /api/v1/receipts
```

Test xác nhận: MoMo **không** tự gọi các API này.

### 7.7 Claim (không test như Payment)

Payment Claim **không có REST**. Không dùng checkout làm claim. Không giả Confirm trên UI.

## 8. Không được làm

- Không `Payment.status = PENDING` / `PENDING_CLAIM`.
- Không dùng Claim làm “đơn MoMo chờ IPN”.
- Không auto-allocate, không auto apply Deposit, không tự issue Receipt.
- Không bypass AuthGuard cho create/read checkout; không fake Google principal.
- Không commit `.env` / secret MoMo.
- Không merge staging/main; không sửa Canonical để test pass.
- Không thêm charge FUTURE.

## 9. Việc Duy Anh làm tiếp

1. Commit WIP trên `backend/payment` nếu cần SHA sạch cho review (không đụng secret).
2. Điền sandbox + tunnel IPN.
3. `pnpm db:migrate` rồi chạy §7.2 → §7.5.
4. Ghi evidence 4 lớp cho mỗi bước (lệnh, HTTP status, query DB, screenshot UI nếu có).
5. Không ghi `READY_TO_MERGE: YES` từ unit local.

## 10. Mẫu report khi xong test

```text
BRANCH: backend/payment
HEAD AT HANDOFF: 41ca82b922c99e3f0d9cdff4cf7f1c000aa4f49f
FINAL SHA (sau commit WIP, nếu có): <sha>
UNIT HMAC + CHECKOUT: PASS / FAIL
LIVE CREATE CHECKOUT (API/DB): PASS / FAIL / BLOCKED_NO_CREDENTIAL
LIVE OPEN MOMO ≠ PAYMENT (UI/API): PASS / FAIL / BLOCKED
LIVE IPN SUCCESS (API/DB/INVARIANT): PASS / FAIL / BLOCKED
IPN IDEMPOTENT / BAD SIG / BAD AMOUNT: PASS / FAIL / BLOCKED
DEPOSIT UNCHANGED: PASS / FAIL
ALLOCATION/RECEIPT NOT AUTO: PASS / FAIL
CLAIM NOT USED AS PENDING PAYMENT: PASS
OPEN/FUTURE KHÔNG ĐÓNG: YES
READY_TO_MERGE V1: NO
```

## 11. Definition of Done cho *handoff test này*

Handoff test xong khi:

- unit 6 case GREEN trên máy nhận;
- live hoặc BLOCKED có lý do (thiếu credential/IPN public) được ghi rõ;
- không có claim “đã thanh toán” chỉ vì mở MoMo;
- OPEN/FUTURE không bị đóng;
- `READY_TO_MERGE` V1 vẫn **NO**.
