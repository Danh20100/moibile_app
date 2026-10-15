# Minimal Identity Foundation vNext addendum

**Current status: REVIEWED_FROZEN — `vnext.identity-foundation.1`.** Account Verification acceptance: `ACCEPTED_WITH_NON_SCHEMA_CONDITIONS`, owner-confirmed 2026-10-13. All four tables are frozen. [Freeze manifest](freeze-manifest.json) fingerprints exact logical/physical JSON and transaction contract. Database implementation and real PostgreSQL verification are complete in the uncommitted worktree; runtime activation remains BLOCKED. Canonical v3.7 and Database v1 remain unchanged.

See [implementation report and handoff](../../../superpowers/audits/2026-10-13-identity-foundation-implementation.md) for migration ordering, actual tests and remaining integration conditions. The preparation sections below retain historical evidence; their future-tense tasks were completed under the subsequent Task 2 authorization.

## Physical readiness checks

- Existing User is an external immutable root. All new User FKs use NO ACTION for deletion/update; no User back-FK requiring legacy initialization. No ownership/reference rekey.
- Every column has explicit nullability and no SQL default. Display name is the only nullable foundation field. No generic JSON payload, global role, public field, secondary email or new session/event/history table.
- UNIQUE User email index already serves ownership lookup; User PKs serve Profile/credential lookup. No duplicate indexes or display-name uniqueness.
- SQL positive counters, nonempty strings, ASCII-lowercase login-key guard and Argon2id encoding-prefix guard are structural guards. Repository CAS enforces monotonic revisions; restricted writer operations enforce binding immutability/no deletion. UNIQUE/CHECK does not itself prove Google/email verification or password strength. The Argon2id prefix check does not validate salt/parameters/strength; dedicated hash library validates full encoding. No work factors are selected in SQL.
- Atomic new registration establishes User/binding/email/Profile; legacy mapping-only resolution and later missing-row initialization remain distinct. No invented bulk mapping from UUIDs.
- A schema-only migration is independent of OTP TTL, session lifetime, reauth UX, Argon2id benchmark and operational cutover. Runtime operations remain disabled where proof/session/audit requirements are unresolved. Any newly selected durable dependency needs separate scope review before activation.
- Current source schema and all v1 assets remain immutable. Future SQL/Kysely addendum validation and real-DB upgrade/concurrency/rollback tests are required during separately authorized implementation; documentation checks do not attest a migrated database.

## Database Implementation tasks (after acceptance/freeze and authorization)

1. Record Account Verification acceptance or exact schema-changing objections; promote only the accepted addendum to REVIEWED_FROZEN. Keep runtime gate OPEN.
2. Recheck integration/lane migration inventory with Duy Anh and allocate next unused number. Read-only preflight found `000006_demo_gateway` and `000007_sepay_production` at integration HEAD `55985da`; no number is reserved here.
3. Write an additive four-table wrapper/up/down under the then-allocated number; no rewriting v1/payment migrations. Define empty-fixture down/up only and populated forward recovery retaining evidence/ownership.
4. Extend existing Kysely schema types, identity port/repository and transaction wiring with the accepted API; implement canonical locking/resolution, original/key normalization boundary, stable email CAS, insert-only Profile/self-edit and credential CAS. No OTP/password/session endpoint runtime in Profile lane.
5. Add separate vNext catalog validator/tests, FK/UNIQUE/nullable/revision tests and the [real-DB concurrency/rollback matrix](../../../superpowers/specs/2026-10-12-profile-identity-foundation-physical-proposal.md#46-future-test-matrix--designed-not-executed). Exercise case-only email collision, dot/plus distinction, issuer races, legacy conflicts, profile preservation, stale CAS and unchanged original references.
6. Run actual isolated fresh/upgrade/rollback/concurrency checks plus frozen-v1 conformance; record results. Handoff persistence to Account Verification; runtime cutover/activation requires its independent security/session gate.


## Verification actually executed for this preparation

Documentation/addendum self-check passed: four matching logical/physical entities, explicit nullability/no defaults, one nullable display-name field, User FKs, PK/UNIQUE/index references, 17 unique bounded constraint/index names, C-collated email key and credential prefix/revision guards; 40 local Markdown links resolved. All 11 pre-existing changed/untracked files are preserved, with six byte-identical and only five intended spec/plan/checklist documents edited. Protected production/Android/Database v1/migrations/dependencies, index and HEAD unchanged; `git diff --check` passed.

Local migration inventory checked 26 Git refs; maximum observed wrapper number 7. No remote freshness guarantee/number reservation. This verification parses/reviews documentation only: no SQL/PG execution, migration, runtime test, hash benchmark or cross-lane acceptance result is claimed. Current reviewer acceptance remains OPEN.


## Formal freeze — authoritative current status

REVIEWED_FROZEN, version vnext.identity-foundation.1, baseline HEAD 079047bc986e71a2993959c0e7c22cc6834deaeb. Account Verification acceptance confirmed by owner: ACCEPTED_WITH_NON_SCHEMA_CONDITIONS, 2026-10-13. Earlier pending statuses above are historical. [Freeze manifest](freeze-manifest.json) fingerprints logical/physical JSON and [transaction contract](transaction-contract.md). Runtime activation stays BLOCKED; Task 2 Database Implementation only is authorized.


## Task 2.5 - current integration readiness

**BLOCKED for release baseline failures; four-table REVIEWED_FROZEN unchanged.** [Combined verification and commit plan](../../../superpowers/audits/2026-10-13-identity-foundation-integration-readiness.md) records actual integration1-8 tests after JSON fixture refactoring. Identity DB19/19 and backend406/406 pass; full persistence65/75 pass, ten failures require Payment/rental lane fixes.

The approved artifact bytes use CRLF. Three narrow -text attributes preserve the exact existing fingerprints during Git clean/checkout; static verification checks this. The earlier LF-attribute claim was incorrect and is superseded by Task2.5 evidence. Frozen JSON/transaction bytes, version and hashes remain unchanged. Runtime activation remains BLOCKED.
