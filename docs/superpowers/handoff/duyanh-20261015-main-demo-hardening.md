# Handoff cho Duy Anh — hardening `main`, đóng gói và demo TrọƠi

> Ngày giao việc: **15/10/2026**. Người tiếp nhận: **Duy Anh (Backend / Database / Full-stack integration)**.
> Baseline đã merge và push: **`main` @ `71a33430fa7842df74aa41458f7bd4d41f172589`**.
> **Mục tiêu: ổn định và demo E2E; hạn chế tối đa mở tính năng mới.**
> Trạng thái tài liệu: **KẾ HOẠCH / CHƯA TRIỂN KHAI**. Các mục bên dưới chỉ PASS khi có bằng chứng kiểm thử tương ứng.

## 0. Quy tắc bất biến & điều kiện nhận việc

- **Feature freeze**: không tự mở marketplace, pricing/quota, AI/OCR production, subscription mới, thanh toán hộ hoặc nghiệp vụ ngoài scope chỉ để demo. Chỉ sửa bug, wiring, bảo mật, dữ liệu demo, cấu hình và tài liệu; thay đổi hợp đồng nghiệp vụ phải xin phê duyệt.
- **Canonical source of truth**: `docs/database/v1/canonical.md` → `docs/database/v1/erd/` → `docs/database/v1/schema/` → migration → service/API → Android. `[OPEN]` không được tự quyết, `[FUTURE]` không tự quảng bá thành chức năng hiện hành.
- **Giữ lịch sử Git và database**: fetch/pull sau khi kiểm tra trạng thái; làm trên nhánh riêng của Duy Anh; PR vào `main`. Không force-push, không reset/`down -v` database, không sửa migration đã phát hành, không đè worktree hoặc thay đổi chưa commit của người khác.
- **Không đưa secret lên GitHub**: bất kỳ giá trị production/local secret, private key, signing key, mật khẩu DB, Merchant SePay/TPBank, dump DB, `.env`, `gradle.properties` cá nhân, `local.properties`, `keystore.properties`, `*.jks` đều phải ngoài Git. `*.example` chỉ được chứa placeholder không dùng được.
- **Ngăn dữ liệu giả đi vào tiền thật**: seed/demo chỉ ở môi trường dev/test, không tạo `PAYMENT` giả là `PROVIDER_VERIFIED`, không reset Checkout đã có; callback và return URL không phải bằng chứng nếu thiếu xác minh provider.

## 1. Baseline và blocker đã biết

| Khu vực | Bằng chứng hiện tại (15/10) | Cần làm |
| --- | --- | --- |
| Merge Git | `main` = `71a3343`, bao gồm `35ad67e` | Lấy baseline từ `main`, không merge thêm nhánh không qua review |
| Real-money SePay | Đã chuyển thử **2.000 VND** trên finance DB **cô lập**; Checkout `4a732deb-5183-426f-a125-373af0ad6158` = `SUCCEEDED`; 1 Payment `GATEWAY / PROVIDER_VERIFIED`, replay IPN không duplicate | Giữ evidence, không tạo thêm lệnh chuyển tiền; nghiệm thu lại sau đóng gói trên DB riêng |
| Backend targeted | Typecheck, Nest build, ESLint PASS; SePay + fixture governance `17/17` PASS | Chạy lại toàn bộ gate từ môi trường chuẩn |
| Android | `CheckoutIdentityTest` PASS; Android Debug smoke dùng API riêng | Kiểm thử cả Guest / Tenant / Owner trên bản API + DB dùng chung |
| Full test suite | `501` test: `494` PASS, `3` FAIL, `4` CANCELLED vì thiếu `DATABASE_URL` trong runtime audit | KHÔNG tuyên bố full-green; xử lý từng lỗi bên dưới |
| Slot chủ trọ | `AssetWizard.kt` hiện nút “Mở thêm 1 slot”, giá UI `259.000đ/năm`; `TroOiViewModel.purchaseLocalCapacity()` trả `REAUTH_UNAVAILABLE` | **Blocker UI/payment**: rà soát luồng; không hiển thị thông báo “đã thanh toán” nếu không có settlement |
| Runtime stack | `docker-compose.yml` có PostgreSQL/PostGIS + Nest; MinIO/Redis ở `compose.infrastructure.yml`, messaging riêng ở `compose.messaging.yml` | Thiết kế 1 Compose thống nhất có profiles và nghiệm thu clean rebuild |
| Cấu hình | `.env.example`, `.env.messaging.example`, `gradle.properties.example`, `local.properties.example`, `keystore.properties.example` đang tồn tại | Một nguồn cấu hình private rõ ràng, có adapter cho Gradle/SDK và bảo vệ Git |

