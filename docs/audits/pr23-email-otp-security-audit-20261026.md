# PR #23 email OTP security audit

Date: 2026-10-26
Decision: **BLOCKED. Keep the PR draft and do not merge.**
Audited head before fixes: `91131cfcfb7323c14f75c6ee86f52e48949108a3`.
Compared main baseline: `9ab30c88d1939d88b86660e45a7c694f85eface2`.
Scope: selective OTP integration branch, not `backend/registerOTP`.

## Findings and fixes

| Finding | Change | Evidence and remaining limit |
|---|---|---|
| The Nodemailer package entry in the lockfile was null, crashing frozen installs in both pnpm 10 and 11. | Restore published package integrity metadata and engine requirement without upgrading other locked packages. | pnpm 10 frozen installation passes; native build/typecheck/lint and focused tests re-run against locked versions. |
| Concurrent wrong guesses could all inspect the old attempt count before the follow-up failure transaction committed. | Commit failed attempts and rejection events in the original mailbox-locked transaction; return the HTTP rejection after commit. SQL also caps attempts and checks expiry/budget on consumption. | Real PostgreSQL regression authored; execution blocked. |
| Expiry was sampled before waiting on the mailbox lock; resend responses used a different clock from issuance. | Recheck after acquiring the lock; derive resend availability from the actual issued expiry. | Expiry-wait and issuance-clock assertions authored; PostgreSQL execution blocked. |
| Consuming or superseding a challenge bypassed resend cooldown. | Check the latest issued challenge, including settled challenges. | Consumed and delivery-failed recovery cases covered by pending PostgreSQL tests. |
| A late failure sending an older code invalidated a newer code for the same mailbox. | Supersede only the issued challenge ID while holding its mailbox lock. | Deferred sender regression authored; PostgreSQL execution blocked. |
| Registration/reset hashing ran before cooldown or OTP validation. | Hash only after the relevant locked checks; throttle public issuance/verification before entering the service. | Source review and compilation pass; actual database contention remains unverified. |
| Only registration consistently enforced canonical mailbox ownership. | All relevant email writers take the canonical mailbox lock; a unique canonical index rejects alias collisions. Never merge users based on email. | Collision/race/rollback tests authored; PostgreSQL execution blocked. |
| An old recovery code could target a changed email/password identity. | Bind recovery codes to user ID, email revision and credential revision; validate the snapshot under the user lock. | Revision-change tests authored; PostgreSQL execution blocked. |
| No shared source/global throttle protected the public OTP endpoints. | Durable HMAC-keyed fixed-window buckets, source before global, atomic conditional UPSERT, bounded expired-row cleanup. Exhausted sources cannot consume the shared budget. | Native guard tests pass; actual PostgreSQL concurrency test not executed. |
| SMTP could downgrade to plaintext, wait without explicit deadlines, or return a rejected recipient as success. | Require TLS, preserve certificate validation, bound transport deadlines, reject unsuccessful recipient acceptance. | Native transport/config tests pass. No actual email delivery was performed. |
| OTP could be enabled while its required Identity foundation remained disabled. | Reject this configuration at startup; disabled OTP leaves other auth flows available. | Native config tests pass. |
| Reset delivery errors revealed eligible-account status. | Return the same accepted response on delivery failure, while invalidating the failed challenge. UI says a code is sent only if the mailbox is eligible. | Status/body behavior covered by pending PostgreSQL tests. Synchronous SMTP timing is still observable; registration already intentionally exposes existing-account conflicts. No claim of timing indistinguishability. |
| Malformed challenge IDs reached PostgreSQL UUID conversion; request bounds and documented status were incomplete. | UUIDv4 validation, bounded email input, explicit HTTP 200 and no-store on the four OTP operations; publish those operations and referenced OpenAPI schemas. | Native DTO/metadata/OpenAPI tests pass. |
| Android reused a challenge across signup/reset and accepted stale request completions after input edits. | Purpose/generation ownership, invalidation on navigation and credential/consent changes, preserve local/demo signup behavior. | Seven isolated Kotlin lifecycle tests pass. Full UI compilation not verified. |
| Android accepted stale verification callbacks and could resurrect credentials after logout. | Cancel OTP verification on invalidation; guard both result branches; validate context before storing tokens and check cancellation inside the same lock used to clear credentials. | Independent source review; real Android repository concurrency integration remains unverified. |
| Ported integration tests invoked methods absent from the selectively integrated service. | Exercise the actual main password/session service, current-password change and PIN preservation; choose an incorrect code deterministically. | Both TypeScript projects compile. Database-backed behavior remains unverified. |
| Existing PIN code failed the repository ESLint rule for an overwritten initializer. | Remove only the redundant initializer. Both try/catch assignments and runtime decisions are unchanged. | Source diff, lint and focused main regression tests pass. |

