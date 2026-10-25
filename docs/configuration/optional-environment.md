# TrọƠi — optional environment variables

The root `.env.example` is intentionally short. It contains the local single-database Compose configuration and the Google-first Android Release settings. Do not copy all optional settings into `.env`.

## Essential Google-first Release configuration

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: backend database. Preserve the actual existing password for an initialized PostgreSQL volume.
- `POSTGRES_TEST_DB`: required by the **current** Docker Compose file. Set to `tro-oi` (identical to `POSTGRES_DB`) to avoid provisioning a second app database. Destructive integration/E2E tests must **not** target `tro-oi`.
- `GOOGLE_CLIENT_ID`: shared Web OAuth audience for NestJS and Android. Register the Android package and its actual signing fingerprints in Google Cloud.
- `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED`: security cutover gate. At `false`, Google account exchange will not succeed; switch to `true` only after cutover preflight/acceptance.
- `TROOI_API_BASE_URL`: compiled into Android at build time. Signed Release needs a real, reachable **HTTPS** backend. Emulator loopback HTTP works only for Debug.
- `BACKEND_PORT`: optional Compose host port (currently 3101 because port 3000 is occupied). Compose defaults to host bind `127.0.0.1`.
- Android Release signing is configured with ignored `keystore.properties`, not `.env`.

Docker already sets `PORT=3000`, `NODE_ENV=production`, `TROOI_BIND_HOST=0.0.0.0`, and builds its own `DATABASE_URL` from PostgreSQL settings. Host-side migration scripts can use a private `DATABASE_URL` independently.

## Extra settings by feature (not necessary for Google-first Release)

| Feature | Optional variables |
|---|---|
| Separate Android Google Web Client ID | `TROOI_GOOGLE_WEB_CLIENT_ID` (Gradle falls back to `GOOGLE_CLIENT_ID`) |
| Google Maps / map configuration | `TROOI_MAP_PROVIDER`, `TROOI_MAPS_API_KEY`, `TROOI_MAPLIBRE_STYLE_URL` |
| Public payment redirect origin | `TROOI_PAYMENT_PUBLIC_ORIGIN`, `TROOI_RELEASE_PAYMENT_PUBLIC_ORIGIN` |
| SePay production profile | `SEPAY_ENABLED`, `SEPAY_ENVIRONMENT`, `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`, `SEPAY_IPN_SECRET_KEY`, `SEPAY_PUBLIC_BASE_URL`, `SEPAY_HANDOFF_SIGNING_KEY`, `SEPAY_FINANCE_DATABASE`, `SEPAY_FINANCE_DATABASE_URL`, `SEPAY_BACKEND_PORT` |
| MoMo | `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_ENDPOINT`, `MOMO_IPN_URL`, `MOMO_REDIRECT_URL` |
| Object storage | `OBJECT_STORAGE_ENABLED`, `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`, `OBJECT_STORAGE_FORCE_PATH_STYLE` |
| MinIO (default Compose) | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` |
| Redis cache | `REDIS_URL`, `CACHE_ENVIRONMENT`, `REDIS_CONNECT_TIMEOUT_MS`, `REDIS_DEV_PORT` |
| CompreFace (default Compose services) | `TROOI_COMPREFACE_DB_USER`, `TROOI_COMPREFACE_DB_NAME`, `TROOI_COMPREFACE_DB_PASSWORD`, `COMPREFACE_ENABLED`, `COMPREFACE_ORIGIN`, `COMPREFACE_API_KEY`, `TROOI_LOCAL_COMPREFACE_LAB`, `TROOI_LOCAL_KYC_FACE_THRESHOLD`, `COMPREFACE_TIMEOUT_MS`, `TROOI_COMPREFACE_FE_PORT` |
| Isolated messaging tests | `MESSAGING_DB_NAME`, `MESSAGING_DB_USER`, `MESSAGING_DB_PASSWORD`, `MESSAGING_DB_PORT`, `MESSAGING_MINIO_USER`, `MESSAGING_MINIO_PASSWORD`, `MESSAGING_MINIO_PORT`, `MESSAGING_MINIO_CONSOLE_PORT` |
| Demo testing | `TROOI_DEMO_BACKEND_ENABLED`, `DEMO_PAYMENT_ENABLED`, `DEMO_PAYMENT_PUBLIC_BASE_URL`, `DEMO_PAYMENT_SIGNING_KEY`, `TROOI_DEMO_MVP_ENABLED`, `TROOI_DEMO_MVP_PORT`, `TROOI_DEMO_PASSWORD`, `TROOI_SEPAY_PAYMENT_FIXTURE`, `TROOI_SEPAY_TEST_AMOUNT` |
| Identity preflight / destructive test DB | `IDENTITY_PREFLIGHT_DATABASE_URL`, `TROOI_IDENTITY_PREFLIGHT_READ_ONLY`, `TEST_DATABASE_URL` |
| Direct host NestJS | `NODE_ENV`, `PORT`, `TROOI_BIND_HOST`, `DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_CONNECTION_TIMEOUT_MS` |
| Docker overrides | `TROOI_BACKEND_BIND`, `TROOI_BACKEND_IMAGE`, `POSTGRES_PORT`, `TROOI_DATABASE_MODE` (normally set by Compose) |
| SePay isolated test lab | `TROOI_STANDALONE_DB_PASSWORD`, `SEPAY_ISOLATED_DB_PORT` |
| Test-only identity fixture | `TROOI_DEMO_CLAIM_USER_ID`, `TROOI_LOCAL_DEMO_AUTH`, `TROOI_LOCAL_DEV_SEED_PASSWORD` |
| Local media lab | `TROOI_LOCAL_MEDIA_DEMO` |

**Important:** the existing `finance-production` Compose profile explicitly uses a **separate finance database**, a current security/settlement boundary. Do not point it at the single `tro-oi` database without an approved backend change. `SEPAY_BACKEND_PORT=3101` (default) also conflicts with the main backend if the main backend uses host port 3101.

Neither TLS/HTTPS ingress nor release signing nor Google Cloud client fingerprints is configured by simply setting environment variables. See [database runtime notes](../../database/README.md).

The default stack includes Redis, MinIO and CompreFace. See [single-Compose runtime](single-compose-runtime.md) for setup and safe migration notes.
