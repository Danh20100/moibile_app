# Credential changes MVP policy — PRO-P1-02

**Status: PROPOSED — approval required before implementation.** Current Identity is Google-only. This draft does not enable credential changes or change the Identity runtime gate. Migration `000008_identity_foundation` is frozen.

## Proposed scope

### Login email

- A login email is metadata on the existing durable User, never an identity or ownership key. Do not create/link Users, Organizations, or roles during an email change.
- Require an authenticated application session and a fresh Google ID token (`auth_time` no older than five minutes), verified signature/audience/issuer, request-bound one-use nonce, and the same immutable `(provider, canonical issuer, subject)` already bound to the current User. Do not accept a different Google subject, even if its email matches.
- Require `email_verified == true`; normalize using the existing `000008` rules. In one transaction, lock the current `user_emails` row, reject a normalized address held by another User, update its address/source/verified timestamp, and increment `email_revision` exactly once. A collision leaves the existing email unchanged and returns a generic conflict. The row keeps its stable `user_email_id` and `user_id`.
- Email OTP is not an alternate path until an approved provider and OTP policy exist. Never claim an address was verified from a UI confirmation or local state.
- On success, revoke all other sessions for the User and retain the current session; write a redacted append-only audit event. Do not log ID tokens, email challenge secrets, or raw credentials.

### Password and PIN

- Do not add password login, password reset, password setup, or PIN-based authentication in this MVP. Google remains the only sign-in and reauthentication method. Existing password/PIN screens must remain explicitly unavailable in Backend mode and must not report a successful save.
- Do not accept or persist a password/PIN from Android or Debug fixtures as an Identity credential. A future local credential product requires separate policy for hashing, recovery, rate limits, revocation, and support.

## Tests and acceptance

- Email change rejects stale/missing `auth_time`, bad signature/audience/issuer, wrong/replayed nonce, unverified email, different subject, malformed address, and collision; each rejection leaves email/session/ownership rows unchanged and emits only redacted security telemetry.
- Success changes exactly one current User email row and increments revision once; race on a normalized email yields at most one winner; repeat proof is rejected; other sessions are revoked; Organization, Listing, Tenancy, Payment and all owner references are byte/ID stable.
- Password/PIN endpoints do not exist or return unavailable, and Android Backend mode cannot claim a password/PIN change succeeded.
- Run isolated PostgreSQL concurrency/rollback tests, DTO/controller tests, Android Backend-mode negative UI tests, identity migration guard/checksum tests, typecheck/lint/build. Accept live verified Google email update only after approval, configured OAuth audience, deployment runbook review, and Android session readback. `PASS_FULLSTACK` additionally requires live device verification.

## Schema, rollback, and gates

- Prefer no migration: update `user_emails` through its existing stable-row/revision trigger and the existing session/audit tables from `000016`. If a new purpose-scoped challenge or event field is required, add an additive migration after `000016`; never edit `000008` or rewrite ownership.
- Rollback disables the email-change endpoint/client action and requires fresh login if sessions were revoked. Preserve the last committed email and append-only audit evidence; never restore an older email automatically or recycle a collided address.
- Keep Identity resolution OFF until the separately approved G1-A/G1-E/G1-S acceptance and cutover gates pass. Email-change approval alone does not enable Identity or Organization onboarding.

## Approval

| Decision | Status | Approver / date | Notes |
|---|---|---|---|
| PRO-P1-02 login-email/password/PIN MVP | PENDING | — | Approve as written or provide edits; no implementation until approved |
