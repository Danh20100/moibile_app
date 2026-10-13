# Four-source foundation integration contract

Status: inactive foundation candidate; production authentication/KYC/payment activation not approved here.

## Authoritative inputs and selection

- Integration ec8d60e625b352f364724e6d199aac5fb7cea32a is the base and already includes Recovery d1e16a034cd6ce40f197d2dec8d9a470338d14f9 plus the six prior Integration-exclusive commits.
- Profile 2d2ec1c17e0c6f8db0c152f93f5bfca53ed2ef20 contributes the approved 55-file package from eb95357, f671fbc, 2bfb32f and 2d2ec1c; original commits remain intact.
- Existing three-source candidate work was preserved by an exact-file SHA-256/ZIP inventory before transplantation. The selected test repairs retain source provenance; no source worktree was reset or rewritten.
- Account Verification f5bbebc51c1191be68fd0f59216bdb61ceb0abf2 contributes three dormant primitives, their three component tests, the AWS SDK dependency/lockfile and implementation documentation.
- Deferred original scripts: tests/integration/infrastructure/compreface-live.integration.test.ts and private-s3-live.integration.test.ts; restore only after approved fixture provenance/isolation and failure-safe cleanup. This exclusion is explicit, not a runtime test skip disguised as PASS.

## Ownership and constraints

| Domain | Authority / owner | Candidate resolution | Activation dependency |
|---|---|---|---|
| Rental/finance | Canonical v3.7 and frozen v1; domain owners | Immutable schema/constraints/history; latest Integration financial semantics retained | Payment/provider acceptance |
| Four-table Identity | Profile Database; frozen vnext.identity-foundation.1 | Migration 000008/types/transaction-bound repository; immutable UUID/ownership | Runtime resolver/session/audit cutover |
| Sessions/security events | Profile physical design + Account Verification runtime | PROPOSED/OPEN; no tables created | Owner acceptance, revocation/audit atomicity |
| Media/KYC evidence | Profile persistence, Account Verification orchestration | PROPOSED/OPEN; private S3 primitive only | G5, durable media/evidence contract |
| Human review | Account Verification, policy owner | Pure nonpersistent revision-checked workflow only | G6 authenticated authorization and atomic persistence |
| Legal/privacy/data-subject/preferences/support | Profile proposals, product/privacy owners | Remain PROPOSED/OPEN/FUTURE per decision register; no competing tables | Relevant G3–G7 decisions |
| Android | Android owner | Latest Payment consumer preserved; fixture-only test reconciliation | Approved authenticated endpoints and real device E2E |

Google-first registration, approved normalization, immutable issuer/subject binding and optional same-User password model remain approved. OTP never independently registers or authenticates. Display name seed-once and legal-name separation remain unchanged. No new auth/password/OTP/session endpoint or KYC controller is registered.

## Reviewed overlap resolutions

Eight latest Integration paths overlap the preserved candidate. Both seeds, IdentityAccessService, Gradle daemon configuration and UI parser retain latest equivalent content. Gradle retains the new separate release-origin control. Identity alignment tests retain Profile compatibility plus Recovery seed-claim coverage with JSON fixtures. SePay tests retain newest no-list-only-settlement semantics; fixture migration cannot resurrect the old paid fallback.

Named migration prefixes replace relative-tip assumptions. Frozen v1 catalog checks run at their prefix, while full chain assertions include the distinct vNext addendum. Rental timestamps are deterministic validated data and invalid checkout still rolls back under ck_tenancies_time_order. SQL migration bytes and financial guards are not repaired through weakened expectations.

## Security findings and next ordered tasks

| ID | Scope / owner | Dependency and required decision | Acceptance / execution status |
|---|---|---|---|
| FND-01 | Integration — source/fixture reconciliation | Compatible source and frozen contract | Implemented: dormant imports/component tests, validated fixtures, scoped regression repairs |
| FND-02 | Account Verification — private transport safety | Existing fail-closed requirement; no new privacy policy | Implemented: remote HTTP/non-origin rejection before SDK dispatch, RED→GREEN regression |
| AUTH-01 | Duy Anh + Account Verification — seeded claim | Explicit demo-only authority and concurrency/ownership policy | MVP guard implemented: development-only, exact configured verified User UUID; automatic claim disabled by default. Concurrent seed-claim CAS remains deferred; demo seed ownership must not be configured for competing accounts |
| AUTH-02 | Account Verification + Profile — common auth runtime | G1-P/R/O/S/A security approval and independent session/audit contract | BLOCKED: shared Login/AuthGuard resolver, reauth/recovery/OTP/session/revocation/audit tests; preserve same UUID |
| MEDIA-01 | Privacy owner + Profile + Account Verification | G5 format/size/content validation, purpose/basis, retention/deletion/integrity/access policy | BLOCKED: accept physical metadata/evidence contract before additive migration; no sensitive collection meanwhile |
| REVIEW-01 | Assurance owner + Account Verification + Profile | G6 authenticated reviewer authority/separation/provenance/assurance | BLOCKED: accept atomic revision/audit contract; never grant VERIFIED from similarity |
| AND-01 | Android + deployment owner | Approved release endpoints/OAuth packaging | BLOCKED: checked-in emulator API; host-only release filter does not prove private-network/tunnel isolation |
| PAY-01 | Duy Anh + release owner | Suitable authorized provider environment | BLOCKED: live callback/payment/reconciliation/E2E acceptance; injected proofs do not prove transferred funds |
| LIVE-01 | Account Verification | Approved isolated target and checksum-verified public fixtures; cleanup | READY for targeted test-harness hardening, then separate authorized laboratory run; no production policy shortcut |
| E2E-01 | Android + Account Verification | AUTH/MEDIA/REVIEW approvals, approved test data and consenting capture | BLOCKED: actual authenticated CameraX/OCR/QR/upload/review/durable decision E2E |

No additional migration number is reserved. Inventory across all four sources has historical tip 7 plus Profile 8; sessions/media/KYC require separate accepted contracts and fresh numbering checks. No physical entity is introduced merely because it appears in a logical proposal.

## Evidence and independent gates

Local fresh evidence and exact commands are kept in the ignored account-verification-integration report directory. Source CI is source evidence only: Vercel statuses point to the landing-page deployment, not backend/KYC verification. A local candidate has no remote CI run without separately authorized push.

The foundation gate checks coexistence and inactivity. Database readiness refers exclusively to the accepted four-table slice. Authentication, KYC, payment release and whole-release readiness remain independent. Passing component, PostgreSQL or native unit tests does not establish G5/G6, live providers or device acceptance.
