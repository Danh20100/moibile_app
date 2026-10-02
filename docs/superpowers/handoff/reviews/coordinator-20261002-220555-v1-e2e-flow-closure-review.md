---
review_of: docs/superpowers/handoff/duyanh-20261002-190219-v1-e2e-flow-closure.md
reviewer: coordinator
reviewed_sha: e1027443220ecc8b7e4a0ec7a3b662dbdbd94321
status: changes-requested
---

# Independent Review — V1 E2E Flow Closure

**Reviewer:** Integration / coordinator audi
**Date:** 2026-10-02
**Branch:** `backend/v1-e2e-flow-closure`
**Current reviewed branch head:** `e1027443220ecc8b7e4a0ec7a3b662dbdbd94321`
**Implementation candidate documented by Duy Anh:** `2cb65ef2f71b221bf560dcd007d5c5c86cac6bb0`
**Previous reviewed implementation:** `1988cb82b3f8317b53982e614ba94918ec9b0b1b`

## Reviewer verdic

```tex
READY_TO_MERGE: NO
```

Duy Anh has already corrected several issues from the first audit: the report now distinguishes static coverage from executable Android flows, keeps `READY_TO_MERGE: NO`, classifies CX-01..CX-06 as in-memory service tests, and exposes Compose test tags as Android resource IDs. Those are good corrections.

Two important blockers remain in the latest branch: (1) DISC-02 is still not stable across five consecutive runs on the coordinator Windows host because Maestro session/device startup fails intermittently, and (2) the shared cross-actor fixture still constructs an impossible V1 state (`PUBLISHED Listing + OCCUPIED Room + ACTIVE Tenancy`). The earlier cold-start `pnpm test` failure also has no code-level fix yet.

---

## 1. Resolved / improved since the initial audi

### 1.1 DISC-02 selector exposure was fixed

`2cb65ef` adds:

```kotlin
Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }
```

at the app scaffold, while the Listing card keeps:

```kotlin
.testTag("public-listing-card")
```

This fixes the original selector problem. In the independent follow-up audit, successful runs now resolve:

```tex
id: v1-discovery-lis
id: public-listing-card
```

and can tap the Listing card and complete all Listing Detail assertions.

### 1.2 Flow accounting is now materially more accurate

The report no longer claims all 198 cases are Android-executable. It now distinguishes the two current Maestro flows from spec/unit/conformance cases and keeps Google/Open-policy blockers visible.

### 1.3 Cross-actor evidence is now labeled correctly

The report now explicitly says CX-01..CX-06 are proven by `tests/core/cross-actor.behavior.test.ts` using the in-memory TransactionManager and are **not** authenticated Android multi-actor E2E.

### 1.4 Merge status is correctly NO

The latest report keeps:

```tex
READY_TO_MERGE: NO
```

because authenticated cross-actor Android execution and other Phase C work remain blocked.

---

## 2. BLOCKER — DISC-02 is still flaky on the coordinator hos

After the `testTagsAsResourceId` and relaunch/wait fixes were pushed, the latest reviewed APK was rebuilt and installed on Pixel_8 / Android 16.

Independent command:

```powershell
pnpm e2e:flow DISC-02
```

executed five consecutive times.

### Latest independent resul

```tex
Runs: 5
Pass: 2
Fail: 3

LATEST_AUDIT_SUMMARY pass=2 fail=3
```

Runs 4 and 5 completed the full flow:

```tex
Launch app
-> wait id: v1-discovery-lis
-> find id: public-listing-card
-> tap Listing card
-> Listing Detail assertions
-> API assertions
-> PostgreSQL assertions
-> invariants
-> PASS
```

So the **selector fix itself works**.

The failed runs now fail earlier at Maestro/ADB session startup rather than at the Listing selector.

Observed errors include:

```tex
Failed to record heartbea
The process cannot access the file because another process has locked a portion of the file

Command failed (host:transport:emulator-5554): device offline

java.io.EOFException
at dadb.AdbShellStream.read
at maestro.android.AndroidDeviceConnection$DadbInstrumentationSession.startedSuccessfully
```

