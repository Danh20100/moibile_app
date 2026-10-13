# Identity Foundation stabilization — 2026-10-13

`IDENTITY_SCOPE_READY: PASS` for Database persistence scope, confirmed by the final review below. `RELEASE_INTEGRATION_READY: BLOCKED`: Payment's eight and Rental's two reproduced failures remain external release blockers. Schema freeze is not runtime activation.

Profile branch `feature/profile-identity-foundation`, HEAD `079047bc986e71a2993959c0e7c22cc6834deaeb`; integration baseline rechecked at `55985da6453773be9a6a456e43f93bf01c8b333d`. Starting state: 10 tracked modified + 39 untracked, empty staging. No stage/commit/push/merge or edits to another active lane. Snapshot hashes are in ignored `test-results/profile-foundation/stabilization/preflight.json`.

## Small concurrency fix

Added a cancellation-aware test barrier in `tests/integration/persistence/support/identity-test-barrier.ts`. Setup errors reject waiting and late-arriving peers with the original cause; a fixture-configured watchdog bounds missing arrivals; settlement clears its timer and later cancellation cannot rewrite a released result. Four core regressions cover these cases. Observed RED (cancel did not propagate setup failure), then GREEN. A real-PostgreSQL failed-setup regression verifies both email snapshots remain unchanged. Existing deadlock scenarios still synchronize on arrivals, not sleeps.

The credential-lock test's prior sleep was replaced with observed pending `pg_locks`, explicit readiness/release gates and a fixture-configured deadline; cleanup releases the held transaction even when observation fails. No production code, frozen schema, migration or Auth runtime changed in this task.

## Verification after final test-code changes

All commands below ran from a detached temporary integration checkout with the complete Profile implementation overlay, not the Profile checkout missing Payment migrations 6/7. PostgreSQL tests used an owned disposable PostGIS 16 database. Logs reside in ignored `test-results/profile-foundation/stabilization/`.

| Command | Actual result | Evidence |
| --- | --- | --- |
| `pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/identity-foundation.integration.ts tests/integration/persistence/identity-vnext.integration.ts` | **22 PASS, 0 FAIL, 0 SKIP** (2 legacy + 20 vNext) | `identity-db.log` |
| `pnpm exec tsx --test tests/core/login-email-normalization.test.ts tests/core/identity-persistence-alignment.test.ts tests/core/identity-test-barrier.test.ts tests/verification/identity*.test.ts` | **16 PASS, 0 FAIL, 0 SKIP** | `core-static.log` |
| `pnpm typecheck` | exit 0 | `typecheck.log` |
| `pnpm lint` | exit 0 | `lint.log` |
| `git diff --check` (Profile and combined checkout) | exit 0 | Final check repeated after documentation changes |
| Payment focused rerun | **7 PASS, 8 FAIL, 0 SKIP**, exit 1 | `payment-handoff-repeat.log` |
| Rental focused clean 1–7 control | **3 PASS, 2 FAIL, 0 SKIP**, exit 1 | `rental-control.log` |

Task 2.5's full persistence result **65 PASS/10 FAIL** and broader backend/v1/Python checks are historical evidence, not fresh runs in this stabilization task. This task's focused reproductions confirm the same ten external blockers; they do not certify the whole release suite. The initial Payment attempt contained connection errors and is not substituted for the stable rerun.

## Test Architecture Compliance

Audited 14 Identity TypeScript test/support/verification files and 10 JSON files (five dataset/schema pairs). Reused all five validated fixture pairs; updated only `identity/persistence-scenarios.json` and its schema with barrier participant/deadline and expected error codes. Two new test/support files, one integration test file updated, plus typed loader/governance coverage updates. Business datasets stay in JSON; technical SQL, schema identifiers and lifecycle assertions remain test logic. The focused AST governance, placement, duplicate-dataset, malformed/missing/version fixture and no-fallback checks pass. No remaining Identity-scope violation detected; this is not certification of unrelated Payment/Rental fixtures.