## Required-check ledger

| Check | Result |
|---|---|
| `pnpm 10 install --frozen-lockfile --ignore-scripts` | PASS after the lock metadata fix. Native package install hooks are not required for these build/tests. |
| `npm run typecheck` | PASS, production and test projects. |
| `npm run build` | PASS. |
| `npm run lint` | PASS after the behavior-preserving initializer fix. |
| Native OTP config/SMTP/guard/hasher/sign-in/API tests | PASS, 31 tests. Transport doubles verify configuration/behavior only. |
| Main password/QR/OpenAPI/frozen-Identity focused tests | PASS, 10 tests. |
| Isolated production Kotlin lifecycle helper + JUnit | PASS, 7 tests. Mutation control fails as expected. This is not an Android application build. |
| `npm test` | BLOCKED by the environment denying the tsx CLI IPC socket with `EPERM`. |
| Equivalent native runner, all repository spec/test files, concurrency 2 | NOT GREEN: database-required runtime HTTP suite and tenancy-join integration cannot run without isolated DB configuration. All other executed assertions pass. 560 tests: 555 pass, 1 fail and 4 cancelled by the database-required HTTP suite setup. No failure is waived. |
| OTP/collision PostgreSQL integration | BLOCKED: no supported nonroot PostgreSQL runtime and no isolated `TEST_DATABASE_URL`. Three tests fail their required-environment assertions; the rate-bucket integration test reports one skip. A skip is not a pass. |
| Migration parity integration | BLOCKED: 12 tests require the isolated database. No migration was run. |
| `:app:compileDebugKotlin` | BLOCKED before Kotlin compilation: Gradle cannot resolve AGP 9.2.1 because Java networking to the Android Maven repository fails. Android SDK is also absent. |
| Real SMTP/mailbox and Android end-to-end OTP acceptance | NOT RUN. No authorized nonproduction mailbox/SMTP configuration was available. No mock result is presented as actual OTP delivery or end-to-end success. |

## Migration and compatibility boundaries

- Existing migrations 000018 KYC, 000019 PIN and 000020 tenancy invitations remain byte-for-byte unchanged in this fix commit. Original OTP migrations 000021/000022 remain additive and unchanged.
- New 000023 adds canonical mailbox uniqueness. Existing alias collisions cause migration failure without deleting or merging accounts. Deployment must resolve them through an explicit reviewed policy; do not change the index or force migration success.
- New 000024 binds recovery proofs, invalidates pre-upgrade recovery challenges, caps stored attempt counts and indexes the latest mailbox issuance.
- New 000025 creates only internal OTP rate buckets. Roll back new migrations in reverse order. Up/down behavior still requires actual PostgreSQL verification.
- Password login, current-password change, Google and PIN retain their existing routes, service semantics and session lifetimes. The existing session service differs only in the lint-only initializer described above. Canonical collision checks deliberately reject an email already owned by another account.
- Sổ, QR/link, tenancy navigation, finance, receipt and join implementation files are not changed by this audit fix commit. The existing tenancy-join database integration is still blocked, so runtime regression safety is not asserted.
- Frozen Identity artifacts retain their exact byte fingerprints. Test fixture mail, synthetic identities and mock SMTP are not delivery evidence.
- No production/shared database was read, reset, migrated or seeded. No actual OTP email was sent. No force push or wholesale source-branch merge was used.

## CI handoff

A PR-scoped `Email OTP audit` workflow checks out the exact head SHA. It provisions a disposable PostgreSQL/PostGIS service for migration, concurrency and existing Identity/session regressions, and a separate JDK/Android SDK job for real debug/release Kotlin compilation. No production secrets, SMTP credentials or production database are used. There is no `continue-on-error`. Workflow availability or pending status is not validation evidence; results must be inspected before any merge.

## Work needed before merge

1. Re-run build, both TypeScript projects, focused tests and lint at the exact reviewed PR head.
2. Provide a supported local isolated PostgreSQL/PostGIS database named `trooi_test`; apply the full migration chain, test up/down, aliases, row preservation, concurrent OTP guesses, reset/session revocation, rate buckets and the main password/Google/PIN/tenancy-join regressions. Never use a production URL or weaken the local test-target guard.
3. Compile the actual Android debug/release variants using the required JDK, SDK and reachable dependency repositories. Exercise signup, reset, stale replies, logout, password login/change, Google, PIN, Sổ and QR against nonproduction services.
4. Perform authorized nonproduction SMTP/mailbox end-to-end verification with an actually received code. Keep codes and secrets out of logs and the audit report.
5. Review the resulting evidence and exact head SHA. Only then remove draft status and merge PR #23. Until then, main must remain unchanged.
