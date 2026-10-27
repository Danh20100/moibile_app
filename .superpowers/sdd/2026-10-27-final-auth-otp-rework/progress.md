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
