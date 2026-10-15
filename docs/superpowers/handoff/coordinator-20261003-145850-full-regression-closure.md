# Handoff — Full Regression Closure

## Metadata

- Owner: `coordinator`
- Date: `2026-10-03`
- Repository: `D:\Projects\TroOi-Project`
- Base staging branch: `integration/full-stack-sync-runtime-staging`
- Base staging SHA: `37e826cc50c04b7509958b822393b425aec6ae1c`
- Test branch: `test/full-regression-closure`
- Test-isolation fix commit: `98bc82eafdf3c94c8bea2e272191f78c4e36861f`
- `main` was not modified.

## Scope

This pass performs broad regression verification of the currently integrated TrọƠi V1 stack:

- NestJS/backend contracts and domain tests;
- Database v1 conformance and PostgreSQL/PostGIS integration;
- marketing web checks and real Chrome smoke;
- Android unit/build/lint/release build;
- Android instrumentation on Pixel 8 emulator;
- backend-backed Android Maestro discovery/detail flows against an isolated local test database;
- test-infrastructure sequencing/isolation.

Explicitly out of scope:

- Duy Anh's in-progress MoMo/deep-link payment implementation that has not yet been integrated into staging;
- live Google identity verification requiring a fresh `GOOGLE_ID_TOKEN`;
- declaring static E2E catalog coverage as equivalent to executable Android E2E.

---

## Backend verification

PASS:

```text
pnpm typecheck
pnpm lint
pnpm openapi:generate
pnpm e2e:coverage
pnpm test
pnpm test:conformance:database-v1
pnpm build
git diff --check
```

Observed counts:

```text
default backend tests:      284 / 284 PASS
Database v1 conformance:     57 / 57 PASS
static E2E catalog:          83 atomic flows
static E2E cases:           198 cases
V1 backlog files:            24
frozen Notification cases:    8
```

### Formatting hygiene

`pnpm format:check` was added as an extra hygiene probe and FAILED before any test-fix change.

Prettier reported style drift in 76 `src/**/*.ts` files.

This was not part of the previously frozen mandatory integration gate, and mass-formatting was intentionally not performed because it would create a large unrelated diff.

Status:

```text
FUNCTIONAL/CONTRACT GATE: PASS
PRETTIER HYGIENE:        FAIL (pre-existing broad formatting debt)
```

---

## Database integration verification

Safety check confirmed:

```text
TEST_DATABASE_URL -> localhost:5433/trooi_test
DATABASE_URL      -> localhost:5433/trooi_dev
```

The integration tests were run only against `trooi_test`.

Results:

```text
migration parity / frozen physical catalog: 1 / 1 PASS
PostGIS public Listing search:               1 / 1 PASS
```

PostGIS verifies:

- PUBLISHED-only public search;
- public projection coordinates;
- radius filtering;
- exact price-range filtering;
- expected published-location index usage;
- invalid negative radius rejection.

---

## Test infrastructure defect found and fixed

### Reproduction

Running:

```text
PostGIS integration test
-> E2E reset
```

initially failed with:

```text
update or delete on table "users" violates foreign key constraint
"fk_organizations_primary_owner_user" on table "organizations"
```

Root cause:

- PostGIS integration used the same User ID as the discovery E2E fixture;
- it also left fixture rows behind;
- E2E reset correctly deletes only its own fixture Organization before trying to delete its fixture User;
- the unrelated PostGIS Organization still referenced that User, creating order-dependent test contamination.

Fix commit:

```text
98bc82e test(e2e): isolate postgis fixture cleanup
```

Fix:

- PostGIS fixture now uses a separate test User ID namespace;
- PostGIS fixture rows are deleted in dependency-safe reverse order in `finally`.

Post-fix sequence was explicitly verified:

```text
clean/migrate trooi_test
-> PostGIS integration PASS
-> E2E reset PASS
-> E2E seed PASS
-> E2E cleanup PASS

TEST_ISOLATION=PASS
```

---

## Marketing web verification

Commands:

```text
web: pnpm check
web: pnpm test
web: pnpm test:browser
```

Results:

```text
JavaScript syntax check: PASS
web tests:               9 / 9 PASS
HTTP marketing /:        PASS
HTTP /login:             PASS
HTTP /tenant:            PASS
HTTP /landlord:          PASS
real headless Chrome:    PASS
```

The browser smoke used installed Google Chrome, not HTTP-only fallback.

---

## Android verification

Environment:

