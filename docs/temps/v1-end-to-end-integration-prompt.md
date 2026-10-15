# Prompt: hoàn thiện TrọƠi V1 từ integration đến merge-ready

Bạn đang làm việc trong repo `D:\Projects\TroOi-Project` / worktree hiện tại của TrọƠi. Mục tiêu là xử lý V1 từ trạng thái hiện tại đến khi branch tích hợp đủ bằng chứng để tiếp tục merge/release review.

## Quy tắc làm việc

- Ưu tiên correctness và evidence. Không báo PASS nếu chưa chạy gate tương ứng.
- Không dùng banner phân cách dài hoặc log trang trí lặp lại. Khi cần nhãn terminal, dùng một từ/ngắn gọn như `STATUS`, `TEST`, `RESULT`.
- Hạn chế lặp lại cùng một kết luận, cùng một command hoặc cùng một đoạn giải thích. Báo cáo cuối nên cô đọng thành trạng thái, thay đổi, test, blocker.
- Được phép `git checkout`, `git switch`, tạo branch mới hoặc `git worktree` để qua nhánh khác xử lý rồi quay lại. Không được làm mất local work đang có.
- Có thể commit theo từng task/coherent fix. Không force-push, không rewrite shared history.
- Không merge/push vào `main` nếu chưa có phê duyệt rõ ràng. Mục tiêu trước mắt là làm `integration/v1-current` merge-ready.
- Trước mọi branch switch: kiểm tra `git status`, commit/stash hợp lý hoặc dùng worktree để không làm mất thay đổi.
- Không hạ test, bỏ invariant, bypass auth, fake provider verification hoặc sửa expected result chỉ để gate xanh.
- Canonical v3.7 là authority cao nhất cho domain. Product/design authority của V1 nằm trong `docs/designs/v1/`. Nếu thay scope sản phẩm, cập nhật authority có chủ đích và ghi rõ tác động.

## Trạng thái xuất phát đã biết

Current integration:

```text
integration/v1-current
HEAD 340fddb
parents:
- cf0068d frontend/v1-app-ui-redesign
- e9d3883 design/app-ui-redesign
```

Current payment branch:

```text
origin/backend/payment
HEAD 8d5da11
feat(payment): add MoMo checkout channel without pending Payment
```

`integration/v1-current` đã chứa frontend redesign + design authority versioned tại:

```text
docs/designs/v1/
  DESIGN.md
  PRODUCT.md
  app-pov-checklist.md
  TroOi_Product_Universe_Interactive.html
  .impeccable/design.json
```

Trong worktree integration có thay đổi checklist đang stage, thêm section đưa MoMo/payment gateway vào current V1. Hãy giữ thay đổi đó.

## Mục tiêu sản phẩm cần chốt

MoMo trở thành capability current V1, nhưng là kênh thanh toán tùy chọn, không biến hệ thống thành phụ thuộc bắt buộc vào gateway.

Invariant bắt buộc:

```text
Billing / Charge
!= Payment
!= Payment Claim
!= Deposit
!= Receipt
!= Gateway Checkout
```

Flow MoMo đúng:

```text
Tenant chọn thanh toán bằng MoMo
→ backend tạo GatewayCheckout
→ mở provider
→ chưa tạo Payment
→ MoMo gửi IPN
→ backend verify provider signature + amount + order
→ success verified
→ tạo đúng một Payment
   source = GATEWAY
   verification = PROVIDER_VERIFIED
→ không auto-allocation
→ không auto-fund Deposit
→ không auto-issue Receipt
```

Manual cash/transfer vẫn tồn tại.

## Phase 1: audit lại authority và promote MoMo vào current V1

Đọc theo thứ tự:

1. `docs/database/v1/canonical.md`
2. `docs/database/v1/erd/`
3. migrations hiện tại
4. `docs/contexts/`
5. `docs/backlogs/v1/`
6. `docs/api/openapi.json`
7. `docs/designs/v1/PRODUCT.md`
8. `docs/designs/v1/DESIGN.md`
9. `docs/designs/v1/app-pov-checklist.md`
10. runtime/tests