The current runner increases the Windows delay from 750 ms to 3000 ms, but that is not sufficient on the coordinator host.

### Important environment delta

Duy Anh's report records a passing 5/5 series under a different Java/Android environment. The coordinator host audit uses:

```tex
Maestro 2.11.0
Android Studio JBR / Java 25.0.3
Pixel_8
Android 16
```

while Duy Anh's report records JBR 21 and a different emulator API level. This may indicate environment sensitivity, but the current evidence is not enough to assign root cause to Java or the emulator.

### Required action

Do not revert the resource-id fix; it is useful. Instead stabilize Maestro session/device startup:

- reproduce the failure from consecutive fresh Maestro invocations;
- capture the Maestro heartbeat/file-lock and ADB device-state transitions;
- verify whether the failure reproduces under JBR 21 vs JBR 25 before pinning a runtime;
- ensure `adb get-state` / boot readiness is valid immediately before starting Maestro instrumentation;
- ensure stale Maestro host/device instrumentation processes are fully gone before the next JVM/session;
- if the runner retries infrastructure setup, make retries explicit and bounded so real app failures are not hidden.

### Acceptance gate

On the supported Windows environment, run:

```tex
DISC-02 five consecutive times
```

and obtain:

```tex
5 PASS
0 FAIL
```

with no `device offline`, instrumentation EOF, or session file-lock failure.

---

## 3. BLOCKER — CX shared fixture still violates frozen V1 state

The latest branch does not change `tests/core/cross-actor.behavior.test.ts::setupRentalHierarchy()`.

It still directly creates:

```tex
Room.operationalState = OCCUPIED
Listing.status = PUBLISHED
Tenancy.status = ACTIVE
```

and the latest report still records CX-01 as:

```tex
Listing published
Room OCCUPIED
pre-existing ACTIVE tenancy unchanged
```

That is not a valid V1 state.

Frozen publication invariant:

```tex
Listing = PUBLISHED
=> Room = VACANT
=> Room lifecycle = ACTIVE
=> Property lifecycle = ACTIVE
```

Once rental activation changes the Room to `OCCUPIED`, the current public Listing must synchronously leave `PUBLISHED`.

The repository-level fixture bypasses the authoritative lifecycle workflow, so a test can become green against a state that production logic must reject.

### Required fix

Split fixtures by scenario.

**Discovery / Inquiry / CX-01:**

```tex
Property ACTIVE
Room ACTIVE + VACANT
Listing PUBLISHED
No ACTIVE tenancy on that Room
```

**Rental / Incident / Billing / Notice / Move-out / CX-02..CX-05:**

```tex
Property ACTIVE
Room ACTIVE + OCCUPIED
Tenancy ACTIVE or the required lifecycle state
Listing != PUBLISHED
```

Prefer authoritative services/lifecycle transitions when practical instead of directly inserting impossible combinations.

Add a regression assertion that the shared test fixtures never treat:

```tex
PUBLISHED Listing + OCCUPIED Room
```

as a valid current state.

Until this is fixed, CX-01's service-level invariant evidence is not trustworthy even though the Notification side effect itself is useful.

---

## 4. OPEN ITEM — cold-start `pnpm test` nondeterminism remains unaddressed

Earlier independent cold run on the same implementation line produced:

```tex
279 discovered
275 pass
4 cancelled
exit 1
```

because the runtime HTTP access audit did not see the spawned server become ready within its 15-second readiness window.

An immediate warm rerun produced:

```tex
279 pass
0 fail
0 cancelled
exit 0
```

No commit after that finding changes the runtime access test/readiness logic, so the cold-start issue should not be considered resolved solely because a later run is green.

### Required action

- reproduce from a genuinely cold process/environment;
- capture child stdout/stderr and startup timings;
- identify whether the cause is process startup, database readiness, port/session state, or timeout sensitivity;
- make the readiness gate deterministic without masking actual startup failures;
- document repeated cold-run evidence in the final report.

---

## 5. Correct evidence classification to preserve

The latest report is much better here. Keep the following distinction in all subsequent reports:

