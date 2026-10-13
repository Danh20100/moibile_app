# Database vNext foundation — source review and implementation gate

**Historical result of the initial audit:** invariant verification implemented; new physical schema gated. The subsequent [Google-first decision register](../specs/2026-10-12-profile-identity-decision-register.md) supersedes the prior authentication recommendations. Verification below belongs to the initial audit, not the current documentation update.
This is an engineering report, not an attestation that Profile, Email OTP, media or KYC runtime is ready.

## A. Baseline

- Authorized worktree: `profile-identity-foundation (authorized Profile worktree)`.
- Branch: `feature/profile-identity-foundation`; HEAD `079047bc986e71a2993959c0e7c22cc6834deaeb`; initial `git status --short` was empty.
- Related Account Verification worktree was observed through `git worktree list` only; no files there were changed.
- Actual migration tip: `database/migrations/000005_optional_sepay_gateway.ts`. Five migration wrappers; 29 frozen public domain tables plus separate `gateway.gateway_checkouts` and migration bookkeeping.
- Canonical v3.7; conceptual/logical/physical JSON each `REVIEWED_FROZEN`. Snapshot `docs/database/v1/schema/trooi-schema-20260927T153946Z.sql` matches initial migration SQL byte-for-byte as read by the integration test.
- Existing Profile audit/spec/plan are explicitly drafts; no original CHỐT-marked approval log or approved physical addendum was supplied. The task provides approved invariants and scope boundaries, not approval of draft tables.
- Node `v24.21.0`, pnpm `12.10.1`, Python 3.12; Docker Desktop reachable. Dependencies installed with the existing frozen lockfile; no dependency or lockfile changes.

## B. Actual source audit (initial review; current statuses are in the decision register)

| Concern | Existing columns / constraints / owner | Missing capability; proposed scope | Invariant / approval gate | Files and tests impacted after approval |
| --- | --- | --- | --- | --- |
| User Profile | `users(user_id uuid PK)`; SQL initial migration line 4; `UsersTable` in schema types line 47; identity repository line 10 | No persisted Profile fields; conditional optional User-owned profile | No global role; Profile field/visibility gate OPEN | Additive migration; schema types; identity port/repository; profile field/authorization tests |
| Auth Identity / User Email | UUID derives from verified issuer/subject in `deterministic-user-id.ts:6`, `verify-token.ts:36`; `authenticateWithGoogle` ensures User in a transaction | No provider or email mapping; transient claims only; lazy mapping needs fresh proof | UUID compatibility approved; linking/cardinality/recovery OPEN | Additive migration; identity repository/port; identity service mapping only after contract; concurrency/ownership tests |
| Session / Security Audit | `getSessionContext` joins Organization and Participant relationships; bearer auth validates Google proof | No durable session/revocation/security-event model; response context is not a session table | Session protocol, event vocabulary, reauth and retention OPEN | Auth lane contract; schema/repository; revocation/audit/privacy tests |
| Media | `incident_events.attachment_reference text NULL` (initial SQL line 307); `payment_claims.evidence_reference text NULL` (line 218); private storage scaffold | No object metadata/FKs or authorized upload/finalize; legacy strings are not Media IDs | Binary storage boundary approved; links/lifecycle/retention OPEN | Media migration/schema/port; resource ownership and legacy compatibility tests |
| KYC | No KYC attempt/evidence/decision table in physical contract, migrations or schema types | Separate attempt/decision/evidence proposal only | Face score is not identity approval; reviewer/state/assurance/retention OPEN | Future verification/evidence migration and policy tests; no runtime in this task |
| Legal Acceptance | `terms_acknowledgements` FK to tenancy terms/participant/User with `acknowledged_at`; SQL line 124 | App acceptance evidence absent; distinct version/hash context | JSON-only catalog approved by task; document/hash/context/retry contract OPEN | Acceptance migration/schema/port; immutable evidence and idempotency tests |
| Privacy Consent | No consent purpose/event model | Purpose-specific append-only evidence proposal | No default consent; purposes/revoke/disposition OPEN | Consent migration and append-only withdrawal tests |
| Data Subject Request | No access/export/erase request model; frozen ownership/participant/finance references | Request/disposition proposal without destructive account cascade | Account deletion cannot erase rental/financial history; lifecycle/holds OPEN | Request migration/schema/port; obligation-blocking and disposition tests |
| Notification Preference | `notifications`: recipient User FK, category, message reference, delivery status and timestamps; recipient/time index; SQL line 354 | Delivery records are not preferences; candidate category/channel key | Category/channel/essential-notice/default policy OPEN | Preference migration/schema/port; essential versus optional tests |
| Support Request | Existing `incidents`/`trust_reports` serve different domains; no support ticket store | Private case proposal; JSON FAQ independent | Access/assignment/transitions/retention OPEN | Support migration/schema/port and cross-user/staff access tests |
| Organization Profile | `organizations`: primary owner User `NO ACTION` FK, name; owner index; SQL line 9 | Separate public-safe organization description/contact projection if approved | Relationship-based permissions frozen; public field collection OPEN | Organization profile migration/schema/repository and visibility tests |

