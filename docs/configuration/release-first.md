# TrọƠi — Release-first execution policy (2026-10-24)

## Product/runtime decision

TrọƠi develops and accepts features against **the real NestJS backend, one shared PostgreSQL/PostGIS application database `tro-oi`, and the Android signed Release artifact**. No mock/demo mode is accepted as product runtime evidence or as a substitute for a working backend feature.

Android Release already directly binds to `BackendTroOiRepository`; the debug-only fixture implementation is retained solely for existing isolated/instrumented tests until those tests are migrated. It is **not** part of the release application and must not be used for acceptance.

One database does **not** mean destructive test reset is safe: full migration, E2E seed/reset and destructive integration tests cannot point at `tro-oi`. Use non-destructive assertions and transactional smoke checks against it. Never run `DROP SCHEMA`, `db:reset`, or down migrations against shared app data.

## Release gate

Run `pnpm release:check` before release work. The checker must not emit credentials or treat an HTTP emulator URL as a Release URL. A passing **configuration** check is necessary but not sufficient for release acceptance.

1. Use a real, reachable HTTPS API origin in `TROOI_API_BASE_URL`; `10.0.2.2` is Android Emulator-only HTTP Debug and cannot be shipped.
2. Deploy and verify NestJS with `POSTGRES_DB=tro-oi` and current additive migrations. Do not modify/drop the existing persistent volume or bootstrap a second business database.
3. Validate the Google Web Client ID on Android and backend, plus the signing identity for package `com.trooi.app` and the registered SHA-1/SHA-256 fingerprints.
4. Complete identity cutover preflight/authorization before changing `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED` from `false` to `true`.
5. Provide the existing signed Release keystore via ignored `keystore.properties`; do not create a new, incompatible certificate or sign into a different package merely to make the build succeed.
6. Run Google registration and sign-in on the signed Release against the actual API: challenge, account chooser, proof, session, context, app entry, restart/restore, error/cancel paths. Record FAIL/NOT RUN distinctly from PASS.
7. Real payment activation must separately prove SePay IPN authentication, replay/idempotency, durable settlement/readback, HTTPS origin, finance authorization and failure paths. `SEPAY_ENABLED=false` is not a successful payment acceptance test.

## Deferred integration work, not a mock substitute

- Email/Password and Email OTP currently have UI plus fixture validation, but no complete backend registration/verification route; do not mark them as available on Release.
- The current `finance-production` Compose profile uses a separate database and backend. A one-DB SePay architecture needs a reviewed refactor of service/config/finance boundaries before enabling real money; **changing environment variables alone is insufficient**.
- Redis, MinIO, CompreFace and MoMo remain optional by the relevant capability, not required just to sign a Google-first Release.

## Current local status at policy adoption

- PostgreSQL `tro-oi`: healthy, 17 migrations.
- Signed current Android Release: **not updated with recent signup UI**. The previous installed APK is not proof of real backend integration.
- Google OAuth Client ID present and matched; security cutover flag disabled.
- Local Android `TROOI_API_BASE_URL`: emulator HTTP, not an acceptable Release endpoint.
- `keystore.properties`: absent in this checkout.
- SePay remains disabled; existing secrets are preserved privately.
- Source changes in the working tree have not been committed/pushed unless explicitly requested.

No step above authorizes production payments, real user migration, destructive database operations, or disabling security checks solely to make the app appear functional.
