# V1 E2E Flow Closure Report

> Replace every placeholder. Do not delete failed/blocked sections to make the report look green.

## 1. Executive status

- **Owner:** Duy Anh
- **Date:** 2026-10-02
- **Branch:** `backend/v1-e2e-flow-closure`
- **Final SHA:** `568fd716769bfaae2f133e4a3af652eea6033a70`
- **Base/Staging SHA consumed:** `97a3897a3cd64da4fe0c5fb3baadcdc50101a8f6`
- **Canonical/authority version:** Canonical Freeze v3.7 at `101e8a35b6f8951b846224f4aaa3d3d555f2ba54`
- **OpenAPI/contract SHA:** `1988cb82b3f8317b53982e614ba94918ec9b0b1b` (`docs/api/openapi.json`)
- **READY_TO_MERGE:** **NO**

### Verdict

Rework of the three reviewed blockers is in `568fd71`. DISC-01 PASS; DISC-02 5/5 after ADB recover + no Maestro instrumentation force-stop (`testTagsAsResourceId` unchanged). CX fixtures are V1-legal (PUBLISHED+VACANT vs UNPUBLISHED+OCCUPIED+ACTIVE). `pnpm test` 279/279 twice with `DATABASE_URL` unset in the shell. READY_TO_MERGE stays NO until an independent audit of this exact SHA.

## 2. Environment

| Item                | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| OS                  | Windows 11 (10.0.26200)                                               |
| Node                | v24.16.0                                                              |
| pnpm                | 12.8.1                                                                |
| Java/JBR            | Android Studio JBR OpenJDK 21.0.10 (`C:\Program Files\Android\Android Studio\jbr`) |
| Maestro             | 2.11.0 (`%USERPROFILE%\maestro\maestro\bin\maestro.bat`)              |
| Android Studio      | JBR from `C:\Program Files\Android\Android Studio`                    |
| Emulator            | Pixel_8 / API 34 / x86_64 / `emulator-5554` (`sdk_gphone64_x86_64`) |
| Docker              | 29.8.0                                                                |
| PostgreSQL/PostGIS  | `postgis/postgis:16-3.4`                                              |
| Backend URL         | `http://127.0.0.1:3000`                                               |
| Android backend URL | `http://10.0.2.2:3000/`                                               |
| Database            | `postgresql://trooi:***@localhost:5432/trooi_dev` (port 5432)         |

`docker compose ps` at gate time: `backend` healthy on 3000, `postgres` healthy on 5432, `web` up on 4173. Backend container image was created ~10 hours before HEAD; DISC-01/02 only exercise public Listing read.

## 3. Scope completed

### Feature groups touched

- [x] Identity / Access (unit/conformance only this session)
- [x] Discovery / Inquiry (DISC-01/02 executable; Inquiry write not Android-executable)
- [ ] Organization / Property / Room (not re-implemented this session)
- [ ] Listing (lifecycle already present; not newly executable)
- [x] Tenancy / Participants / Terms / Ack (CX-04/05 service tests)
- [x] Rental lifecycle / Move-out (CX-05 service tests)
- [x] Billing / Payment / Claim / Deposit / Receipt (CX-03 service tests)
- [x] Incident / Notice (CX-02/04 service tests)
- [ ] Portal / History / Dashboard (not newly executable)
- [x] Notification (service + CX tests; channels remain OPEN)
- [x] Review / Trust Report (CX-06 service test; moderation policy OPEN)

This session’s rework: Maestro/ADB runner (`25f7a71`), CX V1 fixtures (`1db741d`), cold-start `pnpm test` (`568fd71`). `testTagsAsResourceId` unchanged.

### Explicitly out of scope

- Notification channels (push/email/SMS/Zalo): Canonical **OPEN**.
- Authenticated Android Inquiry / AUTH / Portal / Dashboard: `requires_real_google_session`; `GOOGLE_CLIENT_ID` empty.
- OTA reservation / instant booking: **FUTURE**.
- Coordinator local WIP: `gradle.properties`, `gradle/gradle-daemon-jvm.properties` (not present / not committed).

## 4. Coverage accounting

```powershell
pnpm e2e:coverage
```

Output:

```text
V1 E2E coverage PASS: 83 atomic flows, 198 cases, 24 backlog files, 8 frozen notification use cases.
Case files: discovery-contact.yaml, finance.yaml, identity-access.yaml, notifications.yaml, operations.yaml, operator-inventory.yaml, read-models-trust.yaml, rental-lifecycle.yaml
```