Reviewed repository responsibilities: identity → Users; organization → Organizations; property → Properties/Rooms; listing → Listings/Status Events/Inquiries; tenancy → Tenancies/Participants/Terms/Acknowledgements/Notices; finance → Billing/Charge/Utility/Payment/Receipt/Deposit records; incident, notification and trust retain their dedicated roots. No new repository wrapper or duplicate durable source is needed before a contract exists.

Frozen User references are enforceable FKs with `NO ACTION`; `tenancy_participants.user_id` remains nullable. There is no missing FK for a nonexistent vNext table. Legacy attachment strings lack relational media linkage by design; changing their meaning requires an expand/migrate/contract proposal. No approved provider metadata exists to bulk backfill.

### Conflicts reconciled or reported

1. Draft audit said migration `000006_demo_gateway`; actual tip is `000005_optional_sepay_gateway`. Corrected only unfrozen draft references.
2. Draft Profile context/spec/plan selected Markdown + manifest. Current explicit task requires JSON-only Public Content Catalog. Corrected those unfrozen documents; no Android assets or frozen canonical files changed.
3. Draft OTP example offered five minutes. Removed the illustrative value; expiry/attempt/resend rules remain OPEN and belong to the other lane.
4. Plan claimed the current branch did not contain the UI redesign tree despite its first-parent base statement. Corrected the task boundary to inherited UI, unchanged by this DB task.
5. The draft table proposals and Mermaid 0..N email edge do not approve physical cardinalities. New migrations, schema types and runtime mappings remain blocked until a reviewed addendum exists.

## C. Architecture and decision gate

The [physical proposal](../specs/2026-10-12-profile-identity-foundation-physical-proposal.md) provides conceptual boundaries, Mermaid ERD, candidate physical columns/nullability, FK/cardinality, unique/index proposals, concurrency, proof-only lazy backfill, visibility, retention/deletion dependencies, migration order and forward recovery. Its stable G1–G7 gates now reference the decision register, which distinguishes approved authentication choices from remaining OPEN parameters. It is not a frozen contract.

An Archify architecture artifact is available locally at `test-results/profile-foundation/architecture.html`; its source and deterministic delivery/browser receipts are beside it. It maps existing Google verification → identity service → PostgreSQL and deliberately leaves the nonoperational cache/storage scaffolds unconnected. No generic media link or OTP runtime is implied.

At the initial audit, no new table was authorized from the then-supplied drafts. The subsequent owner instruction approves Google-first registration, initial editable Profile, optional password, restricted OTP purposes and alias-safe identity compatibility. The specs now reflect those decisions; physical/security details remain reviewed proposals and this follow-up explicitly prohibits implementation.

## D. Implemented files and rationale

1. `tests/core/identity-persistence-alignment.test.ts`: added independently calculated fixed UUID vectors and whitespace compatibility; catches a namespace/input/hash change that an equal-output-twice test would miss.
2. `tests/integration/persistence/identity-foundation.integration.ts`: real PostgreSQL transactions and repositories verify concurrent idempotent Google login, retained organization/participant references, nullable unregistered participant, same-email distinct-principal isolation, FK protection and unavailable-proof rejection; verifies populated v1 upgrade, idempotent up, public catalog preservation, complete empty down/up and fresh bootstrap.
3. `docs/contexts/layers/profile-identity-foundation.md`: JSON-only scope correction and current source-review link.
4. `docs/superpowers/audits/2026-10-12-profile-db-vnext-gap-audit.md`: migration-tip correction and current source-review link.
5. `docs/superpowers/specs/2026-10-12-profile-identity-vnext-logical-design.md`: JSON-only correction, removal of illustrative OTP duration and current source-review link.
6. `docs/superpowers/plans/2026-10-12-profile-identity-foundation-execution.md`: actual migration tip, JSON-only guidance and inherited-UI boundary corrections; migration approval gate preserved.
7. This source-review report and the physical-proposal document: concrete policy-gated review package.