## Freeze and commit preparation

Freeze `vnext.identity-foundation.1` remains byte-identical to preflight. `.gitattributes` keeps exact frozen UTF-8 CRLF artifacts with narrow `-text` overrides; the static check compares working bytes with Git's clean-filter representation, so a future approved commit can reproduce them. Manifest SHA-256:

- logical: `10209264dd91e1a2aa211fbaac962252822e1e540fc7fe7662c1f6afd4a650b9`
- physical: `74b98a622ba8f564d35ea3e946e3b196b219c46d64fa32038a5e404f8e46833e`
- transactions: `66b593bc26b25425ca54fcdf862089d53cfa56e66195795db4e2ee6270b00f59`

See [commit inventory](2026-10-13-identity-foundation-commit-inventory.md) for all intended files and four boundaries. Include untracked sources, fixtures and schemas explicitly; do not stage logs, ignored credential config, dependencies, temporary database/worktree state or generated outputs. Canonical/Database v1 and historical migrations remain unchanged. Integration requires the owner-controlled combined baseline containing 6/7; no Payment cherry-pick or runtime enablement is implied.

## Owner handoff and remaining gates

Ready-to-send [Payment handoff](2026-10-13-payment-persistence-failure-handoff.md) and [Rental handoff](2026-10-13-rental-persistence-failure-handoff.md) contain exact failures, evidence, reproduction commands and proposed owner regressions. No external message sent. After owners fix these tests, rerun full persistence/backend/conformance/typecheck/lint/fingerprints/diff on the combined release baseline.

Account Verification runtime activation remains separately blocked by shared Login/AuthGuard resolver cutover, authoritative sessions/revocation, durable audit and atomic sensitive operations, Argon2id benchmark, OTP/recovery/reauthentication and removal of direct-ID bypass. Session/audit extensions require independent contracts/migrations; do not alter the four frozen tables silently.

## Cleanup safety

Prior orphan `../identity-release-task25-control (relative to the Profile worktree)` remains unchanged and unregistered (no `.git`, absent from `git worktree list`). Contents: `node_modules`, `scripts`, `src`, `tests`, `tools`, package/lock/workspace files, README, Gradle settings and TypeScript configurations. Its presence has no demonstrated production effect and is not itself an Identity gate failure.

Prior Task 2.5 cleanup was rejected by automatic approval review (`blocked by policy`); this task did not retry, bypass or alter permissions. Owner instruction: verify that exact path is inactive/unregistered and contains only disposable control checkout files, then remove it through an owner-approved cleanup process. Do not run `git clean` or delete another worktree.

Final independent read-only review: **0 Critical, 0 Important**, Identity Database persistence scope approved. Reviewer independently checked the 55-file inventory, the five changed preflight files, barrier/fixtures, recorded test evidence and both handoffs. One deferred Minor: `identity-vnext.integration.ts:884–899` can temporarily leave an unexpected reset failure unobserved during lock polling before `finally` attaches `allSettled`. An immediate rejection observer preserving the later await would improve diagnostics. It affects the test's exceptional failure reporting, not production behavior, frozen schema or demonstrated deadlock setup cancellation; classified non-blocking after review, without expanding this fix pass.

The two task-owned detached worktrees `id-stab` and `id-ctl` were removed using Git with long-path support after checking exact paths, detached state and baseline HEAD. Owned `trooi-id-stab` container stopped/removed; ignored live DB configuration removed. Prior control orphan untouched. No running task database or new registered worktree remains. Logs retained as ignored evidence.

Final HEAD unchanged; **10 tracked modified + 45 untracked**, staging empty. All 51 tested implementation/fixture files matched the tested overlay before cleanup. Of the 49 initial files, 44 are byte-identical and only the five authorized test/fixture files changed; no pre-existing file lost. The six additions are barrier helper, barrier unit test and four handoff/report/inventory documents. Git clean-filter fingerprints and final diff checks passed. No stage/commit/push/merge performed.
