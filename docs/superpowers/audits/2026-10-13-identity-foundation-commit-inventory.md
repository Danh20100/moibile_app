# Identity Foundation commit-ready inventory — 2026-10-13

Plan only: no staging or commits. Full intended set: 55 files; 10 tracked modified, 45 untracked. All files read as UTF-8 and classified; no logs, live credentials, database state, dependencies or generated output in this inventory. Fake credential/hash samples remain isolated JSON fixtures. Narrow secret-pattern review is not a general secret-scanner certification.

## Proposed commit 1 — `docs(identity): freeze vNext identity foundation contract` (22 files)

- `.gitattributes`
- `docs/contexts/layers/profile-identity-base-transition-20261012.md`
- `docs/contexts/layers/profile-identity-foundation.md`
- `docs/database/vnext/identity-foundation/README.md`
- `docs/database/vnext/identity-foundation/freeze-manifest.json`
- `docs/database/vnext/identity-foundation/logical.json`
- `docs/database/vnext/identity-foundation/physical.json`
- `docs/database/vnext/identity-foundation/transaction-contract.md`
- `docs/superpowers/audits/2026-10-12-profile-db-vnext-gap-audit.md`
- `docs/superpowers/audits/2026-10-12-profile-identity-foundation-source-review.md`
- `docs/superpowers/audits/2026-10-13-identity-foundation-commit-inventory.md`
- `docs/superpowers/audits/2026-10-13-identity-foundation-implementation.md`
- `docs/superpowers/audits/2026-10-13-identity-foundation-integration-readiness.md`
- `docs/superpowers/audits/2026-10-13-identity-foundation-stabilization.md`
- `docs/superpowers/audits/2026-10-13-payment-persistence-failure-handoff.md`
- `docs/superpowers/audits/2026-10-13-rental-persistence-failure-handoff.md`
- `docs/superpowers/plans/2026-10-12-profile-identity-foundation-execution.md`
- `docs/superpowers/specs/2026-10-12-profile-identity-decision-register.md`
- `docs/superpowers/specs/2026-10-12-profile-identity-foundation-physical-proposal.md`
- `docs/superpowers/specs/2026-10-12-profile-identity-vnext-logical-design.md`
- `docs/superpowers/specs/2026-10-13-profile-identity-final-owner-checklist.md`
- `docs/superpowers/specs/2026-10-13-profile-identity-persistence-acceptance-request.md`

## Proposed commit 2 — `feat(database): add identity foundation migration and types` (4 files)

- `database/migrations/000008_identity_foundation.ts`
- `database/migrations/sql/000008_identity_foundation.down.sql`
- `database/migrations/sql/000008_identity_foundation.up.sql`
- `src/infrastructure/database/schema.types.ts`

## Proposed commit 3 — `feat(persistence): implement transaction-bound identity repositories` (5 files)

- `src/common/identity/normalize-login-email.ts`
- `src/infrastructure/database/repositories/identity-foundation.repository.ts`
- `src/infrastructure/database/repositories/repository-set.ts`
- `src/persistence/ports/identity-foundation.repository.ts`
- `src/persistence/ports/transaction-manager.ts`

## Proposed commit 4 — `test(identity): add validated JSON fixtures and integration coverage` (24 files)

- `tests/core/identity-persistence-alignment.test.ts`
- `tests/core/identity-test-barrier.test.ts`
- `tests/core/login-email-normalization.test.ts`
- `tests/fixtures/identity/email-normalization.json`
- `tests/fixtures/identity/email-normalization.schema.json`
- `tests/fixtures/identity/google-principals.json`
- `tests/fixtures/identity/google-principals.schema.json`
- `tests/fixtures/identity/legacy-compatibility.json`
- `tests/fixtures/identity/legacy-compatibility.schema.json`
- `tests/fixtures/identity/persistence-scenarios.json`
- `tests/fixtures/identity/persistence-scenarios.schema.json`
- `tests/fixtures/rental/identity-reference.json`
- `tests/fixtures/rental/identity-reference.schema.json`
- `tests/integration/persistence/identity-foundation.integration.ts`
- `tests/integration/persistence/identity-vnext.integration.ts`
- `tests/integration/persistence/support/identity-legacy-fixture.ts`
- `tests/integration/persistence/support/identity-test-barrier.ts`
- `tests/integration/persistence/support/identity-vnext-migrations.ts`
- `tests/support/fixture-loader.ts`
- `tests/support/identity-fixtures.ts`
- `tests/verification/identity-foundation-contract.test.ts`
- `tests/verification/identity-foundation-freeze.test.ts`
- `tests/verification/identity-test-architecture.test.ts`
- `tests/verification/support/identity-test-governance.ts`

## Dependencies and reconstruction

Commit 1 must include the manifest AND every fingerprinted artifact with `.gitattributes` in the same commit; use no line-ending conversion on frozen bytes. Commit 2 preserves historic migrations; deployment requires combined integration 000001–000007 before 000008. Commit 3 includes both port and implementation plus transaction-manager/repository-set wiring together. Commit 4 includes loaders, every dataset/schema pair and test helpers together; no test relies on an omitted untracked file. Final validation is for the complete four-part set; intermediate commits are not independently certified release baselines.

After owner authorization, stage explicit paths, inspect staged diff and compare frozen Git blobs to SHA-256 manifest, then create commits in this order. Reconstruct in a fresh combined checkout, install frozen lockfile and run the commands in the stabilization report. Do not cherry-pick Payment logic to fill the migration chain; integration owner selects the combined baseline. No new dependency/config export is required.

## Task 2.6 authorization readiness

Owner conclusion remains `IDENTITY_SCOPE_READY = PASS`; `RELEASE_INTEGRATION_READY = BLOCKED`. Packaging is ready for separate stage/commit authorization, which has not been received. All 55 inventory files are preserved, including untracked SQL, schemas and helpers. Documentation machine paths were converted to worktree names/relative paths; the exact orphan path and local cleanup note remain in ignored task evidence. No Payment/Rental implementation or historical migration enters these commits; `tests/fixtures/rental/identity-reference.*` are isolated Identity reference fixtures, not Rental behavior changes.

Task 2.6 final checks: core/fixture/static **16 PASS, 0 FAIL, 0 SKIP**; typecheck and lint exit 0; exact frozen bytes/Git clean filters and diff check pass. Commands are the same as the stabilization report; fresh logs are ignored under `test-results/profile-foundation/task26/`. Identity test/fixture/repository/migration bytes remain unchanged from the **22 PASS** PostgreSQL stabilization snapshot; real-DB tests were not rerun during documentation packaging. Minor lock-test observability stays non-blocking; no test-code change or new audit cycle.

Post-authorization requirements are still pending, not claimed PASS: compare staged and committed frozen Git blobs against manifest SHA-256; inspect each staged boundary for unexpected files; verify `HEAD` contains every inventory path; then reconstruct the committed Profile snapshot on a refreshed owner-selected combined integration baseline (migrations 1–7 + Identity 8), run the 22 Identity PostgreSQL tests, 16 core/static tests, typecheck/lint/fingerprints/diff checks. Test-only and repository commits depend on the prior boundaries; none independently enables Auth runtime. Do not claim committed-HEAD reproduction before commits exist.

Two complete outbound messages are the Payment and Rental handoff documents in commit 1. They have not been sent; no communication channel is used by this task. Payment/Rental owners must fix their ten reproduced failures, refresh combined migration inventory, and achieve full persistence/release PASS. Auth Runtime Activation remains BLOCKED under Account Verification ownership independently of schema freeze and commit preparation.