No production source, persistence port, Kysely schema type, migration, frozen ERD, canonical, SQL snapshot, Android file or dependency was changed. No migration number was allocated. No stage, commit, push, merge, rebase, database deployment or shared-database operation occurred.

## E. Verification

Evidence is local under ignored `test-results/profile-foundation/`. An ephemeral `--rm` Docker container named `trooi-profile-foundation-test-079047b`, with task ownership label, random test password and dynamically allocated loopback port, provided a dedicated `trooi_test`. No existing service or Compose volume was used. URLs/passwords were held in the test shell, not printed or committed.

| Exact command / operation | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; existing lockfile retained |
| `pnpm typecheck` | PASS; production and test TypeScript |
| `python -m unittest discover -s tests/database -p 'test_*.py'` | PASS; 46 tests |
| `python scripts/database/physical_contract_validate.py docs/database/v1/erd/logical.json docs/database/v1/erd/physical.json docs/database/v1/schema/trooi-schema-20260927T153946Z.sql` | PASS; 29 tables, zero reconciliation markers |
| `pnpm test:conformance:database-v1` | PASS; 57 tests |
| `pnpm test` without `DATABASE_URL` | FAILED environment prerequisite; 342 passed, four runtime HTTP tests cancelled by missing DB URL |
| `pnpm test` with `DATABASE_URL=TEST_DATABASE_URL` targeting isolated container | PASS; build and all 346 tests, zero skips/cancellations |
| `pnpm exec tsx --test tests/integration/persistence/identity-foundation.integration.ts` with isolated `TEST_DATABASE_URL` | PASS; two real database tests |
| `pnpm exec tsx --test --test-concurrency=1 "tests/integration/persistence/**/*.integration.ts"` with isolated `TEST_DATABASE_URL` | First run FAILED: 49/52 passed; two existing rental time-fixture failures plus Python launcher failure; configured rerun recorded below |
| `pnpm test:persistence:migration` with isolated `TEST_DATABASE_URL` and `PYTHON` set to installed Python executable | PASS; all 11 real PostgreSQL migration/parity tests |
| `git diff --check` / `git diff --exit-code HEAD -- docs/database/v1 database/migrations src android` | PASS; no whitespace errors or changes to protected production/frozen paths |

The first full-suite attempt cancelled these four runtime checks: health endpoint public; unauthenticated private Organization denied; arbitrary bearer token rejected; public Listing discovery reachable. All four passed on the isolated rerun. New tests are characterization/regression coverage for unchanged approved behavior, not a claim of new production implementation or a TDD fix. Full migration parity and finance/rental guard results are reported separately from static contract checks.

Live Google proof, SMTP, OTP challenge store, S3 adapter, KYC, Android and a vNext migration are not exercised because those features are outside this authorized implementation or blocked. Synthetic identities, timestamps and emails exist only in tests.

## F. Quality review

Manual diff review plus scans cover anti-mock, hardcoded identities/secrets/retention, naming, broad `any`, speculative status defaults, duplicated truth and dependencies. There is no changed production SQL/code to contain fake successful records, credentials, raw media, OTP values or policy defaults. Test-only UUID vectors are compatibility evidence, not application defaults. External Google proof is substituted in the integration test; transactions, service behavior, repositories and PostgreSQL are real.

No frozen table/invariant is weakened; finance, legal tenancy acknowledgement and nullable participant meanings remain intact. There are no new dependencies or speculative runtime abstractions. Standards/spec review findings and final fresh verification are recorded below before handoff.

## G. Current decision status

See the [decision register](../specs/2026-10-12-profile-identity-decision-register.md). G1–G3 are partially resolved; G4–G7 remain OPEN. The old eight-item logical list maps to the same seven gates, with payment receive-method storage deferred out of scope. Authentication product choices are APPROVED; normalization, security parameters and collision/session/recovery details remain OPEN. `privacy_consent_events`, `identity_verification_evidence` and `password_credentials` are the consistent proposed names.

## H. Current next step

Use the revised logical/physical specs and execution plan. Profile/Foundation owns durable contracts, types/repositories and future migrations; Account Verification owns shared issuer resolution across login/guard, password/OTP/reauth/recovery/session runtime. Android integration owns conversion of existing Markdown assets/readers/tests to the JSON-only catalog. Complete the remaining parameter/physical reviews before separately authorized implementation. This documentation update does not rerun or supersede the historical test evidence below.

