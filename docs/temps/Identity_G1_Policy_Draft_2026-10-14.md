# Identity G1 policy draft — 2026-10-14

**Status: APPROVED FOR IMPLEMENTATION — runtime gate remains OFF.** Product/security owner approved G1-A, G1-E, and G1-S on 2026-10-15. Approval authorizes implementing and testing these policies; it does not authorize enabling `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED`, creating Users before the registration path is complete, claiming Organizations, or changing existing identity bindings.

This approved policy defines the implementation requirements for G1-A (legacy cutover/collisions), G1-E (verified-email registration), and G1-S (sessions/audit/revocation). Frozen migration `000008_identity_foundation` and its ownership invariants remain unchanged.

## G1-A — Legacy cutover and collisions

### Proposed policy

1. Verify the Google ID token first: configured client audience, Google issuer allowlist, signature, `exp`, and request-bound nonce. Normalize the two already-supported Google issuer aliases to the single canonical issuer stored by migration `000008`.
2. Resolve only by the unique `(provider, canonical issuer, subject)` binding. A resolved binding maps to the existing durable `user_id`; email, display name, Android state, or a deterministic subject-derived UUID is never an ownership key.
3. Legacy adoption is permitted only when an explicit, reviewed legacy-ID mapping identifies exactly one existing `users.user_id`, and that User has no conflicting identity binding. Do not discover candidates by email. Do not rewrite User IDs or reassign Organization, Listing, Tenancy, Payment, or other foreign-key ownership.
4. If aliases point to different Users, a subject maps to multiple candidates, a candidate has a different provider binding, or any legacy reference is ambiguous, reject without writes and emit a redacted audit event. No automatic merge, ownership transfer, or fallback identity creation.
5. During rollout keep the gate OFF until a read-only preflight reports zero unresolved/colliding principals and an operator has approved the exact cutover manifest. Do not run a backfill that changes ownership.

### Required tests

- Both issuer aliases resolve the same canonical binding; exact subject and audience are required.
- Existing binding resolution is stable under concurrent login and never changes `user_id`.
- Legacy candidate adoption succeeds only for the single explicitly mapped existing User.
- Missing, duplicate, conflicting, or ambiguous legacy mappings fail closed with no writes.
- Email equality never links two accounts; Organization and all existing ownership foreign keys remain unchanged.
- A migration/preflight failure leaves the gate off and existing rows byte-for-byte/ID-for-ID unchanged.

### Schema, rollback, acceptance

- No schema change is needed for the proposed MVP if the existing `auth_identities` constraints and legacy mapping input are sufficient. If an auditable cutover manifest needs persistence, add a new additive migration after `000015_user_profile_avatars`; never edit `000008`.
- Rollback means turn the gate off and stop the cutover job. Keep valid immutable bindings and all User/Organization/Payment ownership rows. Never reverse by deleting/reassigning identities. Any additive audit table is retained until its records are no longer required.
- Accept when the reviewed mapping/preflight is reproducible, all collision/no-write tests pass on isolated PostgreSQL, the frozen migration checksum is unchanged, and two approved live Google test accounts resolve to their pre-existing Users without changing ownership. This is still not `PASS_FULLSTACK` until Android journeys pass separately.

## G1-E — Google verified-email registration

### Proposed policy

1. Registration is an explicit operation. Require a Google ID token with valid signature, configured `aud`, allowed `iss`, unexpired `exp`, request-bound one-time `nonce`, non-empty `sub`, syntactically valid email, and `email_verified == true`. Require a recent Google authentication (`auth_time` no older than five minutes); request `max_age=300` when initiating the flow.
2. Existing `(provider, issuer, subject)` binding logs into its current User. A new subject may create a User only through the registration operation after all checks pass.
3. If the normalized email is already attached to any User, reject registration and direct the person to authenticate the existing account. Never link identities by email, transfer ownership, or overwrite `user_emails` to resolve the conflict.
4. Insert `users`, `auth_identities`, `user_emails` (`verification_source='google'`, `verified_at` from server time), and `user_profiles` in one transaction. Rely on unique constraints for races; a collision rolls back the entire transaction and returns a generic safe error. Do not create or assign an Organization as part of registration.
5. Do not create Users on ordinary API authentication, failed registration, missing email verification, or a resolver miss.

### Required tests

- Reject wrong audience/issuer, invalid signature, expired token, wrong/reused nonce, missing subject/email, `email_verified=false`, stale/missing `auth_time`, and malformed normalized email; assert no rows were created.
- Successful explicit registration creates exactly one User and its identity/email/profile rows atomically, with no Organization.
- Existing subject resolves to its existing User; matching email with a different subject rejects without linking or modifying either User.
- Concurrent registration of the same subject or normalized email yields one complete User at most; loser has no partial rows.
- Inject transaction failure at each insert boundary and assert complete rollback.

