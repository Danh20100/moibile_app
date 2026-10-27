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

- [ ] Write a failing test proving left participants and non-current tenancies are excluded from session context.
- [ ] Run the focused test and verify it fails against current all-participant behavior.
- [ ] Add an explicit current-participant repository query for left_at IS NULL and tenancy status ACTIVE or ENDING; use it in getSessionContext.
- [ ] Run the focused test and Backend typecheck.

### Task 2: Registration boundary and Android UX

**Files:** modify app/src/main/java/com/trooi/app/features/auth/AuthScreens.kt, app/src/debug/java/com/trooi/app/core/data/DebugTroOiRepository.kt, and auth regression tests; remove or disconnect DemoBackendLogin if no remaining caller exists.

- [ ] Add regression coverage for a single enabled “Gửi mã xác nhận” registration action, OTP verification before account creation, and no demo auth routing in Backend mode.
- [ ] Verify the new regression fails on current source.
- [ ] Route Backend email registration only through requestEmailRegistration then verifyEmailRegistration; keep Google token registration independent.
- [ ] Run auth UI/repository regressions and relevant Kotlin unit tests.

### Task 3: Post-login role navigation

**Files:** modify app/src/main/java/com/trooi/app/core/model/ContextSelection.kt, app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt, and navigation/session-restore tests.

- [ ] Add tests for owner-only with zero rooms, active tenant, no role, both roles, multiple owner organizations, and multiple current tenancies.
- [ ] Verify multi-role/multi-ID cases currently request a picker or preserve tenant over owner.
- [ ] Resolve owner first, else a current tenancy, else Discovery; keep Sổ projections scoped to all Backend-authorized IDs.
- [ ] Run session restore, source navigation, and ledger presentation tests.

### Task 4: Ordered dual OTP and migration

**Files:** modify src/modules/identity-access/services/email-otp.service.ts, src/persistence/ports/identity-otp.repository.ts, src/infrastructure/database/repositories/identity-otp.repository.ts, src/infrastructure/database/schema.types.ts, DTO/OpenAPI files, Android BackendEmailChange.kt and transport types; add migration 000029 up/down and extend tests/core/email-change-otp.test.ts.

- [ ] Add failing tests for current-email delivery, no update after stage one, new-email delivery only after stage one, final update, old-email notice, user/session/revision binding, replay, and concurrent verification.
- [ ] Implement one challenge ID with CURRENT_EMAIL then NEW_EMAIL stage and a guarded atomic stage advance that rotates HMAC and resets stage attempts.
- [ ] On stage two, consume the OTP, update the stable user email row/revision, record EMAIL_CHANGED, retain the current session, and revoke other sessions within the transaction; send notice to the old email after commit.
- [ ] Add migration 000029 to supersede incompatible pending single-factor challenges, constrain stage values, and enforce one live email-change challenge per user.
- [ ] Run focused OTP, migration-contract, OpenAPI, and TypeScript tests.

### Task 5: Local verification, PR, and merge gate

- [ ] Audit migrations 000026–000029 and current DB migration state; create a verified local PostgreSQL backup outside the repository.
- [ ] Apply pending migrations with the up-only migrator; never reset, down, or seed.
- [ ] Run TypeScript typecheck and Backend suite; Kotlin compile, Android unit/instrumentation tests, assembleDebug, and git diff --check.
- [ ] Recreate only the Backend service; verify health/API, install Debug APK on emulator-5554, and verify required Gmail and Google E2E flows.
- [ ] Commit and push the named branch, open/update a PR, and merge only if every required gate passes; then synchronize local main.