## Initial audit quality review and artifact evidence

The `code-review` skill's independent Standards and Spec reviewers both returned zero material findings. They inspected the uncommitted diff and new proposal/tests without modifying files or running database resets. Manual review confirms the scope and anti-mock/anti-hardcode claims above.

Archify deterministic delivery: architecture type; 9/9 showcase checks; zero composition errors/warnings; one focused label-placement correction. Specification SHA-256 `03893db0d9acb7d7d35c9d9e7c4e38fcba38c8b9b234ffc19dc2fe93056d8600` (1850 bytes); artifact SHA-256 `0794fc275af2c6bd0048175f9ac55c816ca98c2100280775c73b48dd527033b1` (800076 bytes). Automated browser evidence initially skipped automatic Chrome discovery, then PASSED using the installed Microsoft Edge executable through `ARCHIFY_CHROME`. All four viewports (1440×900, 1600×1000, 1920×1080, 2048×1320) were measured; light/dark endpoint screenshots were captured. Perceptual review of the large light/dark and 1440×900 light screenshots found readable nodes, unobscured labels and intact cards. Automated browser evidence and screenshot inspection do not attest untested interaction/export behavior.

The first broad persistence run failed these existing tests:

- `checkout racing with another room transition preserves tenancy-room coherence` (`tests/integration/persistence/guards/rental-concurrency.integration.ts:6`).
- `rental guards enforce publish activation checkout and archive rules` (`tests/integration/persistence/guards/rental-guards.integration.ts:2`).
- `initial migration matches the frozen physical catalog` (`tests/integration/persistence/migration-parity.integration.ts:210`): Windows launcher `py` was unavailable; rerun with `PYTHON=(Get-Command python).Source` passed all 11 migration-parity tests.

Source inspection explains the rental failures: activation sets `started_at` from `new Date()` in `rental-transaction-coordinator.ts:38`, while both existing tests explicitly checkout at `2026-10-01T00:00:00.000Z`. The current date is October 12. Frozen `ck_tenancies_time_order` rejects `ended_at < started_at`; in the concurrency test a rejected checkout leaves the tenancy ENDING, contrary to its assertion. No affected source/test/frozen constraint was modified. These are pre-existing fixture problems; they are reported rather than changing unrelated rental behavior or weakening the frozen invariant.

## Initial audit final verification update

Configured broad persistence rerun: **50/52 passed, two FAILED, zero skipped/cancelled**. Only the two named existing rental checkout fixture failures remain; migration parity and the new identity tests passed. The exact command remained `pnpm exec tsx --test --test-concurrency=1 "tests/integration/persistence/**/*.integration.ts"`, with `TEST_DATABASE_URL` pointing only to the disposable database and `PYTHON` pointing to the installed executable. This is a partial persistence-suite result, not a green migration-release gate.

Final `git diff --check` passed; protected-path diff was empty. HEAD/branch remain unchanged, the index is untouched, and all eight changed/new tracked-scope files are listed in section D. Local ignored diagram/evidence artifacts are confined to `test-results/profile-foundation/` (test logs, diagram specification/HTML, delivery/browser receipts and screenshots). The task-owned disposable container was stopped and removed after verification; no shared database was reset, migrated or seeded. No new schema is ready to apply until the policy gates close.

## Task 1 — Decision Closure & Physical Design Readiness (2026-10-13)

### Fresh preflight and source findings

- Profile HEAD `079047bc986e71a2993959c0e7c22cc6834deaeb`, branch `feature/profile-identity-foundation`, six modified plus four untracked files (10 total); index initially empty. Prior contents/diff/hashes preserved in ignored `test-results/profile-foundation/task1-preflight-20261013/`. No reset/clean/rebase or removal of prior changes.
- Read all eight current Profile documents and tracked diff; prior two test changes remain byte-identical. Source scan found raw UUID derivation in `verifyGoogleIdToken`, consumed by Google login and `AuthGuard`; only `authenticateWithGoogle` writes `ensureUser`. Guard is an authorization bypass risk during an incomplete resolver cutover, not a User writer. SessionContext uses provider claims and raw User ID today.
- Google token verifier delegates signature/audience/issuer/expiry validation to `google-auth-library`, then returns issuer/subject/email/name/picture. Its application types omit `hd`, nonce and authentication freshness metadata. Third-party-mailbox classification and interactive reauth need a reviewed verified-proof contract; fresh token issuance alone does not prove fresh authentication.
- Profile wrappers `000001`–`000005`; Payment Integration `integration/clean-ui-payment-recovery` HEAD `55985da6453773be9a6a456e43f93bf01c8b333d` includes `000006_demo_gateway.ts`, `000007_sepay_production.ts` and matching SQL. `integration/v1-current` HEAD `77bd186` includes `000006`. Neither number is available for Profile; candidate `000008` is not reserved. No Payment edits or migration execution.
- Account Verification inspected read-only: KYC foundation handoff distinguishes KYC from Google/password/OTP auth, assigns durable migrations to Profile and retains G5/G6 gates. Its current KYC/storage worktree is dirty; no edits there. This inspection does not claim auth design approval or tests run by this reviewer.

