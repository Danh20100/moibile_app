# Unified source acceptance — 2026-10-14

Recommendation: **integration_partial_with_explicit_gates**. The approved source functionality is selectively integrated and reviewable; provider/device/security activation gates remain open. Historical source PASS claims are not unified acceptance.

## A. Integration result

- Branch: `integration/unified-source-candidate`.
- Worktree: `D:\Projects\.worktrees\TroOi-Project\integration-unified-source-candidate`.
- Initial clean HEAD / Identity baseline: `e5e6c6db6f4ceb0a3d68765bbef387e870babc94`.
- Profile local source: `f35f79ed95a4e78f5a349d29c77c967a2c1f9588`.
- Payment UI source: `5230a0489209b84ef0dcf69acb67f69fce0efac5`; supporting commits `683bc65d660cd7ee0d9fdf49acaebfb27c075a1f` and `cacf1642e2117a970a072cf7ccaa572ad1c89662`.
- Payment backend authority: `ec8d60e625b352f364724e6d199aac5fb7cea32a`, preserved through the initial baseline.
- Residual x-reg/x-red/x-ctl sources: `55985da6453773be9a6a456e43f93bf01c8b333d` plus read-only uncommitted tests.
- Phase 1: `fe6b052b997c894c0661958d02d8bb3bed3a9a4f` — reconcile Profile UI/API/persistence.
- Phase 2: `239e0e82b39ed0d62237dab9a07cc76a316f482e` — semantic Payment UX port with historical QA archive.
- Phase 3: `test(integration): recover cross-branch regression coverage`; final commit SHA and clean status are supplied in the final handoff (`git rev-parse HEAD`, `git status --short`).
- Integrated/modified files: 91, including 46 historical Payment QA archive files (40 Kotlin/TypeScript/Gradle paths).
- No merge, push, PR, source ref mutation, worktree registration/removal, frozen schema rewrite or unrelated domain integration.

## B. Domain reconciliation

| Domain | Source | Integrated functionality | Preserved invariants | Missing/deferred |
|---|---|---|---|---|
| Profile UI/API | f35f79e + e5e6c6d | Approved compact hub, six root destinations/tags, grouped settings/security/finance, offline Vietnamese help/legal, authenticated name save and session projection | Own-User writes; Google refresh preserves edits; legal identity separate; relationship-derived access | Connections empty state; durable personal/contact/security/preference/support writers |
| Operator/OCR | f35f79e | Intro + three counted steps + completion, two-sided capture/select, OCR suggestions and review, optional first asset, real workspace callbacks | OCR never verifies identity or authorizes operation; no backend evidence/KYC activation; existing reauthentication gate retained | Production onboarding submission and real camera/manual/device acceptance |
| Identity DB | e5e6c6d | Existing transaction-bound four-table foundation reused; no new migration | Frozen 000008 TS/SQL and schema bytes; immutable bindings; email/password CAS; 1ec8310 development-user claim restriction | Common resolver/reauth/recovery/OTP/session/audit activation contracts |
| Payment | ec8d60e + 5230a04 | Bank-transfer panel, amount validation, refresh/replay eligibility, reference toggle, status synchronization, keyboard/button sizing, exact formatting, notification navigation | Authoritative Payment history; confirmation distinct from allocation/deposit/receipt; backend authorization/idempotency unchanged; ended tenancy read-only | App create/replay blocked by unavailable reauthentication; live SePay/payment/allocation/receipt E2E |
| Tests | all sources + x-* | Missing Profile/payment tests migrated; two smoke tests recovered; negative Profile transport/OCR coverage added | Current tests/android layout, validated candidate fixtures, no backendDebug resurrection | Device execution and historical interactive manual host |

## C. Test matrix

Final suites passed on the final code/test state. HTTP audit uses isolated port 55439; migration tests use isolated port 55433. Commands use Java 21, Android SDK 36, an installed Python interpreter, and only newly created loopback PostgreSQL/PostGIS test containers. TEST_DATABASE_URL points to trooi_test; no shared or production data was used.

