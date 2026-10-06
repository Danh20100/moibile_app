# V1 integration evidence — 2026-10-06

READY_TO_MERGE: NO

This file describes the tree at `5b875ba`. The docs commit that adds this revision is not a new implementation HEAD. The emulator instrumentation fix is `b3b4cd0`.

| Field | Value |
| --- | --- |
| Database | local `trooi_test` for reset tests, `trooi_dev` for the runtime access server. They are separate databases on port 5432. |
| Device | emulator `emulator-5554`, `sdk_gphone64_x86_64`, Android 14 / API 34, GMS 26.34.36. Not a physical device. |
| Maps / Google sign-in / MoMo | UNVERIFIED. Maps key is blank. No interactive Google account. No sandbox payment or public IPN. Maestro is not installed. |

| Command | Result |
| --- | --- |
| `pnpm exec tsx tests/e2e/v1-integration-runtime.ts` | exit 0. Persisted HTTP checkout and trust passed. Then 4 persistence tests passed. Live Google/MoMo were not claimed. |
| payment-gateway concurrency, finance guards, finance concurrency | exit 0. 5 passed. |
| `pnpm test:persistence:migration` | exit 0. 7 passed. |
| `pnpm test:conformance:database-v1` | exit 0. 57 passed. |
| `pnpm exec tsx --test tests/audit/low-level-architecture/runtime.access.test.ts tests/verification/openapi-client-contract.test.ts` | exit 0. 7 passed. |
| `pnpm e2e:coverage` | exit 0. 85 flows, 202 cases. |
| `pnpm test` | exit 0. 336 passed, 0 failed. |
| `:app:connectedBackendDebugAndroidTest` | exit 0. 5/5 on the emulator, 0 skipped, 0 failed. |
| `:app:lintDebug` | exit 0. |
| `adb shell am force-stop` then `monkey -p com.trooi.app.backenddev 1` | exit 0. One event injected. Not a sign-in. |
| `:app:testDebugUnitTest` | exit 1. The Gradle test worker could not execute the test classes, including existing classes. This is not recorded as a product PASS. |

Still OPEN: Claim, Review, Inquiry history, anonymous reports, moderation, geocoder, and deposit-requirement changes. No POV checklist row is ticked. Google sign-in, native map tiles, Maestro, and MoMo sandbox remain UNVERIFIED, so READY_TO_MERGE stays NO.