### Reviewed outcome and blockers

EMAIL-01/EMAIL-02 record explicit owner invariants. All new normalization, freshness/recycling, security numerical values, minimal Profile validation and transaction mechanisms are PROPOSED. The register includes source-backed rationale/trade-offs, precise approval questions and schema-versus-runtime blockers. Physical proposal now gives unconditional single-current-email uniqueness, email revision, positive credential CAS revision/no delete-reinsert, principal advisory-lock transaction/immutable binding, conflict remediation/cutover, rollback boundaries, durable repository handoff and a designed future test matrix. No new table for a deferred feature was selected.

No table is frozen. Required choices before migration authoring: email normalization/comparison/syntax and lifecycle representation; minimal Profile nullable-completion/validation/projection; identity locking/ownership/cutover acceptance; credential generation/revision and session/audit compatibility. Password/OTP tuning and session lifetimes may remain runtime blockers if their choices do not alter the accepted four-table persistence shape. Unrelated extended G2/G3–G7 do not all block minimal identity migration. Operator collision authority, Account Verification acceptance, exact typed transaction interfaces and mandatory audit/session consistency remain OPEN.

### Files changed in this Task 1 review

Seven existing working-tree documents updated: decision register, logical spec, physical proposal, execution plan, gap audit, source review and `docs/contexts/layers/profile-identity-foundation.md`. Existing base-transition document and both test files are unchanged from preflight. All 10 prior modified/untracked files remain present; production/Android/frozen Database v1/migrations/dependencies remain untouched. No commit/push/merge/staging or schema/runtime implementation.

### Fresh verification boundary

Current checks are source/Git/inventory inspection, local Markdown link/status/name/approval review, byte hashes of unchanged pre-existing files, protected-path/index checks, diff whitespace and frozen physical-contract validation. Results are recorded after their actual execution below. No PostgreSQL migration/test, runtime suite, Google login, SMTP/OTP, Argon2 benchmark, session cutover or Android test is run by Task 1. Initial-audit results earlier in this file remain historical.

| Task 1 command/check actually executed | Result |
| --- | --- |
| `git rev-parse HEAD`, `git branch --show-current`, `git status --short`, `git diff`, `git worktree list`, read-only `git ls-tree -r --name-only` on Profile/Payment integration refs | Confirmed HEAD/branch, all 10 prior files and occupied `000006`/`000007`; no mutation |
| Source `rg` scans + reads of verifier, guard, identity service/port/repository and Account Verification handoff | Findings above; no runtime/security approval inferred |
| Python documentation/scope self-check, evidence `task1-preflight-20261013/verification.json` | PASS: eight documents, 39 local links, 10 prior files still present; seven intended docs changed, base-transition and both tests byte-identical |
| `git diff --check` and explicit untracked proposal/register whitespace check | PASS; no whitespace errors (Git emits existing CRLF conversion notices) |
| `git diff --cached --exit-code` | PASS; index untouched |
| `git diff --exit-code HEAD -- src app database/migrations docs/database/v1 package.json pnpm-lock.yaml` | PASS; protected paths unchanged |
| `python scripts/database/physical_contract_validate.py docs/database/v1/erd/logical.json docs/database/v1/erd/physical.json docs/database/v1/schema/trooi-schema-20260927T153946Z.sql` | PASS; 29 frozen tables, reconciliation=0. Validates v1 only, not proposed vNext tables. |

Working tree remains six modified/four untracked files; HEAD unchanged. This result completes the Task 1 review package, not owner decision closure, physical freeze, migration implementation or runtime test acceptance.
