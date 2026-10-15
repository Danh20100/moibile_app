# P5.1 Profile & Identity implementation and acceptance

Date: 2026-10-14  
Branch: `integration/profile-ledger-candidate`  
Start HEAD: `a73e7214e999a87a498478a7a88c32393cde49bc`  
Final implementation HEAD: `9c634ec` (`feat(identity): gate shared Google principal resolution`). The acceptance-report commit follows this implementation commit and is the final branch tip; its exact hash is recorded in the final handoff.  
Recommendation: **partial_with_gates**

## Summary

The shared Google principal resolver now serves both Google login and protected requests. It verifies the token through the configured Google verifier, resolves the durable `auth_identities` binding or one compatible legacy User, and returns that User ID to the request context. Alias conflicts fail closed. Unregistered principals do not create Users. The explicit `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED` runtime gate defaults to off because the approved session/audit cutover and G1-A/G1-E completion decisions are still open.

With the gate off, Google login and protected API requests return 503 after rejecting invalid tokens. This is the expected fail-closed runtime state until cutover approval; normal authenticated product use is unavailable in this state.

The Profile display-name path remains backed by the existing `user_profiles` table and its update/readback tests. Messaging passed a test-verifier HTTP round-trip against isolated PostgreSQL and private MinIO with seeded test bindings. This proves resolver-to-Messaging compatibility for mapped accounts; it does not prove live Google login or ordinary new-account registration.

No migration or frozen artifact changed. New registration, verified email/phone operations, credentials, preferences, avatar, Operator onboarding, and KYC remain blocked or unimplemented as listed below.

## Git and files

- Authorized worktree: `D:\Projects\.worktrees\TroOi-Project\integration-profile-ledger-candidate`
- Branch verified before edits: `integration/profile-ledger-candidate`
- Start HEAD: `a73e7214e999a87a498478a7a88c32393cde49bc`
- Final implementation HEAD: `9c634ec`; final branch tip includes the report/checklist commit recorded in the handoff.
- No migration was added. Migrations `000001`–`000009`, frozen migration `000008`, the logical/physical Identity JSON and the transaction contract remain unchanged.

Implementation and test files:

- `src/modules/identity-access/services/google-principal-resolver.ts` — verify token, enforce disabled-by-default gate, resolve existing durable/legacy principal, and reject unregistered accounts.
- `src/modules/identity-access/identity-access.module.ts` — injects one resolver backed by the shared verifier and transaction manager.
- `src/modules/identity-access/services/identity-access.service.ts` — Google login now calls that resolver; removes direct `ensureUser` and seeded ownership mutation.
- `src/common/guards/auth.guard.ts` — protected requests use the same resolver and attach its resolved User to request context.
- `tests/core/auth-guard.test.ts`, `tests/core/identity-persistence-alignment.test.ts`, `tests/audit/low-level-architecture/architecture.contract.test.ts` — shared resolver behavior, disabled-gate behavior, and updated caller contracts.
- `tests/integration/persistence/identity-foundation.integration.ts` — real PostgreSQL alias, concurrency, legacy-reference, unregistered no-create and provider-failure coverage.
- `tests/integration/messaging.integration.ts` — test-only verifier with real resolver/repository, PostgreSQL, and private S3-compatible storage.
- `tests/core/support/payment-gateway-http-harness.ts` — isolated test resolver wired through the same AuthGuard contract.

The seeded development login path that reassigned Organization and Tenancy ownership was removed. A verified Google token no longer transfers an existing owner/participant reference.

## Feature matrix

