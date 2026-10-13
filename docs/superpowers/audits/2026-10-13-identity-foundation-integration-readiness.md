# Task 2.5 - Integration Readiness & Release Baseline Verification

Date: 2026-10-13. **Decision: BLOCKED, not INTEGRATION_READY.** Four-table schema remains REVIEWED_FROZEN; remaining release-test failures do not reopen approved owner policies or frozen schema. Auth activation remains independently BLOCKED.

## Preflight and immutable artifacts

Profile branch `feature/profile-identity-foundation`; HEAD `079047bc986e71a2993959c0e7c22cc6834deaeb`. Staging empty; no commits/push/merge/ref updates. Existing implementation captured before this task and preserved outside explicit test/attribute/document edits. Production implementation files are byte-identical to Task2 preflight. Canonical v3.7, frozen Database v1 and all historical migrations unchanged.

Freeze version `vnext.identity-foundation.1`: manifest hashes of logical.json, physical.json and transaction-contract.md unchanged. SHA-256 physical `74b98a622ba8f564d35ea3e946e3b196b219c46d64fa32038a5e404f8e46833e`. Fresh reconstruction test found all three artifacts use CRLF; old LF attributes would change their frozen hashes during commit. Narrow -text attributes now preserve exact approved bytes; raw vs Git-clean-filtered blob hashes match. No freeze version/hash/physical-schema changes. Also repaired one invalid CP1252 punctuation byte in README; frozen artifacts unaffected. Earlier LF claims are superseded by this evidence.

## Actual combined baseline and migration chain

Re-read local integration branch, active integration worktree HEAD, and advertised origin ref: all `55985da6453773be9a6a456e43f93bf01c8b333d`. Created detached temporary worktree `identity-release-task25 (detached temporary worktree)` from that commit, installed frozen-lockfile dependencies, overlaid exactly49 Profile files listed below. Existing shared runtime files were identical between Profile HEAD and integration baseline before overlay; no three-way conflict or Payment overwrite. Active integration/Account Verification worktrees were untouched.

Owned PostgreSQL16/PostGIS container `trooi-identity-release-task25`, isolated trooi_test; no shared/production DB. Initial random loopback port was incompatible with a hardcoded Payment test port; recreated ONLY the owned container on then-unused loopback55433, and final results below supersede that initial run. Secrets generated at execution time, confined to ignored config, never added to fixtures.

`pnpm db:migrate` on empty combined database applied, in order:

1. 000001_initial_schema
2. 000002_prepare_initial_rollback
3. 000003_gateway_checkouts
4. 000004_gateway_checkout_durability
5. 000005_optional_sepay_gateway
6. 000006_demo_gateway
7. 000007_sepay_production
8. 000008_identity_foundation

Current inventory:17 advertised remote heads contain no competing >=000008 wrapper; all available active worktrees checked, only Profile and this owned combined overlay have8. Refresh this inventory before eventual integration/commit. No number conflict found; no Payment migration edits/cherry-picks.

Identity tests now use checked-out combined migrations directly, not the old Git-pinned extraction fixture. They require exactly1-8. A deliberately incomplete copied1-5/8 chain is used only to prove the missing-predecessor guard fails. Wrapper2 has inline SQL, so the negative helper copies actual available SQL files rather than assuming every wrapper has external up/down files.

Schema checks verify v1 and vNext table columns/nullability/types/defaults, named constraints and exact vNext PK/UNIQUE/FK definitions/actions, CHECK expressions, C email collation, indexes and three enabled BEFORE ROW UPDATE/DELETE guards. Existing User UUID and organization/tenancy/nullable-participant references preserved. Populated8 down refuses and retains data/history; subsequent up is a no-op preserving all8 history entries. Empty8 down/up works. This is a tested non-destructive continuation path, not a production disaster-recovery/backfill exercise.

## Executed final checks on combined code

| Command | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: |
| `pnpm exec tsx --test tests/integration/persistence/identity-vnext.integration.ts` | 19 | 0 | 0 |
| `pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/*.integration.ts tests/integration/persistence/guards/*.integration.ts` | 65 | 10 | 0 |
| `pnpm test` | 406 | 0 | 0 |
| `pnpm test:conformance:database-v1` | 57 | 0 | 0 |
| `pnpm exec tsx --test tests/verification/identity*.test.ts tests/core/login-email-normalization.test.ts tests/core/identity-persistence-alignment.test.ts` | 12 | 0 | 0 |
| `python -m unittest discover -s tests/database -p 'test_*.py'` | 46 | 0 | 0 |
| `pnpm typecheck`, `pnpm lint`, `git diff --check` | exit0 each | - | - |

Counts are separate suites with overlap. The full75 includes Identity19 and legacy Identity2; do not sum as unique tests. All positive results follow final fixture/helper/code refactor. The full suite ran serially to prevent preexisting schema-reset harnesses from racing across files. Logs, preflight hashes, copy manifest and migration history live under ignored `test-results/profile-foundation/integration-readiness/`.