```tex
83 flows / 198 cases
= static/spec coverage inventory

DISC-01 / DISC-02
= current Android/Maestro executable flows

CX-01..CX-06
= in-memory service/business behavior tests unless/until real HTTP/PostgreSQL/multi-actor UI is added

AUTH / INQ authenticated / PORTAL / DASH
= require real Google session

OPEN-policy cases
= blocked, not passed
```

Do not collapse these into a single "198 passed" number.

---

## 6. Phase C / full-stack cross-actor requirement remains

For a cross-actor flow to be called full E2E, evidence still needs:

```tex
Actor A Android action
-> authenticated HTTP reques
-> NestJS authorization
-> real PostgreSQL source fac
-> Notification row / delivery projection
-> Actor B authenticated read
-> source feature opens
-> invariant checks
```

The current CX tests prove useful service semantics but not this entire chain.

If real Google configuration is unavailable, keep these flows explicitly blocked and do not bypass AuthGuard.

---

## 7. Environment/report metadata

The report should continue to record the environment that actually produced each result. If Duy Anh's 5/5 DISC-02 run is on JBR 21/API 34 and the coordinator host is JBR 25/Android 16, keep both environments explicit rather than assuming the result is portable.

For the final merge candidate, record:

- tested implementation SHA;
- report commit SHA separately if the report is committed afterward;
- exact Maestro version;
- exact Java major used by Maestro;
- AVD/API;
- Docker/backend image SHA or rebuild status;
- Google client/session availability.

---

## 8. Required rework checklis

- [x] Expose Compose test tags as Android resource IDs.
- [x] Correct report from `READY_TO_MERGE: YES` to `NO`.
- [x] Stop claiming all 198 cases are live E2E.
- [x] Label CX-01..CX-06 as in-memory service tests.
- [ ] Stabilize Maestro session startup across 5 consecutive runs on the supported Windows environment.
- [ ] Fix invalid `PUBLISHED + OCCUPIED + ACTIVE tenancy` CX fixture.
- [ ] Re-run CX service tests after fixture correction.
- [ ] Resolve or formally reproduce/document cold-start `pnpm test` nondeterminism.
- [ ] Rebuild backend container to candidate HEAD before claiming notification HTTP evidence.
- [ ] Configure real Google Web Client ID/session for Phase C, without bypassing AuthGuard.
- [ ] Run authenticated cross-actor flows where currently required.
- [ ] Regenerate report against the final tested implementation SHA.

---

## 9. Mandatory final gates

At the final candidate:

```powershell
pnpm e2e:coverage
pnpm typecheck
pnpm tes
pnpm test:conformance:database-v1
pnpm build
git diff --check
pnpm e2e:flow DISC-01
pnpm e2e:flow DISC-02
```

Additionally:

```tex
DISC-02: 5 consecutive live runs
Cross-actor service tests: rerun after valid fixture spli
Backend Docker image: rebuilt to candidate HEAD for HTTP evidence
Phase C: real Google-authenticated execution where required
```

---

## 10. Frozen boundaries — do not change these to make tests green

- `USER != TENANCY_PARTICIPANT`
- no global LANDLORD/TENANT role
- `Inquiry != Booking`
- Search/Map only expose PUBLISHED Listings
- PUBLISHED Listing requires VACANT Room
- no direct `ACTIVE -> ENDED`
- Notification is delivery/read-layer state, not business source of truth
- exact Notification channel remains OPEN
- OPEN stays OPEN
- FUTURE stays FUTURE
- no migration-history rewrite

---

## Current independent status

```tex
Static V1 coverage: PASS
Typecheck: PASS
Android latest build/install: PASS
DISC-02 selector/resource-id fix: VERIFIED WORKING when Maestro session starts
DISC-02 latest independent consecutive run: 2 PASS / 3 FAIL
Failure class: Maestro/ADB session startup (file-lock, device offline, instrumentation EOF)
CX in-memory Notification behavior: useful, but CX-01 fixture invalid
Cold-start full test gate: previously reproduced nondeterministic; no fix ye
Authenticated Phase C: NOT RUN
READY_TO_MERGE: NO
```

After Duy Anh pushes the next rework commit, run another independent audit against that exact SHA before changing the merge decision.