| Feature | Status | Android → API → storage | Evidence / limit |
| --- | --- | --- | --- |
| Google proof verification | `PASS_GATED` | Google Credential Manager → `POST identity-access/auth/google` or Bearer guard → existing Google verifier | Both call `GooglePrincipalResolver`; invalid tokens are rejected. Runtime resolution is disabled unless `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED=true`. Live Google provider acceptance was unavailable. |
| Durable principal resolution / aliases | `PASS_GATED` | Login and guarded API → `identityFoundation.resolveGooglePrincipal` → `auth_identities`, compatible `users` UUID | PostgreSQL verified canonical and historical issuer alias resolution, concurrent resolution, legacy User/reference preservation and conflict rejection. No email-based User selection or User merge. |
| New Google registration | `BLOCKED_SECURITY_CONTRACT` | Sign-in UI → Google login endpoint → no write for unregistered subject | Resolver returns unavailable for unregistered principals and does not create a User. Registration awaits email freshness/completion and session cutover approval. |
| Display-name Profile | `PASS_GATED` | Compose Profile → ViewModel → repository → `PATCH/GET identity-access/profile` → `user_profiles.display_name` | Existing update/read/refresh behavior and regression tests pass; broader login/guard runtime is gated off by default. Provider claims do not overwrite edited names. |
| Other ordinary personal fields / legal identity | `NOT_IMPLEMENTED` | Profile forms → no supported durable API/table mapping | Legal name is read-only in current UI; additional fields do not have an approved persistence contract. |
| Primary email view/change | `BLOCKED_SECURITY_CONTRACT` | Session/Profile email currently comes from verified Google claims; email-change button reports unavailable | Durable email repository exists, but registration/email update runtime, target proof, reauthentication, audit and session consistency are not wired. Google claims do not authorize ownership transfer. |
| Password setup/change/recovery and PIN | `BLOCKED_SECURITY_CONTRACT` | Security forms → no active password/session endpoints | No password login is exposed by BackendTroOiRepository. Argon2id runtime parameters, reauthentication, recovery and session invalidation remain open. |
| Phone / OTP | `BLOCKED_EXTERNAL_PROVIDER` | Contact form → no server verification API | UI does not verify ownership; no approved SMS provider, purpose-bound proof or rate/expiry policy is configured. |
| Avatar / private Profile media | `BLOCKED_SECURITY_CONTRACT` | Google picture claim is presentation data; no upload/readback API | No Profile media metadata/domain contract or authenticated avatar endpoint; G5 media lifecycle remains open. |
| Privacy and notification preferences | `NOT_IMPLEMENTED` | Settings switches/forms are local preview state → no Backend write | No approved durable preference contract or user-scoped storage; saving does not prove delivery. G4 remains open. |
| Owner/Operator onboarding | `NOT_IMPLEMENTED` | Three-step UI/OCR → repository default unavailable result → no durable onboarding state | `completeLocalLandlordOnboarding` has no Backend implementation; no new Organization/role claim was added. OCR remains data-entry assistance only. |
| KYC / identity evidence | `BLOCKED_SECURITY_CONTRACT` | Capture/OCR UI → no evidence API → no durable evidence/review store | UI reports unavailable; no OCR approval, evidence upload or reviewer access was introduced. G6 authority/retention/access remain open. |
| Messaging compatibility | `PASS_GATED` | AuthGuard → resolver → Messaging APIs → PostgreSQL conversation/message records + private S3-compatible attachment bytes | Test-verifier HTTP test: A/B exchange, history reload, private attachment retrieval, account C and anonymous denial. Fixture bindings were inserted by the isolated test only. Real Google accounts remain untested. |
| Logout/account switching | `PASS_GATED` | Existing Android session generation and credential clearing → current repository session | ViewModel generation checks and repository session clearing remain; Android JVM suite passes. No new two-device/live-account acceptance is claimed, and Google-backed calls are gated off by default. |
| Device instrumentation | `REGRESSION` | Existing Android UI → instrumentation APK on local API 37 emulator | `:app:connectedDebugAndroidTest` reached 34/87 tests, 15 failures, then was stopped. Failures surfaced across pre-existing account/settings, onboarding and local Messages UI tests; no Android source changed in this slice. Device acceptance is incomplete. |

## Identity behavior and security boundary

- `verifyGoogleIdToken` remains the only token verification implementation and uses the configured Web OAuth Client ID verifier for issuer, audience, signature, expiry and subject checks.
- Login and AuthGuard use the same `GooglePrincipalResolver`. AuthGuard no longer derives an authorization User ID independently.
- Repository resolution checks the canonical provider binding and both historical deterministic UUID candidates under the frozen transaction locking behavior. An unambiguous existing legacy User is preserved; conflicting candidates/mappings reject.
- Email is not used to choose or merge Users. The old User UUID and Organization/Tenancy/Payment/Messaging references are not rekeyed.
- A protected request may resolve a compatible existing account only. An unregistered principal fails without creating `users`, `auth_identities`, email or Profile rows.
- `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED` defaults to `false`. Do not set it in a deployed runtime until the G1-A old-writer/collision procedure and G1-S shared session/audit/revocation contract are accepted. No fallback to the former `ensureUser` path remains.
- `user_profiles.display_name` initialization is insert-only; later provider names cannot replace user edits.
- The removed development seed-claim path previously changed Organization and participant User references after login. Its removal prevents that ownership transfer.

## Messaging and PostgreSQL/storage evidence

