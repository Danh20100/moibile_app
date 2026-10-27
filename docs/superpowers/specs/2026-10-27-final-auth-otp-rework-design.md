# TrọƠi Final Auth & OTP Rework — Design

## Intent
Make Backend authentication depend on verified identity proofs, ensure email changes require possession of both mailboxes, and route authenticated users directly to the correct Sổ/Khám phá destination.

## Goals
- Email/password registration creates the user, password credential, and session only in the successful OTP verification transaction.
- Backend mode has no fixture/demo authentication fallback. Google registration remains a separate ID-token flow with no email OTP.
- Email change uses one logical challenge ID and two ordered stages: current email OTP, then new email OTP. Both stages bind to user ID, current session, email row ID, and email revision.
- The final email update, second-stage OTP consumption, security event, and revocation of other sessions are atomic. Keep the verifying session valid, refresh /me, preserve Google principal binding, and notify the former email after commit.
- Backend session context includes only current tenant relationships. Owner access takes landing priority; owners go to Sổ even with zero rooms; active tenants without owner access go to Sổ; accounts without either go to Khám phá. Multi-resource Sổ views use all Backend-authorized IDs without a picker.

## Non-goals
- No Finance/SePay or Release changes.
- No new global role column; permissions remain derived from Backend relationships.
- No DB reset, down migration, or seed operation.

## Approaches
1. **One challenge row with two stages (selected):** retain one challenge ID; after current-email verification atomically rotate its stage, code HMAC, attempt count, and send time before sending the new-email OTP. This matches the required shared challenge scope and keeps the API small.
2. **Parent challenge with two OTP records:** clearer separation of OTP records, but adds schema/API coordination and extra concurrency paths without improving the required shared logical scope.

## Design
- Android presents one registration action that requests email OTP; after a challenge arrives it presents OTP verification and creates the account only on server acceptance. Test/debug fixtures cannot be selected from Backend runtime.
- Backend session context derives tenant access only from participants who have not left and whose tenancy is current (ACTIVE or ENDING). Organization ownership continues to come from Backend ownership relationships.
- Navigation resolves owner first, then a current tenancy, then Discovery. Owner and tenant Sổ projections continue to aggregate all authorized organizations/tenancies.
- Additive migration 000029 constrains email-change stages, supersedes incompatible pending single-factor challenges, and enforces one live email-change challenge per user. Migrations 000026–000028 are audited as a prefix; apply pending migrations only after a verified local PostgreSQL backup.
- The change notice is sent to the former address after the email update commits. The current session remains active; other sessions are revoked in the same transaction. Google principal rows are untouched.
- Regression coverage includes OTP-only account creation, Google-only registration, demo-auth isolation, both OTP stages, stale scope, replay/races, active-tenant role derivation, multi-resource landing, /me, and email-change notification.

## Constraints
- Preserve existing frozen migrations; add a new migration rather than editing an applied migration.
- Do not read or modify .env, credentials, or Release configuration.
- Do not run GitHub Actions. Merge through a PR only after all required local gates and live E2E evidence pass.
- Required local gates: TypeScript typecheck/backend tests, Kotlin compile/Android tests/assembleDebug, migration audit and backup, Backend-only rebuild, emulator health/API smoke, and git diff --check.
