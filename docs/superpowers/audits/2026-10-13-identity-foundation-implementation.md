# Identity Foundation - implementation evidence and handoff

Date: 2026-10-13. Branch: `feature/profile-identity-foundation`. HEAD: `079047bc986e71a2993959c0e7c22cc6834deaeb`. All changes remain uncommitted/unstaged. Original working-tree changes preserved; no Payment or Account Verification worktree edits.

## Phase 1 - formal freeze PASS

Owner-confirmed Account Verification decision: ACCEPTED_WITH_NON_SCHEMA_CONDITIONS; two independent reviewers reported no schema-changing blockers. Four tables are REVIEWED_FROZEN at `vnext.identity-foundation.1`. Exact SHA-256 fingerprints are in [manifest](../../database/vnext/identity-foundation/freeze-manifest.json); physical hash `74b98a622ba8f564d35ea3e946e3b196b219c46d64fa32038a5e404f8e46833e`. Logical/physical/transaction bytes are verified by integration tests. Frozen Markdown has LF attributes. Canonical v3.7/v1 and historical migrations are unchanged. Runtime activation remains BLOCKED.

## Phase 2 - Database implementation complete in worktree

Migration `000008_identity_foundation`: additive four-table SQL, named PK/FK/UNIQUE/CHECK/indexes, no arbitrary defaults. Guard requires applied Payment migrations 000006/000007. Immutable principal and revision/no-removal triggers enforce writer invariants without extending frozen columns. Empty down is supported; populated down refuses rather than destroying identity data. Forward recovery required for populated deployments.

Number inventory: 26 local refs, 17 remotely advertised heads whose objects were available, seven other worktrees; no competing >=000008 wrapper at snapshot. Combined baseline `55985da6453773be9a6a456e43f93bf01c8b333d` provides 000001-000007. Local Profile has only 1-5; its standalone migration chain intentionally refuses 8. Tests extract immutable integration wrappers/SQL into an owned temporary fixture and append local 8, never cherry-picking Payment logic. Local 1-5 match baseline after line-ending normalization. Integration must combine reviewed branches in order and refresh allocation before deployment. CI must have that pinned Git object available.

Changed code: four Kysely table types; `identityFoundation` repository slot in existing TransactionManager; new typed persistence port and transaction-bound Kysely repository; ASCII-local/IDNA-domain normalization helper. Resolver uses canonical principal advisory lock, both unchanged legacy UUID candidates and sorted User locks; collision fails closed. Registration atomically creates User/binding/email/Profile. Email stable-row CAS releases old key; Profile is insert-once/self-edit; credential insert/CAS uses monotonically increasing bigint revision and encoded Argon2id syntax. Existing authentication callers remain unchanged.

## Phase 3 - executed verification

All commands executed on an owned ephemeral PostgreSQL 16/PostGIS container, isolated `trooi_test`; no shared DB used. Counts are separate suites, not deduplicated totals.

| Command | Result |
| --- | --- |
| `pnpm exec tsx --test tests/integration/persistence/identity-vnext.integration.ts` | 18 PASS, 0 FAIL/SKIP |
| `pnpm exec tsx --test tests/core/login-email-normalization.test.ts` | 2 PASS, 0 FAIL/SKIP; also included in backend suite |
| `pnpm test` | 348 PASS, 0 FAIL/SKIP |
| `pnpm test:conformance:database-v1` | 57 PASS, 0 FAIL/SKIP |
| `python -m unittest discover -s tests/database -p 'test_*.py'` | 46 tests OK |
| `pnpm typecheck` / `pnpm lint` | exit 0 each |

DB suite covers alias races, UUID and ownership/nullable Participant preservation, legacy conflicts, duplicate case-only email, initialization rollback, email CAS/collision/released-key reuse, stale proofs including absent-to-present credential, credential concurrency/reset/rehash, stale login and User-lock lifetime, private Profile seed/edit preservation, writer guards, frozen v1/vNext catalogs including key/FK definitions and checks, predecessor guard, populated-down refusal and empty down/up. Final review found a URL-host normalization repair: regression first failed on percent-encoded domain; validation now rejects percent/query/fragment and numeric-host repairs, retaining IDNA. Core and DB/backend checks reran after fix.

Fresh independent final review: no Critical findings; normalization concern fixed with RED/GREEN evidence; minor proof/catalog/doc gaps addressed. Reviewer performed read-only inspection, not test execution. Logs/inventory/progress are under ignored `test-results/profile-foundation/database-implementation/`.

## Account Verification persistence handoff - accepted with runtime conditions

Use `transactionManager.transaction` and its transaction-bound `repositories.identityFoundation`; typed conflicts throw so caller must allow transaction rollback, not swallow them and commit partial state. External cryptographic proof/hash computation may precede the transaction; revalidate all captured email/credential snapshots under User lock before session issuance. `validateProofSnapshot` binds current email row/revision and credential revision or explicit absence; `validateLoginSnapshot` additionally binds normalized login email. Lock remains held until transaction completes. Mutation methods are trusted persistence primitives, not authentication endpoints or proof verification.

Account Verification must compose sensitive mutation + durable audit + session revocation/issuance in the SAME transaction or supply an independently reviewed atomicity design. Do not commit storage mutation and then perform best-effort audit/revocation. Shared Google Login/AuthGuard must call the same resolver and fence all direct-ID writers. Retry serialization/deadlock failures as whole transactions under runtime-owned retry policy. Email lookup is never an identity merge. Validate authorization, proof purpose/target/freshness and password hash with dedicated runtime libraries; encoded storage checks do not establish password strength.

Blocking runtime items: authoritative common sessions/revocation; durable audit and atomic collaborator design; reauth/recovery/OTP security; Argon2id benchmark; removal of direct-ID bypass. Sessions/audit tables, if needed, require separate contract and migration; do not mutate frozen four-table shape. No new schema-changing blockers remain for these four tables.

## Integration tasks remaining

1. Review uncommitted implementation diff and combine integration baseline with approved Profile changes; recheck globally unused numbering and migrate complete 1-8 chain in isolated staging.
2. Re-run DB tests on combined release baseline; review populated forward recovery/deployment permissions and restricted writers; never bypass predecessor guard.
3. Account Verification implements/accepts transaction collaborators and shared resolver cutover, then executes auth/session/security end-to-end tests before runtime activation.
4. Commit only after requested integration confirmation; no commit/push/merge here.

Not run: old full persistence suite using incomplete Profile-only migration chain, deployed auth/session/OTP tests or production migration. Actual session issuance and audit atomicity remain unimplemented runtime blockers, not properties proven by the storage lock tests.