Chốt MoMo là optional current-V1 payment channel. Không biến gateway thành bắt buộc để V1 hoạt động.

Cần sửa các tài liệu đang nói:

- `tenant-momo = OPEN`
- payment gateway chỉ là `FUTURE`
- provider placement chưa chốt

Sau promotion, design/product phải mô tả rõ:

- MoMo nằm trong Tenant Payment/Billing journey hiện tại.
- Mở MoMo chỉ tạo checkout session.
- Chỉ provider-verified callback mới tạo Payment.
- Payment Claim vẫn là capability riêng, không dùng làm pending MoMo.
- Manual payment vẫn hợp lệ.
- Không tự động allocation/deposit/receipt.

Không sửa Canonical chỉ vì tiện implementation. Nếu câu `payment gateway as MVP dependency = FUTURE` vẫn tương thích với MoMo optional current V1 thì giữ nguyên và giải thích rõ “optional capability, not dependency”. Chỉ sửa Canonical nếu sau impact review vẫn có contradiction thực sự với product scope mới.

Cập nhật checklist để phản ánh promotion và DoD mới.

## Phase 2: sửa nhánh payment độc lập

Có thể checkout/switch sang `backend/payment` hoặc tạo worktree riêng từ `origin/backend/payment`.

Fresh audit đã thấy blocker:

```text
src/common/interceptors/transform.interceptor.ts
TS2416
TransformInterceptor<T> trả Observable<ResponseFormat<T> | T>
nhưng implements NestInterceptor<T, ResponseFormat<T>>
```

Sửa type contract đúng cách. Không dùng `any`/cast mù để che lỗi.

Sau đó xử lý MoMo provider contract:

- enforce amount hợp lệ theo contract provider hiện dùng;
- encode `extraData` đúng format provider thay vì gửi raw tenancy UUID;
- verify signature của create-payment response trước khi tin response;
- giữ timing-safe HMAC comparison;
- validate `partnerCode`, `orderId`, `requestId`, amount và success result khi xử lý IPN ở mức cần thiết;
- giữ idempotency: IPN lặp không tạo Payment thứ hai;
- không tạo Payment khi create checkout;
- không tạo Payment khi signature sai, amount mismatch hoặc provider fail;
- không tự allocation, fund Deposit hoặc issue Receipt;
- secrets chỉ lấy từ env, không commit secret.

Review migration `gateway.gateway_checkouts` và repository constraints. Bảo đảm migration up/down chạy được, không làm sai catalog public V1.

Bổ sung/siết tests cho các case mới, đặc biệt:

- min/max amount;
- extraData encode/decode;
- invalid create-response signature;
- mismatched partner/order/request;
- duplicate IPN;
- invalid signature;
- amount mismatch;
- provider failure;
- checkout success chỉ tạo một provider-verified Payment.

Gate tối thiểu trên payment branch:

```powershell
pnpm typecheck
pnpm lint
pnpm build
pnpm exec tsx --test tests/core/momo-hmac.test.ts tests/core/payment-gateway.behavior.test.ts
pnpm test:conformance:database-v1
pnpm test
.\gradlew.bat :app:testDebugUnitTest --no-daemon
.\gradlew.bat :app:assembleBackendDebug --no-daemon
.\gradlew.bat :app:lintDebug --no-daemon
git diff --check
```

Nếu full backend tests cần PostgreSQL, bật Docker/Postgres, migrate đúng schema rồi chạy lại. Phân biệt rõ lỗi môi trường với lỗi code.

## Phase 3: port payment lên integration hiện tại

Không merge mù toàn bộ `backend/payment` vào integration.

Payment branch xuất phát từ base cũ và merge simulation đã conflict tại:

```text
RentalViewModel.kt
RentalWorkspace.kt
TenantScreens.kt
```

Giữ implementation/UI mới hơn từ `integration/v1-current`, rồi port payment capability có chọn lọc.

Ưu tiên:

