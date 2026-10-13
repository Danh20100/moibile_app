# Profile and Identity Foundation — execution plan

> **For future agentic workers:** use `superpowers:executing-plans` or an explicitly selected execution workflow only after relevant gates close and implementation is authorized. This revision is documentation only; do not execute migration/runtime tasks now.

**Updated:** 2026-10-13 (Task 1 readiness review). **Branch:** `feature/profile-identity-foundation`; source HEAD `079047b`, inherited from `design/app-ui-redesign` at `ef1da3b`.
**Goal:** deliver Google-first registration, editable initial Profile, optional password and purpose-bound Email OTP while preserving existing User IDs and frozen rental/financial invariants.
**Architecture:** PostgreSQL owns provider bindings, primary login email, Profile and optional User-owned password credential. Account Verification owns the shared account resolver, proof/password/session orchestration and fail-closed Redis challenges. Android public content is a JSON-only catalog; PostgreSQL stores evidence only.
**Tech stack:** existing NestJS/Kysely/PostgreSQL/PostGIS; Android Kotlin/Compose; proposed Argon2id after G1-P review; Backend SMTP and separate Redis challenge contract.
**Specs:** [logical contract](../specs/2026-10-12-profile-identity-vnext-logical-design.md), [physical proposal](../specs/2026-10-12-profile-identity-foundation-physical-proposal.md), [decision register](../specs/2026-10-12-profile-identity-decision-register.md).

## Global constraints

- Preserve Canonical v3.7, frozen v1 ERD/schema and applied migrations. Profile-local tip is `000005_optional_sepay_gateway`; Payment Integration `55985da` contains `000006_demo_gateway` and `000007_sepay_production`. Both numbers are occupied. Coordinate the next unused number with Duy Anh; no Profile allocation is made here.
- Only Google initially registers Users. Google and Email + Password later resolve to the same User. Email OTP verifies email, authorizes recovery or sensitive operations; it never registers or independently logs in.
- Initial verified Google email becomes primary login email. Google name seeds editable `display_name` once, never `legal_name`; missing name requires user input. Later Google login never overwrites user-edited Profile.
- Optional password requires secure reauthentication after Google registration. Store only secure salted hashes, prefer Argon2id; no arbitrary parameters, credentials, production fixtures or successful mock fallback.
- Resolve issuer aliases without rekeying or email-based merging. No global User role; nullable participant links and financial/tenancy history remain intact.
- This task authorizes documents only: no migrations, production/Android edits, stage/commit/push/merge/rebase, shared database operation or other worktree changes. Future tasks below are not execution permission.

## Ownership and handoff

| Lane | Responsibility and future files | Boundary |
| --- | --- | --- |
| Profile / Database foundation | Specs/register; future `database/migrations/`, `src/infrastructure/database/schema.types.ts`, `src/persistence/ports/identity.repository.ts`, `src/infrastructure/database/repositories/identity.repository.ts`, transaction wiring and database tests | One reviewed durable contract and migration sequence for `auth_identities`, `user_emails`, `user_profiles`, `password_credentials`; no OTP/password/session endpoint implementation |
| Account Verification | `src/integrations/google-identity/verify-token.ts`, `src/modules/identity-access/`, `src/common/guards/auth.guard.ts`, future password/reauth/session/OTP runtime and security tests | Consume the database contract; own common resolver, cryptographic proof, hashing, session/guard integration and endpoints; no duplicate tables, competing migrations/types or alternate User-ID algorithm |
| Android integration lane | Future Profile/auth UI; `app/src/main/assets/`, `app/src/main/java/com/trooi/app/features/profile/LegalDocuments.kt` and related tests | Own display-name completion/edit and JSON catalog migration; consume Backend APIs; no credential/business database or SMTP secrets |

Account Verification reviews proof/session requirements before physical freeze; Profile supplies persistence contracts before runtime writes. Coordinate shared-file edits and migration inventory before integration. This plan assigns future responsibility without claiming the other branch has accepted/implemented it; do not overwrite that worktree.

## Review focus

