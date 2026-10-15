# Selective source integration — working audit

## Source safety and acceptance

Initial target: `integration/unified-source-candidate` at `e5e6c6db6f4ceb0a3d68765bbef387e870babc94`, clean on 2026-10-14.
Profile local ref: `temp/profile-operator-mvp-20261013` at `f35f79ed95a4e78f5a349d29c77c967a2c1f9588`.
Payment ref: `origin/recovery/payment-methods` at `5230a0489209b84ef0dcf69acb67f69fce0efac5`.
Identity baseline ref: `integration/profile-identity-kyc-candidate` at the initial target SHA.
Payment backend baseline: `ec8d60e625b352f364724e6d199aac5fb7cea32a`.
Residual worktrees: x-reg, x-red, x-ctl at `55985da6453773be9a6a456e43f93bf01c8b333d`; uncommitted changes are read-only evidence.

Protected worktree HEAD/status/diff snapshots were captured in ignored `test-results/unified-source/source-snapshot.json`. Profile source already has dirty logical/physical JSON; these are excluded. No active Git process or command explicitly targeting this target was visible in the process inventory. An existing Gradle daemon and other Codex sessions exist; no emulator ownership is assumed. No source mutations, worktree registration changes, pushes, or PRs are authorized.

Success gates: fresh Profile/identity/navigation tests and Android build for phase 1; transport/payment/domain tests and build for phase 2; valuable residual regression recovery for phase 3; broad backend and isolated migration checks before final recommendation. Source test claims are historical evidence only.

## Ownership matrix

| Domain | Source ref | Target files | Current implementation | Changes to retain | Conflicts | Resolution | Test evidence |
|---|---|---|---|---|---|---|---|
| Profile UI | f35f79e | features/profile, shared settings wrapper, tenant account wrapper | Older hub/settings | Compact hero, six root actions/tags, grouped settings/security/finance, offline catalog, contextual labels | Updated callback and session email | Extract approved files and all callers | 25 Profile JVM / 13 Profile TS contracts PASS; builds PASS; device blocked |
| Profile API | f35f79e + e5e6c6d | identity-access controller/DTO/service; BackendApi/repository/ViewModel | No own-profile HTTP writer; principal name projection | Authenticated own-name read/write and persisted session projection | Source weakens demo ownership guard | Retain candidate 1ec8310 development-user guard; retain candidate storage validation | Own-Profile persistence/ownership PASS; live Google unverified |
| Identity database | e5e6c6d | 000008 SQL/TS, identity repository, transaction ports/registration, fixtures | Frozen foundation and transaction-bound repository already present | All baseline foundation behavior | Source fixture deletion and formatting churn | No migration/schema/port replacement; existing repository authoritative | Freeze/parity/isolated migrations PASS; no frozen edits |
| Operator onboarding | f35f79e | LandlordOnboardingScreen, CitizenIdOcr, LocalLandlordApplication, Debug fixture repository | Five steps requiring asset | Intro + three steps + completion; optional first asset | Main OCR dependency versus Debug demo; production reauth unavailable | One ML Kit dependency in main, keep Debug demo and fixtures; no production KYC activation | OCR/model/boundary JVM PASS; capture/device blocked |
| Payment backend | ec8d60e via e5e6c6d | payment/finance/checkout services and repositories | Existing authoritative checkout/payment/allocation/receipt | Full baseline security and money rules | UI branch uses older architecture | Preserve backend unless a demonstrated integration defect needs repair | 459 backend / 81 persistence PASS; provider live unverified |
| Payment UX/QA | 683bc65, cacf164, 5230a04 | current tenancy/payment presentation and tests/android | Current TroOi primitives and runtime | Missing behavior only; bank transfer wording, keyboard/reference/button states, notification navigation | Retired V1 primitives/backendDebug fixtures; contradictory provider assertion | Semantic port; do not restore old variants | Semantic port complete; JVM/build PASS, 6 migrated UI cases compile; device blocked |
| Regression recovery | candidate/Profile/Payment/x-* | tests only and supporting fixtures when necessary | Broad candidate fixture recovery already present | Only missing valuable coverage | Dirty sources, duplicates, obsolete architecture | Classify each changed source test before copying | Inventory complete; no missing x-* tests; two source smoke cases recovered |

