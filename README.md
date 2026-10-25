# TrọƠi

Ứng dụng Android quản lý vận hành cho thuê phòng trọ, kết nối NestJS API và PostgreSQL/PostGIS. Repo này chứa **sản phẩm, hợp đồng kỹ thuật, kiểm thử và hướng dẫn vận hành**; các biên bản handoff, kế hoạch Superpowers và evidence lịch sử không nằm trên nhánh chính (có thể tra cứu qua lịch sử Git).

**Thứ tự đọc contract:** [Database v1 canonical](docs/database/v1/canonical.md) → [frozen conceptual ERD](docs/database/v1/erd/conceptual.json) → [contexts](docs/contexts/) → implementation and tests. **Payment is actual money inflow. Receipt is not the Payment record.** Các module Subscription/Pricing/Quota và CSV/Excel import là FUTURE, không phải chức năng core đã nghiệm thu.

## Release-first (quyết định 24/10/2026)

**Không sử dụng Mock/Demo để chạy hay nghiệm thu sản phẩm.** Android Release ↔ NestJS ↔ một PostgreSQL/PostGIS `tro-oi`; Google OAuth, dữ liệu và thanh toán phải được kiểm chứng trên hệ thống thật. Debug-only fixture được giữ cho các bài test nội bộ, không thay thế API và không được đưa vào Release. Chạy `pnpm release:check` trước khi phát hành; hiện tại HTTPS, signing và Identity Session cutover chưa hoàn tất nên **chưa có Release PASS**. Xem [Release-first policy](docs/configuration/release-first.md).

## Cấu trúc repository

| Đường dẫn | Nội dung |
| --- | --- |
| `app/` | Android Kotlin + Jetpack Compose; **Release dùng backend thật**; Debug fixtures chỉ dành cho automated tests, không nghiệm thu sản phẩm |
| `src/modules/` | Nghiệp vụ NestJS: Identity, Organization, Room, Listing, Tenancy, Billing, Payment, Incident… |
| `src/infrastructure/`, `src/persistence/` | Database adapter và các service hạ tầng |
| `database/` | Migrations và seed phát triển |
| `docs/database/`, `docs/contexts/` | Hợp đồng dữ liệu/nghiệp vụ cần cho kiểm thử và triển khai |
| `docs/api/openapi.json` | OpenAPI được generate; không chỉnh sửa thủ công |
| `docs/designs/v1/` | Design/UX reference đang được sử dụng |
| `tests/` | Unit, conformance, integration, E2E và Android tests |
| `scripts/` | Công cụ migrate, kiểm thử và tạo dữ liệu |
| `docker-compose.yml` | **Một** Docker Compose: Backend, PostGIS và các profile tùy chọn |
| `.env.example` | **Một** mẫu environment; dữ liệu thật lưu trong `.env` bị Git ignore |

Hướng dẫn nghiệp vụ nằm gần source tại các `src/modules/*/README.md`; [database](database/README.md), [bối cảnh kỹ thuật](docs/README.md), [Android tests](tests/android/README.md). Các hợp đồng DB versioned được test tự động; không suy luận quy tắc tài chính chỉ từ giao diện.

## Chuẩn bị máy

