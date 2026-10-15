# TrọƠi V1 — End-to-end integration specification

Ngày: 2026-10-05. Trạng thái: **APPROVED — user approved spec và implementation plan trong hội thoại ngày 2026-10-05**.

Đây là written spec theo kiến trúc/thứ tự xử lý đã được duyệt trong hội thoại. Đây là approved written spec; implementation plan tại `docs/superpowers/plans/2026-10-05-v1-end-to-end-integration.md` cũng đã được user duyệt. User chọn vị trí `docs/temps/`; approval cho phép triển khai theo gates của plan, không chứng nhận merge-ready và không tự thay thế Canonical hoặc product authority.

## 1. Mục tiêu, authority và scope

Hoàn thiện `integration/v1-current` để merge/release review bằng implementation và evidence thực tế, giữ Room Ledger redesign. Không merge/push `main` trong scope này.

Authority cho từng concern:

| Concern | Nguồn quyết định |
| --- | --- |
| Domain, ownership, lifecycle, invariants | `docs/database/v1/canonical.md` v3.7 → ERD → frozen public schema |
| Scope V1 bổ sung | Quyết định user ngày 2026-10-05 được ghi trong spec này; phải phản ánh vào product/design authority khi implementation |
| Product/visual/interaction | `docs/designs/v1/PRODUCT.md`, `DESIGN.md`, HTML và `.impeccable/design.json` |
| Transport | OpenAPI hiện hành; thay contract có chủ đích rồi regenerate, không lấy DTO cũ làm business authority |
| Completion | Master checklist + automated/runtime evidence tại đúng HEAD |

Các quyết định đã chốt:

- **MoMo là optional current V1 capability.** Không cấu hình hoặc provider unavailable không làm manual payment, tenancy hay discovery ngừng hoạt động. Giữ câu Canonical `payment gateway as MVP dependency = FUTURE`: optional channel không phải dependency bắt buộc.
- **Session restore và native Map là acceptance V1.** Không sử dụng ngoại lệ V2 trong checklist cũ để bỏ hai gate này.
- **Trust Report có authenticated submission trong V1.** Identity do backend derive; report listing/moderation/admin chưa được mở chỉ vì submission đã có.
- `Billing/Charge != Payment != Payment Claim != Deposit != Receipt != GatewayCheckout`. Provider handoff/redirect không xác nhận actual money.
- Không đóng OPEN bằng default tùy tiện. Riêng authenticated-only submission V1 là scope được user duyệt; anonymous reporting và các policy Trust còn lại vẫn chưa được quyết định.

## 2. Baseline và reconcile audit/prompt

Baseline đã audit, không phải giả định về branch tương lai:

| Ref | Commit |
| --- | --- |
| Integration | `340fddb6691725e03d214cacada2a352ba5ca1fe`, parents `cf0068d` / `e9d3883` |
| Payment remote / detached audit worktree | `8d5da11d808ec463dfd63ed060d1601d50b3a577`, base `41ca82b` |
| Frontend / design remote | `cf0068d` / `e9d3883` |

Integration chưa chứa payment module/migration. Merge simulation conflict tại `RentalViewModel.kt`, `RentalWorkspace.kt`, `TenantScreens.kt`; working tree không đang conflict. Integration chưa có remote branch riêng và upstream đang trỏ frontend branch: không push theo upstream mặc định.

Phải giữ checklist promotion MoMo đã staged (+8 dòng) và prompt untracked. Audit gates: integration typecheck/lint/build và 57 conformance tests pass; full suite 280 pass, 4 cancelled do thiếu `DATABASE_URL`. Payment typecheck/build/full-suite entry fail `TS2416`; 6 focused tests và 57 conformance tests pass. Android unit/build/lint pass trên hai HEAD nhưng chưa có device/sandbox proof. Không dùng kết quả lịch sử `284/284` thay fresh verification.

Reconciliation bắt buộc trong implementation:

- Promotion sửa `tenant-momo = OPEN`, gateway FUTURE-only và inventory totals/relations liên quan một cách có chủ đích; giữ stable screen IDs. Roadmap gateway tổng quát chỉ còn mô tả phần mở rộng ngoài optional MoMo V1, không phủ định channel hiện tại.
- Checklist cũ ghi map/session là V2 được supersede bởi quyết định trên. TalkBack/font-scale/predictive-Back physical quality follow-up không trở thành exemption cho session/map hoặc navigation behavior.
- Nhãn `BLOCKED_BACKEND` cũ cần đối chiếu contract từng item; endpoint tồn tại không đồng nghĩa DoD đã xong.
- Payment handoff ghi WIP chưa commit là stale; manifest deep-link không phải resume-routing evidence.
- Câu kết thúc trong prompt cho phép external blocker phải được hiểu là ghi nhận blocker trung thực: required gate thiếu evidence vẫn `READY_TO_MERGE: NO`, không chuyển `UNVERIFIED` thành PASS.