- backend payment-gateway module;
- migration;
- OpenAPI;
- env template;
- provider client/HMAC;
- finance repository ports;
- Android gateway DTO/client wiring;
- deep link;
- Payment screen action theo design current V1;
- focused tests.

Không được overwrite visual redesign của Băng.

Sau port, review diff giữa integration trước/sau để chắc chắn không mất:

- Guest/Tenant/Landlord navigation mới;
- Room Ledger components;
- updated design references;
- current Google auth/runtime fixes.

## Phase 4: sửa các P0 frontend/domain còn tồn tại

### Room FSM

UI chỉ expose legal operational transitions:

```text
VACANT -> MAINTENANCE
MAINTENANCE -> VACANT
VACANT -> INACTIVE
MAINTENANCE -> INACTIVE
INACTIVE -> VACANT
```

`OCCUPIED -> VACANT` chỉ qua confirmed checkout.
Không tồn tại manual:

```text
OCCUPIED -> VACANT
OCCUPIED -> MAINTENANCE
OCCUPIED -> INACTIVE
INACTIVE -> MAINTENANCE
```

Thêm behavior tests, không chỉ source-string tests.

### Concrete Context Switcher

Không chỉ có ba category chung chung.

Cần model selection cụ thể:

```text
Discovery
Tenant:
  tenancy A
  tenancy B
Operations:
  organization A
  organization B
```

Giữ selected tenancy / selected organization trong app state.
Không dùng `firstOrNull()` để chọn tenancy thay người dùng.

### Session restore

`shared-session` là V1 design surface.

Implement persistent session/token strategy phù hợp với Google identity contract, rồi startup:

```text
launch
→ restore credential/session
→ resolve /identity-access/me
→ derive capabilities
→ validate selected context
→ route đúng POV
```

Không lưu secret/token theo cách không an toàn.

### Capability refresh

Khi access/capability thay đổi:

```text
refresh access
→ validate selected tenancy/org
→ validate active context
→ validate current page
→ fallback hợp lệ
```

Không để user ở stale Operations/Tenant route sau khi mất capability.

## Phase 5: hoàn thiện fidelity với HTML V1

Dùng `docs/designs/v1/TroOi_Product_Universe_Interactive.html` làm visual/interaction reference, nhưng Canonical/OpenAPI vẫn thắng nếu có conflict domain.

Cần ít nhất:

- Room Ledger 6 mục phải clickable và route đúng source surface;
- Landlord attention rows drill-down vào source record;
- Tenant Finance/Incident đi trực tiếp vào detail/action, không bắt vòng qua workspace khác;
- Guest Map có interaction thật khi provider đã chốt, không raw lat/lng;
- Landlord property/listing location UI không bắt user nhập raw coordinates;
- notification affordance/back provenance đúng caller;
- Account selected state đúng;
- Settings/Help/current V1 shared surfaces có implementation tối thiểu theo design;
- Trust Report được wire theo backend current contract;
- Payment → Deposit Application được wire;
- Payment Claim/Review giữ gated behavior nếu policy/API vẫn chưa complete;
- Inquiry Activity chỉ active khi có authenticated user-scoped contract; nếu contract thiếu thì bổ sung backend hoặc giữ explicit gated state, không giả dữ liệu.

Sửa các semantic mismatch trong design nếu vẫn còn, đặc biệt Notice phải tenancy-scoped nếu backend contract chỉ hỗ trợ tenancy notice.

## Phase 6: tests phải kiểm tra behavior

Giảm phụ thuộc vào test kiểu:

```text
source.contains(...)
```

Bổ sung test cho:

- legal Room transitions;
- multi-tenancy/multi-organization selection;
- access refresh fallback;
- session restore routing;
- Room Ledger navigation;
- notification back provenance;
- MoMo checkout vs confirmed Payment;
- provider callback idempotency;
- Deposit Application separation;
- Trust Report boundary.

Không cần xóa source-level regression tests hữu ích, nhưng chúng không được là bằng chứng duy nhất.