The test used a separately named Compose project and its own PostgreSQL database and private MinIO-compatible volume. The real Nest HTTP app, database resolver, Messaging repository and S3 adapter were exercised. Only the Google token verifier and test principal bindings were substituted/seeded.

Verified assertions: account A opens an authorized Inquiry conversation, account B opens the same conversation, both exchange messages, history is read through the database, the attachment bytes are retrieved through authenticated private storage, and account C plus anonymous access are denied. Existing broader Messaging tests also exercise Tenancy membership and message/media boundaries. This is test-verifier acceptance, not Google provider acceptance.

## Commands and results

| Command / check | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, zero lint errors |
| `pnpm build` | PASS |
| `pnpm test` | PASS, 456 passed / 0 failed |
| `pnpm test:conformance:database-v1` | PASS, 57 passed / 0 failed |
| `node --import tsx --test --test-concurrency=1 tests/integration/persistence/profile-persistence.integration.ts tests/integration/persistence/identity-foundation.integration.ts tests/integration/persistence/identity-vnext.integration.ts` | PASS, 23 tests including nested PostgreSQL concurrency/rollback cases across Profile, resolver and frozen Identity persistence; isolated PostgreSQL at port 55518 |
| `pnpm exec tsx --test tests/integration/messaging.integration.ts` | PASS, 1 test; isolated PostgreSQL + private MinIO, test Google verifier |
| `:app:testDebugUnitTest` | PASS, 216 / 216 |
| `:app:assembleDebug` and `:app:assembleRelease` | PASS; Release APK is unsigned |
| `:app:lintDebug` | PASS; 0 errors, 61 warnings, 2 hints |
| `python app/scripts/verify_frontend_architecture.py` | PASS |
| `python app/scripts/verify_fixture_isolation.py <debug.apk> <release.apk>` | PASS, 7 Debug assets match source; 53 Release sentinels excluded |
| `:app:connectedDebugAndroidTest` | INCOMPLETE: stopped after 34/87 tests with 15 observed failures in existing UI/onboarding/settings flows |
| `pnpm test:google:live` | NOT RUN: `.env` contains no `GOOGLE_ID_TOKEN`; no actual Google-account acceptance claimed |
| Android device two-account/live Google acceptance | BLOCKED_EXTERNAL_PROVIDER; no live account credentials or completed instrumentation run |

An initial backend suite attempt found stale HTTP test wiring and a fixture-governance failure; those were corrected. The final `pnpm test` rerun is green. The initial Android attempt overlapped Gradle jobs and corrupted its shared incremental cache; a serial no-daemon rerun passed JVM/Debug gates. The connected instrumentation run later exposed UI failures and was stopped rather than presenting partial device evidence as green.

## Blockers and deferred work

- **G1-A:** No approved operational remediation authority for dual legacy User candidates or incompatible existing mappings; runtime gate remains off.
- **G1-S:** No approved shared application session, expiry/refresh/revocation, mandatory audit and invalidation consistency protocol; runtime gate remains off.
- **G1-E:** Verified-email freshness/completion rules for registration are not implemented. New principals cannot register.
- **G1-P/G1-R/G1-O:** Password hash parameters/benchmarks, accepted reauthentication and recovery proof, OTP parameters/providers remain open. No password or OTP success path was added.
- **G2/G4/G5/G6:** More personal fields, preferences, Profile media, and KYC authority/retention contracts remain open or unimplemented.
- Operator onboarding has UI only; there is no approved Backend Organization/onboarding operation in this implementation slice.
- Live Google token acceptance was impossible because the configured environment has no `GOOGLE_ID_TOKEN` test token. Messaging uses a test verifier and test-only durable bindings.
- Because the runtime gate defaults off, authenticated Android Product flows will receive 503 until deployment cutover is approved and configured. Enabling it prematurely bypasses no check, but would activate Google-only existing-account resolution without the complete session/audit contract.
- Connected Android instrumentation was incomplete and failed 15 observed tests by test 34/87. UI behavior, camera/gallery, accessibility, dark mode, keyboard and real account switching are not accepted.
- No Ledger work was started. No push, merge, PR or other worktree was used.

## Commit list

Local commits:

- `9c634ec` — `feat(identity): gate shared Google principal resolution`
- acceptance report/checklist — committed separately after the implementation slice; the branch-tip hash is recorded in the final handoff.

Recommendation: **partial_with_gates**. The resolver foundation and test-verifier Messaging compatibility are reviewable; production account activation and most Profile domains are still gated or incomplete.