## Remaining release blockers - exact files and remediation

Eight failures are Payment migration tests, left untouched as required:

| File/test location on combined baseline | Finding | Owner fix and rerun |
| --- | --- | --- |
| `demo-gateway-migration.integration.ts:103` | Generic latest down acts on8, not DEMO6; expected DEMO-history refusal does not apply to empty Identity8 | Scope rollback test to6 with explicit target setup, then exercise7/8 independently |
| `demo-gateway-migration.integration.ts:120,173` | Latest history expected5/7 but actual8 | Test target migration history separately from full release chain |
| `migration-parity.integration.ts:37,207` | Latest expected4/5 but actual8 | Pin fixture migration cutoff for Payment upgrade/down tests |
| `migration-parity.integration.ts:257,658` | Full public catalog33 versus expected29 | Keep exact frozen-v1 catalog validation on1; validate additive tables separately on full1-8; do not edit frozen v1 |
| `migration-parity.integration.ts:321` | Rollback setup leaves durability4, expectation only1-3 | Replace fixed relative-down count with explicit target chain/history |

Two failures are existing rental checks:

- `guards/rental-concurrency.integration.ts:6`: checkout remains ENDING versus expected ENDED.
- `guards/rental-guards.integration.ts:2`: checkout throws PersistenceCheckViolation.

Clean control worktree from the same integration commit, WITHOUT Identity overlay, ran those two files on actual1-7: **3 PASS/2 FAIL/0 SKIP**, identical failures. Source activation uses current timestamp while checkout fixtures supply2026-10-01, earlier than current activation; rental owner must review deterministic lifecycle timestamps/SQL constraint failure. Do not change business policy or production rental code to suppress these failures. Rerun both control files and complete combined persistence/release checks after owner fixes.

## Test Architecture Compliance

Audited12 TypeScript files (four required tests, two Identity persistence helpers, two shared fixture utilities, three verification tests and focused classifier) plus10 JSON files (five datasets/five schemas). Refactored all four required tests; provider/transaction mocks receive validated fixture data. Static source-contract assertion moved from core to verification without losing coverage. Added Identity-owned legacy rental setup instead of rewriting shared Payment/rental harnesses.

Five new deterministic fixture datasets, no existing fixture directory to reuse:

- identity/email-normalization: input/expected normalization, alias distinctions, unsupported addresses and expected error.
- identity/google-principals: legacy UUID vectors, whitespace and provider mock data.
- identity/persistence-scenarios: registration/collision/profile/credential/CAS/rollback data, revision expectations, timestamps, hashes, fixed IDs and concurrency configuration.
- identity/legacy-compatibility: original UUID/reference characterization and provider-failure scenarios.
- rental/identity-reference: Identity-only tenancy/organization/property/room setup.

Each has versioned schema with exact required fields, types, enums and no unknown fields. Shared loader throws clearly on missing file/field/type/version, returns recursively frozen data and has no business-data fallback. Meta-tests deliberately inject missing fields/wrong version/types and prohibited literal snippets. Focused AST verification checks business-valued fields/calls and email/UUID/date/hash/Google identity literals, unseeded generation and fallback; SQL/schema/protocol/type constants stay in code. Duplicate full datasets/array scenarios checked. Each vNext top-level test initializes its own actual DB, with beforeEach isolation for child scenarios; no previous top-level test supplies state. Legacy Identity tests independently initialize their fixtures. Core coverage retained; added real PostgreSQL opposite multi-User-lock deadlock verifies typed PersistenceDeadlock or email conflict and full rollback.

**Identity scope violations remaining:0 found.** Out-of-scope observations, not fixed: inline business datasets and random IDs in Payment demo/migration tests and original shared rental harness. Existing src Google verifier .spec convention is unrelated auth-runtime lane; no new tests/mocks/utilities placed in production src. Classifier is intentionally scoped, not proof that every repository test is compliant.

Fresh read-only final reviewer found no Critical/new fixture defects. Important findings are the10 release failures above. Deferred minor: new deadlock-test barrier does not cancel its peer if first proof validation fails before signalling; future failing setup could hang that test. Current runs pass; add bounded/cancellable rendezvous in follow-up. No second review cycle or unrelated fixes performed.

## Integration safety and runtime handoff

Payment runtime/migrations1-7 are unchanged versus integration HEAD. Identity storage remains additive, preserves existing roots/references and never merges by email. Principal lock precedes sorted legacy User locks; normal mutations lock their User. Opposite multi-User order can deadlock; tested mapper reports a sanitized typed error, transaction rolls back. Callers must order multi-User locks consistently and retry complete transactions under approved runtime policy; no runtime retry/security policy added here.

Login/AuthGuard/provider callers unchanged; no new auth bypass, password login endpoint, email change endpoint, OTP sender or session runtime activated. Existing direct-ID runtime remains a separately blocked cutover item. Sessions/revocation, durable audit, sensitive-operation atomicity, proof security/recovery and Argon2 benchmark remain Account Verification conditions. New sessions/audit schema requires a separate contract/migration, never edits frozen four tables.

