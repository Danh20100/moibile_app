# TrọƠi — Android · NestJS · PostgreSQL/PostGIS

> **Status: DEMO HARDENING, NOT PRODUCTION READY (15/10/2026).** SePay đã có **một giao dịch ngân hàng thật 2.000 VND** được đối soát thành công trên database cô lập; đó không phải bằng chứng full app, full Docker hay Auth production đã PASS.
>
> **Duy Anh tiếp quản:** [Handoff hardening & demo](docs/superpowers/handoff/duyanh-20261015-main-demo-hardening.md) · [Handoff merge trước đó](docs/implementation/phase5/main-integration-handoff-20261015.md).

## 1. Architecture & source of truth

TrọƠi là “sổ vận hành thuê trọ”: quản lý tài sản/phòng, người thuê, các khoản phải thu, tiền đã nhận, sự cố và lịch sử; Android là sản phẩm chính. [Landing page](https://github.com/onsra520/TroOi-Landing-Page) ở repository riêng, không phải dependency để build ứng dụng.

| Phần | Thư mục | Trạng thái |
| --- | --- | --- |
| Android | `app/` | Kotlin + Jetpack Compose; Debug có MOCK/BACKEND; Release luôn Backend |
| Backend | `src/` | NestJS REST API dưới `/api/v1`, identity/tenancy/finance/discovery |
| Database | `database/`, `docs/database/v1/` | PostgreSQL 16 + PostGIS; migrations và seed development |
| Docker | `docker-compose.yml`, `Dockerfile` | **Hiện có** PostgreSQL/PostGIS + Backend |
| Tùy chọn | `compose.infrastructure.yml` | MinIO/Redis qua profile, adapter không mặc định bật |
| Messaging lane | `compose.messaging.yml` | Dev/test riêng, chưa hợp nhất |
| Payment | `src/modules/payment-gateway/` | SePay, MoMo, DEMO only local/test |
| Tests | `tests/`, `tests/android/` | Contract, governance, API, JVM, instrumentation |

**Canonical authority:** `docs/database/v1/canonical.md` → `docs/database/v1/erd/` → `docs/database/v1/schema/` → migration → services → App. `USER` là danh tính, không có “global role” chủ trọ/người thuê; quyền được tính theo Organization, Room/Tenancy, Participant. `BILLING_CYCLE` / `CHARGE` là nghĩa vụ, `PAYMENT` là tiền thực thu, `RECEIPT` chỉ là chứng từ. `[OPEN]` không tự chốt và `[FUTURE]` (Pricing/Quota, CSV/Excel import...) không được bật ngoài quyết định Product.

## 2. Yêu cầu môi trường

- Git, Windows PowerShell (lệnh mẫu bên dưới) hoặc shell tương đương.
- Node.js đáp ứng `package.json`: `^22.22.3 || ^24.15.0 || >=26.0.0`; pnpm (Dockerfile dùng pnpm 12.8.1), Docker Desktop + Compose v2.
- Android Studio, Android SDK API 36, JDK được Android Gradle Plugin 9.2.1 hỗ trợ, Google APIs/Play Services trên emulator hoặc Android thiết bị thật (minSdk 26).
- `adb` để cài APK; `keytool` để lấy SHA-1 Google OAuth.

~~~powershell
node --version
pnpm --version
docker compose version
java -version
adb devices
~~~

**URL phát triển:** Android emulator tới Backend chạy trên host dùng `http://10.0.2.2:3000`; thiết bị thật dùng IP LAN hoặc HTTPS được phép. `10.0.2.2` không phải địa chỉ của điện thoại thật.

## 3. Cấu hình một nguồn và bảo mật

**Hiện tại**: `.env.example` dành cho Backend/Docker, `.env.messaging.example` cho messaging test cũ, `gradle.properties.example`, `local.properties.example`, `keystore.properties.example` cho Android. Chúng chỉ là **template**, không chứa secret thật.

**Mục tiêu của Duy Anh**: một private root `.env` làm nguồn cấu hình local duy nhất; adapter chuyển đúng biến sang Compose/Backend và environment Gradle. **Adapter và unified Compose chưa được triển khai**; hiện Gradle vẫn nhận biến môi trường hoặc tham số `-P...`. SDK path và release signing là ngoại lệ cần quản lý qua môi trường/keystore bảo mật, không ép lưu khóa bí mật vào Android client.

~~~powershell
# Chạy ở thư mục root. Tạo file riêng tư, thay các giá trị trên máy cá nhân.
Copy-Item .env.example .env
# Không chia sẻ nội dung .env trong chat / issue / log.
git check-ignore -v .env
git status --short
~~~

| Cấu hình | Tên biến hiện có | Phạm vi |
| --- | --- | --- |
| DB | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_TEST_DB`, `DATABASE_URL`, `TEST_DATABASE_URL` | Backend/Compose |
| Google sign-in | `GOOGLE_CLIENT_ID` | Web OAuth Client ID để Backend verify ID Token |
| Android Google | `TROOI_GOOGLE_WEB_CLIENT_ID` hoặc Gradle `trooiGoogleWebClientId` | Cùng Web Client ID, không phải Google client secret |
| Android Maps | `TROOI_MAPS_API_KEY` / Gradle `trooiMapsApiKey` | Public app key phải restrict package + SHA-1/API |
| Android API | `TROOI_API_BASE_URL` / Gradle `trooiApiBaseUrl` | Base URL đúng Backend |
| SePay | `SEPAY_ENABLED`, `SEPAY_ENVIRONMENT`, `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`, `SEPAY_IPN_SECRET_KEY`, `SEPAY_HANDOFF_SIGNING_KEY`, `SEPAY_PUBLIC_BASE_URL`, `SEPAY_FINANCE_DATABASE` | **Server-only**, riêng finance DB |
| Payment Android | `TROOI_PAYMENT_PUBLIC_ORIGIN` / Gradle `trooiPaymentPublicOrigin` | Public HTTPS origin, không có secret |
| Object storage | `OBJECT_STORAGE_*`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Optional |
| Cache | `REDIS_URL` / `CACHE_ENVIRONMENT` | Optional |

**Không commit:** `.env`, `.env.*` thật, `gradle.properties` cá nhân, `local.properties`, `keystore.properties`, `*.jks`, database dump, bank statement, API key bí mật. Trước khi push kiểm tra `git diff --cached --name-only`, `git ls-files`, `git check-ignore -v`. Nếu một secret đã từng bị track, xóa khỏi Git index và **rotate** khóa (ignore không xóa lịch sử).

### 3.1. Cách lấy Google OAuth & Maps API key

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → tạo/chọn project, cấu hình OAuth consent screen/branding.
2. Tạo **OAuth 2.0 Client ID loại Web application**. Đặt cùng ID vào Backend `GOOGLE_CLIENT_ID` và Android `TROOI_GOOGLE_WEB_CLIENT_ID`/`trooiGoogleWebClientId`.
3. Tạo **Android OAuth Client ID** với package `com.trooi.app` và SHA-1 certificate ký Debug. Release cần fingerprint của release key riêng. Kiểm tra SHA-1 Debug trên Windows:
   ~~~powershell
   keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
   ~~~
4. Với Maps, bật Maps SDK for Android, billing theo yêu cầu Google, tạo API key và restrict theo **Android package + SHA-1 + Maps SDK for Android**. Truyền qua `TROOI_MAPS_API_KEY`.
5. Kiểm tra Google login trên emulator và điện thoại thật, Backend xác nhận đúng audience + principal; thử refresh/logout/restart. Debug Mock login không phải kiểm thử Google auth.

**Tài liệu chính thức:** [Google Sign-In Android](https://codelabs.developers.google.com/sign-in-with-google-android) · [OAuth Web Client ID](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) · [Maps API key](https://developers.google.com/maps/documentation/android-sdk/get-api-key).

### 3.2. SePay cá nhân + ngân hàng TPBank liên kết

**Luồng:** Android → NestJS tạo Checkout → SePay QR `BANK_TRANSFER` → khách chuyển khoản → tiền về **TPBank đã liên kết với merchant SePay** → SePay IPN + REST → Backend xác minh → PostgreSQL Payment. Đây là **gateway SePay**, **không phải tích hợp trực tiếp TPBank API**; luồng QR đã thử **không cần TPBank API key**. Tài khoản SePay cá nhân phải có quyền liên kết ngân hàng và đủ điều kiện Production theo SePay.

1. Vào [SePay Merchant](https://my.sepay.vn/), đăng ký/đăng nhập, mở **Cổng thanh toán**, cấu hình phương thức **Quét mã QR chuyển khoản ngân hàng**; bắt đầu ở Sandbox rồi làm thủ tục liên kết **tài khoản TPBank nhận tiền** mà merchant được quyền sử dụng.
2. Khi chuyển Production đã được SePay duyệt, lấy **MERCHANT ID** + **SECRET KEY** Production ở dashboard, lưu chỉ trong server/secret manager.
3. Cấu hình SePay IPN tại **Cổng thanh toán → Cấu hình → IPN**; chọn kiểu xác thực `SECRET_KEY`, tạo `SEPAY_IPN_SECRET_KEY` riêng và bảo đảm header đến Backend là `X-Secret-Key`. Tạo `SEPAY_HANDOFF_SIGNING_KEY` khác cả secret merchant và IPN.
4. Backend chỉ bật SePay Production khi `SEPAY_ENABLED=true` và `SEPAY_ENVIRONMENT=production`; `SEPAY_FINANCE_DATABASE` phải **trùng tên database của `DATABASE_URL`**, đồng thời **không** được là `trooi_dev` hoặc `trooi_test`; `SEPAY_PUBLIC_BASE_URL` phải là HTTPS origin công khai không kèm path/port/query.
5. Đăng ký URL IPN: `https://<public-host>/api/v1/finance/checkouts/sepay/ipn`. Backend cần public HTTPS reverse proxy có allowlist. **Không expose `/demo/login` hoặc Backend demo** qua ngrok.
6. Handoff SePay submit form đến `https://pay.sepay.vn/v1/checkout/init`. Chỉ đánh dấu Checkout `SUCCEEDED` khi có bằng chứng provider được kiểm tra: đúng merchant/invoice/amount/currency, đúng giao dịch `BANK_TRANSFER`/`APPROVED`, đơn `CAPTURED`, tồn tại một Payment `GATEWAY / PROVIDER_VERIFIED`. Return URL hoặc ảnh chuyển khoản **không được tự xác nhận**.
7. Kiểm thử callback thiếu/sai secret (401), payload sai (400), ambiguous/pending (503), retry idempotent (chỉ một Payment). Không gửi thêm tiền thật chỉ để “chạy test”.

**Bằng chứng E2E riêng biệt (15/10/2026):** chuyển ngân hàng thật **2.000 VND**; SePay REST `CAPTURED` và IPN đã xác thực; Checkout `4a732deb-5183-426f-a125-373af0ad6158` thành `SUCCEEDED` trên **`trooi_sepay_isolated`**, Payment `00791baa-cf9a-4d17-ae10-678738bd13da` `PROVIDER_VERIFIED`. Gửi callback đó lần thứ hai **không tạo Payment trùng**. API detail của SePay từng trả HTTP 404, vì vậy source hiện có fallback **chỉ khi IPN đã xác thực và một đơn REST `CAPTURED` khớp tuyệt đối**. Điều này **không** chứng minh một Compose Production thống nhất đã hoạt động.

**Tài liệu chính thức:** [SePay Quick Start](https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau) · [IPN](https://developer.sepay.vn/vi/cong-thanh-toan/IPN) · [Checkout Form](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/form-thanh-toan).

## 4. Dựng Backend + Database Docker (cách hiện có)

**Hiện trạng chính xác:** `docker-compose.yml` chỉ có `postgres` (PostGIS) + `backend`. Redis/MinIO có trong `compose.infrastructure.yml`, `compose.messaging.yml` là lane legacy/test; một Compose “all-in-one” + single-env adapter **vẫn là TODO giao Duy Anh**, chưa tuyên bố đã hoàn tất. Compose hiện tại cũng **chưa truyền đủ biến SePay/finance riêng**, nên không được hiểu lầm chạy base Compose là đã bật Checkout Production.

~~~powershell
# Tại root; Docker Desktop đang chạy, .env đã tạo và điền đúng giá trị.
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build --wait
docker compose ps
curl.exe -i http://localhost:3000/api/v1/health
docker compose logs --tail=80 backend
~~~

`Dockerfile` build Nest; `docker-entrypoint.sh` chạy **migration up** trước khi mở API. PostgreSQL dùng named volume `postgres_persistence_data`. Backend qua Docker dùng hostname nội bộ `postgres`, host-side scripts dùng `localhost` trong `DATABASE_URL`. Không tự chạy `db:reset` sau build.

Lệnh an toàn:
~~~powershell
docker compose logs -f backend
docker compose logs -f postgres
docker compose down
# KHÔNG thêm -v: xóa volumes có thể xóa dữ liệu.
~~~

**MinIO + Redis optional** (chỉ khi cấu hình đã được cấp, gồm `MINIO_ROOT_PASSWORD`):
~~~powershell
docker compose --env-file .env -f docker-compose.yml -f compose.infrastructure.yml --profile local-infra up -d --no-deps redis minio
~~~

Không tự ghép `compose.messaging.yml` vào base nếu chưa xử lý tên service/port/volume trùng nhau. **Việc Duy Anh cần hoàn thành**: một `docker-compose.yml` làm entrypoint, profiles cho optional services, healthcheck, private S3 bucket/init, config injection, finance DB biệt lập, snapshot/backups; thử rebuild ở Docker project và volume **mới** rồi nghiệm thu restart **không mất data**. Không chạm các DB/port đang phục vụ người khác.

### 4.1. Chạy Nest trên host (không chạy Docker Backend song song ở port 3000)

Khi PostgreSQL/PostGIS đã chạy nhưng **container Backend tắt**:

~~~powershell
pnpm install --frozen-lockfile
node --env-file=.env --import tsx scripts/database/migrate.ts up
pnpm build
node --env-file=.env build/main.js
~~~

Node `--env-file=.env` cần phiên bản Node phù hợp như phần 2. **`pnpm start:dev` không tự đọc `.env` từ PowerShell**: phải cấp biến môi trường trước (hoặc dùng wrapper được Duy Anh kiểm chứng).

- Health: `GET http://localhost:3000/api/v1/health`.
- API private: token Bearer do Backend xác minh + quyền Organization/Tenancy; không dùng UUID/tokens giả.
- OpenAPI/Swagger: `src/main.ts` cấu hình Swagger tại path `docs` (kiểm tra URL host theo deployment).
- Migration up: chỉ trên đúng DB, không chạy reset/down trên môi trường có tiền thật.

### 4.2. Seed dữ liệu development (không dùng trên database tiền thật)

Script đã có `database/seeds/development.ts` và gọi fixture `scripts/demo/fixture.cjs`. Sau migrate trên **DB dev/test riêng, được backup**:

~~~powershell
# Đảm bảo DATABASE_URL trong .env đang trỏ DB DEV, KHÔNG phải finance/production.
node --env-file=.env --import tsx database/seeds/development.ts
~~~

Seed hiện tại có dữ liệu synthetic hữu hạn, **chưa chứng minh đầy đủ demo nhiều người hoạt động**. Duy Anh cần xây bộ seed đa actor deterministic/idempotent: Owner/Organization/Room/Listing, Tenant/Participant/Tenancy/Terms, khoản thu/biên nhận hợp lệ, incident, notice, message, lịch sử thủ công — **không giả `PROVIDER_VERIFIED` hay IPN ngân hàng**. Seed chạy lần 2 phải không nhân đôi, rollback chỉ trên disposable DB.


## 5. Build và chạy Android App

Các lệnh sau dành cho **Windows PowerShell** tại thư mục gốc. SDK Android cần cài qua Android Studio; đường dẫn mặc định trên Windows là ví dụ, không phải quy tắc cố định.

~~~powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
.\gradlew.bat :app:testDebugUnitTest --console=plain
.\gradlew.bat :app:assembleDebug -PtrooiApiBaseUrl=http://10.0.2.2:3000 --console=plain
adb devices
adb -s emulator-5554 install -r app\build\outputs\apk\debug\app-debug.apk
~~~

- **Google login:** cấp OAuth Web Client ID đúng Android/Backend, ví dụ đặt biến môi trường `TROOI_GOOGLE_WEB_CLIENT_ID` trước khi build. Cấu hình `GOOGLE_CLIENT_ID` của Backend tương ứng và đăng ký SHA-1 Debug/Release trong Google Cloud. Key không có nghĩa là login chắc chắn PASS; kiểm tra trên thiết bị.
- **Maps:** cấp `TROOI_MAPS_API_KEY` có restriction. Chỉ Android client được nhận API key đã restrict; tuyệt đối không đóng gói SePay secret hoặc database password trong `BuildConfig`.
- **Debug MOCK / BACKEND:** `RuntimeDataSource` giữ lựa chọn trong debug preferences. Debug không nhất thiết đang chạy Backend; kiểm tra chế độ trước khi test network/payment. Nếu muốn chủ động chọn Backend cho build local demo, dùng `-PtrooiDemoBackendEnabled=true` **chỉ ở Debug**, sau khi đã audit rằng demo login chỉ bind loopback. Debug demo auth không thay thế Google auth thật.
- **Release:** `.\gradlew.bat :app:assembleRelease --console=plain` chỉ khi có signing key được bảo vệ ngoài Git, endpoint HTTPS hợp lệ và toàn bộ release gates PASS. App Release **không** được cấp đường login mock/demo. `keystore.properties` cá nhân và `*.jks` không được push.
- **Emulator khác tên:** dùng kết quả `adb devices` để thay `emulator-5554`; điện thoại thật dùng IP LAN/HTTPS của máy Backend, **không dùng** `10.0.2.2`.
- **Tránh lỗi URL kép:** xác nhận cách `BackendClient` ghép API prefix trước khi nhập `trooiApiBaseUrl`; không tự tạo `/api/v1/api/v1`.

### 5.1. Kiểm tra những màn hình trọng yếu

| Vai trò | Điều kiện demo |
| --- | --- |
| Guest | Discovery/search, listing detail, ảnh/map; không lộ dữ liệu tài khoản/chủ trọ |
| Tenant | Google login hợp lệ, linked tenancy, billing cycle/charge, Checkout SePay, trạng thái chưa trả/đã trả và lịch sử đúng Backend |
| Owner | Quản lý tài sản/phòng, tạo room/listing, công nợ, ghi nhận Payment, quyền giữa các Organization |
| Auth/session | Google login, token refresh, logout/revoke, mở lại app, phân quyền User A/B; không dùng fixture bearer ở bản release |
| SePay | Không tự báo thành công từ trình duyệt; đối chiếu IPN + REST + Payment, replay không ghi nhận trùng |
| Slot phòng | **ĐANG BLOCK**: `AssetWizard.kt` có UI “Mở thêm 1 slot” / `259.000đ/năm` nhưng `TroOiViewModel.purchaseLocalCapacity()` hiện trả `REAUTH_UNAVAILABLE`. Giá trên UI là giá hiện có, **không phải** một Checkout hoạt động. Vì Pricing/Quota là `[FUTURE]`, phải xin quyết định Product để ẩn/disable hoặc đặc tả thanh toán slot riêng; **không** dùng sai luồng SePay tiền thuê để thu phí slot. |

Ghi lại bằng chứng màn hình, HTTP status, và kết quả database cho từng vai trò. Nếu lỗi Auth/slot thì ghi **FAIL/BLOCKED** chứ không chuyển qua Mock rồi báo PASS.


## 6. Kiểm thử và tiêu chí nghiệm thu

~~~powershell
# Static/backend
pnpm typecheck
pnpm build
pnpm lint

# Test SePay + test không dùng inline business fixture
pnpm exec tsx --test tests/core/sepay-production.test.ts tests/core/sepay-ipn-list-fallback.test.ts tests/verification/cross-branch-persistence-fixtures.test.ts

# Bộ test Backend tổng quát: cần cấp môi trường DB test đúng schema và migrations
pnpm test

# Android
.\gradlew.bat :app:testDebugUnitTest --console=plain
.\gradlew.bat :app:assembleDebug --console=plain
~~~

**Snapshot lúc merge `main` commit `71a3343`, không được đổi thành PASS nếu chưa chạy lại:**

- Backend typecheck, build, lint: **PASS**; SePay + fixture governance: **17/17 PASS**; Android `CheckoutIdentityTest`: PASS.
- Full `pnpm test`: **501** bài, **494 PASS**, **3 FAIL**, **4 CANCELLED** do thiếu `DATABASE_URL` cho runtime HTTP audit (không có một môi trường test DB được cấp đúng). Ba lỗi còn lại: Finance fixtures, application restart fixtures, Identity fixtures.
- E2E tiền thật **2.000đ** chỉ được kiểm chứng trên finance DB cô lập; không coi đó là full Product, Docker hay Google Authentication acceptance.

**Không chạy full test với finance DB đã chứa Payment thật.** Các test có thể ghi dữ liệu. Môi trường kiểm thử cần DB và identity/fixtures riêng, migrations đúng version, các biến môi trường được load thật (PowerShell chạy `pnpm test` **không tự đọc** `.env`). Duy Anh cần chuẩn hóa test runner và ghi bằng chứng PASS/FAIL.

## 7. Khắc phục sự cố nhanh

| Triệu chứng | Kiểm tra và xử lý |
| --- | --- |
| `docker compose up` fail | Docker Desktop, `docker compose --env-file .env config --quiet`, ports đang chiếm, env bắt buộc; không xóa volume để chữa lỗi |
| Backend trả `500`/không kết nối DB | `docker compose ps`, `docker compose logs backend`, schema migrations, hostname `postgres` (Docker) và `localhost` (host) |
| Google Auth `401`/`503` | Web OAuth client audience khớp, Android OAuth package/SHA-1, access guard, principal tồn tại; không bypass auth bằng Mock |
| Debug app vẫn thấy dữ liệu mẫu | Kiểm tra `RuntimeDataSource`: chọn BACKEND, API host/port, token Tenant/Owner, refresh app |
| IPN SePay `401` | Secret ở server và SePay dashboard có đồng bộ không; không ghi key ra log |
| IPN SePay `400/503` | Payload, invoice/amount/currency/remote order ID, merchant và REST evidence; REST detail `404` chỉ có fallback xác thực nghiêm ngặt |
| Chuyển tiền rồi nhưng UI chưa đổi | Kiểm tra Checkout readback + IPN/REST + PostgreSQL Payment; **đừng chuyển tiếp lần thứ hai** cho đến khi đối soát |
| Slot chủ trọ bấm không hoạt động | Hiện là stub: `purchaseLocalCapacity` trả `REAUTH_UNAVAILABLE`, chưa có tính năng thu phí slot hợp lệ |
| Gradle không thấy SDK | `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `local.properties` private khi cần, JDK/AGP |
| Build Release lỗi signing | Không commit `keystore.properties`/`*.jks`; cấp key bằng kênh an toàn, xác nhận SHA-1 Release riêng |
| `pnpm test` fail/cancel | Xem baseline `main`, cung cấp **DB test riêng**, sửa fixture governance trước khi báo toàn bộ PASS |

## 8. Bàn giao Duy Anh và quy tắc an toàn

Hướng dẫn này phản ánh **cách chạy đang tồn tại** và nhấn mạnh phần còn phải triển khai. Yêu cầu còn mở trước demo:

- Audit hardcode/naming/JSON fixture đầy đủ, sửa ba bài fixture còn lỗi.
- Hợp nhất **một private `.env`** làm nguồn chạy local; không track/push file cá nhân. Gradle/Android SDK/signing phải được cấu hình đúng, không nhét bí mật server vào client.
- Đưa **Backend + PostgreSQL/PostGIS + tùy chọn MinIO + Redis** vào một `docker-compose.yml` có profile, migrate, seed, volume, backup, health, hỗ trợ rebuild không mất dữ liệu, không đụng DB tiền thật.
- Kiểm tra UI Guest/Tenant/Owner, Google Auth thật, Payment/SePay và quyết định về slot phí quản lý; **không tự mở tính năng mới**.
- Seed dữ liệu tổng hợp hợp lệ như hệ thống có người dùng (room, listing, tenancy, charge, incident, conversations, lịch sử), deterministic và idempotent trên **database demo tách biệt**, không tạo gateway Payment giả `PROVIDER_VERIFIED`.
- Nghiệm thu qua video/screenshots, HTTP traces, DB readback và tài liệu PASS/FAIL.

Chi tiết đầu việc và Definition of Done tại **[Handoff Duy Anh 15/10/2026](docs/superpowers/handoff/duyanh-20261015-main-demo-hardening.md)**. Không dùng `docker compose down -v`, `pnpm db:reset` hoặc rollback migrations trên DB có dữ liệu quan trọng; không push secret hoặc log thông tin ngân hàng lên GitHub.