## 3. Target architecture và ownership

Giữ NestJS module/port/transaction architecture và Compose redesign hiện có. Không thêm queue, Redis, generic provider framework hoặc auth subsystem mới.

| Boundary | Sở hữu / trách nhiệm |
| --- | --- |
| Identity-access + Google integration | Verify identity; `/me` trả backend user và relationships; không phát backend access/refresh token mới trong scope |
| Root Android session/context/navigation | Trạng thái bootstrap, selected tenancy/org, route provenance, capability reconciliation và vô hiệu callback cũ |
| Rental-lifecycle / Room | Legal FSM; activation/confirmed checkout là cause riêng, không bị manual state setter thay thế |
| Payment-gateway + MoMo adapter | Checkout intent, provider correlation, request/response/IPN verification, dispatch/retry và callback transaction |
| Finance persistence / billing | Actual Payment, allocation và deposit application; provider write đi qua trusted gateway path, manual write qua boundary riêng |
| Deposit / Receipt | Fulfillment/settlement và evidence artifact; không tự chạy theo gateway callback |
| Audit-trust | Safe submission đúng public target, reporter principal, persistence; không tự remove nội dung hoặc quyết định moderation |
| Native map | Render/pick vị trí; dữ liệu Listing chỉ lấy public projection từ backend; không sở hữu địa chỉ/domain vocabulary |

Gateway dùng repository/transaction ports hiện có; không import PostgreSQL adapter vào application service. MoMo-specific payload được verify/normalize trước business write. Android đọc checkout/Payment từ backend, không synthesize success từ URI.

## 4. Manual Payment và gateway trust boundary — P0

`POST /finance/payments` là manual confirmed-record endpoint:

- Chỉ operator của tenancy được ghi tiền manual; tenant gửi tiền bên ngoài hệ thống vẫn đi qua Claim khi policy/API được chốt, không tự xác nhận inflow.
- Request chỉ hỗ trợ `MANUAL_CASH | MANUAL_TRANSFER`; `verification` được server gán `USER_RECORDED`. Client gửi `GATEWAY`, `PROVIDER_VERIFIED` hoặc field verification tự chọn bị reject 400 trước insert.
- Service boundary cũng reject provider provenance từ untrusted/manual caller; bảo vệ không chỉ ở DTO/Android. Read DTO giữ đầy đủ source/verification để hiển thị gateway records.
- Chỉ transaction xử lý fully verified successful IPN được tạo `Payment(source=GATEWAY, verification=PROVIDER_VERIFIED)`.
- Allocation, Deposit Application, Receipt issuance và correction tiếp tục explicit, authorized, cùng tenancy và tuân theo tổng amount guards. Không biến allocation/receipt thành side effect của Payment.

Quyền operator-only manual recording và server-derived verification là proposed transport hardening để review cùng spec này; không đóng permission-confirm policy của Payment Claim.

## 5. Checkout contract và state flow — P0

Các path dưới đây tương đối với API prefix hiện có:

| API | Contract mục tiêu |
| --- | --- |
| `POST /finance/checkouts` | Authenticated active participant hoặc operator của tenancy ACTIVE/ENDING; body tenancyId/amount, bắt buộc `Idempotency-Key` UUID; replay cùng key/payload tìm lại intent và resume dispatch khi hợp lệ |
| `GET /finance/checkouts/:id` | Authorize read tenancy mỗi lần; trả local durable status, không dispatch provider qua GET |
| `POST /finance/checkouts/momo/ipn` | Public transport, bắt buộc verify provider; accepted callback trả 204 không body |

Checkout chỉ tham chiếu tenancy và amount, không tự allocation vào Billing/Charge. Former tenant có thể đọc history được cấp quyền nhưng không tạo/retry checkout mới. IPN của intent đã được authorize trước đó không bị mất vì participant rời tenancy sau handoff.

### 5.1 Durable intent trước external call