| Metric                        | Expected | Actual |
| ----------------------------- | -------: | -----: |
| Atomic flows                  |       83 |     83 |
| Test cases                    |      198 |    198 |
| V1 backlog files represented  |       24 |     24 |
| Frozen Notification use cases |        8 |      8 |

### Status by feature group

Counts are case-file totals. **Executable** means Maestro/`pnpm e2e:flow` in this run. Other cases remain spec/unit/conformance, not Android-executed.

| Feature group        | Cases | Executable | Passed | Failed | Blocked | Notes |
| -------------------- | ----: | ---------: | -----: | -----: | ------: | ----- |
| Identity / Access    |    12 |          0 |      0 |      0 |      12 | AUTH-* need real Google session |
| Discovery / Inquiry  |    25 |          2 |      2 |      0 |      14 | DISC-01/02 Maestro GREEN; DISC-03 OPEN; INQ-* need Google |
| Operator / Inventory |    40 |          0 |      0 |      0 |       0 | spec + existing unit/conformance; not Maestro |
| Rental               |    35 |          0 |      0 |      0 |       1 | PART-05 OPEN; CX-05 service PASS |
| Finance              |    36 |          0 |      0 |      0 |       2 | CLAIM-01/02 OPEN; CX-03 service PASS |
| Operations           |    17 |          0 |      0 |      0 |       0 | CX-02/04 service PASS; not Maestro |
| Read / Trust         |    17 |          0 |      0 |      0 |       7 | REVIEW/TRUST OPEN; PORTAL/DASH need Google |
| Notifications        |    16 |          0 |      0 |      0 |       1 | NOTIF-04 OPEN; 8 frozen events covered in YAML + CX unit tests |

## 5. Mandatory gate results

| Gate                     | Command                             | Exit | Result    | Evidence |
| ------------------------ | ----------------------------------- | ---: | --------- | -------- |
| Coverage                 | `pnpm e2e:coverage`                 |    0 | PASS      | 83/198/24/8 |
| Typecheck                | `pnpm typecheck`                    |    0 | PASS      | `tsc --noEmit` both projects |
| Full tests               | `pnpm test` (DATABASE_URL unset) x2 |    0 | PASS      | 279/279 then 279/279 |
| DB conformance           | `pnpm test:conformance:database-v1` |    0 | PASS      | 57 tests, 0 fail |
| Build                    | `pnpm build`                        |    0 | PASS      | `nest build` |
| Diff hygiene             | `git diff --check`                  |    0 | PASS      | no whitespace errors |
| DISC-01                  | `pnpm e2e:flow DISC-01`             |    0 | PASS      | Maestro + `tests/e2e/assertions/discovery.ts` |
| DISC-02                  | `pnpm e2e:flow DISC-02` x5          |    0 | PASS      | 5/5 after ADB/Maestro harden (`25f7a71`) |
| Android assemble         | `gradlew :app:assembleBackendDebug -Pandroid.overridePathCheck=true -PtrooiApiBaseUrl=http://10.0.2.2:3000/` with JBR |    0 | PASS | installed on `emulator-5554` |

`android.overridePathCheck` was passed on the Gradle CLI only. `gradle.properties` was not edited.

## 6. Flow evidence

### DISC-01 — Public Listing Feed

**Preconditions**

```text
pnpm e2e:flow DISC-01 reset+seed
listing_id: 10000000-0000-4000-8000-000000000005
room_id: 10000000-0000-4000-8000-000000000004
status: PUBLISHED
public_title: Phong E2E - Thu Duc
public_price_projection: 3500000.00
backendDebug installed; Pixel_8 online
```

**User/UI path**

```text
Anonymous Searcher
→ launch com.trooi.app.backenddev clearState
→ assertVisible "Tìm phòng"
→ scrollUntilVisible "Phong E2E - Thu Duc"
→ assertVisible "Phong E2E - Thu Duc"
Maestro: all COMPLETED
```

**HTTP evidence**

```text
GET http://127.0.0.1:3000/api/v1/listings/public
status: 200
envelope.success: true
data contains id 10000000-0000-4000-8000-000000000005
status: published
publicTitle: Phong E2E - Thu Duc
publicPriceProjection: 3500000.00
publicLocationProjection: { longitude: 106.751, latitude: 10.851 }
operationalAddressText absent
```

**Database evidence**

```text
listings.listing_id = 10000000-0000-4000-8000-000000000005
status: PUBLISHED
listing_status_events count: 1, to_status PUBLISHED
inquiries for listing: 0
```

**Invariant evidence**

```text
public projection does not expose operationalAddressText
Discovery/detail flow creates no Inquiry
```