- Opposite issuer aliases racing on first registration converge; conflicting existing legacy candidates fail closed without transferring references (Tasks 1–3).
- Missing/changed Google name, existing edited/cleared Profile and first-login/edit races preserve user ownership and request missing input (Tasks 2–3, 5).
- Duplicate primary email or missing/unverified Google email never creates a partial successful account or attaches to another User (Tasks 1–3).
- Setup/reset/login/rehash races and replay after database failure cannot restore a stale credential or issue an unauthorized session (Task 4).
- JSON conversion preserves legal meaning and old acceptance references while assets and loader become JSON-only (Task 6).

## Task 1 — record approved choices and close remaining contract details

**Owner:** Profile/Database, with Account Verification review. **Files:** linked specs/register and this plan. **Consumes:** AUTH-01–AUTH-06, EMAIL-01/EMAIL-02, PROFILE-01, CONTENT-01. **Produces now:** decision review, physical readiness proposal and security parameter candidates. **Produces after acceptance:** reviewed physical addendum; no runtime code.

- [x] Record Google-only registration, same-User Google/password login, optional password after reauth, and restricted OTP purposes.
- [x] Record initial primary verified email and editable display name; no legal-name inference or later provider overwrite.
- [x] Standardize entity names and G1–G7; payment receive-method storage and Connections are deferred scope, not extra gates.
- [x] Propose alias-safe resolution, primary login uniqueness, atomic initialization, credential revision and fail-closed proof consumption.
- [ ] Close G1-E: normalization/collation, primary reuse, collision and missing/unverified Google email behavior, mailbox recovery freshness.
- [ ] Close G1-P/R/O/S: password rules/Argon2id configuration, acceptable reauth/recovery proof and age, OTP abuse/expiry parameters, common session/revocation/audit protocol. Candidate parameters are documented with sources/trade-offs; none is approved/default.
- [ ] Close G1-A: dual-legacy-account remediation, consistency checks and coordinated retirement of direct-ID writers. Approve physical constraints/write permissions.
- [ ] Close minimal G2 validation, owner-only projection and incomplete-profile operation list needed for missing-name completion. Keep unrelated G3–G7 work gated independently.

- [x] Task 1 preflight: inspect HEAD/branch/status/diff and all current Profile documents; preserve review copies/hashes of all 10 existing changed files; inspect Profile/Payment Integration inventories read-only.
- [x] Record explicit EMAIL-01/EMAIL-02 approval provenance; propose single-current-email row/revision, normalization/local-case/IDNA/SMTPUTF8 policy, mailbox freshness/completion/recycling without treating review as approval.
- [x] Document principal lock/UNIQUE/CAS algorithm, legacy conflict workflow, exact existing direct-ID callers, cutover/rollback boundaries and future real-DB/runtime test matrix.
- [x] Supply sourced G1-P/R/O/S candidate parameters/trade-offs and proposed durable persistence handoff; inspect Account Verification's existing KYC/auth boundary without changing its worktree or claiming approval.
- [x] Classify schema-blocking versus activation-only versus unrelated gates. At Task 1 review the four tables were PROPOSED; current owner approval closes their business choices. Separate addendum is physical-review complete, acceptance pending, not frozen.
- [x] Owner explicitly approves F-E1/F-E2/F-A1/F-C1/F-G2 with adjusted ASCII case-insensitive login key. Exact mailbox freshness/completion and minimal text-validation values remain runtime review, not schema blockers.
- [ ] Review with Account Verification exact transaction result types/proof freshness/session audit collaborator and credential/email revision lifecycle; obtain acceptance before dependent runtime or physical freeze.

**Exit:** this documentation review is complete when proposals/evidence/blockers are coherent and verified. Decision closure/physical freeze is a separate exit: owner decisions + auth-lane acceptance + reviewed vNext addendum. No migration/runtime implementation begins under this task.

## Task 2 — additive durable foundation (future, gated)

**Owner:** Profile/Database. **Files:** a new migration/SQL after the then-current tip; existing schema types, identity port/repository and transaction wiring; `tests/integration/persistence/identity-foundation.integration.ts`; separate reviewed vNext contracts/validation. **Consumes:** Task 1 addendum. **Produces:** reviewed transaction operations for canonical binding, primary email/Profile initialization and User-owned credential lookup/insert/compare-and-swap, consumed by the runtime lane.