- Node.js theo `package.json` (`^22.22.3 || ^24.15.0 || >=26`), pnpm, Git.
- Docker Desktop/Engine + Compose v2 (Linux containers).
- Android Studio + SDK API 36, JDK 21, ADB/emulator để build ứng dụng.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
# Chỉnh .env tại máy. KHÔNG commit/đưa vào log/chat các secret.
git check-ignore -v .env
```

### Một nguồn cấu hình, một Compose

- **`.env` (local, untracked):** cấu hình Backend/Docker/Google/Maps/SePay và những profile test cần thiết. Chỉ có một template `.env.example` được track.
- **`docker-compose.yml`:** file Compose duy nhất, với các service mặc định (Backend, PostGIS, MinIO, Redis, CompreFace) và profile cô lập `messaging-test`, `sepay-isolated`, `finance-production`. Các DB test dùng container/volume riêng.
- **Gradle:** `app/build.gradle.kts` chỉ đọc các biến **client allowlist** qua `-P` → environment → root `.env`. `gradle.properties.example` là mẫu cấu hình Gradle; `local.properties.example` dành cho SDK và `keystore.properties.example` dành cho signing — mỗi loại chỉ một mẫu. Các file thật bị ignore.
- **Không** copy `SEPAY_SECRET_KEY`, `SEPAY_IPN_SECRET_KEY`, `SEPAY_HANDOFF_SIGNING_KEY`, `POSTGRES_PASSWORD` hoặc private signing key vào APK.

Với các profile phụ, **phải điền mật khẩu riêng** trong `.env`; không có mật khẩu MinIO hoặc database tài chính mặc định. Chỉ nên bật profile đang cần kiểm thử.

## Chạy Backend + Database

```powershell
node --env-file=.env scripts/config/check-local.cjs
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build --wait
docker compose ps -a
# Host port lấy từ BACKEND_PORT trong .env (mặc định 3000, máy phát triển đang dùng 3101)
curl.exe -i http://localhost:3101/api/v1/health
docker compose logs --tail=100 backend
# KYC/Redis/MinIO đều đã thuộc Compose mặc định; chi tiết: docs/configuration/single-compose-runtime.md
```

Backend khởi chạy migrations theo `docker-entrypoint.sh`. PostgreSQL dùng named volume, dữ liệu được giữ khi `docker compose down` **không có `-v`**.

Các profile tùy chọn:

```powershell
# Cache và object storage (cấp MINIO_ROOT_PASSWORD riêng trong .env)
node --env-file=.env scripts/config/check-local.cjs
docker compose up -d

# Messaging test: chỉ 2 service cô lập; không khởi động Backend mặc định
node --env-file=.env scripts/config/check-local.cjs messaging-test
docker compose --env-file .env --profile messaging-test up -d --no-deps messaging-postgres messaging-minio

