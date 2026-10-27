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
