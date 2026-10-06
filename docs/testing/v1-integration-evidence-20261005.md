# V1 integration evidence — 2026-10-06

READY_TO_MERGE: NO

| Field | Value |
| --- | --- |
| SHA | uncommitted working tree; do not treat a later commit as this run |
| Variant | `:app:compileDebugUnitTestKotlin` and `:app:assembleBackendDebug` passed on 2026-10-06 |
| Device / Google / Maps / MoMo | UNVERIFIED. SDK `adb devices -l` listed no devices |
| TEST_DATABASE_URL | missing. `node --import tsx tests/e2e/v1-integration-runtime.ts` exited 1 and did not claim live Google or MoMo |

Automated checks from this session:

- `SharedSurfaceNavigationTest`: 3 passed via JUnit 4.13.2 on the unit-test classpath.
- Deposit application unit tests: 3 passed via JUnit on the unit-test classpath.
- Finance behavior tests: 8 passed.
- Listing-report unit tests: 6 passed via JUnit.
- OpenAPI alignment tests: 6 passed via JUnit.
- `pnpm e2e:coverage`: passed, 85 atomic flows and 202 cases, including GW-01 and TR-01.
- `pnpm exec tsx --test tests/verification/openapi-client-contract.test.ts`: 3 passed.
- `tests/audit/low-level-architecture/runtime.access.test.ts`: not run. `DATABASE_URL` is unset.
- `pnpm openapi:generate`: passed earlier. Snapshot uses `SubmitTrustReportDto` and no client `reporterUserId`.
- Gradle `:app:testDebugUnitTest` worker: failed earlier to load test classes, including an existing test class. Direct JUnit is the run recorded here. That worker failure is not a product PASS.

Still OPEN: Claim, Review, Inquiry history, anonymous reports, moderation, geocoder, and deposit-requirement changes. No row in the POV checklist was ticked from this note.
