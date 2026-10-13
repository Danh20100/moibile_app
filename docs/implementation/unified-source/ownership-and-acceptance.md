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
| Profile UI | f35f79e | features/profile, shared settings wrapper, tenant account wrapper | Older hub/settings | Compact hero, six root actions/tags, grouped settings/security/finance, offline catalog, contextual labels | Updated callback and session email | Extract approved files and all callers | Pending fresh JVM/TS/build |
| Profile API | f35f79e + e5e6c6d | identity-access controller/DTO/service; BackendApi/repository/ViewModel | No own-profile HTTP writer; principal name projection | Authenticated own-name read/write and persisted session projection | Source weakens demo ownership guard | Retain candidate 1ec8310 development-user guard; retain candidate storage validation | Pending persistence/ownership tests |
| Identity database | e5e6c6d | 000008 SQL/TS, identity repository, transaction ports/registration, fixtures | Frozen foundation and transaction-bound repository already present | All baseline foundation behavior | Source fixture deletion and formatting churn | No migration/schema/port replacement; existing repository authoritative | Pending freeze/parity/isolated DB |
| Operator onboarding | f35f79e | LandlordOnboardingScreen, CitizenIdOcr, LocalLandlordApplication, Debug fixture repository | Five steps requiring asset | Intro + three steps + completion; optional first asset | Main OCR dependency versus Debug demo; production reauth unavailable | One ML Kit dependency in main, keep Debug demo and fixtures; no production KYC activation | Pending OCR/model/boundary tests |
| Payment backend | ec8d60e via e5e6c6d | payment/finance/checkout services and repositories | Existing authoritative checkout/payment/allocation/receipt | Full baseline security and money rules | UI branch uses older architecture | Preserve backend unless a demonstrated integration defect needs repair | Pending fresh backend tests |
| Payment UX/QA | 683bc65, cacf164, 5230a04 | current tenancy/payment presentation and tests/android | Current TroOi primitives and runtime | Missing behavior only; bank transfer wording, keyboard/reference/button states, notification navigation | Retired V1 primitives/backendDebug fixtures; contradictory provider assertion | Semantic port; do not restore old variants | Pending comparison and acceptance |
| Regression recovery | candidate/Profile/Payment/x-* | tests only and supporting fixtures when necessary | Broad candidate fixture recovery already present | Only missing valuable coverage | Dirty sources, duplicates, obsolete architecture | Classify each changed source test before copying | Pending inventory |

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
