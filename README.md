# TrọƠi

Ứng dụng Android quản lý vận hành cho thuê phòng trọ, kết nối NestJS API và PostgreSQL/PostGIS. Repo này chứa **sản phẩm, hợp đồng kỹ thuật, kiểm thử và hướng dẫn vận hành**; các biên bản handoff, kế hoạch Superpowers và evidence lịch sử không nằm trên nhánh chính (có thể tra cứu qua lịch sử Git).

**Thứ tự đọc contract:** [Database v1 canonical](docs/database/v1/canonical.md) → [frozen conceptual ERD](docs/database/v1/erd/conceptual.json) → [contexts](docs/contexts/) → implementation and tests. **Payment is actual money inflow. Receipt is not the Payment record.** Các module Subscription/Pricing/Quota và CSV/Excel import là FUTURE, không phải chức năng core đã nghiệm thu.

## Cấu trúc repository

| Đường dẫn | Nội dung |
| --- | --- |
| `app/` | Android Kotlin + Jetpack Compose; Debug hỗ trợ MOCK/BACKEND, Release sử dụng Backend |
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
- **`docker-compose.yml`:** file Compose duy nhất, với các profile `local-infra`, `messaging-test`, `sepay-isolated`. Các DB test dùng container/volume riêng.
- **Gradle:** `app/build.gradle.kts` chỉ đọc các biến **client allowlist** qua `-P` → environment → root `.env`. `gradle.properties.example` là mẫu cấu hình Gradle; `local.properties.example` dành cho SDK và `keystore.properties.example` dành cho signing — mỗi loại chỉ một mẫu. Các file thật bị ignore.
- **Không** copy `SEPAY_SECRET_KEY`, `SEPAY_IPN_SECRET_KEY`, `SEPAY_HANDOFF_SIGNING_KEY`, `POSTGRES_PASSWORD` hoặc private signing key vào APK.

Với các profile phụ, **phải điền mật khẩu riêng** trong `.env`; không có mật khẩu MinIO hoặc database tài chính mặc định. Chỉ nên bật profile đang cần kiểm thử.

## Chạy Backend + Database

```powershell
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build --wait
docker compose ps
curl.exe -i http://localhost:3000/api/v1/health
docker compose logs --tail=100 backend
```

Backend khởi chạy migrations theo `docker-entrypoint.sh`. PostgreSQL dùng named volume, dữ liệu được giữ khi `docker compose down` **không có `-v`**.

Các profile tùy chọn:

```powershell
# Cache và object storage (cấp MINIO_ROOT_PASSWORD riêng trong .env)
docker compose --env-file .env --profile local-infra up -d --build --wait

# Messaging test: chỉ 2 service cô lập; không khởi động Backend mặc định
docker compose --env-file .env --profile messaging-test up -d --no-deps messaging-postgres messaging-minio

# Isolated SePay test DB: không phải DB finance/merchant Production
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

## Google OAuth và Maps

1. Vào [Google Cloud Console](https://console.cloud.google.com/), tạo/chọn project và cấu hình OAuth consent.
2. Tạo **Web OAuth Client ID** cho Backend Google ID-token verification: `GOOGLE_CLIENT_ID`. Android Credential Manager dùng cùng Web Client ID qua `TROOI_GOOGLE_WEB_CLIENT_ID`.
3. Tạo **Android OAuth Client ID** cho package Debug `com.trooi.app.backenddev` và SHA-1 Debug; Release dùng `com.trooi.app` và release SHA-1 khác. Cấu hình màn hình đồng ý, tester và audience theo Google Cloud.
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