- [ ] Check HEAD/status and both lanes' migration inventories before numbering; preserve all v1 artifacts and coordinate without editing the other worktree.
- [ ] Write failing real-DB cases for principal uniqueness across aliases, owner FKs, single-current-email-per-User and normalized-login uniqueness with deterministic comparison, positive email/credential revisions, credential 0..1 cardinality and complete rollback of losing registration attempts. Add normalization cases only after G1-E closes.
- [ ] Add the reviewed four-table contracts, types and operations to the existing identity repository/transaction manager: principal lock/read/immutable binding, new registration vs legacy initialization, primary-login restricted lookup, email revision CAS, insert-only Profile/self update, credential insert/CAS. The physical proposal section 4.7 defines responsibilities and typed outcomes; finalize TypeScript signatures with Account Verification before code. Gate required session/audit persistence on G1-S; do not invent extra tables, state machines or defaults.
- [ ] Verify populated v1 upgrade, unchanged UUID vectors and Organization/Participant/financial references, nullable participants, legacy Users without fabricated provider mappings, fresh bootstrap, empty down/up, forward recovery and separate vNext drift.
- [ ] Verify the complete physical section 4.6 matrix: opposite-alias first registration, legacy conflicts, duplicate primary email, changed provider claims/Profile edit preservation, email CAS/stale lookup, credential setup/reset/login/rehash races and failure after each mutation. Database cases require real concurrent transactions; session/proof cases remain auth-lane runtime tests.

**Exit:** separately approved durable contract and isolated DB tests pass after implementation authorization. Do not weaken frozen v1 catalog validation. Baseline tests do not attest new schema behavior.

## Task 3 — shared Google resolution, registration and initial Profile (future, gated)

**Owner:** Account Verification; Profile supplies Task 2 operations. **Files:** `src/integrations/google-identity/verify-token.ts`, `src/modules/identity-access/services/identity-access.service.ts`, `src/common/guards/auth.guard.ts`, affected principal contracts; `tests/core/identity-persistence-alignment.test.ts`, `tests/core/auth-guard.test.ts`, auth/database integration tests. **Consumes:** verified Google proof and durable contract. **Produces:** one resolved `user_id` for login and protected requests; only explicit Google registration may create Users.

- [ ] Test mapping present, one/no legacy candidate, two legacy candidates, inconsistent mapping and opposite-alias first-registration races; losing attempts leave no orphan User/Profile/email.
- [ ] Route all verified Google paths through the same resolver; retain the deterministic helper for compatibility and eliminate direct-ID bypass in the guard. Protected requests cannot register accounts. Coordinate cutover to retire old writers.
- [ ] Atomically initialize verified primary login email and Profile. Missing name remains unset and requests input; missing/unverified email and email collisions follow G1-E without fabricated verification or merge.
- [ ] Test proof-only initialization of legacy Users; repeated login preserves edited/cleared Profile, changed provider name/email cannot silently replace persisted values, and all relationship-based access remains attached to the same User.
- [ ] Reconcile the old same-email distinct-principal test with the new primary-login uniqueness contract: prove isolation/conflict, not two completed registrations sharing a login key. Retain historical UUID-vector expectations and add resolver-level alias equivalence tests.

**Exit:** approved Google initialization/lookup is proven and Task 4 session integration is coordinated.

## Task 4 — optional password, Email OTP proofs, recovery and sessions (future, gated)

**Owner:** Account Verification. **Files:** future auth/password/recovery/OTP runtime under `src/modules/identity-access/` and approved integrations; shared guard/session contracts and dedicated security tests. **Consumes:** Tasks 2–3 and closed G1-P/R/O/S. **Produces:** same-User Google/password sessions and narrowly scoped operation proofs.

- [ ] Test rejection of unknown email, absent credential, unregistered User, missing/stale/wrong-purpose reauth and ambiguous lookup; none may register, merge or fall back to standalone OTP login.
- [ ] Implement secure optional setup with reviewed salted Argon2id configuration; test format verification, permitted rehash, secret redaction and exclusion of credentials from projections. No silent weaker algorithm fallback.
- [ ] Test password and Google login resolving to the same User with common session semantics, approved anti-enumeration/rate controls and credential revision recheck before session issuance.
- [ ] Build purpose-bound SMTP/Redis challenge runtime separate from cache. Test replay, expiry, attempts/resend, wrong User/email/purpose, Redis outage/restart and delivery failure using approved parameters only.
- [ ] Test concurrent setup/reset/change/rehash, stale revisions, reset-versus-login, proof burned after DB rollback/crash and recovery targeting only existing accounts. OTP alone cannot create a User, issue a normal session or silently perform first-password setup for a Google-only account.
- [ ] Verify reviewed proof eligibility/freshness for recovery (including non-Google-hosted mailboxes) and consistency of password replacement, required audit and session invalidation. Missing security prerequisites fail closed.