**Result:** PASS

### DISC-02 — Listing Detail

**Preconditions**

```text
Same seed as DISC-01
backendDebug rebuilt after testTagsAsResourceId
Maestro listing-detail.yaml: relaunch after clearState; wait id v1-discovery-list; tap id public-listing-card
```

**User/UI path**

```text
Searcher
→ launchApp clearState
→ launchApp stopApp (recover blank first frame after pm clear)
→ wait id: v1-discovery-list
→ scrollUntilVisible id: public-listing-card
→ tapOn id: public-listing-card
→ visible: Thông tin công khai, Giá đề xuất của tin đăng, 3500000.00, Liên hệ về tin đăng, Đăng nhập để liên hệ
→ not visible: Synthetic E2E address - not a real rental property
```

**HTTP evidence**

```text
Same GET /api/v1/listings/public assertion script as DISC-01
status: 200
```

**Database evidence**

```text
Same PostgreSQL assertions as DISC-01
inquiries for listing remain 0 (guest did not submit Inquiry)
```

**Invariant evidence**

```text
No operational address text on detail
No Inquiry / Tenancy / Room mutation from guest detail view
No booking/instant-reservation controls asserted via "Đăng nhập để liên hệ" (unauthenticated)
```

**Result:** PASS (5 consecutive runs, EXIT=0 each)

DISC-02 cases **not** in the Maestro file (not claimed GREEN): DISC-02-H02 back-navigation, DISC-02-S01 listing became non-public.

## 7. Cross-actor evidence

Proven by `tests/core/cross-actor.behavior.test.ts` inside `pnpm test` (in-memory TransactionManager). Not proven as Android multi-actor E2E.

### CX-01 — Searcher → Inquiry → Operator

- Inquiry persisted: PASS (service)
- Correct operator recipient resolved: PASS (`primaryOwnerUserId`)
- Notification created after source event: PASS (`NEW_INQUIRY`, `inquiry:${id}`)
- Notification source reference opens same Inquiry: PASS at payload reference; Android open-from-notification **not run**
- No Booking/Reservation: PASS (no booking APIs called; Inquiry contract test rejects booking fields)
- No Tenancy side effect: PASS (discovery fixture has zero non-terminal Tenancy)
- Room/Listing state unchanged: PASS (Listing `published`, Room `VACANT`)

Evidence:

```text
setupPublishedListing: VACANT + PUBLISHED, no non-terminal Tenancy
setupOccupiedRental: OCCUPIED + ACTIVE + UNPUBLISHED Listing (CX-02..05)
CX-01 Room remains VACANT
HTTP Inquiry send from Android: BLOCKED (AuthGuard + empty GOOGLE_CLIENT_ID)
```

### CX-02 — Incident

- Incident persisted + NEW_INCIDENT to operator: PASS (service)
- Status change INCIDENT_STATUS_CHANGED to reporter: PASS (ACKNOWLEDGED)
- Notification does not perform the transition: PASS (service `updateStatus` is the mutator)
- Android tenant/operator UI: not run

### CX-03 — Billing / Payment

- PAYMENT_DUE on cycle create to tenant: PASS (service)
- PAYMENT_CONFIRMED on recordPayment to tenant: PASS (service)
- Charge/Payment remain separate records in service: PASS
- Android billing UI: not run

### CX-04 — Notice

- TENANCY_NOTICE to linked tenant: PASS (service)
- Acknowledgement user+timestamp: existing tenancy-support tests in `pnpm test`
- Android notice UI: not run
- Delivery/ack is not legal validity: PASS (`TenancyNotice contract has no legal-validity claim`)

### CX-05 — Move-out

- ACTIVE → startEnding emits MOVE_OUT, Room stays OCCUPIED: PASS (service)
- ACTIVE → ENDED rejected: PASS (`ACTIVE cannot jump directly to ENDED`)
- checkout ENDING → ENDED + Room VACANT: existing rental-lifecycle tests in `pnpm test`
- Android move-out UI: not run

### CX-06 — Review / Trust moderation

- Trust report on Listing notifies operator `REVIEW_OR_REPORT_MODERATION`: PASS (service)
- Moderation login/evidence/multiplicity: **BLOCKED_BY_OPEN_POLICY**
- One Trust Report does not auto-remove content: PASS (conformance `TrustReport targets exactly one Listing or Review without auto-removal policy`)

## 8. Notification verification

Exact channels are OPEN. Service-layer delivery/source only.