## Decisions and limits

- OCR suggests input only; identity images are ephemeral and do not authorize an operator.
- Source Profile backend supports display-name persistence, not durable legal/contact/security/notification preference writers.
- Production onboarding submission remains fail-closed behind unavailable backend reauthentication. Operator Workspace entry retains server authorization and may create the first Organization through its existing API; it does not imply KYC approval.
- Preserve Debug OCR activity/entry/fixtures. Main CitizenIdOcr is a separate data-entry function, not a duplicated class; move the existing identical ML Kit dependency to main scope once.
- No immutable principal, verified email, password revision, frozen migration, Canonical/ERD, or financial ledger changes.
- Admin, Messaging, marketplace, subscriptions, and unrelated redesign remain excluded.

## Phase evidence

Verification results and final reconciliation will be appended after execution. Live Google/SePay/KYC E2E is not verified by unit tests or source screenshots.

### Phase 1 completed

- Profile source f35f79e selectively extracted; frozen migrations/repositories and candidate security retained.
- Fixed two actual source wiring defects found by separate standards/spec reviews: standalone Settings host callbacks, and back navigation while a display-name save is pending.
- `pnpm typecheck`, `pnpm lint`: PASS after retaining control-character validation without a lint-disallowed regex.
- Targeted Profile/session/identity/freeze TypeScript: 34 PASS / 0 FAIL; includes 13 Profile contracts.
- Isolated PostgreSQL foundation/vNext: 22 PASS / 0 FAIL. Added real Profile controller/service persistence across reconnect with cross-account checks: 1 PASS / 0 FAIL.
- Broad `pnpm test` with isolated DATABASE_URL: 459 PASS / 0 FAIL / 0 SKIP. Initial run without DATABASE_URL had 4 cancelled HTTP audit tests; rerun resolved that environment gate.
- Android `:app:testDebugUnitTest :app:assembleDebug`: PASS after final callback fixes; no device or live Google activation claim.
- `git diff --check`: PASS. Protected source/main HEAD/status/diff snapshot comparisons: unchanged.
- Missing upstream functionality remains explicit: Connections is an empty-state snackbar; personal/contact/security/preferences/support writes other than display name lack durable approved endpoints; onboarding submission requires unavailable reauthentication and stays fail-closed.

### Phase 2 semantic decisions (working)

- Reviewed actual diffs of 683bc65d660cd7ee0d9fdf49acaebfb27c075a1f, cacf1642e2117a970a072cf7ccaa572ad1c89662 and 5230a0489209b84ef0dcf69acb67f69fce0efac5.
- Replaced the current inline obsolete checkout panel with one extracted GatewayPaymentPanel using TroOiCard/Button/FormField/InformationRow and retained Room Ledger state presentation. No second checkout flow, legacy V1 UI atom, backendDebug variant or legacy fixture was restored.
- Retained amount bounds, server replay permission, resulting-Payment history reconciliation, pending/unknown/failed/synchronizing/confirmed states, reference visibility, two-line measured action minimum size, IME dismissal/padding, and notification source callbacks. Payment formatting preserves exact decimal values and Vietnamese date boundaries.
- Preserved the existing reauthentication gates, session generation/state ownership, Idempotency-Key behavior, SePay transport, authorization, allocation/deposit/receipt invariants. Production Android create/replay is BLOCKED pending approved backend proof. This is not a live-provider readiness claim.
- Existing CheckoutFlowTest requires confirmed same-amount requests to reuse the obligation/key. Historic source called this action “new transfer”; unified UI refreshes the confirmed record for the same amount and creates through the existing intent path for changed amounts or FAILED checkout. Migrated callback expectations follow that authoritative invariant.
- The reported contradictory CheckoutTransportTest assertion is already corrected in e5e6c6d. Android explicitly sends provider=SEPAY; optional backend provider defaults to MOMO. Keep the explicit SEPAY assertion and existing bearer/idempotency checks; no production behavior changed to satisfy tests.
- Source payment/notification unit presentation tests imported, four instrumentation cases migrated into current Debug layout. Deposit-application isolation test now reads the actual extracted panel; the obsolete MoMo substring check is removed.
- Source reports/screenshots/video copied byte-for-byte into payment-source-evidence with a historical-only README. Original 111/13/13 claims are not unified acceptance.
- Native audit: shared theme tokens and expanding 48dp-minimum actions, visible labels, read-only states, scroll/IME handling, and source-navigation ownership retained. Real dark/200%-font/keyboard/geometry validation awaits exclusive device execution. Architecture guard found a source generic TextButton in Profile; converted to the existing TroOi tertiary button without restoring a retired atom.