**Exit:** both login methods and recovery satisfy the approved contracts; no OTP login/registration path exists.

## Task 5 — Profile and remaining domains (future, separately gated)

**Owners:** Profile/Database for durable contracts; assigned Backend/Android integration owners for runtime/UI. **Consumes:** PROFILE-01, relevant G2–G7 decisions and earlier tasks.

- [ ] Add authenticated display-name completion/edit with ownership, validation and race tests; later Google login is read-only for existing Profile data and never supplies legal name.
- [ ] Add other Profile/public organization/contact fields only after G2; derive capabilities from existing relationships.
- [ ] After G5, add media metadata/resource links, private adapter lifecycle and authorization tests. After G6, add `identity_verifications` / `identity_verification_evidence` with approved review/retention; never approve KYC from face score alone.
- [ ] After G3/G4/G7, add legal/consent evidence, data-subject disposition, notification preferences and support. Preserve tenancy/finance history; a gate list is not permission to create all candidate tables.

## Task 6 — JSON-only Public Content Catalog migration (future Android integration)

**Owner:** Android integration; Profile/Database reviews evidence references. **Current files:** `app/src/main/assets/legal/terms-of-use.vi.md`, `app/src/main/assets/legal/privacy-policy.vi.md`, `app/src/main/java/com/trooi/app/features/profile/LegalDocuments.kt`, `tests/android/unit/java/com/trooi/app/features/profile/LegalDocumentsTest.kt`. **Proposed destination:** JSON documents/catalog in `app/src/main/assets/public/content/`; exact schema/manifest frozen under G3. **Consumes:** CONTENT-01 and approved version/hash/locale contract. **Produces:** offline JSON content rendering and stable evidence references.

- [ ] Inventory legal/FAQ assets and consumers; preserve current `legal:terms` / `legal:privacy` identities unless an explicit migration maps them.
- [ ] Freeze typed JSON schema/content blocks, locale/version and hash/canonicalization rules. Define backward interpretation of old evidence; never reuse an old content hash/version for changed bytes or overwrite recorded acceptance.
- [ ] Write tests for missing/malformed/unsupported document/version/locale, offline loading/rendering and version/hash selection. Show explicit unavailable state, not fabricated legal content.
- [ ] Convert approved content without inventing legal/FAQ copy. Replace `parseLegalMarkdown` and `.md` paths with typed JSON loading/rendering; update consumers, accessibility/text selection and tests together.
- [ ] Remove superseded Markdown/HTML public content assets and obsolete parser/tests once JSON consumers replace them. Inspect APK/AAB contents and add a packaging check rejecting `.md`/`.html` public content.
- [ ] Verify offline Terms/Privacy/Help and acceptance references against the approved evidence contract; no duplicate legal bodies in PostgreSQL. Discover/run actual Gradle/CI checks before claiming completion.

**Exit:** JSON-only packaged content and reader tests pass; old acceptance evidence remains interpretable. This revision plans the migration and does not edit Android.

## Task 7 — verification and controlled integration (future)

- [ ] Run discovered commands: `pnpm typecheck`, `pnpm test:conformance:database-v1`, `python -m unittest discover -s tests/database -p 'test_*.py'`, `pnpm test`, `pnpm test:persistence:migration`, `pnpm exec tsx --test --test-concurrency=1 "tests/integration/persistence/**/*.integration.ts"`. Database URLs must target isolated fixtures; set `PYTHON` to the installed executable on Windows when required.
- [ ] Run new vNext/alias/password/recovery/session suites and actual Android Gradle/CI checks for Task 6. Historical baseline results do not prove new runtime behavior.
- [ ] Resolve or explicitly report date-sensitive rental fixture failures in the initial source review; never weaken `ck_tenancies_time_order` to pass tests.
- [ ] Manually review production diff for fake records, plaintext/OTP/secrets, arbitrary defaults, unsafe fallbacks, poor names and duplicate truth; check frozen artifacts and `git diff --check`.
- [ ] Prepare reviewed handoff, auth cutover and forward recovery. Obtain separate authorization before any commit, push, merge or deployment; this plan grants none.