| Event                    | Source fact exists first | Correct recipient | Notification created | Opens source | Does not mutate source | Result |
| ------------------------ | ------------------------ | ----------------- | -------------------- | ------------ | ---------------------- | ------ |
| new inquiry              | Y (service)              | Y (owner)         | Y                    | payload only | Y                      | PASS service; Android BLOCKED |
| payment due              | Y (service)              | Y (tenant)        | Y                    | payload only | Y                      | PASS service |
| payment confirmed        | Y (service)              | Y (tenant)        | Y                    | payload only | Y                      | PASS service |
| new incident             | Y (service)              | Y (operator)      | Y                    | payload only | Y                      | PASS service |
| incident status changed  | Y (service)              | Y (reporter)      | Y                    | payload only | Y                      | PASS service |
| tenancy notice           | Y (service)              | Y (tenant)        | Y                    | payload only | Y                      | PASS service |
| move-out                 | Y (service)              | Y (operator)      | Y                    | payload only | Y                      | PASS service |
| review/report moderation | Y (submit report)        | Y (operator)      | Y                    | payload only | Y                      | PASS service; moderation OPEN |

## 9. Failures and root causes

### F-01 — DISC-02 Maestro `id: public-listing-card` missing

- **Observed:** `scrollUntilVisible id: public-listing-card` FAILED; hierarchy had no resource-id for Compose testTags.
- **Reproduction:** `pnpm e2e:flow DISC-02` before `testTagsAsResourceId`.
- **Root cause:** `Modifier.testTag` is not a UiAutomator resource-id unless `testTagsAsResourceId = true` on a parent.
- **Fix:** `Scaffold` `semantics { testTagsAsResourceId = true }` in `TroOiApp.kt`.
- **Regression test:** `tests/e2e/maestro/listing-detail.yaml` tap `id: public-listing-card`
- **Retest:** PASS
- **Commit:** `2cb65ef2f71b221bf560dcd007d5c5c86cac6bb0`

### F-02 — DISC-02 blank white screen after `launchApp clearState`

- **Observed:** After `pm clear` + first launch, screenshot is empty white; `"Tìm phòng"` not in hierarchy for 15s. Maestro log also shows Windows `KeyValueStore` heartbeat file-lock (also present on passing runs).
- **Reproduction:** Consecutive `pnpm e2e:flow DISC-02` with only `clearState: true` then immediate assert.
- **Root cause:** First process after `pm clear` can present a blank Activity; Maestro marks launch COMPLETED before Compose tree exists. Heartbeat file-lock is a separate Windows Maestro 2.11 issue and did not uniquely correlate with pass/fail.
- **Fix:** Second `launchApp: stopApp: true`; wait `id: v1-discovery-list`.
- **Regression test:** five consecutive `pnpm e2e:flow DISC-02`
- **Retest:** PASS 5/5
- **Commit:** `2cb65ef2f71b221bf560dcd007d5c5c86cac6bb0`

### F-03 — Maestro/ADB consecutive-run instability (lock / offline / instrumentation EOF)

- **Observed:** Review sample DISC-02 2 PASS / 3 FAIL. Failures were KeyValueStore file-lock, device offline, instrumentation EOFException — not Listing selector.
- **Reproduction:** Consecutive `pnpm e2e:flow DISC-02` with `am force-stop dev.mobile.maestro.test` immediately before `maestro test`.
- **Root cause:** Force-stopping Maestro instrumentation races the next dump (EOF). `wait-for-device` accepts `offline`. Shared `~/.maestro` KeyValueStore heartbeat from a leftover JVM.
- **Fix:** Remove instrumentation force-stop; ADB recover until `get-state=device` and `sys.boot_completed=1`; wait/kill leftover Maestro `java.exe`; isolate `MAESTRO_HOME` per run.
- **Regression test:** DISC-01 once + DISC-02 x5
- **Retest:** PASS 5/5
- **Commit:** `25f7a71`

## 10. Flakiness

| Flow    | Runs | Pass | Fail | Failure mode | Status |
| ------- | ---: | ---: | ---: | ------------ | ------ |
| DISC-01 |    1 |    1 |    0 | none this rework | GREEN |
| DISC-02 |    5 |    5 |    0 | none after F-03 | STABLE (5 consecutive) |
| DISC-02 review sample | 5 | 2 | 3 | lock / offline / EOF | addressed in F-03 |

## 11. Authorization and security checks

