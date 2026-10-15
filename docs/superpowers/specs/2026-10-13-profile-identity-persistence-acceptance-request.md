# Account Verification — minimal persistence acceptance request

**Acceptance recorded: ACCEPTED_WITH_NON_SCHEMA_CONDITIONS, owner-confirmed 2026-10-13.** Review version `vnext.identity-foundation.1`, baseline `079047bc986e71a2993959c0e7c22cc6834deaeb`; owner reports two independent reviewers found no schema-changing blockers. Formal freeze is complete; runtime proof/session/audit dependencies remain separately blocked. This record does not claim a new message was sent to another lane.

**Review artifacts:** [minimal addendum](../../database/vnext/identity-foundation/README.md), [typed API and error/transaction rules](2026-10-12-profile-identity-foundation-physical-proposal.md#47-proposed-durable-repository-handoff), [approved decisions](2026-10-12-profile-identity-decision-register.md#owner-approval--minimal-physical-contract-2026-10-13).

| Acceptance item | Contract to confirm | Effect of rejection |
| --- | --- | --- |
| Principal resolution/locking | Verified proof only; canonical issuer lookup; unchanged two legacy UUID candidates; fail closed on dual/inconsistent owners; transaction-scoped principal lock then sorted User locks; UNIQUE authoritative; registration retries whole transaction, never merges by email | If lock/owner contract requires durable state, revise `auth_identities`; old-writer fencing timing alone is runtime-only |
| Email initialization/change | Original address preserved; ASCII local-part lowercase + lowercase IDNA domain key; no dot/plus folding; one verified current row; stable row ID and positive decimal bigint revision; CAS change releases old key, never changes credential/User ownership | Identify exact extra fields/constraints if needed; OTP TTL/missing-email UX alone is not a table blocker |
| Old proofs / stale login | Proof binds User, stable email row/revision, purpose and target; old revision always invalid after committed change. Login carries email and credential snapshot, revalidates under User lock before accepted atomic session issuance | If session generation must live in these four tables, specify it before freeze; alternatively keep sessions independent and activation disabled pending session collaborator |
| Profile | Nullable name means completion needed; initial insert leaves existing row untouched, including NULL; same resolved User only may complete/edit; Backend validation; no public projection | Exact API length/completion restrictions remain runtime-only unless a new persisted field/SQL CHECK is requested |
| Credential | Optional one row/User; secure encoded salted Argon2id with SQL prefix guard plus full library validation; absent-state setup under User lock; positive monotonic bigint CAS; reset/change/rehash version checks; no removal/delete-reinsert; same-secret rehash preserves secret-change timestamp | Identify any generation/lifecycle persistence need before freeze; library/work factors/benchmarks are runtime-only |
| Transaction/error boundary | Port methods use caller transaction; failed mutation result aborts whole transaction. Unique violations require rollback/savepoint handling; never continue an aborted PG transaction. Typed conflict/stale results; bounded whole-transaction retry only after rollback | Agree exact error mapping/abort integration before repository implementation; no fake success/no-op collaborator |
| Audit/revocation dependency | Sensitive mutation + mandatory audit/revocation requires accepted atomic consistency boundary. Four-table addendum adds no session/event store; runtime activation stays disabled until collaborator exists | Explicitly confirm **no required durable columns in these four tables**, or name schema-changing dependency; protocol/lifetimes/retention alone stay independent |

### Reviewer response required before formal freeze

Record reviewer/lane, date and exact artifact/version reviewed. For each row respond `ACCEPTED` or `CHANGES_REQUIRED` with the concrete schema/API consequence. A valid minimal acceptance may confirm four-table shape while leaving auth runtime activation OPEN. Owner approval is not reviewer acceptance; documentation self-check is not a substitute.

### Accepted dependency boundaries (owner-approved; lane confirmation pending)

Profile Database owns additive durable tables/types/repository transactions only. Account Verification owns verified Google resolution orchestration, reauth/hash/OTP/recovery/common session runtime and all old-writer/guard cutover. No alternate tables/migrations, User algorithm, account merge, successful no-op audit or OTP-created session. Required session/event tables, if selected, need a separately reviewed addendum/migration; do not modify these four tables speculatively.


## Formal freeze — current authority

Owner confirmed Account Verification ACCEPTED_WITH_NON_SCHEMA_CONDITIONS on 2026-10-13 for vnext.identity-foundation.1 at Profile HEAD 079047bc986e71a2993959c0e7c22cc6834deaeb, and authorized formal freeze/Database Implementation. The separate addendum is now REVIEWED_FROZEN; exact-byte SHA-256 fingerprints are in `docs/database/vnext/identity-foundation/freeze-manifest.json`. Earlier acceptance-pending statements are historical and superseded. Runtime activation remains BLOCKED; no session/audit/OTP/Google guard runtime is included.
