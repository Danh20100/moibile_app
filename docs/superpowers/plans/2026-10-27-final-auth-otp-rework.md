# TrọƠi Final Auth & OTP Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Require proof of both mailboxes for email changes, enforce email OTP registration, and land Backend sessions in the correct Sổ/Khám phá view.

**Architecture:** Keep OTP authority in the Backend transaction layer. Reuse one email-change challenge row with ordered CURRENT_EMAIL and NEW_EMAIL stages; Android carries one challenge ID. Derive landing from Backend-owned organization and current tenancy relationships, with owner-first priority and aggregate Sổ projections.

**Tech Stack:** NestJS, TypeScript, PostgreSQL migrations, Kotlin, Jetpack Compose, Gradle, Docker Compose, Android emulator.

**Spec:** docs/superpowers/specs/2026-10-27-final-auth-otp-rework-design.md

## Global Constraints
- Do not read or modify .env, credentials, or Release configuration.
- Do not run GitHub Actions, database reset/down/seed, or force push.
- Preserve migrations 000026–000028; add 000029 for ordered dual OTP.
- Merge through a PR only after required local gates and live E2E evidence pass.

## Review Focus
- Replaying the current-email OTP after stage transition must fail.
- Concurrent current-email verifications must produce one new-email OTP and one successful transition.
- Left/ended tenant relationships must route to Khám phá; ACTIVE/ENDING tenancies remain eligible.
- Multiple owner organizations and mixed owner/tenant access must land in the aggregated owner Sổ without a picker.
- A failed SMTP notice after commit must be reported and block the E2E merge gate.

---

### Task 1: Backend role authority

**Files:** modify src/persistence/ports/tenancy.repository.ts, src/infrastructure/database/repositories/tenancy.repository.ts, src/modules/identity-access/services/identity-access.service.ts; add a focused Backend regression test.

- [x] Write a failing test proving left participants and non-current tenancies are excluded from session context.
- [x] Run the focused test and verify it fails against current all-participant behavior.
- [x] Add an explicit current-participant repository query for left_at IS NULL and tenancy status ACTIVE or ENDING; use it in getSessionContext.
- [x] Run the focused test (5/5 passed in the earlier branch checkout).
- [ ] Run Backend typecheck and record repository-query integration evidence.

### Task 2: Registration boundary and Android UX

**Files:** modify app/src/main/java/com/trooi/app/features/auth/AuthScreens.kt, app/src/debug/java/com/trooi/app/core/data/DebugTroOiRepository.kt, and auth regression tests; remove or disconnect DemoBackendLogin if no remaining caller exists.

- [x] Add regression coverage for a single enabled “Gửi mã xác nhận” registration action, OTP verification before account creation, and no demo auth routing in Backend mode.
- [ ] Verify the new regression fails on the pre-change source.
- [x] Route Backend email registration only through requestEmailRegistration then verifyEmailRegistration; keep Google token registration independent.
- [ ] Run auth UI/repository regressions and relevant Kotlin unit tests.

### Task 3: Post-login role navigation

**Files:** modify app/src/main/java/com/trooi/app/core/model/ContextSelection.kt, app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt, and navigation/session-restore tests.

- [x] Add tests for owner-only without tenant access, active tenant, no role, both roles, multiple owner organizations, and multiple current tenancies.
- [ ] Verify multi-role/multi-ID cases request a picker or preserve tenant over owner on the pre-change source.
- [x] Resolve owner first, else a current tenancy, else Discovery; route post-login and refreshed Backend sessions through the same resolver.
- [ ] Run session restore, source navigation, and ledger presentation tests.

### Task 4: Ordered dual OTP and migration

**Files:** modify src/modules/identity-access/services/email-otp.service.ts, src/persistence/ports/identity-otp.repository.ts, src/infrastructure/database/repositories/identity-otp.repository.ts, src/infrastructure/database/schema.types.ts, DTO/OpenAPI files, Android BackendEmailChange.kt and transport types; add migration 000029 up/down and extend tests/core/email-change-otp.test.ts.

- [ ] Add failing tests for current-email delivery, no update after stage one, new-email delivery only after stage one, final update, old-email notice, user/session/revision binding, replay, and concurrent verification.
- [x] Implement one challenge ID with CURRENT_EMAIL then NEW_EMAIL stage and a guarded atomic stage advance that rotates HMAC and resets stage attempts.
- [x] On stage two, consume the OTP, update the stable user email row/revision, record EMAIL_CHANGED, retain the current session, and revoke other sessions within the transaction; send notice to the old email after commit.
- [x] Add migration 000029 to supersede incompatible pending single-factor challenges, constrain stage values, and enforce one live email-change challenge per user.
- [ ] Run focused OTP, migration-contract, OpenAPI, and TypeScript tests.

### Task 5: Local verification, PR, and merge gate

- [ ] Audit migrations 000026–000029 and current DB migration state; create a verified local PostgreSQL backup outside the repository.
- [ ] Apply pending migrations with the up-only migrator; never reset, down, or seed.
- [ ] Run TypeScript typecheck and Backend suite; Kotlin compile, Android unit/instrumentation tests, assembleDebug, and git diff --check.
- [ ] Recreate only the Backend service; verify health/API, install Debug APK on emulator-5554, and verify required Gmail and Google E2E flows.
- [x] Commit the continuation directly to fix/android-auth-otp-security; keep main untouched.
- [ ] Complete the local gates, then open/update a PR and wait for acceptance before any merge.


---

## Final Code Audit update — 2026-10-27

Audit started from `16ad151312dbc1011b66371a133a81cd858c5917` on `fix/android-auth-otp-security`, compared with `main` at `0745deb7b39e7eebbd9d55dc3d93e4f44a06631c`.

### Static review fixes
- Correct the public OpenAPI policy and the checked-in Android auth contract for Google nonce sessions, OTP registration/reset, password login, refresh, logout/revoke-all, reauthentication, and password/PIN security endpoints.
- Keep the winning stage-two email OTP live when a concurrent current-email verifier loses the atomic stage-advance race.
- Scope Google/password/PIN reauthentication nonce consumption to the authenticated user and session; acquire the PIN revision lock through the transaction-bound repository.
- Revoke other active sessions atomically after a successful password change while retaining the current session.

**Static review: PASS. Runtime: NOT RUN.** Regression coverage has been added, but tests and builds have not been run. No database was queried or changed, no `.env` was edited, and no Actions workflow was run.

### Local verification and E2E handoff
- Backend: `pnpm typecheck`; run the six focused core tests listed in the progress ledger; then `pnpm test` and `git diff --check`.
- Android: `./gradlew :app:testDebugUnitTest :app:compileDebugKotlin :app:assembleDebug`; with the emulator attached, `./gradlew :app:connectedDebugAndroidTest`.
- Backup and migrations: confirm the local DB target and current `pgmigrations` state read-only; take and verify a custom-format `pg_dump` outside the repository (`pg_restore --list)); apply pending migrations only with `pnpm db:migrate`; confirm 000027–000029 are recorded. Never run down/reset/seed.
- Emulator E2E: verify email registration OTP then login/reset; Google-only login and fresh password setup; password/PIN configuration and reauthentication; old-session revocation after password change/reset; dual email-change OTP (old address first, new address second), replay/race behavior, and notice delivery to the former address; owner/tenant/mixed/no-role navigation and session refresh.
- Do not merge until these local gates and acceptance pass. Keep `main` untouched and do not use GitHub Actions for this verification.