# Isolated SePay test DB: không phải DB finance/merchant Production
node --env-file=.env scripts/config/check-local.cjs sepay-isolated
docker compose --env-file .env --profile sepay-isolated up -d --no-deps sepay-postgres
```

Các profile test **không thay thế hoặc gắn tự động** vào volume cũ `trooi-sepay-standalone`; dữ liệu thanh toán thật trước đây phải được bảo toàn riêng. Không dùng seed/reset/rollback hoặc `docker compose down -v` trên DB có dữ liệu quan trọng. Không chạy test tài chính trên `trooi_finance` hoặc bất kỳ finance DB thật nào.

Nếu chạy Backend trên host thay vì container Backend:

```powershell
# Chỉ chạy sau khi DATABASE_URL trong .env đã trỏ tới DB thích hợp.
node --env-file=.env --import tsx scripts/database/migrate.ts up
pnpm build
node --env-file=.env build/main.js
```

### Seed dữ liệu giả

`database/seeds/development.ts` và `scripts/demo/fixture.cjs` thêm Organization, Owner/Tenant, Room/Listing, Tenancy, Billing, Incident, Messages và Payment thủ công **USER_RECORDED**. Script từ chối database khác `trooi_dev`; chạy lại phải idempotent.

```powershell
# Sau migrations. Xác minh DATABASE_URL trỏ ĐÚNG trooi_dev trước khi chạy.
node --env-file=.env --import tsx database/seeds/development.ts
```

Không tạo gateway `PROVIDER_VERIFIED` giả hoặc seed vào DB nhận tiền thật.

## Bản đồ miễn phí: MapLibre + OpenFreeMap (mặc định)

**Lựa chọn ổn định chi phí:** Android dùng [MapLibre Native Android](https://maplibre.org/maplibre-native/android/) với mã nguồn mở **BSD-2-Clause**, lấy bản đồ từ [OpenFreeMap](https://openfreemap.org/). Không cần tạo Google Maps API Key, không yêu cầu Google Cloud Billing, không cần OpenFreeMap API Key/đăng ký hay thêm tài khoản thanh toán. Theo thông báo **hiện tại** của OpenFreeMap, public instance là miễn phí, không giới hạn lượt xem/request và được hỗ trợ bằng quyên góp.

Đây là ba vấn đề độc lập:

| Thành phần | Giá và điều kiện |
| --- | --- |
| MapLibre Android SDK | **Miễn phí / mã nguồn mở (BSD-2-Clause)**, kể cả phân phối trong ứng dụng thương mại; phải tuân thủ license |
| Dữ liệu nền OpenStreetMap | Mở theo [ODbL](https://www.openstreetmap.org/copyright) và cần ghi nguồn tác giả |
| Hosted tiles của OpenFreeMap | **Hiện miễn phí, không yêu cầu thẻ/API key, không có hạn mức công bố** theo [website](https://openfreemap.org/) và [Terms of Service](https://openfreemap.org/tos/) |

**Quan trọng:** không có cơ sở để **cam kết miễn phí và uptime mãi mãi** đối với hosted tiles do bên thứ ba vận hành. [OpenFreeMap ToS](https://openfreemap.org/tos/) quy định dịch vụ *as-is*, có thể ngừng hoặc thay đổi điều khoản; chi phí data mạng của thiết bị hoặc tự host riêng vẫn do người triển khai trả. Nếu TrọƠi tăng tải, cần đánh giá SLA và cân nhắc self-host; không tự chuyển sang tiles có billing. Chỉ dùng tiles khi người dùng xem bản đồ, không thu thập hàng loạt hoặc prefetch/offline gây vi phạm chính sách. Không sử dụng `tile.openstreetmap.org` làm nền production: [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) nói rõ tile server do quyên góp duy trì và **không đảm bảo phục vụ không giới hạn**.

Mặc định trong `.env`:

```dotenv
TROOI_MAP_PROVIDER=maplibre
TROOI_MAPLIBRE_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
TROOI_MAPS_API_KEY=
```

- `maplibre` (**mặc định, khuyến nghị**): không khởi tạo Google Maps ở màn này, hoạt động dù Maps Key/Billing trống; hiện bản đồ, marker công khai, chọn pin, kéo camera/tìm khu vực.
- `google`: chỉ dùng Google Maps khi có Google Maps Key; nếu thiếu key **tự về MapLibre**. Khi đã chọn Google và gặp lỗi Billing/key, có nút **“Dùng bản đồ miễn phí”** để quay về MapLibre. Google Maps SDK không có tín hiệu tin cậy để tự xác định trạng thái Billing Cloud.
- `auto`: dùng Google nếu có key, nếu không dùng MapLibre. **Không khuyến nghị** nếu muốn chắc chắn không phát sinh phí Google.
- Có thể đổi `TROOI_MAPLIBRE_STYLE_URL` sang một HTTPS style URL khác, **nhưng giá và điều khoản của tile provider mới phải được kiểm tra riêng**; không được mặc định nhà cung cấp khác là miễn phí.

MapLibre được chia sẻ cho màn **Guest Discovery và Owner Location Picker**; không thay đổi quy tắc riêng tư về vị trí phòng. Hiện attribution **“© OpenStreetMap contributors · OpenFreeMap”** ngay dưới bản đồ. Sau khi sửa biến môi trường dùng trong BuildConfig, **build lại APK**.

**Tài liệu tham chiếu**: [MapLibre license](https://github.com/maplibre/maplibre-native/blob/main/platform/android/LICENSE.md), [OpenFreeMap Quick Start](https://openfreemap.org/quick_start/), [OpenFreeMap ToS](https://openfreemap.org/tos/), [OSMF Tile Policy](https://operations.osmfoundation.org/policies/tiles/). Kiểm tra lại điều khoản khi phát hành Production.

## Google OAuth và Maps

1. Vào [Google Cloud Console](https://console.cloud.google.com/), tạo/chọn project và cấu hình OAuth consent.
2. Tạo **Web OAuth Client ID** cho Backend Google ID-token verification: `GOOGLE_CLIENT_ID`. Android Credential Manager dùng cùng Web Client ID qua `TROOI_GOOGLE_WEB_CLIENT_ID`.
3. Android OAuth Client đã được đăng ký cho **`com.trooi.app`** và SHA-1 **`B7:21:C0:57:38:35:FA:3C:73:8D:84:EA:71:11:F5:78:51:50:E4:8B`**. Phải giữ nguyên cặp này khi build local Google Login; không thêm hậu tố `applicationIdSuffix`, không thay debug signing key. Khi ký Release bằng khóa khác về sau phải đăng ký fingerprint tương ứng và nghiệm thu riêng, không tự đổi OAuth Client hiện có.
4. Bật Maps SDK for Android, cấp `TROOI_MAPS_API_KEY` **giới hạn package + SHA-1 + API**.
5. Test login Google thật, nonce, refresh, logout và phân quyền; Debug Mock login không được dùng để khẳng định OAuth E2E PASS.

```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