### Schema, rollback, acceptance

- Migration `000008` already has the required unique principal/email constraints and verification source. One-time nonce replay protection requires durable server-side challenge consumption, so additive migration `000016_identity_sessions` adds the challenge record; do not alter `000008`.
- Rollback disables the registration endpoint/feature flag. Keep legitimately created User and immutable identity rows; do not delete data or free email/principal keys for reuse. Support account closure requires a separately approved retention policy.
- Accept after backend tests pass on isolated PostgreSQL, security review confirms token/nonce handling, the production Google OAuth audience/config is verified, and live Google registration succeeds only for an explicitly registered account. Confirm no Organization or ownership is implicitly granted.

## G1-S — Session, audit, and revocation

### Proposed policy

1. Exchange an accepted Google ID token for an application session; do not use the Google ID token as the durable app session. Generate a cryptographically random 256-bit opaque refresh credential and store only its SHA-256 hash. Android stores it using platform-protected storage; API requests use short-lived access tokens (15 minutes) bound to immutable `user_id` and session ID.
2. Refresh credentials rotate on every use. Set 30-day idle and 90-day absolute lifetime. Reuse of a rotated/revoked refresh credential revokes the entire session family and emits a security event. Logout revokes the current session; “log out all” revokes all active sessions for that User.
3. Persist session state server-side: session/family IDs, User ID, credential hash, created/last-seen/idle and absolute expiry, revoked timestamp/reason, and authentication time. Authorization always derives from the session’s durable User; client-supplied User/Organization IDs cannot override it.
4. Record append-only security events for registration, session create/refresh/reuse/logout/revoke, identity collision, and reauthentication. Store event code, User/session IDs when known, timestamp, outcome, and minimal redacted request metadata; never store raw Google tokens, OTPs, passwords, or refresh credentials.
5. Destructive/sensitive operations such as Organization creation require a one-time, five-minute, operation-scoped reauthentication proof issued only after a fresh Google authentication (`auth_time` ≤ 5 minutes). Bind it to User + session + operation, consume atomically with the protected write, and reject replay or cross-operation use. Until this service contract is implemented, keep Organization creation fail-closed.

### Required tests

- Access expiry, refresh rotation, idle/absolute expiry, logout, global revoke, restart persistence, and revoked-session rejection.
- Concurrent refresh permits one rotation; replay of the old credential revokes the family; no raw credentials appear in DB/log/event payloads.
- Session User cannot be changed by request parameters; revoked sessions lose access on the next request.
- Reauthentication proof is short-lived, one-use, bound to the same User/session/operation, and consumed atomically with Organization creation; race/replay fails without duplicate Organization or role.
- Audit events are append-only, redacted, and emitted for both success and security rejection; audit write failure fails closed for security-sensitive state changes.

### Schema, rollback, acceptance

- Additive migration only, `000016_identity_sessions` after avatar-storage `000015`: one-time `identity_auth_challenges`, `auth_sessions`, immutable `auth_session_refresh_history`, and append-only `identity_security_events`, foreign keys to existing User rows, unique token hashes, expiry/revocation indexes, and constraints preventing session ownership mutation. Do not put secrets or raw tokens in these tables. Freeze down migration when live session/audit/challenge rows exist; do not cascade-delete them.
- Rollback disables session exchange/refresh and forces session revocation or expiry before returning to any previously approved authentication path. Since the current Google resolver gate is OFF, there is no safe fallback to turn on automatically. Preserve audit history and identity ownership. Any deployment rollback leaves the Identity gate OFF.
- Accept after migration up/down guards and repository tests pass; refresh/revoke/replay/race tests pass against isolated PostgreSQL; log redaction is verified; Android secure storage and logout/account-switch tests pass; and approved live Google owner/tenant accounts pass API and device verification. Only then may a separate explicit approval authorize enabling the runtime gate.

## Approval record

Approval is recorded independently for G1-A, G1-E, and G1-S below. Runtime Identity resolution remains **OFF** until the full acceptance criteria are met and separately approved. New User registration remains unavailable until its implementation is complete, and Organization creation must continue to fail closed until reauthentication proof is enforced. No `PASS_FULLSTACK` status may be inferred from backend contract tests.

| Decision | Status | Approver / date | Notes |
|---|---|---|---|
| G1-A legacy cutover/collisions | APPROVED — implementation pending | Product/security owner / 2026-10-15 | Exact policy above approved; runtime gate remains OFF until acceptance |
| G1-E verified-email registration | APPROVED — implementation pending | Product/security owner / 2026-10-15 | Explicit registration only after implementation; email alone never links identities |
| G1-S session/audit/revocation | APPROVED — implementation pending | Product/security owner / 2026-10-15 | Organization create remains fail-closed until operation-bound proof is enforced |