## Current documentation-only completion criteria

Specs and register agree on approved/open decisions, G1–G7 and entity names; lane ownership and JSON migration tasks are explicit; relative links resolve; `git diff --check` passes; production/frozen paths and pre-existing test changes remain untouched. No new runtime/migration/test result is claimed by this revision.

## Task 1 implementation handoff — next sequence, not authorization

1. Close the schema-affecting choices listed in the register, review Account Verification's proof/session contracts and freeze only the approved minimal four-entity addendum. Leave unrelated feature gates OPEN.
2. Refresh integration/Payment migration inventories with Duy Anh; reserve the next globally unused number only at the authorized implementation step. Preserve wrappers/SQL `000001`–`000007` and frozen v1 byte-for-byte. Define additive upgrade and forward recovery before writing SQL.
3. Author reviewed new four-table migration/types, repository operations and real DB cases from physical sections 3.1/4.6/4.7. Keep legacy Users valid without guessed mappings, test all owner/reference invariants and transaction rollback.
4. Hand durable API to Account Verification for separately authorized resolver/guard/login/projection cutover, then reauth/password/OTP/common session integration after activation blockers close. Fence old writers before claiming alias convergence.
5. Run isolated migration/repository tests and actual auth runtime tests after those changes exist. Do not reuse historical PASS counts as Task 1 evidence; record exact command/results and unresolved fixtures at that time.

Task 1 ran only read-only source/Git/inventory review and documentation consistency/scope verification. No current migration, PostgreSQL/runtime test, benchmark, SMTP delivery or live Google reauth was executed. Verification evidence is appended to the source audit after final checks.


## Current gate — Final Decision Closure / Minimal Physical Freeze

- [x] Provide the [short owner checklist F-E1–F-G2](../specs/2026-10-13-profile-identity-final-owner-checklist.md) with one recommendation, alternative/trade-off and direct SQL consequence per decision. All rows await explicit approval.
- [x] Prepare typed persistence API/result/concurrency contract in physical section 4.7 for Account Verification review; no production interface implementation.
- [x] Recheck Payment Integration: `000006` and `000007` are occupied; no number allocated to Profile.
- [x] Owner approves mandatory schema decisions; minimal physical documentation review completed.
- [ ] Account Verification accepts affected persistence dependencies before formal freeze; runtime activation remains a separate OPEN gate.
- [ ] After freeze and separate implementation authorization, allocate next globally unused number and implement additive tables/repositories/tests. Keep runtime activation gates tracked separately; OTP/session timing or hash benchmarking alone cannot block an independent schema.

No repeated source audit is required for this closure step. Use the checklist as the review deliverable, retain historical audit evidence, and do not activate authentication or add unrelated tables to close physical readiness.


## Minimal Physical Contract Approval & Freeze Preparation — historical gate (superseded)

**Owner approvals:** F-E1/F-E2/F-A1/F-C1/F-G2 APPROVED; record/register supersedes earlier recommendations. [Separate minimal vNext addendum](../../database/vnext/identity-foundation/README.md) defines exact four-table columns/nullability/FKs/UNIQUE/CHECK/indexes, no defaults and no changes to frozen v1. Current status PHYSICAL_REVIEW_COMPLETE_ACCEPTANCE_PENDING.