## Phase 7: full verification trên integration

Sau khi mọi thay đổi được port/fix vào `integration/v1-current`, chạy fresh gates trên exact HEAD.

Backend:

```powershell
pnpm typecheck
pnpm lint
pnpm build
pnpm test:conformance:database-v1
pnpm test
```

Android:

```powershell
.\gradlew.bat :app:testDebugUnitTest --no-daemon
.\gradlew.bat :app:assembleBackendDebug --no-daemon
.\gradlew.bat :app:lintDebug --no-daemon
```

Repository:

```powershell
git diff --check
git status --short
```

Nếu Docker/Postgres có thể chạy:

- migrate từ clean DB;
- migration parity;
- backend runtime smoke;
- payment persistence;
- checkout → verified IPN → Payment;
- duplicate IPN;
- allocation/deposit/receipt vẫn explicit.

Nếu có Android device:

- fresh Google sign-in;
- Guest journey;
- Tenant journey;
- Landlord journey;
- notifications;
- Context Switcher với nhiều context;
- process restart/session restore;
- MoMo sandbox/deep-link return;
- Payment chỉ xuất hiện sau verified provider callback.

Nếu thiếu device hoặc sandbox credential, ghi `UNVERIFIED`, không ghi PASS.

## Phase 8: checklist, evidence và cleanup

Reconcile `docs/designs/v1/app-pov-checklist.md` bằng evidence thật.

Chỉ tick item khi đúng Definition of Done tương ứng:

```text
design/authority
+ implementation
+ backend contract
+ access/error/loading state
+ automated tests
+ runtime/device evidence khi cần
```

Cập nhật OpenAPI sau code nếu generator thay đổi contract.

Không để:

- stale paths;
- conflict markers;
- duplicate design files ngoài `docs/designs/v1/`;
- temporary generated artifacts;
- secrets;
- debug-only code;
- unused compatibility shims không có lý do.

## Branch/commit strategy

Bạn được phép chuyển branch/worktree để làm từng phần.

Một flow phù hợp:

```text
integration/v1-current
  ↓
worktree/branch payment-fix từ backend/payment
  ↓
fix + test + commit
  ↓
quay lại integration/v1-current
  ↓
port/cherry-pick có chọn lọc
  ↓
resolve frontend/domain/UI issues
  ↓
full verification
```

Không bắt buộc dùng đúng tên branch trên. Quan trọng là giữ history sạch và không mất work.

Tạo commit theo intent, ví dụ:

```text
docs(v1): promote momo as optional payment channel
fix(payment): harden momo provider verification
feat(android): integrate v1 momo checkout flow
fix(android): enforce room operational transitions
feat(android): select concrete tenancy and organization contexts
feat(auth): restore v1 session context
fix(android): align room ledger interactions with v1 design
test(v1): close integration behavior gates
```

Không gộp mọi thứ vào một commit khổng lồ nếu có thể tách rõ.

## Điều kiện kết thúc

Chỉ báo `READY_TO_MERGE: YES` khi:

- current V1 authority và implementation không còn mâu thuẫn về MoMo;
- payment backend typecheck/build/test green;
- DB conformance green;
- Android unit/build/lint green;
- các P0 domain/context/session issue đã xử lý;
- merge conflicts đã resolve mà không mất redesign;
- checklist đã reconcile;
- runtime/device/sandbox gates cần thiết có evidence hoặc được ghi rõ là external blocker chưa thể verify.

Nếu còn blocker, báo `READY_TO_MERGE: NO` và chỉ liệt kê blocker còn lại.

## Format báo cáo cuối

Giữ ngắn gọn, không lặp.

Dùng cấu trúc:

```text
HEAD:
COMMITS:
STATUS: READY_TO_MERGE YES/NO

DONE:
- ...

TESTS:
- command → result

BLOCKERS:
- ...

NOTES:
- chỉ những điểm cần người tiếp theo biết
```

Không in toàn bộ log nếu không cần. Chỉ trích phần đủ chứng minh PASS/FAIL.
