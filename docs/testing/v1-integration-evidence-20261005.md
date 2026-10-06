# V1 integration evidence — 2026-10-06

READY_TO_MERGE: NO

This file describes the tree at `65606e4` (`docs(test): record executable v1 device and sandbox scenarios`). The evidence commit that adds this revision is docs-only and is not itself a new implementation HEAD.

| Field | Value |
| --- | --- |
| Implementation HEAD | `65606e4` |
| Prior intent commits | `22564dc` trust submission, `6b019c5` Android report/deposit/shared surfaces, `7cfde23` HTTP runtime |
| Variant | backendDebug assemble succeeded earlier the same day. This recheck did not rebuild the APK. |
| Device / Google / Maps / MoMo | UNVERIFIED. SDK `adb devices -l` listed no devices. |
| TEST_DATABASE_URL | unset. `DATABASE_URL` unset. |

Commands run against `65606e4` or the runtime commit immediately before the runbook commit:

| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm build` | exit 0 |
| `pnpm e2e:coverage` | exit 0, 85 flows, 202 cases |
| `pnpm exec tsx --test tests/verification/openapi-client-contract.test.ts` | 3 passed |
| `node --import tsx tests/e2e/v1-integration-runtime.ts` | exit 1. `TEST_DATABASE_URL` must target `trooi_test`. Live Google/MoMo are not claimed. |
| `pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/trust-submission.integration.ts` | exit 1. Both tests fail at `assert.ok(url)` because the URL is unset. |
| `tests/audit/low-level-architecture/runtime.access.test.ts` | not run. `DATABASE_URL` is unset. |
| SDK `adb devices -l` | daemon started, no devices attached |
| `:app:testDebugUnitTest` | not a product PASS. The Gradle test worker previously failed to load test classes, including an existing test class. |
| `:app:connectedBackendDebugAndroidTest` | not run. No device. |

Still OPEN: Claim, Review, Inquiry history, anonymous reports, moderation, geocoder, and deposit-requirement changes. No row in the POV checklist is ticked from this file.