1. Verify identity/relationship, amount và provider configuration trước dispatch.
2. Transaction insert checkout intent; unique `(created_by_user_id, idempotency_key)` và request fingerprint cho tenancy, normalized amount, provider. Cùng key/cùng fingerprint trả intent cũ; cùng key/khác payload trả 409. Authorize lại trước replay.
3. Persist immutable `partnerCode`, `orderId`, create `requestId`, amount, orderInfo, base64 extraData, `requestType=captureWallet`, `autoCapture=true` và callback/redirect URL snapshot; không persist accessKey/secretKey/signature hoặc credential-bearing raw request. V1 dùng thanh toán một bước, không mở capture/cancel hai bước.
4. Commit intent và acquire dispatch lease trong DB trước network. Không giữ DB transaction/row lock trong lúc gọi MoMo.
5. Verify create response rồi conditional update dưới lock; response muộn không được đảo terminal outcome. Create-response success chỉ xác nhận create request, không tự tạo Payment.

Client giữ key trước POST và nhớ checkout ID sau response, theo backend user. Khi response tới client bị mất, replay POST bằng key cũ để tìm đúng intent, không phát sinh order mới.

### 5.2 State vocabulary

| State | Meaning / next action |
| --- | --- |
| `INITIATED` | Intent committed; provider result chưa biết. Dispatch lease có thể đang giữ |
| `CREATED` | Có signed payUrl hợp lệ từ create response đã verify; đang chờ payment outcome, chưa có Payment |
| `UNKNOWN` | Timeout/disconnect/unverifiable response hoặc dispatch lease hết sau crash; không biết provider đã nhận hay chưa |
| `FAILED` | Final failure đã verify theo đúng API/payment contract; lưu result code/finality, dừng dispatch replay và không tự chuyển sang success |
| `SUCCEEDED` | Successful IPN đã verify và transaction commit Payment; resultingPaymentId tồn tại |

Không emit `EXPIRED` chỉ vì local timeout; checkout expiry policy không được tự suy ra. Loại bỏ state này khỏi target active contract nếu chưa có provider evidence/policy.

Main flow: `INITIATED → CREATED → SUCCEEDED`. `INITIATED → UNKNOWN` khi dispatch uncertain; `UNKNOWN → CREATED` sau verified replay response. Pending/non-final không chuyển thành `FAILED`; giữ `CREATED` khi đã có valid handoff, nếu chưa có thì giữ unresolved state. GET timeout hoặc thiếu IPN không tự hạ `CREATED` sang `UNKNOWN` để redispatch. Verified final failure chuyển unresolved state sang `FAILED`. Verified payment-success IPN có thể chuyển `INITIATED/CREATED/UNKNOWN → SUCCEEDED`, kể cả trước create response. `FAILED` và `SUCCEEDED` giữ terminal outcome; callback trái ngược được ghi nhận để đối chiếu, không tự đảo state hoặc tạo Payment. Contract hiện hành không cấp phép tự chuyển final failure sang success; nếu provider thay contract, cần authority/evidence mới trước khi thay transition.

## 6. Provider verification, failure, retry và idempotency — P0

### 6.1 Request/create response

