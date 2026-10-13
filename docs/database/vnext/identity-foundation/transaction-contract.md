# Frozen Identity Foundation transaction contract

Status: REVIEWED_FROZEN; version vnext.identity-foundation.1; source HEAD 079047bc986e71a2993959c0e7c22cc6834deaeb. Runtime activation BLOCKED.

### 4.1 Google principal resolution and registration

Verify Google proof outside the database transaction; reject unsupported issuer, invalid signature/audience/expiry and missing subject before resolution. A verified subject permits computing the two historical IDs using the unchanged `googlePrincipalUserId` algorithm for `accounts.google.com` and `https://accounts.google.com`; canonicalizing the lookup key must not change either historical derivation.

Proposed concurrency strategy: use READ COMMITTED and acquire a transaction-scoped advisory lock derived from the canonical provider-principal key **before** any candidate reads. All resolver/binding writers must use the same lock namespace/key; a hash collision only serializes unrelated principals, never identifies a User. Keep the full principal UNIQUE constraint authoritative. After acquiring the lock, new statements read the committed winner; REPEATABLE READ snapshots taken before waiting are unsuitable without restart. Lock existing User rows in sorted UUID order after the principal lock; all credential/email writers lock the owning User before dependent rows. Lock timeout/deadlock/serialization failures roll back and retry only the entire transaction under a bounded operational policy. [PostgreSQL locking documentation](https://www.postgresql.org/docs/current/explicit-locking.html) supports transaction-scoped advisory locks; the choice/key implementation still requires review.

Within one transaction:

1. Read canonical `(google, https://accounts.google.com, subject)` binding and check supported legacy candidate Users. If a mapping exists, its owner must be compatible with existing candidates. If both distinct legacy Users exist, or any binding conflicts, fail closed with no reassignment/merge; G1-A owns remediation. Email never breaks this tie.
2. If there is no mapping and exactly one legacy User exists, bind that same User using the verified proof. If neither exists, only the explicit Google registration flow may create one, using the existing derivation from the verified issuer. Insert a new User strictly; unexpected UUID conflict must restart resolution/return conflict, never blindly attach via `ensureUser` and assume ownership. A protected request may resolve an existing account but cannot register one.
3. Initialize missing Profile and verified primary email only under this Google initialization contract; require verified email proof and honor G1-E collision/completion policy. Profile insertion is `ON CONFLICT DO NOTHING` semantics, never an update from provider claims. Existing email/edited Profile are preserved. A resolved legacy User may acquire a provider mapping independently of email/name completion, preserving existing Google access; fresh proof initializes required rows in one separate initialization transaction when ready. A new User cannot be committed without its required verified email and initial Profile. Any proposed OTP pending-registration proof stays outside these four durable tables and is subject to G1-E approval.
4. Commit User + canonical binding + required initialization atomically. On principal uniqueness/serialization conflict, roll back the whole attempt (including any candidate User/Profile/email), retry by resolving the winner and validate its owner. Do not retry an email ownership conflict as a merge. Use bounded, reviewed operational retries, without an invented business retry policy.

The canonical-principal unique constraint plus complete rollback/re-resolution handles simultaneous first registrations carrying opposite aliases. When an existing User row exists, locking it serializes initialization and credential changes; locking an absent mapping row alone does not protect first registration. Cutover must retire all legacy direct-ID writers before this guarantee is claimed. In particular, both `IdentityAccessService` and `AuthGuard` currently invoke `verifyGoogleIdToken`, which derives a UUID directly: Account Verification must route verified proof from both through the shared resolver. Google and password sessions must use the resolved User consistently for every subsequent request.

No bulk issuer/subject backfill can be inferred from a UUID. Existing accounts without fresh proof remain uninitialized. Do not adopt a second User through matching email, create alias rows that point to different Users, or change Organization, Participant or financial FKs.

### 4.2 Password setup, login and recovery

- Setup requires a resolved Google-registered User and approved secure reauthentication bound to the setup action. Compute the expensive salted hash outside a row-locking transaction; then revalidate proof and expected credential state inside the commit boundary. Lock the User and insert a credential only if none exists. Concurrent setup cannot turn into last-writer-wins replacement.
- Password login looks up the unique approved normalized primary email, verifies the owning User's stored hash, and uses the common G1-S session protocol. Missing/ambiguous email or credential cannot register, attach a provider or bypass reauthentication. To prevent a password-reset race, recheck the credential revision, current primary email row/key/revision and account/session eligibility before issuing authentication; a stale successfully verified hash must not issue a session after it has been replaced.
- Change/recovery binds proof to User, purpose, target email where applicable, and expected credential revision (or explicit absence for approved setup), plus expected email revision where applicable. Lock/revalidate and perform compare-and-swap replacement. Reset versus change, reset versus login, and reset versus rehash races must fail/retry against current state without overwriting a newer password. Approved rehash uses the same revision check.
- Consume a recovery/sensitive-operation proof only for its permitted operation. Proposed Redis/PostgreSQL failure policy: atomically consume the purpose-bound Redis proof before the database write; revalidate target/revision in PostgreSQL; a database rollback or crash burns the proof and requires fresh approved proof. Never restore consumed proof or fabricate success. This deliberately fail-closed cross-store contract cannot claim a distributed transaction; user-visible retry semantics and proof eligibility remain G1-R/G1-O review items.
- A recovery proof cannot create a User, silently perform first-password setup for a Google-only account, replace primary email or issue a normal authenticated session. G1-R must explicitly govern accounts with no password and acceptable reauthentication factors. Do not assume an old `email_verified` claim is fresh recovery proof.
- Password replacement, required audit evidence and revocation/session-version mutation must be atomic when the G1-S protocol uses PostgreSQL, or use its reviewed consistency mechanism. Missing security prerequisites fail closed. The precise session-revocation scope and evidence lifecycle remain OPEN, not an implied default.


### 4.4 Primary-email change and stale-proof protection (PROPOSED)

Account Verification supplies existing resolved User, accepted purpose-bound reauth, target-address proof and expected current `user_email_id/email_revision`; proof binds normalized target and User. The database lane does not interpret tokens/OTP or infer authorization from a User FK.

1. Normalize the target under the approved policy before hashing/proof delivery; no target-only OTP can change an account. Consume approved proof under the reviewed fail-closed Redis/PG boundary.
2. In PostgreSQL lock User then current email row, compare stable row ID/current revision and recheck eligibility. If an identical normalized address is reverified, apply reviewed idempotency/revision semantics; it is not an ownership transfer. A concurrent change or stale proof returns a typed stale-state result.
3. Update the same row's accepted address, normalized key, proof metadata and increment revision. UNIQUE address enforces collision even across different Users; two competing claimants cannot both commit. Concurrent exchanges may deadlock/collide; roll back, never drop uniqueness or temporarily clear primary email. Use bounded whole-operation retries only with still-valid proof; burned proof requires fresh proof.
4. Commit required security audit and session/recovery invalidation under G1-S's reviewed durable transaction contract. If that sink/contract is unavailable, do not enable the operation. After commit, old address cannot perform password lookup, old-email OTP fails revision checks, and later Google claims cannot restore it. Password ownership stays by User; no hash is moved.

A primary-email login lookup returns row ID/revision along with User/credential revision; before session issuance the runtime must atomically validate all observed versions with its session issuance contract. A check followed by an unrelated asynchronous session write leaves a race. Session/audit sink design is intentionally not invented in this four-table proposal.

### 4.5 Compatibility inventory, cutover and conflicts (PROPOSED)

Source scan at HEAD finds one direct User creator: `IdentityAccessService.authenticateWithGoogle` calls `identity.ensureUser(principal.userId)`. `verifyGoogleIdToken` creates the raw UUID used by both login and `AuthGuard`; the guard itself does not persist Users but can direct authorization to the wrong alias User. `getSessionContext` projects provider claims and reads relationships using that UUID. Durable consumers must receive persisted Profile/email and resolved User. No other production caller of `ensureUser` or `googlePrincipalUserId` was found; repeat the scan against integration and Account Verification before cutover, since this finding is not a global deployed-writer inventory.

Deploy additive schema after review without changing existing FK roots. Prepare the shared resolver/runtime and compatible response contract; drain or gate old direct-ID registration writers during activation and route both login and guard through the resolver. Do not activate an alias-safe login with an old guard, or roll back to raw-ID writers after mapping activation. Keep old Google clients supported via reviewed Google-bearer-to-resolved-User compatibility until common session transition is approved; do not assume replacing all bearer tokens atomically is possible. Rollback is feature-off/forward correction preserving mappings, not dropping populated rows/rekeying Users. Old-writer fencing and backward client/session behavior need G1-A/G1-S sign-off.

For dual legacy UUIDs or incompatible mapping, reject before any account-private/domain operation. Produce restricted conflict evidence; inventory both Users and all references read-only, then follow the decision register's separately authorized remediation workflow. A mapping without either legacy candidate is incompatible under the current deterministic-ID contract and fails closed; a future import mechanism needs explicit approval. Freshly verified subject proof cannot establish that either unrelated arbitrary UUID is its owner. No automatic merge, delete, email-based selection or FK reassignment.

### 4.6 Future test matrix — designed, not executed

| Case | Assertions / layer |
| --- | --- |
| Normalization | Domain case/IDNA and ASCII local-case variants match/collide under F-E1; Gmail dot/plus untouched; Unicode local/quoted/list/domain-literal input rejects under proposed MVP policy. Port/runtime tests under the now-approved F-E1 policy. |
| Duplicate email | Two different subjects claiming same normalized primary: only one completed registration, other typed conflict, no partial User/binding/Profile; DB transaction test. |
| Alias compatibility | Each legacy UUID vector unchanged; either issuer resolves mapping/one legacy candidate to same original User; references unchanged. Helper + resolver/real DB. |
| No legacy User / alias race | Opposite issuers start simultaneously, many repetitions; one User/binding/email/Profile committed, both successful retries resolve same UUID. Winner is first committed valid transaction, not email selection. Real DB. |
| Legacy conflicts | Two UUID candidates, incompatible mapping, arbitrary mapping owner: deny resolution/protected access, zero ownership/ref writes; typed conflict audit where safe. Resolver + DB. |
| Existing mapping / new claims | Edited email/name, cleared/missing existing Profile, name change: preserve rows; only self completion changes NULL. Missing/unverified email cannot invalidate an existing complete account's Google principal. Runtime + DB. |
| Completion / authorization | Absent/invalid seed enters completion; same-User valid name succeeds, cross-User edit denied, rejected input never truncates; legacy relationship permissions conserved. Runtime + DB. |
| Primary-email change | Reauth + new verification + revision CAS; duplicate target aborts; concurrent changes one wins, old-address lookup/proofs reject, UUID/credential owner unchanged; audit failure rolls back. DB + security runtime. |
| Credential races | Two first setups one wins; reset/reset, change/reset, rehash/reset reject stale CAS; login verified before reset/email change cannot issue later session from stale state; no revision reuse after rehash. DB + session runtime. |
| Proof failure | Wrong purpose/User/email revision, replay, expiry, resend accumulated attempts, Redis outage/restart, delivery failure and consume-before-DB crash fail closed; OTP never registers/session-issues. Auth-lane tests after parameters approved. |
| Atomic rollback | Inject failure after User, binding, email, Profile and required audit/session mutations; no partial completed account, winner rows unaffected; burned proof not restored. Real DB + runtime fault injection. |
| Upgrade / immutable roots | Populated v1 snapshot, nullable Participant, organization/tenancy/payment refs and historical migrations unchanged; legacy rows remain valid without fabricated mappings; isolated fresh/upgrade/down-up on empty fixture only after authorization. |
| Cutover | Old writer excluded; legacy Google bearer and both new auth methods resolve same User; mixed version rejected/gated; no raw guard fallback. Integration/deployment rehearsal. |

### 4.7 Proposed durable repository handoff

These are interface review candidates for the existing identity repository/transaction manager, not implemented methods or auth runtime. All operations take the current transaction executor; no repository starts an independent transaction. Account Verification verifies/consumes proof; Profile persists vetted outcomes. Hash reads use a credential-only projection.

- `lockGooglePrincipal(principal)` and `readGoogleResolution(principal, legacyUserIds)` return mapping/candidate owners under the shared lock; binding insert is immutable and conflicts return `principal_conflict`, not upsert-owner.
- `createGoogleUserFoundation(input)` atomically inserts User/canonical binding/verified email/Profile, returning resolved User and completion state; `initializeLegacyFoundation(input)` locks the existing User and inserts only missing approved rows. Inputs include explicit timestamps/proof source, normalized key and initial revisions; no fabricated defaults.
- `findPrimaryLogin(normalizedEmail)` returns stable email row/User/email revision and optional credential-only hash/revision. No lookup creates or links a User.
- `replacePrimaryEmail(userId, expectedEmailRowId, expectedRevision, verifiedTarget)` returns `updated | stale_state | email_conflict`; it requires the caller's reviewed same-transaction audit/session collaborator before activation.
- `insertPasswordCredential(userId, expectedAbsent, encodedHash)` and `replacePasswordCredential(userId, expectedRevision, encodedHash, kind)` return `updated | stale_state`; setup requires existing Google binding. The runtime owns proof eligibility; repository checks absence/current revision and never interprets mailbox OTP as reauth.
- `initializeProfileIfAbsent` never updates on conflict; `updateOwnDisplayName` consumes the runtime-authorized resolved User/validated value, locks consistently and returns persisted Profile. Session context excludes hashes/provider subject and uses persisted current email/name.

The following **PROPOSED review signatures** replace the earlier method sketches as the handoff contract. No production interface is created. Lock-key implementation and the common session/audit collaborator remain auth-lane review items; their absence blocks activating sensitive writes, not independently creating these four tables.

```ts
import type { Transaction } from 'kysely';
import type { Database } from '../../../src/infrastructure/database/schema.types';

type Tx = Transaction<Database>;
type UserId = string; // Existing UUID representation; never an email-derived ID.
type Revision = string; // Positive base-10 PostgreSQL bigint, never lossy JS number.
type Instant = string; // Validated UTC ISO-8601 timestamp supplied explicitly.
type GoogleIssuer = 'accounts.google.com' | 'https://accounts.google.com';
type GooglePrincipal = { issuer: GoogleIssuer; subject: string };
type VerifiedEmail = {
  address: string; normalizedEmail: string;
  verifiedAt: Instant; verificationSource: 'google' | 'email_otp';
};
type EmailRow = VerifiedEmail & {
  userId: UserId; userEmailId: string; emailRevision: Revision;
};
type ProfileRow = {
  userId: UserId; displayName: string | null;
  createdAt: Instant; updatedAt: Instant;
};
type CredentialRow = {
  userId: UserId; passwordHash: string; credentialRevision: Revision;
  createdAt: Instant; passwordChangedAt: Instant;
};
type ErrorCode = 'user_not_found' | 'principal_conflict' | 'legacy_conflict'
  | 'email_conflict' | 'stale_state' | 'credential_exists'
  | 'google_binding_required' | 'profile_missing';
type Result<T> = { ok: true; value: T } | { ok: false; error: ErrorCode };
type Resolution = { kind: 'resolved'; userId: UserId }
  | { kind: 'unregistered' };
type LoginSnapshot = {
  userId: UserId; userEmailId: string; normalizedEmail: string;
  emailRevision: Revision; credentialRevision: Revision;
};

interface IdentityFoundationPersistence {
  resolveGooglePrincipal(tx: Tx, principal: GooglePrincipal): Promise<Result<Resolution>>;
  createGoogleUserFoundation(tx: Tx, input: {
    principal: GooglePrincipal; email: VerifiedEmail;
    displayName: string | null; now: Instant;
  }): Promise<Result<{ userId: UserId; email: EmailRow; profile: ProfileRow }>>;
  initializeLegacyFoundation(tx: Tx, input: {
    principal: GooglePrincipal; userId: UserId; email: VerifiedEmail;
    displayName: string | null; now: Instant;
  }): Promise<Result<{ email: EmailRow; profile: ProfileRow }>>;
  findPrimaryLogin(tx: Tx, normalizedEmail: string): Promise<{
    email: EmailRow; credential: CredentialRow | null;
  } | null>;
  replacePrimaryEmail(tx: Tx, input: {
    userId: UserId; expectedEmailId: string; expectedEmailRevision: Revision;
    target: VerifiedEmail;
  }): Promise<Result<EmailRow>>;
  initializeProfileIfAbsent(tx: Tx, input: {
    userId: UserId; displayName: string | null; now: Instant;
  }): Promise<Result<ProfileRow>>;
  updateOwnDisplayName(tx: Tx, input: {
    userId: UserId; displayName: string; now: Instant;
  }): Promise<Result<ProfileRow>>;
  insertPasswordCredential(tx: Tx, input: {
    userId: UserId; encodedHash: string; now: Instant;
  }): Promise<Result<CredentialRow>>;
  replacePasswordCredential(tx: Tx, input: {
    userId: UserId; expectedRevision: Revision; encodedHash: string;
    kind: 'change' | 'reset' | 'rehash'; now: Instant;
  }): Promise<Result<CredentialRow>>;
  validateLoginSnapshot(tx: Tx, expected: LoginSnapshot): Promise<Result<LoginSnapshot>>;
}
```

- Only verified Google proof reaches principal methods; repository canonicalizes the lookup issuer, computes **both** unchanged legacy IDs itself, locks principal then User(s) in sorted order, and never selects by email. Resolution may bind one proven legacy User; it cannot register. Creation rechecks unregistered state under that same lock, derives the ID from verified actual issuer and inserts all four required foundation facts atomically (credential remains absent). If another transaction won, return `stale_state` for whole-operation re-resolution, not an owner-changing upsert.
- Legacy initialization verifies the resolved mapping owner equals `input.userId`. Existing email/Profile is returned unchanged, including NULL/edited values. Proof-derived email is inserted only when missing; an occupied address returns `email_conflict` without undoing pre-existing ownership. New registration requires email/Profile, legacy mapping-only resolution does not attest completion.
- Profile initialize returns existing row unchanged; same-User edit uses an already authorized resolved User, locks User and updates only validated text/timestamp. Concurrent self edits serialize with last committed edit winning; no optimistic Profile revision is proposed. Missing edit row returns `profile_missing`, then the approved self-completion flow initializes it; Google never fills an existing NULL name.
- Credential insert locks User, requires a Google binding and absent row, sets revision 1; second setup returns `credential_exists`. Replacement locks User/credential, requires expected revision, increments it with overflow rejection and preserves creation time. Change/reset update secret-change time; rehash preserves it. Email change likewise increments the stable email row revision and preserves User/credential ownership. No credential/email delete-reinsert operations exist.
- Account Verification verifies reauth/OTP/target normalization/secret policy before repository calls; types are **not** proof of authorization. Expensive hash verification runs outside locks. `validateLoginSnapshot` locks User/email/credential and compares row ID, current key and both revisions; `stale_state` rejects stale success. Locks must remain held through the accepted same-transaction session issuance/audit operation; returning success then writing a session outside this transaction is unsafe. Missing durable session collaborator leaves password activation disabled.
- Domain conflicts return typed results; orchestrator must abort the **whole transaction** on any failed mutation result (returning `{ok:false}` from a transaction callback must not accidentally commit earlier writes). Use abort/rollback semantics at the transaction boundary. SQL uniqueness/FK errors first require rollback/savepoint handling before any further query; do not catch and keep using an aborted PostgreSQL transaction. Deadlock/serialization/lock timeout return a sanitized retryable transaction failure through the existing error mapper, never a guessed User or successful no-op. Retry the full transaction after rollback under reviewed bounded operational limits; no email-owner conflict retry becomes a merge.
- Only restricted credential verifier/writer consumes `CredentialRow`; Profile/session DTOs cannot include hash/provider subject. Required audit/revocation collaborators run in the same accepted commit boundary; failing collaborator rolls back the mutation. Proof burned before DB failure requires new proof. Exact auth event/session storage remains independently scoped, not extra fields/defaults in these four tables.