**Ba lỗi test đã quan sát**:
1. `tests/verification/account-verification-foundation.test.ts`: `tests/core/finance.behavior.test.ts` còn business literals thay vì fixture JSON.
2. `tests/verification/application-restart-foundation.test.ts`: Owner/Tenant principal trong fixture chưa được bind đúng; phải là hai identity riêng.
3. `tests/verification/identity-test-architecture.test.ts`: literal trong `tests/integration/persistence/identity-vnext.integration.ts` (vùng dòng ~246 ở baseline).

**Bốn cancelled**: nhóm `tests/audit/low-level-architecture/runtime.access.test.ts` thiếu `DATABASE_URL` đúng loại DB test. Không chạy `pnpm test` với finance DB tiền thật.

## 2. P0 — audit source, naming, hardcode, fixture JSON

**Phạm vi**: `src/`, `app/src/`, `database/`, `tests/`, `scripts/`, tất cả đường API và config.

- Kiểm tra naming theo convention từng ngôn ngữ: TypeScript PascalCase class/DTO, camelCase variable/service method, snake_case column & migration, Kotlin theo Kotlin style; tên domain thống nhất `Room`/`Listing`/`Tenancy`/`BillingCycle`/`Charge`/`Payment`/`Receipt`/`Incident`; tránh viết tắt không định nghĩa, magic ID, đổi tên DB schema tùy tiện.
- Liệt kê **mọi** hardcode: giá/slot, thông số kinh doanh, amount VND, URL/host, token, UID, ngày giờ, phone/email, mã phòng, test fixture, status fallback, text chưa i18n, cấu hình giao diện. Phân loại: (A) constant kỹ thuật hợp lệ, (B) fixture dev/test, (C) bug phải config/DB, (D) đề xuất thay đổi canonical cần approval.
- Thẩm định đủ `*.json`, `*.schema.json`, fixture loaders, `tests/fixtures/`: schema validate fail-closed, type, version, required fields, dữ liệu liên kết FK/tenancy/role, không trùng data source, không fallback literal, không phụ thuộc thứ tự test. Chuyển business literals **test** về fixture có schema, không biến chúng thành default production.
- Loại bỏ dead code, mock/legacy route còn chạy trên release; bảo đảm Debug fixture/demo adapter không cho auth bypass trong Release/Production.
- Với mỗi kết quả, ghi `path:line`, mức P0/P1/P2, trạng thái, test liên quan và commit sửa. Không “cleanup” hàng loạt phá contract để đạt số liệu đẹp.

**Nghiệm thu**: 3 lỗi fixture phía trên PASS; static governance PASS; full test suite chạy có DB riêng; lint/typecheck/build PASS; báo cáo còn sót hardcode hợp lệ và blocker chủ ý.

## 3. P0 — một nguồn cấu hình, tuyệt đối không track secret

**Ý định cuối**: **một file local private `.env` ở repo root** làm nguồn duy nhất cho giá trị chạy Backend/Compose và cấu hình chung; **một template `.env.example`** có placeholder để người mới bootstrap. Đây **chưa** là trạng thái hiện tại.

