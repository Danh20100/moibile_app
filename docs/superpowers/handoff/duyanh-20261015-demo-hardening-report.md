# Demo hardening report — 15/10/2026

Source changes for the Duy Anh handoff. This is not a full-stack PASS.

## Passed here

- Finance, Application Restart, and Identity fixture governance: 15/15.
- `tsc -p tsconfig.tests.json` PASS after the seed and fixture edits.
- Demo fixture id self-check PASS. Seed is idempotent in code: existing rows are skipped, payments stay `USER_RECORDED`.
- Gradle allowlist test rejects server secrets in `app/build.gradle.kts`.

## Docker, 15/10/2026

Backups are in `.local-backups/` and are gitignored. Postgres was recreated without deleting the volume.

- Backend image built. Postgres, Backend, Redis, and MinIO are healthy. `minio-init` exited 0 and created private bucket `trooi-media`. The bucket is still there after a MinIO restart.
- `trooi_dev` is on migration `000017`. Demo payments stay `USER_RECORDED`.
- Public `GET /api/v1/listings/public` returns 3 published listings, including `Phòng P.201 Phú Nhuận`. The draft listing is absent.
- Restart of Postgres and Backend kept dev counts. Health stayed 200.
- Host `DATABASE_URL` points at `trooi_finance`. `database/seeds/development.ts` refuses every database except `trooi_dev`.

## Tests and Android, later 15/10/2026

- `pnpm test` against `trooi_test`: 498 pass, 5 fail. The doc failures were missing README phrases; those tests pass after the phrases were restored. The HTTP audit passes 4/4 when the identity gate is true and `trooi_test` is migrated. `tests/core/slot-entitlement.test.ts` passes.
- `./gradlew :app:testDebugUnitTest :app:assembleDebug` BUILD SUCCESSFUL. Debug APK `com.trooi.app.backenddev` was installed on emulator-5554 at 11:08, replacing the 13/10 build.

## Google gate

Demo backend container: `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED=true`, database pathname `/trooi_dev`, health 200. `TROOI_IDENTITY_NAMESPACE` was not changed. The 13/10 emulator APK posted `idToken` without `nonce`, and `POST /api/v1/identity-access/auth/google` returned 400 `nonce should not be empty`. The replacement debug APK then opened in mock mode, which shows the Google button but does not call Google. The emulator preference is now `BACKEND`.

## Slot checkout

Product rules used: one extra managed room, 259000 VND, one year from verification, capacity only after `PROVIDER_VERIFIED`, no tenancy `payments` row.

- Backup: `.local-backups/trooi_finance-20261015-before-slot.sql` (gitignored).
- `trooi_finance` migrated additively from `000007` through `000017`. It was not seeded or reset.
- Payments remain 6, of which 4 are `PROVIDER_VERIFIED`.
- One slot checkout is `CREATED`. Entitlements: 0. Reconcile returned "SePay order is not uniquely paid".
- The bank form is `.local-backups/slot-checkout.html`. It posts to SePay and does not contain the secret key. Opening it and transferring 259000 VND is the remaining human step. Replay must not add a second entitlement.

## Not done on a device

- Google login on a phone.
- The 259000 VND transfer itself.
- Guest, Owner, Tenant, incident, and restart scenarios on a device.

## Hardcodes kept

| Value | Class | Why it stays |
| --- | --- | --- |
| `TROOI_IDENTITY_NAMESPACE` | Technical constant | Changing it would reassign every derived User id |
| `259.000đ / 1 năm` | Approved slot price | One room-slot, one year, only after SePay verification |
| `e0080000-0000-4000-8000-*` | Demo/test data | Stable seed identities, not production logic |
| `http://minio:9000` in Compose | Technical constant | Container DNS name on the Compose network |
| `compileSdk` / `minSdk` | Technical constant | Android toolchain pins |

## Open blockers

1. **259000 VND transfer.** The checkout exists and is unpaid. Pay from `.local-backups/slot-checkout.html`, then reconcile. Do not insert a payment by hand.
2. **Phone Google login.** The 400 was the old APK. The emulator now has the build that sends `nonce`. Sign-in still has to be tapped on the device.
3. **SePay production** still refuses `trooi_dev` and `trooi_test`. The slot checkout lives on `trooi_finance`.
4. **Device E2E** for Guest, Owner, Tenant, incident, and restart is not evidenced.