| Test gate | Command | Passed | Failed | Skipped | Blocked |
|---|---|---:|---:|---:|---|
| Backend typecheck | `pnpm typecheck` | 1 gate | 0 | 0 | — |
| Backend lint | `pnpm lint` | 1 gate | 0 | 0 | — |
| Backend/unit/contracts/runtime access | `pnpm test` with isolated DATABASE_URL | 459 | 0 | 0 | — |
| Persistence/migrations/parity/rollback/constraints | `pnpm exec tsx --test --test-concurrency=1 @files` (all tests/integration/persistence/*integration.ts, including guards) | 81 | 0 | 0 | — |
| Profile JVM subset | Included in `:app:testDebugUnitTest` | 25 | 0 | 0 | — |
| All Android JVM | `gradlew.bat :app:testDebugUnitTest` | 209 | 0 | 0 | — |
| Debug APK | `gradlew.bat :app:assembleDebug` | 1 | 0 | 0 | — |
| Release APK | `gradlew.bat :app:assembleRelease` | 1 unsigned build | 0 | 0 | Production signing/configuration acceptance |
| Android instrumentation compile | `gradlew.bat :app:assembleDebugAndroidTest` | 1 APK build | 0 | 0 | Execution below |
| Android lint | `gradlew.bat :app:lintDebug` and Release lint vital | 0 errors; 61 warnings, 2 hints | 0 | 0 | — |
| Frontend architecture | `python app/scripts/verify_frontend_architecture.py` | 1 gate | 0 | 0 | — |
| APK fixture isolation | `python app/scripts/verify_fixture_isolation.py <debug.apk> <release-unsigned.apk>` | 7 Debug assets / 53 excluded Release sentinels | 0 | 0 | — |
| Release JVM task | `:app:testReleaseUnitTest` | 0 | 0 | Unsupported task | Current AGP task model has no such task |
| Device instrumentation/manual UI | Not executed | 0 | 0 | 0 | No exclusive emulator authorization; six migrated source cases plus current suite remain unexecuted |
| Live Google/SePay/KYC E2E | Not executed | 0 | 0 | 0 | No approved live test environment exercised; KYC/security contracts remain gated |

The Profile Postgres test validates controller/service ownership and persistence across DB reconnect, with a supplied principal; it is not an actual Google-token HTTP login E2E. SePay persistence/provider proofs are injected test evidence, not transferred funds. Initial environment failures and their successful reruns are recorded in ownership-and-acceptance.md.

## D. Conflicts and risk log

1. Profile source's permissive demo-room claim was rejected; candidate 1ec8310 restriction remains byte-equivalent in that guard. Candidate private-storage transport validation retained.
2. Duplicate migration/table/schema churn excluded. Frozen artifacts and all existing migration semantics remain unchanged against initial HEAD.
3. Source fixture deletions/inline-data replacements excluded; candidate regression governance and stronger no-list-only-settlement cases retained.
4. Debug OCR demo preserved; one existing ML Kit dependency moved to main scope for the distinct approved data-entry function. No verification class duplication or backend activation.
5. Fixed source Settings Operator/onboarding callback omissions and delayed-save back-navigation race; standards/spec reviews rechecked both.
6. Old V1 UI atoms/build variants excluded. The extracted Payment panel is the single replacement for the old inline checkout presentation.
7. Confirmed same-amount primary action refreshes the existing obligation. Changed amounts/failed checkout retain the existing new-intent behavior. No financial/idempotency contract changed for source UX wording.
8. Reported provider-test contradiction was absent in resolved source/baseline; explicit SEPAY transport expectation retained.
9. Device geometry, dark theme, large fonts, IME, camera, app restart and authenticated route walkthroughs are not proven by compilation or historical captures.
10. Missing backend proof stays fail-closed. Rendering security/onboarding destinations is not activation. Release build is unsigned and does not prove deployment/OAuth/provider configuration readiness.

Standards review: one Profile navigation issue, resolved; no remaining material Payment or phase-3 standards findings. Spec review: one Settings callback issue, resolved; upstream feature gaps remain explicit. No new production code was added in phase 3.

## E. Remaining work

- **Integration defects:** none known after completed local gates/reviews; unexecuted device tests may reveal defects.
- **Missing backend functionality/contracts:** approved reauthentication/security/session/audit cutover; production onboarding submission; durable contact/legal/profile visibility/preferences/support/Connections workflows. No unapproved schema or authorization substitute supplied.
- **Live providers:** consenting/test Google login → Profile round trip; authorized SePay callback/replay → actual Payment → allocation/deposit/receipt chain; no real-provider PASS claimed.
- **UI/device acceptance:** exclusive current-Debug instrumentation/manual session, Profile navigation and Operator entry, two-side camera OCR, restart/resume, light/dark/200%-font/keyboard/accessibility acceptance.
- **Deferred domains:** Admin Analytics, Messaging, marketplace, subscriptions, unrelated redesign, production KYC and unapproved schema redesign.

## F. Recommendation

**integration_partial_with_explicit_gates**. Review the three local commits and ownership/test inventory. Keep unsupported production actions fail-closed. No push, PR, main merge or branch deletion was performed or recommended as an automatic next action.

Detailed evidence: ownership-and-acceptance.md, regression-recovery.md and payment-source-evidence/README.md. Fresh raw logs/XML/APKs are local ignored outputs under test-results/unified-source/ and app/build/; historical source images/video are tracked with their provenance.


## Phase 4 addendum — Messaging (2026-10-14)

The original Phase 1–3 report above remains historical evidence for its recorded state. This addendum records a new execution from `8606a27db87adaeb13ecc5f69db9ab66692a1aae`, selectively incorporating the four Messaging commits through local source `c3929adc74f223c58d12d2dc0194155964f22506` with `-x` provenance.

See [Phase 4 integration and fresh acceptance](phase4-messaging-integration.md) for the ownership matrix, source-to-target commit mapping, complete command/count matrix, conflict/risk log, isolated MinIO setup, production identity activation gate and contextual navigation limits. Fresh unified validation covers 464 Backend tests, 81 persistence tests, real PostgreSQL/MinIO Messaging HTTP assertions and 216 Android JVM tests, plus Debug/unsigned Release/instrumentation builds, lint and architecture/APK isolation. Historical source results are not substituted for these runs.

Messaging's private full-stack implementation and contextual Inquiry/Tenancy entry are integrated. Frozen Identity Foundation, Profile/Operator design/gates and authoritative Payment behavior remain intact. Current Google login does not create the durable bindings required to open new conversations; approved resolver activation remains fail-closed. Live Google/SePay and exclusive-device instrumentation/UI acceptance are unverified.

Phase 4 recommendation: **unified_partial_with_explicit_gates**. No push, PR, main merge or protected-source mutation.