- Lập inventory *tên biến + nơi đọc + profile dùng* từ `.env.example`, `.env.messaging.example`, Compose, `Dockerfile`, Node, Kotlin/Gradle, Google/Maps, SePay, optional Redis/MinIO. Không log hoặc paste **giá trị secret**.
- Refactor loader/Compose để đọc `--env-file .env` và chuyển biến vào đúng service; tách môi trường `local/demo/test` bằng *profile/config entrypoint* thay vì thêm các `.env.production`, `.env.sepay-standalone` được share bừa bãi. Production thực tế ưu tiên secret manager/CI secret injection; không đóng gói `.env` trong image.
- Gradle đọc các biến **không bí mật** từ environment tương ứng (`TROOI_API_BASE_URL`, `TROOI_GOOGLE_WEB_CLIENT_ID`, `TROOI_MAPS_API_KEY` nếu cấu hình được, `TROOI_PAYMENT_PUBLIC_ORIGIN`) hoặc `-P...`; không đòi copy cấu hình qua một `gradle.properties` cá nhân khác. **Gradle không tự đọc `.env`**: phải làm adapter/launcher và có test. Android SDK path vẫn cần biến `ANDROID_HOME`/`local.properties` do Android SDK quản lý; tài liệu phải nói rõ ngoại lệ kỹ thuật thay vì hứa bỏ một cách mù quáng.
- Release signing key nằm ngoài repo; có thể truyền qua CI secrets hoặc môi trường an toàn, không xuất keystore/password trong APK hoặc BuildConfig. Không embed `SEPAY_SECRET_KEY`, `SEPAY_IPN_SECRET_KEY`, merchant credential, DB password vào Android.
- Kiểm tra và giữ `.gitignore` + `.dockerignore`, `git ls-files`, `git check-ignore -v`, `git diff --cached --name-only`. Nếu phát hiện secret đã track thì `git rm --cached -- <file>` và **xoay khóa nếu từng bị lộ**, không xóa bản local; tuyệt đối không `git add -f`. Không push log/env/database dump.
- `.env.messaging.example`/`gradle.properties.example` có thể giữ làm tài liệu mẫu công khai khi chuyển đổi, nhưng xác lập rõ **single authoritative private config** và loại bỏ các bản cấu hình có thể gây lệch runtime.

**Nghiệm thu**: chạy local sau clean clone chỉ với `.env` private + SDK/keystore được cấp an toàn; tất cả service/Android đọc đúng cấu hình; `git status` và staged diff không có secret.

## 4. P0 — một Docker Compose, rebuild và data safety

**Đầu ra bắt buộc**: `docker-compose.yml` làm **một entrypoint** chạy Backend + PostgreSQL/PostGIS + Redis + MinIO/S3-compatible + bucket/init cần thiết. Dùng `profiles` cho optional services (không kéo Redis/MinIO lên nếu adapter chưa dùng), tránh cứng cổng/mật khẩu và xung đột container/volume.

- Hợp nhất cấu hình còn phân mảnh tại `compose.persistence.yml`, `compose.infrastructure.yml` và `compose.messaging.yml`; giữ các script cũ cho tới khi parity PASS rồi mới deprecate rõ ràng, không làm đứt CI/test đang tham chiếu.
- Thiết kế service dependencies + healthchecks + named volumes + networks + logs + restart + database migrations **up-only**; bảo đảm PostGIS extension, test DB isolation, MinIO private bucket, môi trường DEV/DEMO/SEPAY rõ ràng.
- **Bảo vệ tiền thật**: database SePay độc lập không được dùng seed/reset demo. Không đổi `DATABASE_URL` trỏ đến `trooi_dev` nếu bật SePay Production: loader hiện chặn `trooi_dev` / `trooi_test` và yêu cầu `SEPAY_FINANCE_DATABASE` trùng tên DB; xử lý kiến trúc tương thích thay vì nới guard.
- Trước khi thao tác Docker: audit container đang chạy + mount + named volumes, snapshot/backup DB và evidence; xác nhận dự kiến ảnh hưởng. **Không chạy `docker compose down -v`, `db:reset`, `volume rm` hoặc prune.**
- Thử trước trên Docker project/volume **mới**, không đổi các port `3000/3001/3100/3101/3102` hiện đang dùng. Dùng `docker compose --env-file .env config --quiet` để validate tránh in secret; `docker compose ... build` và `up -d --wait` khi mọi service đã cấu hình đúng.
- Kiểm chứng 2 lần start/rebuild không mất dữ liệu và không duplicate seed/migration; kiểm thử service internal DNS, host port và HTTP health; có lệnh logs, backup, restore, shutdown không xóa volume.