- [x] Preserve current working tree (11 existing files, including original 10); update only current specs/checklist/plan and new documentation addendum/handoff artifacts. No production/Payment/migration edits.
- [x] Reconcile case-insensitive normalized login key with preserved original email, email CAS/release/revision invalidation, immutable Google ownership, Argon2id credential CAS and private nullable Profile.
- [x] Review four-table physical shape independently of OTP/session timing or hash benchmarks; no unresolved owner business decision changes the minimal shape.
- [x] Prepare [Account Verification acceptance request](../specs/2026-10-13-profile-identity-persistence-acceptance-request.md) and exact API/error/transaction handoff. Review requested; no acceptance recorded.
- [x] Inspect 26 locally available Git refs for migration numbering: highest observed wrapper `000007`; `000006`/`000007` occupied. No fetch/global guarantee or number allocation; refresh all lanes with Duy Anh before implementation.
- [ ] Record reviewer acceptance or specific schema-changing objections. Promote only accepted addendum to REVIEWED_FROZEN after relevant dependencies; leave runtime activation OPEN.
- [ ] Obtain separate Database Implementation authorization; refresh/reserve next unused number, then implement additive wrapper/SQL, existing Kysely types/identity port/repository/transaction operations and separate vNext validation/tests as enumerated in addendum README.
- [ ] Run actual isolated fresh/populated-upgrade/empty down-up/concurrency/rollback tests and frozen-v1 conformance after implementation; preserve UUID/nullable Participant/organization/financial references. Current doc validation is not schema implementation evidence.

Pending session/audit storage, proof eligibility/freshness, OTP/password/security parameters and direct-ID cutover cannot activate incomplete auth runtime. They do not block four-table freeze unless Account Verification identifies an actual new durable dependency. Neither migration numbering nor new schema/runtime implementation is authorized by this document.


## Current execution gate - Formal Freeze and Database Task 2, 2026-10-13

- [x] Owner-confirmed Account Verification ACCEPTED_WITH_NON_SCHEMA_CONDITIONS recorded; exact four-table addendum REVIEWED_FROZEN; SHA-256 manifest verified.
- [x] 000008 globally unused at inventory snapshot: 17 advertised remote heads, 26 local refs, seven other worktrees. Combined baseline 55985da6453773be9a6a456e43f93bf01c8b333d supplies immutable migrations 1-7. Guard rejects absent predecessors.
- [x] Additive migration, Kysely types, transaction-bound foundation port/repository and normalization implemented.
- [x] Real PostgreSQL 18/18; backend 348/348; frozen-v1 conformance 57/57; Python database checks 46; typecheck/lint successful.
- [ ] Integration owner combines baseline and changes, refreshes number allocation and deployment checks; no commit/push/merge performed here.
- [ ] Account Verification completes authoritative sessions, durable audit, proof/reauth/recovery security and fences direct-ID writers before activation.

[Actual verification and persistence handoff](../audits/2026-10-13-identity-foundation-implementation.md). Earlier gate entries are historical.


## Task 2.5 - Integration Readiness, 2026-10-13

**Release conclusion: BLOCKED.** Actual detached combined baseline at current integration HEAD `55985da6453773be9a6a456e43f93bf01c8b333d` plus the explicit Profile overlay migrated 1-8 successfully. Identity DB suite 19/19, backend406/406, v1 conformance57/57, fixture/core/static12/12, Python46 OK, typecheck/lint/diff checks successful. Full persistence75:65 PASS/10 FAIL/0 SKIP; eight Payment migration-test assumptions and two rental failures block release. Rental failures reproduced on clean integration1-7 (control3 PASS/2 FAIL). No Payment/Auth implementation changes are authorized by this result.

- [x] Preserve implementation and frozen bytes; fix Git-clean filter reproducibility with exact three-file -text exceptions (existing freeze uses CRLF, not LF).
- [x] Refactor four Identity test files and Identity-only setup to five schema-validated JSON fixture datasets; move static contract into verification; independent DB initialization; focused fixture governance checks.
- [x] Actual empty combined chain, populated rollback refusal/forward no-op, UUID/reference preservation and real deadlock typed rollback verified.
- [x] Prepare commit boundaries only; no staging/commit/push/merge.
- [ ] Payment owner scopes migration-specific tests to their target migration and separates frozen-v1 catalog from additive release catalog.
- [ ] Rental owner fixes dated checkout fixtures/constraint failure and reruns controls plus combined persistence suite.
- [ ] Re-run all release checks on the final combined baseline after owner fixes; only then consider INTEGRATION_READY.

See [Task 2.5 evidence and commit plan](../audits/2026-10-13-identity-foundation-integration-readiness.md). Auth runtime remains separately BLOCKED. Final reviewer deferred one non-blocking test-harness barrier cancellation improvement.