- Amount là integer VND từ 1.000 đến 50.000.000 inclusive; dùng decimal/integer conversion chính xác, reject fractions/overflow. `extraData` là base64 của JSON tối thiểu `{checkoutId}`, không chứa secret hay dùng làm nguồn authorization. Đây là contract [MoMo captureWallet](https://developers.momo.vn/v3/vi/docs/payment/api/wallet/onetime/).
- Kiểm tra HTTP status, payload shape và create-response HMAC theo field set provider; đối chiếu partnerCode/orderId/requestId/amount với intent. Golden fixtures phải độc lập với helper đang test.
- Nếu sandbox thiếu signature, khác signed field set hoặc không verify được so với docs, ghi **integration blocker** cùng redacted evidence và yêu cầu provider làm rõ contract. Không bỏ signature verification, dùng unsigned fallback hay launch URL để vượt gate.
- HMAC timing-safe; field thiếu không được lấp bằng config để hợp thức hóa signature. Không log credential-bearing payload.
- V1 launch baseline là `payUrl` nằm trong signed response, HTTPS và host allowlist theo environment. Không coi `deeplink` là được HMAC bảo vệ nếu nó không nằm trong signed field set; không launch URI tùy ý từ unverified response. Provider web handoff vẫn cho phép quay lại app qua registered return URI.
- Implementation defaults đề xuất: transport timeout 35s, dispatch lease 60s; writing plan resolve/test và có thể điều chỉnh theo transport/runtime evidence, giữ timeout phù hợp provider guidance và lease đủ cho dispatch. Đây không phải domain/product invariant hoặc payment expiry. Ownership token và conditional completion vẫn bắt buộc bất kể giá trị cụ thể.

### 6.2 Failure/retry rules

| Tình huống | Behavior bắt buộc |
| --- | --- |
| Intent insert/commit fail | Không gọi provider; trả lỗi, client retry cùng key |
| Crash sau commit, trước HTTP | Intent vẫn có; sau lease recovery cho retry cùng correlation |
| Provider nhận request nhưng timeout/DB update fail | Giữ/recover uncertainty; IPN vẫn tìm được intent đã commit; không tự tạo checkout khác |
| Invalid/unsigned create response | Không launch URL, không tạo Payment; `UNKNOWN` kèm verification blocker. Replay vẫn tìm lại intent nhưng không dispatch tiếp khi blocker chưa được giải quyết |
| Verified final failure theo create/payment contract | `FAILED`; replay trả cùng outcome, không dispatch lại. Muốn intent mới phải thao tác mới rõ ràng, key mới |
| Verified pending/non-final hoặc duplicate request/order | Không kết luận failed/paid; lưu provider outcome. Chờ IPN nếu provider đang xử lý; duplicate/conflict không đổi requestId/orderId, giữ unresolved để đối chiếu |
| Đồng thời nhiều create/retry request | DB uniqueness + lease chọn dispatcher; caller khác nhận checkout hiện có; hết lease vẫn reuse provider requestId |
| App/backend process restart | Recover intent/key/ID và lease từ persistence; không dựa vào process-local map |

MoMo AIOv2 sử dụng `requestId` cho idempotency và giữ hiệu lực 31 ngày. Retry phải dùng cùng immutable create payload/orderId/requestId; không tự đổi ID khi network uncertain. Local mapping không bị xóa sau 31 ngày. Sau 31 ngày kể từ first-dispatch timestamp, block create replay cho unresolved intent và hiển thị cần đối chiếu; không thử lại như order mới. [MoMo API idempotency](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/idempotency/).

Chỉ dùng replay `POST /finance/checkouts` với cùng `Idempotency-Key` và payload, không có endpoint retry riêng. Sau authorize/fingerprint check, dispatch lại cùng immutable requestId/orderId chỉ khi intent `INITIATED/UNKNOWN`, lease cho phép, còn provider idempotency window và không có outcome yêu cầu chờ/đối chiếu/configuration fix. `CREATED/FAILED/SUCCEEDED` trả trạng thái hiện tại, không dispatch. Intent do user khác tạo không được resume bằng key của caller; operator vẫn đọc authorized checkout qua GET. Không cần background scheduler trong V1. Provider query API không tạo Payment và không nằm trong required V1 scope; missing-IPN hoặc duplicate/conflicting outcome giữ unresolved với correlation để đối chiếu, không giả confirmed success hoặc tự tạo order mới.

### 6.3 Result-code classification

Mapping phụ thuộc **API stage + requestType + persisted autoCapture**, không dùng `code != 0` làm failure rule. Theo [MoMo result-code contract](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/resultcode/):

| Outcome | Xử lý |
| --- | --- |
| `0` | Success của API tương ứng: create response chỉ mở handoff; verified payment IPN mới xác nhận tiền |
| `1000`, `7000`, `7002` | Pending/non-final; chưa Payment, chưa final failure |
| `9000` | Với một bước `autoCapture=true`, contract cho phép coi là payment success; với `false` chỉ authorization, chưa paid. V1 chỉ nhận success qua verified IPN khớp persisted one-step intent |
| Documented final failure áp dụng cho API hiện tại | `FAILED`, không redispatch hoặc tự chuyển success; không lấy refund/other-API codes làm payment rules |
| Non-final system/configuration/validation error | Không terminalize; lưu outcome, chỉ replay khi nguyên nhân đã xử lý và immutable payload còn hợp lệ |
| `40/41` duplicate request/order, code chưa nhận diện | Unresolved, không đổi IDs hay suy ra tiền; cần IPN/đối chiếu |

Persist verified code, API stage và normalized finality/outcome để recovery không mất semantics; terminal outcome/evidence được giữ riêng, không bị late non-final observation ghi đè. Finality của create API không đồng nghĩa payment đã settled. Writing plan phải chốt đầy đủ mapping/fixtures theo provider contract tại thời điểm tích hợp, gồm `9000` theo autoCapture và terminal contradiction; không chỉ test code `0`.

### 6.4 IPN và transaction

Validate runtime DTO/types/required signed fields, HMAC và exact partnerCode/orderId/create requestId/normalized amount; đối chiếu extraData với snapshot, require valid provider transaction ID cho payment-success outcome theo §6.3. Pending/non-final và authorization-only không tự tạo Payment. Code chưa nhận diện giữ uncertainty, không tự kết luận thành công/thất bại.

Sau verification, transaction lock checkout row và reread:

1. Duplicate same successful event: no-op, trả 204 sau khi xác nhận committed result.
2. Success mới từ unresolved state: insert đúng một Payment, update checkout/resultingPaymentId và Notification theo current delivery contract trong cùng transaction.
3. Verified pending/non-final: lưu outcome, chưa Payment; verified final failure từ unresolved state: `FAILED`, chưa Payment. Invalid signature/identity/amount không đổi business state.
4. Terminal outcome đã có: contradictory callback trả conflict 409 với redacted evidence để đối chiếu; final failure không tự thành success, success không bị đảo Payment. Duplicate matching final outcome là no-op 204; successful event khác transId cùng order không tạo Payment thứ hai. Callback pending đến muộn là no-op 204, không hạ terminal state.

Unique provider order/request identity, unique `(provider, partnerCode, transId)` cho successful settlement và unique resultingPaymentId là DB backstops; không thay thế row lock/atomic commit. Payment insert hoặc checkout update fail phải rollback tất cả; retry callback có thể hoàn tất sau đó.

ACK sau commit/no-op: **204, empty body, không global response envelope**; phải đáp ứng trong 15s theo [MoMo Payment Notification](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/notification/). Signature/shape invalid trả 400/401; identity/amount conflict trả 409; unknown order trả 404; DB transient failure trả 5xx, không ACK thành công. Exception/timeout không được tạo partial Payment. Provider redelivery không được giả định là vô hạn: local unresolved outcome phải luôn đọc được.

Android return URI chỉ kích hoạt restore/auth và authorized GET checkout/Payment. Query parameters từ redirect không phải payment evidence; client double-tap, app cancellation hoặc quay về trước IPN không tạo Payment. Pending checkout IDs được nhớ theo user, không cần nhớ payUrl hoặc credentials.

## 7. Concrete context và navigation

Root state có `SelectedContext = Discovery | Tenant(tenancyId) | Operations(organizationId)`, cùng remembered selected tenancy/org cho mỗi backend user. Capabilities chỉ derive từ `/me`, không persist như quyền đã có và không thêm `USER.role`.

- Switcher liệt kê từng tenancy/org cụ thể với source-backed labels; former tenancy có read-only history presentation. Không chọn bằng `firstOrNull()` hoặc global category count.
- Restore lựa chọn đã nhớ nếu còn trong capabilities; nếu không có valid selection và chỉ có một concrete context thì chọn context duy nhất; nhiều context thì mở switcher; không có relationship thì Discovery.
- User chuyển context phải cập nhật scope của projections/commands, xóa detail route/reads từ context trước. Dashboard/Finance không trộn các org/tenancy khi đang chọn một context.
- Refresh access: validate remembered IDs → selected context → active page/resource/back stack; context mất quyền chuyển Discovery/switcher, detail mất quyền về root hợp lệ. Reconcile trước privileged rendering; late response từ generation/context cũ bị bỏ.
- Route detail mang source type/ID và tenancy/org scope. Notification giữ origin route/context; Back từ source về notification, rồi caller còn được authorize. Process restart không cần restore toàn bộ detail back stack: về root của selected context hợp lệ, hoặc pending checkout detail sau authorize.
- Sáu Room Ledger mục, attention rows, Tenant Finance/Incident và notifications phải mở exact source detail/action bằng routes hiện có hoặc extension tối thiểu; không bắt user vòng qua workspace list.

Room UI chỉ expose `VACANT→MAINTENANCE`, `MAINTENANCE→VACANT`, `VACANT→INACTIVE`, `MAINTENANCE→INACTIVE`, `INACTIVE→VACANT`. `OCCUPIED→VACANT` chỉ qua confirmed checkout. Backend guard vẫn authoritative; concurrency/conflict có error state và refresh source.

## 8. Session restore V1

Giữ Google ID token **chỉ trong memory**, như transport credential ngắn hạn. Dùng Credential Manager dependencies hiện có; không thêm backend session JWT, refresh-token table hoặc persist token vào preferences/file/Keystore để giả long-lived session.

Bootstrap: `launch → shared-session → reacquire Google credential → auth/google khi cần resolve identity → verified /identity-access/me → restore user-scoped context hints → validate capability/resource → authorized root`.

- Returning-user flow dùng `GetGoogleIdOption`, authorized accounts và auto-select; explicit sign-in button hiện có là fallback. Auto-select phụ thuộc provider/account/consent, không hứa silent restore với mọi thiết bị. [Google Credential Manager](https://developers.google.com/identity/android-credential-manager/android/reference/com/google/android/libraries/identity/googleid/GetGoogleIdOption.Builder?hl=en).
- Lưu non-secret hints bằng app-private SharedPreferences: restore opt-in sau sign-in, backend userId, selected context IDs, pending checkout ID/key. Chỉ áp dụng hints khi `/me` xác nhận đúng user; đổi account không dùng data của account trước.
- Không credential/cancel/401: clear token, privileged projections/routes; cho explicit login hoặc Discovery. Backend/network unavailable: restore retry/error state, không render authenticated từ stale flag.
- Token hết hạn khi app đang chạy: reacquire/verify một lần có concurrency guard; chỉ retry safe reads. Không auto replay mutation ngoài checkout idempotency contract.
- Logout clear in-memory identity, hints/pending intents và Credential Manager state; vô hiệu callbacks theo generation, restart không tự đăng nhập lại. Backend durable checkout/finance history không bị logout xóa.
- Acceptance restart yêu cầu Google credential còn authorized và backend reachable: authenticated user/context khôi phục hợp lệ. Nếu OS cần account selection thì phải hoàn thành selection an toàn, không chọn identity bằng heuristic.

## 9. Native Map V1 và location UX

Repo hiện minSdk 26 / compileSdk 36, Compose BOM 2025.08.00, Kotlin Compose plugin 2.2.10; chưa có map SDK/key config. Giữ **Google Maps SDK for Android** là provider V1, native `MapView` bọc `AndroidView`, lifecycle gắn host Activity. Exact dependency version để writing plan resolve/pin/test với baseline; spec không freeze version. Không thêm Maps Compose wrapper/toolchain upgrade trong kiến trúc hiện tại. Dependency resolution/build phải xác minh compatibility trước shipping, không coi lựa chọn provider là build evidence. [SDK configuration](https://developers.google.com/maps/documentation/android-sdk/config).

- Guest Map render native map, pan/zoom, public Listing markers, marker-selected preview và exact Listing detail. Camera chọn khu vực; explicit “Tìm khu vực này” dùng existing coordinate/radius/price search, không tự geocode text.
- Chỉ public coordinates của PUBLISHED Listing; missing public location không được lấy exact operational location làm fallback. Empty results/error/offline states rõ ràng; giữ list alternative có keyboard/TalkBack targets.
- Current-device-location là opt-in runtime permission; approximate/deny vẫn dùng camera picker. Không cần background location hoặc lưu lịch sử vị trí thiết bị.
- Property editor có exact operational address + private map pin; public pin được chọn/confirm riêng. Listing editor dùng public map picker. Không tự copy private pin sang public, không raw lat/lng fields trong product flow.
- Chọn điểm chỉ ra tọa độ transport; không tạo neighborhood label, room type hoặc availability meaning. UI dùng “Khu vực đã chọn”/source labels thay raw numbers hoặc tên địa lý suy đoán.
- Key qua Gradle property `trooiMapsApiKey` hoặc env `TROOI_MAPS_API_KEY`, manifest placeholder; không hardcode/commit key. Restrict Maps SDK API + package/signing SHA-1 riêng cho backendDebug/release; configure billing/project ngoài Git. Không dùng backend OAuth client ID làm Maps key. [Google Maps setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key).
- Thiếu key/billing/GMS là runtime/config blocker, không exemption V2. Native render và picker phải có device evidence; known SDK renderer issues phải được kiểm tra trên target device, không suppress tests để claim PASS. [SDK release notes](https://developers.google.com/maps/documentation/android-sdk/release-notes).

## 10. Authenticated Trust Report submission V1

Harden existing `POST /audit-trust/reports` thành user submission contract; không gọi nguyên `SubmitInternalReportDto` từ Android.

- AuthGuard bắt buộc; derive `reporterUserId` từ verified principal. Client body chỉ target ID, canonical reason và optional note. Client gửi reporter/status/resolvedAt bị reject 400; service input phân biệt trusted actor với user payload. Evidence-reference/upload contract tiếp tục OPEN.
- Exactly one Listing hoặc Review target. Authorize read/report target và verify existence trước insert trong transaction; target inaccessible/nonexistent trả 404, cả hai/không target trả 400. Không yêu cầu tenant/operator relationship để report PUBLISHED public Listing.
- Listing submission chỉ cho PUBLISHED target còn public tại commit; lock/revalidate target trong transaction để không race với unpublish. Review vẫn là target canonical nhưng chưa mở report action khi thiếu authoritative published/readable Review contract; trả explicit unsupported-target 422, không report arbitrary private Review. Việc mở Review path sau này cần contract/policy riêng.
- Persistence gán `SUBMITTED`, reporter principal và createdAt. Chỉ return receipt/projection của submission vừa tạo; không expose global report history qua success response.
- `GET /audit-trust/reports` và moderation mutations không có user-facing V1 route; endpoint list hiện tại phải fail closed 403 cho app users, không chỉ giấu nút UI. Không tự invent admin role.
- Canonical reason allowlist; input size limits bắt buộc ở transport. Note 2.000 ký tự và request body 8 KiB là **implementation defaults đề xuất**, writing plan resolve/test và có thể điều chỉnh; không phải domain/product invariant. Không fetch arbitrary evidence URL hoặc thêm upload subsystem; rate-limit/evidence-verification policy vẫn OPEN.
- Report không mutate Listing/Review, không tạo public personal score. Legacy owner moderation notification không được cấp quyền đọc report qua notification: chỉ phát sau khi có authorized recipient contract; V1 submission không dựa vào notification đó.

Authority update trong implementation ghi rõ authenticated-only V1 submission là quyết định mới; giữ anonymous support/rate-limit/moderation/evidence policy OPEN. Claim/Review eligibility/publication không bị promotion Trust kéo theo.

## 11. Migration và selective integration strategy

Giữ 29-table frozen **public** catalog; checkout technical schema nằm ngoài public, không thêm pending Payment/Claim hoặc sửa meaning core entities.

- Migration checkout có positive integer/bounds guard, immutable correlation/autoCapture, client idempotency key/fingerprint, dispatch lease/first-dispatch timestamp, verified provider outcome/finality và successful provider transId. Constraints bảo vệ unique client intent, provider order/request/transaction identity, resultingPaymentId và status/result consistency; FK tenancy/Payment theo existing ports.
- Nếu `000003_gateway_checkouts` chưa áp dụng ở bất kỳ shared environment, chỉnh migration trước integration. Nếu đã áp dụng, giữ migration history và thêm forward migration; không rewrite deployed migration. Baseline SHA không đủ để kết luận deployment history: phải kiểm tra migration catalog trước execution.
- Core public parity và gateway schema assertions là hai gate riêng. Clean-DB, forward migration, upgrade path và down/up chạy trên disposable DB. Down checkout migration là destructive với technical correlation: không dùng cho production có unresolved/paid checkout; giữ core Payment records, forward recovery là mặc định.
- Persistence test harness phải reset auxiliary gateway schema trong disposable DB cùng migration metadata; reset public-only hiện tại không được để gateway residue/FK cũ làm sai lần chạy kế tiếp.
- Harden từ payment HEAD trong isolated branch/worktree; đưa backend/ports/migration/env/OpenAPI sang integration chọn lọc. Port Android behavior vào newer files; không wholesale overwrite từ payment base cũ.
- Preserve Guest/Tenant/Landlord navigation, Room Ledger components, versioned authority và Google runtime fixes. So sánh before/after diff; regenerate OpenAPI từ target code thay vì ghi đè snapshot branch cũ.
- Commit theo intent; giữ local work và staged checklist, không force-push/rewrite shared history. Vị trí worktree/branch name là execution detail, không cố định bởi spec.

## 12. Thứ tự xử lý sau spec/plan approval

1. Promote authority và reconcile checklist/scope.
2. Harden payment branch: interceptor type/ACK, manual trust boundary, durable checkout, verification và DB idempotency.
3. Selectively port backend rồi Android handoff vào integration.
4. Close Room FSM, concrete context, access reconciliation và session restore.
5. Close source navigation, native map/location UX, safe Trust submission, Deposit Application và Account/Settings/Help.
6. Full automated/runtime/device/sandbox verification; reconcile evidence, cleanup và merge review.

Behavior tests đi cùng từng boundary; bước cuối không phải thời điểm mới bắt đầu test. Written plan phải tách work packages có dependency rõ, không biến danh sách này thành approval implementation.

## 13. Acceptance criteria và evidence

Mỗi item cần implementation, current backend contract, access/loading/empty/error states, behavior tests và runtime evidence khi tương tác phụ thuộc provider/device. Source-string tests được giữ như supplemental regression checks, không là bằng chứng duy nhất.

| Gate | Evidence bắt buộc |
| --- | --- |
| Authority | Product/design/HTML/checklist đồng nhất optional MoMo, V1 map/session, safe Trust submission; invariant Canonical không bị làm yếu |
| Manual vs gateway | HTTP/controller/service tests: spoof gateway/verification reject, tenant manual-confirm reject, operator manual success; no bypass path tạo provider Payment |
| Provider boundary | Independent create/IPN HMAC fixtures; sandbox/docs discrepancy là blocker; amount min/max/outside/fraction, base64, signature/identity mismatch; stage-aware success/pending/final-failure và `9000`/autoCapture; terminal contradiction không đảo state; 204 empty ACK/no envelope |
| Checkout recovery | Persistence-before-call, crash-before-dispatch, timeout-after-acceptance, client response loss, late create response, rollback/restart; replay cùng POST/key/payload resume đúng intent với cùng provider IDs, same-key conflict và lease race tests; pending/duplicate/final outcome không redispatch sai |
| PostgreSQL concurrency | Hai connection/transaction callbacks đồng thời cùng intent; đúng một Payment/result link/notification side effect; failure rollback rồi retry; duplicate transId khác intent bị chặn; không auto allocation/deposit/receipt |
| Room/context/navigation | Executable FSM tests; multiple tenancy/org selection; lost-capability fallback; six Ledger source routes; exact attention/detail targets; notification caller/source Back; Account selected state |
| Session | Automated bootstrap/reducer/gateway tests + real-device sign-in/process kill/relaunch; correct backend identity/context, account switch, logout, expired/revoked credential, offline and cancellation |
| Map | Native tiles/gestures, marker→Listing, camera search, private/public picker isolation, permission allow/approximate/deny, error/empty states; real-device evidence, không placeholder/raw coordinate UI |
| Trust | Auth required, spoof actor reject, target existence/public visibility, double/no target, gated Review/list/moderation; persistence actual reporter; no content removal/public score |
| Finance | Explicit allocation/deposit/receipt, tenancy guards and total-money limits; MoMo callback không tự gọi downstream financial commands |
| Runtime | Clean DB migrate/parity, backend access smoke, persisted checkout/Payment; real Guest/Tenant/Landlord/Notification journeys và MoMo sandbox return-before/after IPN |

Fresh final gates trên exact target HEAD, ghi thêm tracked staged/unstaged diff để xác định artifact được test:

```powershell
pnpm typecheck
pnpm lint
pnpm build
pnpm test:conformance:database-v1
pnpm test
pnpm test:persistence:migration
.\gradlew.bat :app:testDebugUnitTest --no-daemon
.\gradlew.bat :app:assembleBackendDebug --no-daemon
.\gradlew.bat :app:lintDebug --no-daemon
git diff --check
git diff --cached --check
git status --short
```

Dedicated payment PostgreSQL/concurrency suite và Android instrumentation/device scenarios phải có runnable command/evidence được ghi trong plan và final record; default `pnpm test` không được coi là tự cover mọi persistence test. Target backendDebug cần behavior verification riêng ngoài debug unit tests. Không dùng cached result làm bằng chứng process-restart/provider behavior mới.

Evidence record chứa commit SHA, environment/build variant, command/scenario, exit/result và artifact path đã redact secrets/PII. Thiếu DB/device/Maps key/billing/MoMo credentials/public IPN URL ghi `UNVERIFIED` và external blocker. Không tick checklist hoặc báo `READY_TO_MERGE: YES` khi required evidence còn thiếu. MoMo optional cho vận hành V1 không có nghĩa được miễn gate của capability được ship.

## 14. OPEN/FUTURE được giữ nguyên

OPEN: textual geocoder/area labels; room/property type owner/vocabulary; availability semantics; Payment Claim evidence/confirmation; Review eligibility/publication/moderation; anonymous Trust submission, rate-limit/evidence/moderation permission policy; financial unallocated/over-allocation và deposit-requirement-change policy. Không dùng maps SDK hoặc reporting form để tự freeze các policy này.

FUTURE: gateway bắt buộc cho MVP; gateway providers/platform mở rộng; backend long-lived session/refresh-token subsystem; team/delegation, asset inventory, extra charge types, subscription/import, realtime chat, AI/OCR, OTA/nightly/proration và public personal ratings. Core current V1 đã được Canonical freeze vẫn phải hoạt động trong published contract.

Settings/Help là shared surfaces tối thiểu theo HTML; Notice phải tenancy-scoped; Task 1 reconcile wording prototype tương ứng. Inquiry Activity chỉ active sau authenticated sender-scoped contract; scope hiện tại giữ explicit gated state, không fake data. Không đổi chất lượng UI/theme hoặc refactor unrelated code để giải quyết integration.

## 15. Review handoff

User đã approve written spec và implementation plan trong hội thoại ngày 2026-10-05, bao gồm native SDK choice, manual operator-only write, checkout state/retry contract và safe Listing-only reporting activation với Review gated. Approval không thay thế implementation/runtime evidence hoặc merge/release gates.

Lịch sử bước viết spec: không sửa source code hoặc stage/commit thay đổi của user trước approval. Spec và plan hiện đã được duyệt; execution tuân theo task boundaries và evidence gates của approved plan.