**Nghiệm thu**: một lệnh up từ clean clone (sau khi cấp private config) + migrations + optional seed; screenshot/log health; restart giữ dữ liệu; tài liệu rollback.

## 5. P0 — rà soát UI và E2E (đặc biệt Payment / slot / Auth)

Kiểm trên Android emulator **và ít nhất một thiết bị thật** khi có thể; riêng mỗi role lưu bằng chứng màn hình, API response và DB assertion.

| Persona / flow | Ca bắt buộc |
| --- | --- |
| Guest | Khám phá/phân trang/search/tin đăng chi tiết, ảnh/map, không lộ private location hoặc UI quản trị |
| Google auth | Google Credential Manager đăng ký/login, OTP/reauth (nếu scope hiện có), refresh sau restart, logout + revoke, expired token; kiểm tra SHA-1 Android OAuth, Web Client ID, Google backend audience |
| Tenant | Vào `Tenancy` thật với quyền hợp lệ → danh sách `BillingCycle / Charge` → checkout `SEPAY` → handoff external → return → polling/readback → lịch sử `Payment`/`Receipt`; phân biệt `CREATED / UNKNOWN / SUCCEEDED` |
| Owner | Có nút `+ Thêm tài sản` → tạo/tồn tại/đăng tin phòng → tenant link → công nợ/confirmed payment hiển thị đúng; không thấy checkout của người thuê ngoài quyền |
| Owner — **thêm slot** | `AssetWizard` đang hiện `+1 slot`, `259.000đ/năm` và “Xác nhận thanh toán”, **nhưng** `TroOiViewModel.purchaseLocalCapacity` hiện trả `REAUTH_UNAVAILABLE`. Đây là **stub/blocked**, không phải SePay đang hoạt động; phải quyết định với Product: (A) ẩn/vô hiệu và ghi “Chưa hỗ trợ” vì Pricing/Quota là `[FUTURE]`, hoặc (B) chỉ nối payment sau khi có phê duyệt product/canonical + backend contract riêng. Không tự gán thanh toán tiền thuê cho phí slot hay giả `SUCCEEDED` |
| Auth + quyền | User A/B, owner/tenant của các tổ chức khác: IDOR 403/404, guest private API 401, no mock login trên public/Release, Google disabled fail-closed |
| Real-money SePay | IPN sai/thiếu secret 401; payload lỗi 400; REST provider uncertain/404 detail 503 hoặc fallback bảo mật; accepted callback 200; amount/merchant/invoice/remote order/transaction match; duplicate callback chỉ 1 `PROVIDER_VERIFIED`; return URL không tự xác nhận |

**Lưu ý SePay + TPBank:** Merchant là tài khoản SePay của cá nhân/đơn vị được cấp quyền, liên kết **tài khoản TPBank nhận tiền** trong dashboard. Tiền chuyển về tài khoản ngân hàng liên kết; phía app chỉ tích hợp **SePay Payment Gateway**, **không giả định có API trực tiếp hay API key của TPBank**. Đối soát người thụ hưởng, invoice và nhận tiền trên tài khoản thực tế trước khi demo. Không lấy demo OTP hoặc token để giả auth.

**Nghiệm thu**: video/screenshots + trace HTTP + DB row cho từng flow, nhất là Payment; logout/restart làm mới không mất phân quyền, không double charge.

## 6. P1 — cập nhật README và hướng dẫn onboarding “từ zero”

README phải giải thích **cái đang chạy thực tế** và **đích cần triển khai**, đủ cho người khác clone/build không cần hỏi người cũ:

- Sơ đồ monorepo, prerequisite Node/pnpm, Docker Desktop, JDK/Android Studio/SDK, USB/ADB/emulator, Google Cloud.
- Link và thao tác tạo **Google OAuth Web Client ID + Android client/package/SHA-1**, Maps API key bị giới hạn (app/package SHA-1), Merchant ID + Secret Key + IPN secret SePay, ngrok hoặc HTTPS domain; hướng dẫn cấu hình `.env` riêng tư.
- TPBank: liên kết và xác thực tài khoản ngân hàng với SePay từ dashboard, **không đòi TPBank API key** cho transfer QR thông thường; phân biệt Sandbox vs Production, tiền thật, callback và webhook.
- Hướng dẫn `docker compose` up/build/logs/down an toàn, DB migrate/seed, Nest app health/OpenAPI, Android debug/release, runtime MOCK/BACKEND, URL emulator `10.0.2.2` vs máy thật LAN/IP, test commands, troubleshooting, backup.
- Cảnh báo credential leakage, các endpoint public, cách bật/tắt IPN, rollback; tài liệu cập nhật kèm thay đổi code/config để không lỗi thời.

