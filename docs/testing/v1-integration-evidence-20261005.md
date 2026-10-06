# V1 integration evidence — 2026-10-06

READY_TO_MERGE: NO

This file describes implementation HEAD `1bc1683`. The docs commits that add this revision are not a new implementation HEAD.

Backend commands below ran on `78700aa`, before the Android-only guest-discovery fix. Receipt: `C:\Users\ROG\AppData\Local\Temp\trooi-v1-final-gates-20261006.txt`. Working tree at that time had only the local unstaged `gradle.properties` path check.

| Field | Value |
| --- | --- |
| Database | local `trooi_test` for reset tests, `trooi_dev` for the runtime access server. Separate databases on port 5432. |
| Device | emulator `emulator-5554`, `sdk_gphone64_x86_64`, Android 14 / API 34, GMS 26.34.36. Not a physical device. |
| Maps | Tiles and one zoom observed. Pan, permission denial, marker to listing, and the on-device picker were not run. |
| Google sign-in | UNVERIFIED. No web client id. |
| MoMo | Create response had no signature, so verification failed. Wallet return, replay, and dashboard were not run. Public IPN tunnel health was 200 during the run. |

| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0. |
| `pnpm lint` | exit 0. |
| `pnpm build` | exit 0. |
| `pnpm test:conformance:database-v1` | exit 0. 57 tests. |
| `pnpm test` | exit 0. 336 passed, 0 failed. |
| `pnpm test:persistence:migration` | exit 0. 7 passed. |
| payment-gateway, payment-gateway concurrency, trust-submission | exit 0. 7 passed. |
| finance guards and finance concurrency | exit 0. 2 passed. |
| `pnpm exec tsx tests/e2e/v1-integration-runtime.ts` | exit 0. Persisted HTTP checkout and trust passed, then 4 persistence tests. Live Google/MoMo were not claimed. |
| `pnpm e2e:coverage` | exit 0. 85 flows, 202 cases. |
| `:app:connectedBackendDebugAndroidTest` | exit 0. 4 passed, 1 skipped, 0 failed. The skip is the blank-key map test. |
| `maestro test tests/e2e/maestro/v1-integration-navigation.yaml` | exit 0. |
| `:app:assembleBackendDebug` | completed. The combined Gradle command still exited 1 because unit tests failed. |
| `:app:lintDebug` | completed. Same combined exit 1. |
| `:app:testDebugUnitTest` | exit 1. The Gradle test worker could not execute the test classes, including existing classes. Not a product PASS. |
| `:app:testBackendDebugUnitTest` | task does not exist. |
| `adb shell am force-stop` then `monkey -p com.trooi.app.backenddev 1` | exit 0. One event injected. Not a sign-in. |
| MoMo sandbox create | HTTP 200, `resultCode` 0, no `signature`. Client `MomoVerificationError`. Not a payment PASS. |

Still OPEN: Claim, Review, Inquiry history, anonymous reports, moderation, geocoder, and deposit-requirement changes. No POV checklist row is ticked.

READY_TO_MERGE stays NO until Google sign-in, a signed MoMo sandbox payment (return, replay, one Payment, no allocation/deposit/receipt), and the remaining map gestures are actually verified.