- Google token verification not bypassed: PASS for this session (Phase C not run; `GOOGLE_CLIENT_ID` empty; live Google test not invoked).
- No client-authoritative `senderUserId` on HTTP: PASS when principal present (`InquiryController` assigns `user.userId`). Unauthenticated POST remains AuthGuard-protected (`tests/e2e/README.md`).
- Resource authorization by relationship: PASS (`pnpm test` resource-authorization suite).
- No global LANDLORD/TENANT role: PASS (conformance `USER contract has no global business role`).
- No cross-tenancy/org read/write: PASS (resource-authorization tests).
- Public Listing never leaks operational address: PASS (DISC-01/02 HTTP + Maestro `assertNotVisible` synthetic address).
- Notifications do not bypass source-resource authorization: PASS at NotificationService recipient checks; NOTIF-03-N01 Android not run.

Result: PASS at unit/HTTP-public layers; **BLOCKED** for authenticated Android.

## 12. Database/schema/migration impact

- Schema changed: NO
- Migration added: NO
- Existing migration history rewritten: NO
- Constraints/indexes added or changed: none this session
- Concurrency protections tested: none added
- Rollback/recovery considerations: n/a (no migration)

## 13. OPEN policy blockers

| Case / Flow | OPEN decision required | Current behavior | Action needed |
| ----------- | ---------------------- | ---------------- | ------------- |
| DISC-03 | search/filter policy details | spec_only / open_policy in catalog | authority for filter semantics |
| PART-05 | participant policy still OPEN | catalog `open_policy` | authority |
| CLAIM-01, CLAIM-02 | Payment Claim policy OPEN | catalog `open_policy` | authority |
| NOTIF-04 | notification channel + read-state policy OPEN | no channel hardcoded | do not freeze push/email/SMS/Zalo |
| REVIEW-01..03, TRUST-01..02, CX-06 | moderation/login/evidence/multiplicity OPEN | report notify only; no auto-remove | authority before executable moderation E2E |

## 14. FUTURE boundaries verified

Confirm no accidental implementation of:

- OTA reservation / instant booking — not in Inquiry contract (static test)
- full realtime messaging — Inquiry contract rejects thread/typing
- payment gateway dependency — not added
- saved search / advanced favorites — DISC-03 remains OPEN/spec
- proration engine — not added
- service/WiFi/parking/Other charges — conformance charge types RENT/ELECTRICITY/WATER only
- public tenant/personal landlord rating — conformance
- partner marketplace/dispatch — not added

Evidence/notes: `pnpm test:conformance:database-v1` FUTURE/OPEN static tests PASS.

## 15. Commits

```text
568fd716769bfaae2f133e4a3af652eea6033a70 test: make pnpm test independent of prior shell state
1db741d test: split CX fixtures into legal V1 states
25f7a71 test: harden Maestro ADB startup on Windows
e102744 docs: record v1 e2e flow closure evidence
2cb65ef test: stabilize DISC-02 listing-card tap on Windows
1988cb8 feat: complete v1 cross-actor flows and notification side effects
```

Staging `97a3897` is an ancestor. Independent audit must use **exact** `568fd716769bfaae2f133e4a3af652eea6033a70` (or the docs commit immediately after this file if present).

## 16. Files/areas intentionally untouched

- `gradle.properties` — coordinator WIP; `android.overridePathCheck` passed via `-P` only
- `gradle/gradle-daemon-jvm.properties` — not present, not created
- Canonical / ERD / migrations
- Docker image rebuild (container still serves public Listing for DISC-01/02)
- Google client configuration / AuthGuard bypass

Confirm coordinator local WIP was not committed:

```text
gradle.properties
gradle/gradle-daemon-jvm.properties
```

`git status` after stabilize commit: clean except this report file.

## 17. Known gaps after completion

1. Phase C authenticated Android (AUTH, INQ-01, PORTAL, DASH, CX-01 UI) blocked by empty `GOOGLE_CLIENT_ID` / no Google session.
2. CX-02..CX-05 have no Maestro/Android executable flow (`spec_only` in `tests/e2e/journeys/CX-v1-cross-actor.yaml`).
3. Docker `backend` image is older than HEAD; notification HTTP in that container was not rebuilt/retested.
4. DISC-01-H02/F01 and DISC-02-H02/S01 are not in the Maestro YAML.
5. Independent audit of SHA `568fd71` has **not** been run yet. Local 5/5 is not merge authority.

## 18. Final merge decision

```text
READY_TO_MERGE: NO
```

Reason:

Three reviewed blockers were reworked locally. This report must **not** flip READY_TO_MERGE to YES on local evidence. Request an **independent audit against exact SHA `568fd716769bfaae2f133e4a3af652eea6033a70`**. PASS → consider YES. FAIL → continue rework.