**README ở `main` được cập nhật trước trong đợt handoff này**, nhưng lệnh một Compose + single-config cuối cùng **chỉ được đánh dấu DONE sau khi Duy Anh thực sự triển khai và kiểm chứng**.

## 7. P1 — seed dữ liệu giả như app đang hoạt động

- Seed **synthetic, deterministic, idempotent** trên database dev/demo **riêng**; gồm vài chủ trọ, người thuê, workspace/property, nhiều room/listing có ảnh placeholder hợp lệ, có phòng trống / đang thuê, terms, billing cycles/charges, incident tickets, notices, inbox/conversations và payment lịch sử **manual mô phỏng với provenance rõ ràng**.
- Tenant/Owner có liên kết `TenancyParticipant` thật; không dùng global business role; không ghép danh tính Google thật vào fixture nếu không có binding được duyệt.
- Room/listing/terms/charge/payment theo invariant Database v1; không seed cọc/hợp đồng/biên nhận sai vòng đời.
- Dữ liệu đa dạng trạng thái để UI đầy đủ: 3–5 khu trọ/tòa, ~10–20 phòng, một số listing PUBLISHED, vài thuê ACTIVE, sự cố mở/đóng, khoản đã đến hạn/chưa đến hạn, lịch sử hợp lệ; số lượng gợi ý, không bắt buộc.
- **Tuyệt đối không fake Gateway `PROVIDER_VERIFIED`, SePay IPN, real bank credit hoặc impersonate tài khoản thật**. Nếu demo Paid, dùng manual flow rõ nhãn hoặc fixture sandbox tách biệt. Không seed vào `trooi_sepay_isolated` đã từng ghi tiền thật.
- Seed có `--dry-run` hoặc output tóm tắt, re-run giữ số row ổn định, unseed/cleanup chỉ đối với disposable DB. Chạy smoke DB → backend → Android ngay sau seed.

## 8. Thứ tự thi công / yêu cầu chứng cứ / điều kiện chốt demo

1. **P0.1 Audit**: chụp baseline, inventory config, rà soát hardcode/naming/fixture + 3 blocker và runtime audit DB.
2. **P0.2 Config/secrets**: single private source, adapters Gradle, Git/Docker ignore, không phát sinh secret ở client/log.
3. **P0.3 Docker**: thống nhất Compose, backup và deploy song song trên container/volume mới, verify parity và restart persistence.
4. **P0.4 Product flows**: Google auth, Tenant Checkout, Owner phòng/slot, access guard; không tự bật tính năng pricing `[FUTURE]`.
5. **P1 Seed**: dataset demo đa vai trò, dữ liệu hoạt động thực tế nhưng không làm giả tiền.
6. **P1 Documentation**: cập nhật README đúng với thực thi, chạy lại clean onboarding.
7. **Final gate**: full backend tests + governance, Android debug/release build + targeted tests, DB schema/migrate, Docker health, cross-role E2E, SePay no-duplicate readback, công khai bảng PASS/FAIL + blocker.

**Bàn giao bắt buộc**: changelog/commit hoặc PR, `docs/implementation/phase5/` acceptance report, screenshot/video demo, test summary, Docker compose/volumes inventory, danh sách tên biến môi trường (không có giá trị), seed report và các blocker chưa giải quyết.

**Definition of Done:** có thể dựng demo ổn định từ `main` với hướng dẫn README, không lộ secret, không fake thanh toán, các luồng bắt buộc kiểm chứng bằng dữ liệu Backend thật; **không có P0 mở**. Nếu còn lỗi/feature đang stub, hiển thị tình trạng rõ và khoanh lại thay vì tuyên bố toàn hệ thống hoàn thành.
