# SDD ledger — plan: docs/superpowers/plans/2026-10-27-final-auth-otp-rework.md

## Setup
- Workspace: existing user-selected branch checkout `fix/android-auth-otp-security`; HEAD began at `38c020b`; no unrelated changes were present.
- Spec: `docs/superpowers/specs/2026-10-27-final-auth-otp-rework-design.md`.
- Ruling: The plan skill's helper scripts are not available through this cloud skill reader or the Windows repo checkout. Track task starts, evidence, and completions in this ledger directly; no helper script is required for code behavior.

## Pre-flight interfaces
- Task 1 -> Task 3: session context supplies owner organization IDs and current tenancy IDs. The existing Kotlin navigation consumes `SessionContextTransport`; schema unchanged. Repository must exclude left participants and non-current tenancies before UI routing.
- Task 2 -> Task 4: Android email-change uses one challenge ID and one verification endpoint; ordered stages can remain server-driven, with Android displaying the server's next-stage instruction.
- Task 4 -> Task 5: migration 000029 updates schema only after backup; all local DB operations are up-only and target selection must be verified.

## Tasks
- Task 1: RED observed in `npx tsx --test tests/core/session-context.behavior.test.ts`: new regression included `ten-ended` and `ten-left` in actual session context.
- Task 1: current-participant repository method implemented and focused test rerun: 5/5 passed. Backend typecheck and repository query evidence remain to be recorded before completion.


## GitHub continuation — 2026-10-27
- Target: onsra520/TroOi-Project, branch fix/android-auth-otp-security, starting from 6f01fb6d86fb27603c74dbd4db6712a8c8dff28a.
- Implementation commits now on the branch: e4fab0a (dual OTP backend and migration 000029), 2aa34b1 (Android ordered-stage handling), 66aa34e / e7fd282 / 865eea1 (remove the Backend local-demo route, unregister its provider, add a boundary regression), 0c43556 / 3aa171a / 6600fd2 (role-priority landing on login/refresh and owner-only session-restore coverage), and f756548 (repair migration-test assertions).
- Migration regression assertions now check the staged challenge invalidation, stage constraint, live-challenge index, event code, and rollback guard using newline-aware string checks.
- Backend has no /identity-access/auth/local-demo controller route or service provider. OpenAPI already did not list that route; a regression now checks the controller, module, and OpenAPI contract.
- Backend login and session refresh resolve owner first, then current tenancy, then Discovery. Mock-only trust-return navigation is preserved. Restore tests cover owner without tenant access, mixed owner/tenant, multiple owner IDs, multiple tenant IDs, and no role.
- Dual OTP remains one challenge ID with CURRENT_EMAIL then NEW_EMAIL. Migration 000029 and Android stage UI are committed.

## Validation and handoff
- Earlier local evidence recorded above: npx tsx --test tests/core/session-context.behavior.test.ts passed 5/5 after Task 1 changes.
- This continuation used GitHub file/commit APIs only. No TypeScript or Kotlin tests, typecheck, Android build, migration apply, database backup, emulator smoke, Gmail/Google E2E, or Actions run was performed here.
- These gates remain required before acceptance/merge. No PR was opened, no merge was performed, and main was not edited.
- Implementation checkpoint before the plan/ledger status commits: 6600fd235e0ca14826c60e361c49441c0e18f458; the tracking updates follow it.


## Final Code Audit — 2026-10-27
- Audit target: `onsra520/TroOi-Project`, branch `fix/android-auth-otp-security`, start HEAD `16ad151312dbc1011b66371a133a81cd858c5917`; comparison target `main` at `0745deb7b39e7eebbd9d55dc3d93e4f44a06631c`.
- The branch was 17 commits ahead of `main` and had no commits behind at audit start. All audit fixes below are committed only to this branch.
- Static review findings fixed:
  - Public auth and OTP routes were missing from the runtime OpenAPI public-path policy, and registration/reset paths were incorrectly marked Bearer-protected in the checked-in OpenAPI. The Google contract described an ID-token-only request and a profile response, while Android sends an ID token plus nonce and receives an application session. Added the full Android auth/security route set and corrected body, response, security, and HTTP status documentation. Google/password login and refresh now return the documented HTTP 200.
  - A losing concurrent CURRENT_EMAIL verifier could supersede the winning NEW_EMAIL OTP. Race rejection now records the rejection without superseding the live winning challenge; the regression asserts the stage-two challenge remains live.
  - Organization-create reauthentication consumed a nonce before checking its user/session scope. All three methods (Google, password, PIN) now pass the user and session filters to atomic challenge consumption. PIN revision locking now goes through the transaction-bound repository executor.
  - Password change replaced the credential without revoking other sessions. It now revokes other sessions in the same transaction, retains the current session, and records reason `PASSWORD_CHANGED`.
- Scope review: email OTP registration creates the account only after proof; Google-only registration and fresh Google password setup remain separate from email OTP; password reset revokes all sessions; PIN and password reauthentication stay bound to the active user/session; role landing still resolves owner first, then current tenant, then Discovery; migrations 000027–000029 remain unchanged and were statically reviewed for constraints and rollback guards.
- **Static review: PASS** — source and published contract were read back, route/security/schema references were checked, and migration/navigation flows were reviewed. This is static review only.
- **Runtime: NOT RUN** — regression tests were added but not executed; typecheck, backend suite, Android build/tests, database backup, migration apply, service smoke, emulator E2E, Gmail/Google live flows, and GitHub Actions were not run. No database operation or `.env` change was made.

### Local acceptance checklist
1. On the checked-out branch, run `pnpm typecheck`, then focused tests:
   `pnpm exec tsx --test tests/core/email-change-otp.test.ts tests/core/email-otp-api.contract.test.ts tests/core/google-initial-password.test.ts tests/core/profile-contact-migrations.test.ts tests/core/session-context.behavior.test.ts tests/core/profile-operator-navigation.contract.test.ts`.
   Follow with `pnpm test` and `git diff --check`.
2. Run Android local checks: `./gradlew :app:testDebugUnitTest :app:compileDebugKotlin :app:assembleDebug`. With an authorized emulator attached, run `./gradlew :app:connectedDebugAndroidTest`.
3. Before any local database work, confirm the selected database/host and migration state read-only. Create a custom-format PostgreSQL backup outside the repository and verify it with `pg_restore --list`. Only then apply pending migrations with the up-only `pnpm db:migrate`; verify 000027–000029 are recorded. Do not run down, reset, seed, or point at production.
4. Rebuild/restart only the local Backend service and smoke health plus the auth endpoints. On the emulator, cover: email OTP registration and password login/reset; Google-only registration/login and fresh password setup; PIN setup/change and Google/password/PIN reauthentication; password-change and reset revocation (old sessions fail, expected current session behavior); both email-change OTP stages, replay/race rejection, and former-address notice; owner-only, tenant-only, mixed-role, and no-current-role landing.
5. Keep the branch unmerged until local gates and product acceptance pass. No GitHub Actions run, PR merge, main edit, or database operation was part of this audit.