```text
Android Studio JBR: D:\Program Files\Android\Android Studio\jbr
AVD: Pixel_8
API/device runtime: Android 16 emulator
```

### Unit/build/lint

PASS:

```text
:app:testDebugUnitTest
:app:lintDebug
:app:lintBackendDebug
:app:assembleDebug
:app:assembleBackendDebug
:app:bundleRelease
```

Unit result:

```text
34 tests
0 failures
0 errors
0 skipped
```

Notes:

- `testBackendDebugUnitTest` does not exist for the current Gradle variant setup. An initial attempt to invoke it failed at task discovery; this is not an application/test failure.
- release compilation emits existing deprecation warnings for `Icons.Rounded.ArrowBack` and old `hiltViewModel` package usage;
- release packaging reports `libandroidx.graphics.path.so` cannot be stripped and is packaged as-is;
- none of those warnings failed lint/build.

### Instrumentation

Executed:

```text
:app:connectedDebugAndroidTest
```

Result:

```text
Pixel_8: 6 / 6 tests PASS
0 failed
0 skipped
```

---

## Real backend-backed Android E2E

To avoid interfering with the normal dev database or the existing port-3000 Docker backend, this pass used:

```text
fresh NestJS runtime from current source
port: 3001
database: trooi_test
Android backendDebug API URL: http://10.0.2.2:3001/
appId: com.trooi.app.backenddev
Pixel_8 emulator
Maestro
```

Backend health on port 3001 returned HTTP 200.

### DISC-01

```text
reset fixture
seed deterministic PUBLISHED Listing
launch real backendDebug Android app
find 'Phong E2E - Thu Duc'
API + PostgreSQL invariant assertions

RESULT: PASS
```

### DISC-02

```text
reset fixture
seed deterministic PUBLISHED Listing
launch real backendDebug Android app
wait for v1-discovery-list
open exact Listing by stable semantic ID
verify public detail/price/contact UI
verify synthetic operational address is NOT visible
API + PostgreSQL invariant assertions

RESULT: PASS
```

Both flows verify the backend API and PostgreSQL source facts after Android execution.

These are the only currently executable Maestro flow IDs in `tests/e2e/run-flow.ts`; the 83/198 catalog is broader static coverage and must not be reported as 83 live Android flows.

---

## Google authentication live gate

Environment key check:

```text
GOOGLE_CLIENT_ID: present
GOOGLE_ID_TOKEN:  missing
```

Therefore `pnpm test:google:live` was NOT claimed as passed.

Authenticated cross-actor device E2E requiring a real Google token/account remains an external credential gate.

No AuthGuard bypass or fabricated token was introduced.

---

## Payment/MoMo note

Duy Anh is currently implementing the new user-described payment flow separately, including external MoMo handoff/deep-link behavior and transfer-identification message/reference semantics.

This regression pass deliberately does NOT freeze, alter, or claim coverage for that in-progress implementation.

Existing frozen Payment/Billing/Receipt/Deposit domain tests remain green, but that does not constitute validation of the new MoMo UX/integration.

Re-test the MoMo feature separately after Duy Anh hands off a reviewed branch.

---

## Environment cleanup

After runtime E2E:

- isolated port-3001 backend was stopped;
- Pixel_8 emulator was shut down;
- port 3001 confirmed free;
- Git working tree was clean before creating the test-isolation fix;
- no dev database reset was performed by this pass.

---

## Current assessment

```text
Backend functional/contracts:      GREEN
Database conformance:              GREEN
Database integration:              GREEN
Web:                               GREEN
Android unit/build/lint:           GREEN
Android instrumentation:           GREEN
Executable public Android E2E:     GREEN (DISC-01, DISC-02)
Authenticated Google live E2E:     BLOCKED_BY_CREDENTIAL
MoMo payment integration:          OUT_OF_SCOPE_IN_PROGRESS
Prettier format hygiene:           PRE_EXISTING_DEBT
Test-order isolation defect:       FIXED_ON_TEST_BRANCH
```

## Next action

1. Review the single test-infrastructure fix on `test/full-regression-closure`.
2. If approved, merge that small fix into staging.
3. Continue Khánh Băng Android backend-contract wiring from current staging.
4. When Duy Anh finishes the MoMo payment branch, review/integrate it separately and add dedicated payment deep-link/reference E2E.
5. Run authenticated Google multi-actor device E2E when a legitimate live credential/session is available.

Do not mass-format the 76 source files as part of the test-isolation patch.