## Thanh toán SePay / TPBank

TrọƠi tạo Checkout qua NestJS → SePay QR chuyển khoản → ngân hàng **TPBank được liên kết với SePay Merchant** nhận tiền → SePay IPN/REST đối soát → ghi Payment/Entitlement vào PostgreSQL. **Không sử dụng TPBank API Key trực tiếp** trong luồng này.

- Tại [SePay Merchant](https://my.sepay.vn/): liên kết tài khoản nhận tiền được phép, lấy `SEPAY_MERCHANT_ID` và `SEPAY_SECRET_KEY`, cấu hình IPN secret riêng qua `X-Secret-Key`.
- `SEPAY_ENABLED=true`, `SEPAY_ENVIRONMENT=production` chỉ được bật với `DATABASE_URL` trỏ **finance DB tách biệt**, có `SEPAY_FINANCE_DATABASE` khớp DB name và `SEPAY_PUBLIC_BASE_URL` là HTTPS origin công khai được kiểm soát.
- IPN: `<SEPAY_PUBLIC_BASE_URL>/api/v1/finance/checkouts/sepay/ipn`. Không public các endpoint demo login.
- **Không tự đánh dấu SUCCESS từ browser return**. Đối soát invoice, amount, remote order, bank method, SePay REST + IPN hợp lệ; callback trùng không tạo Payment/Entitlement thứ hai.
- Checkout tiền thuê và **Checkout mua thêm slot Owner** là hai nghiệp vụ tách biệt. Giá slot hiện tại trong source là `259000.00 VND`, chỉ tăng entitlement sau `PROVIDER_VERIFIED`. Đây **chưa phải** chứng cứ đã nghiệm thu E2E cho slot; đừng chuyển tiền thật khi chưa kiểm tra luồng và quyền Owner.
- Không tạo thêm giao dịch ngân hàng chỉ để chạy test code. Dùng unit/integration fixture và provider sandbox khi có cấu hình tương ứng.

## Build Android

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
.\gradlew.bat :app:testDebugUnitTest --console=plain
.\gradlew.bat :app:assembleDebug -PtrooiApiBaseUrl=http://10.0.2.2:3000 --console=plain
adb devices
adb -s emulator-5554 install -r app\build\outputs\apk\debug\app-debug.apk
```

- Emulator truy cập Backend trên host qua `10.0.2.2`; điện thoại thật dùng địa chỉ LAN/HTTPS phù hợp.
- Debug có thể chuyển MOCK/BACKEND, phải kiểm tra mode đang dùng trước khi nghiệm thu API.
- Release: `.\gradlew.bat :app:assembleRelease` chỉ khi cấp private signing và HTTPS endpoint hợp lệ; không build secret server vào client.

## Quality gates

```powershell
pnpm typecheck
pnpm build
pnpm lint
pnpm exec tsx --test tests/core/sepay-production.test.ts tests/core/sepay-ipn-list-fallback.test.ts
pnpm test
python scripts/verify_docs_links.py --scope all
```

**Lưu ý:** full `pnpm test` yêu cầu **database test đã migrate** và environment phù hợp; thiếu `DATABASE_URL` có thể khiến runtime access tests bị hủy. Không gọi đó là full PASS nếu còn test fail/cancel. Docker Engine và thiết bị/emulator phải chạy để nghiệm thu E2E thật.

Đọc [hướng dẫn module](src/modules/) và [database](docs/database/) để tìm contract theo chức năng. Mọi thay đổi config phải cập nhật ngay README này và `.env.example`, không tạo thêm file config song song chỉ để chạy demo.


## Configuration preflight and safe finance deployment

The root `.env` is the **only application environment file**. Copy `.env.example`, then set
`POSTGRES_PASSWORD` and any provider credentials through a private channel. `.env.example`
intentionally has no working default passwords. `DATABASE_URL` and `TEST_DATABASE_URL`
are for **host-side scripts/tests** and must use URL-encoded credentials; Compose builds its
own connection URL from `POSTGRES_*` with correct escaping.

Run this preflight **before** starting a profile (no secrets are printed):

```powershell
node --env-file=.env scripts/config/check-local.cjs
docker compose --env-file .env config --quiet
# Optional services require additional credentials
node --env-file=.env scripts/config/check-local.cjs
node --env-file=.env scripts/config/check-local.cjs messaging-test
node --env-file=.env scripts/config/check-local.cjs sepay-isolated
```

Docker always runs the default Backend with `NODE_ENV=production`, `SEPAY_ENABLED=false`,
and a local development database. Local PostgreSQL/API ports are bound to `127.0.0.1`
and never published to a public network by this Compose configuration. `TROOI_DATABASE_MODE`
is set by Compose, not manually. `COMPREFACE_*` are optional server-only verification
settings; leave `COMPREFACE_ENABLED=false` unless the integration is explicitly enabled.

### Production SePay — separate full application/finance runtime

`finance-backend` is an **opt-in** profile with its own `DATABASE_URL`, never the
default development database. Configure `SEPAY_FINANCE_DATABASE_URL` to a **separately
managed and backed-up full TrọƠi application database** reachable from the container,
and configure `SEPAY_FINANCE_DATABASE` to the exact database name. It must contain the
real authorized identities and tenancies for that environment. **Do not** point it at
`trooi_dev`, `trooi_test`, or a disposable SePay fixture database.

Only after verifying database backup, migrations and authorized merchant settings:

```powershell
node --env-file=.env scripts/config/check-local.cjs finance-production
docker compose --env-file .env --profile finance-production config --quiet
# Starts only this service; does not start/reset local postgres or demo fixtures.
# WARNING: the service runs additive database migrations on the configured finance DB.
docker compose --env-file .env --profile finance-production up -d --build --wait finance-backend
docker compose logs --tail=80 finance-backend
```

The finance API binds to **localhost port `SEPAY_BACKEND_PORT` (default 3101)**.
A separately configured TLS reverse proxy must expose *only approved SePay callback/
handoff paths* at `SEPAY_PUBLIC_BASE_URL`; do not expose developer/demo endpoints.
The callback endpoint is `/api/v1/finance/checkouts/sepay/ipn`. The startup guard
rejects mismatched or development databases, disabled SePay Production, missing secrets,
and missing HTTPS origins **before migrations are attempted**.

These steps are **deployment instructions, not evidence of a completed Production
transaction**. Validation in CI verifies the Compose/Gradle/environment contract;
real banking and end-to-end authentication require separate authorized acceptance.

### Android / Gradle

Application values come from `.env` via an allowlist in `app/build.gradle.kts`.
`gradle.properties.example` now contains **build-tool JVM settings only**:
do not copy duplicate application values to `gradle.properties` or they may override
`.env`. For a one-off override use `-PtrooiApiBaseUrl=...` or the matching `TROOI_*`
environment key. Android SDK `local.properties` and release signing
`keystore.properties` remain private per-machine exceptions; no Backend/SePay
credentials belong in an APK.

After changes, run the automatic drift guard:

```powershell
pnpm exec tsx --test tests/verification/configuration-completeness.test.ts
pnpm typecheck
pnpm build
```