### Phase 2 completed

- `pnpm typecheck`, `pnpm lint`: PASS. Targeted Profile/finance/SePay/MoMo/authorization/fixture contracts: 112 PASS / 0 FAIL.
- Full isolated persistence suite with PYTHON set to the installed interpreter and TEST_DATABASE_URL on dedicated loopback port 55433: 81 PASS / 0 FAIL / 0 SKIP. Initial 76/81 run used port 55439 and lacked the Python launcher expected by the catalog harness; all five environment failures were resolved without weakening tests or frozen migrations.
- Final `:app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest :app:assembleRelease :app:lintDebug`: PASS. JVM 207 PASS / 0 FAIL / 0 SKIP; Release APK is unsigned. Release lint vital also PASS.
- `:app:testReleaseUnitTest` does not exist in this project's current AGP task model. The initial combined invocation failed during task selection, before tests; no build variant was added to manufacture that gate.
- APK fixture isolation: PASS, 7 Debug assets match source and 53 Debug sentinels absent from Release assets/DEX. Architecture guard and diff whitespace: PASS.
- Source/main HEAD/status/diff snapshots unchanged. No Payment backend/authorization/receipt/repository or database/frozen specification changes against initial e5e6c6d.
- Standards and requirements reviews found no remaining Phase 2 production defects. Device/instrumentation/manual checks and live provider E2E remain NOT VERIFIED; no exclusive emulator authorization was received.

### Phase 3 and final verification completed

- Recovered two missing source Payment smoke cases using current primitives. Added unauthorized Profile PATCH/no-refresh and future-DOB/numeric-name extraction regressions. Production code unchanged in this phase.
- Fresh Android final state: 209 JVM PASS (25 Profile), Debug and unsigned Release assembly PASS, instrumentation APK compile PASS, Android lint PASS (0 errors, 61 warnings, 2 hints). Six migrated source instrumentation cases remain NOT EXECUTED.
- Fresh final backend typecheck/lint PASS; full suite 459 PASS / 0 FAIL / 0 SKIP. Fresh isolated persistence inventory/migration/parity/rollback/transaction suite: 81 PASS / 0 FAIL / 0 SKIP.
- Final verification initially shared the migration-reset database with runtime HTTP discovery and produced one transient HTTP500 (458/459). Corrected the test setup by using the independent fully migrated isolated database at port55439 for HTTP audit; complete459/459 rerun passed. Migration tests exclusively used55433. No production patch or assertion weakening.
- Architecture and APK fixture isolation PASS; frozen database/payment/authz/receipt boundaries unchanged against initial HEAD. Diff whitespace PASS; protected source/main HEAD/status/diff snapshots unchanged.
- Standards and spec reviews: phase3 has no material findings. Source exclusions/replacements are documented in regression-recovery.md.
- Final diff inventory: 91 integrated/modified files, including 46 historical Payment evidence/archive files and 40 Kotlin/TypeScript/Gradle paths.
- Recommendation: integration_partial_with_explicit_gates. Live provider/KYC/security activation and exclusive device/manual acceptance remain NOT VERIFIED/BLOCKED, not PASS.