## Commit readiness - plan only

Do NOT commit/stage/push/merge until requested integration confirmation. Suggested boundaries, in order:

1. Freeze documents: .gitattributes plus complete vNext addendum/manifest/transaction artifacts; owner decisions, logical/physical specs, acceptance, execution/context/audit evidence and this readiness report. Include every referenced untracked artifact; exact three-file -text attributes must accompany the frozen files.
2. Additive migration and Kysely schema types:8 wrapper/up/down and schema.types.ts; historical files excluded. This commit depends on combined1-7 baseline and is not standalone deployable on Profile1-5.
3. Transactional persistence: new foundation port/repository/normalization and existing transaction-manager/repository-set wiring as one atomic boundary. No Auth/Payment runtime edits.
4. Tests and fixture governance: four Identity tests, suite/shared helpers, all five dataset/schema pairs and verification files together. No package/dependency change required.

The four boundaries must be integrated and verified as one release set. Source commit in manifest is the reviewed baseline, not the future commit ID. Static test confirms Git clean filtering retains frozen bytes; add all5 vNext files and referenced documents explicitly to reconstruct complete evidence. Avoid blanket git add; ignored DB credentials/logs, node_modules/build/test-results are excluded. Combined overlay file list follows; broader existing documentation remains in the docs boundary, reviewed separately.

- `.gitattributes`
- `src/infrastructure/database/schema.types.ts`
- `src/infrastructure/database/repositories/repository-set.ts`
- `src/persistence/ports/transaction-manager.ts`
- `src/common/identity/normalize-login-email.ts`
- `src/infrastructure/database/repositories/identity-foundation.repository.ts`
- `src/persistence/ports/identity-foundation.repository.ts`
- `database/migrations/000008_identity_foundation.ts`
- `database/migrations/sql/000008_identity_foundation.up.sql`
- `database/migrations/sql/000008_identity_foundation.down.sql`
- `tests/core/login-email-normalization.test.ts`
- `tests/core/identity-persistence-alignment.test.ts`
- `tests/integration/persistence/identity-foundation.integration.ts`
- `tests/integration/persistence/identity-vnext.integration.ts`
- `tests/integration/persistence/support/identity-vnext-migrations.ts`
- `tests/integration/persistence/support/identity-legacy-fixture.ts`
- `tests/support/fixture-loader.ts`
- `tests/support/identity-fixtures.ts`
- `tests/verification/support/identity-test-governance.ts`
- `tests/verification/identity-foundation-contract.test.ts`
- `tests/verification/identity-foundation-freeze.test.ts`
- `tests/verification/identity-test-architecture.test.ts`
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
- `docs/database/vnext/identity-foundation/freeze-manifest.json`
- `docs/database/vnext/identity-foundation/logical.json`
- `docs/database/vnext/identity-foundation/physical.json`
- `docs/database/vnext/identity-foundation/README.md`
- `docs/database/vnext/identity-foundation/transaction-contract.md`

Referenced owner/spec/acceptance/history documentation included in the final overlay:
- `docs/contexts/layers/profile-identity-base-transition-20261012.md`
- `docs/contexts/layers/profile-identity-foundation.md`
- `docs/superpowers/audits/2026-10-12-profile-db-vnext-gap-audit.md`
- `docs/superpowers/plans/2026-10-12-profile-identity-foundation-execution.md`
- `docs/superpowers/specs/2026-10-12-profile-identity-vnext-logical-design.md`
- `docs/superpowers/audits/2026-10-12-profile-identity-foundation-source-review.md`
- `docs/superpowers/audits/2026-10-13-identity-foundation-implementation.md`
- `docs/superpowers/specs/2026-10-12-profile-identity-decision-register.md`
- `docs/superpowers/specs/2026-10-12-profile-identity-foundation-physical-proposal.md`
- `docs/superpowers/specs/2026-10-13-profile-identity-final-owner-checklist.md`
- `docs/superpowers/specs/2026-10-13-profile-identity-persistence-acceptance-request.md`
- `docs/superpowers/audits/2026-10-13-identity-foundation-integration-readiness.md`


## Cleanup and final repository state

PostgreSQL task container stopped/removed; ignored DB credential config removed. Both detached worktrees unregistered, combined worktree directory removed. Control directory removal failed on Windows long filenames; subsequent native recursive cleanup was rejected by automatic approval review with stated reason `blocked by policy`. Orphaned `../identity-release-task25-control (relative to the Profile worktree)` files remain on disk; no active Git worktree or running task DB. No alternative tool used to bypass the rejection.

Final Profile HEAD unchanged `079047bc986e71a2993959c0e7c22cc6834deaeb`;10 tracked modified/39 untracked files; staging empty. Logs and the49-file overlay manifest describe the tested temporary snapshot; this cleanup paragraph was added afterward. No commit/push/merge.
