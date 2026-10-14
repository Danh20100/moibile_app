# TrọƠi Phase 5 — Full-stack execution checklist

Status: **IN PROGRESS** (2026-10-14). This checklist records verified implementation/evidence, not a release claim.

## Scope, sources, and invariants

- Baseline: `integration/unified-source-candidate` at `c7873d3` (Phase 4 `9d56009` + local Gradle config hygiene).
- Execution branch: `integration/profile-ledger-candidate`, isolated worktree `D:\Projects\.worktrees\TroOi-Project\integration-profile-ledger-candidate`.
- Ledger source: `temp/ledger-owner-tenant-ui-20261014` at `d9f79b8`. Discovery agent owns descendant `temp/discovery-ui-redesign-20261014`; do not mutate or merge unfinished code.
- Frozen identity migration `000008`, its exact physical/logical/contract bytes, authoritative Payment semantics, and all historical rental FK/ownership relations MUST remain intact.
- NO dummy/successful-looking OTP, KYC, Payment, storage or registration responses. Missing external verification remains fail-closed.
- NO direct writes to `main`, remote pushes, PRs or modifications of other agent worktrees without separately requested integration.

## P5.0 — Environment / preflight

- [x] Confirm `integration/unified-source-candidate` clean and pin baseline `c7873d3`.
- [x] Create isolated Phase 5 branch/worktree from that baseline.
- [x] Copy ignored `.env` and `gradle.properties` to execution worktree for local use; do not print secrets or commit either file.
- [x] Run frozen Identity / Profile subset: 14 tests pass, 0 fail.
- [x] Start owned isolated PostgreSQL/PostGIS (`trooi-phase5-idp`, host port `55518`), separate new volume and network.
- [x] Apply migrations `000001`–`000009` in isolated `trooi_test` and run Profile reconnect persistence integration: 1 test pass.
- [ ] Validate **actual** Google ID token with configured `GOOGLE_CLIENT_ID` in an approved live test; config-key presence alone is NOT enough.
- [ ] Validate the configured private MinIO bucket from the Phase 5 runtime and Android endpoint on emulator/device; existing running MinIO is not an end-to-end proof.

## P5.1A — Identity P0: shared resolver and Google authorization

- [x] Review G1-A/G1-E/G1-S: AUTH-06/F-A1 approves fail-closed alias conflict behavior, while cutover/remediation, email freshness and common session/audit protocol remain OPEN; runtime activation remains gated.
- [x] Add one shared Google principal resolver for login and AuthGuard; raw deterministic-ID fallback is removed. `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED` defaults off.
- [x] Resolve supported issuer aliases to one existing mapped/legacy User; verified email equality is not used for ownership, conflicts reject, and Organization/Tenancy references are never transferred.
- [ ] New Google registration stays unavailable: verified-email freshness/completion and approved session cutover are not implemented. Unregistered principals fail closed without User creation.
- [x] Preserve display-name Profile data and do not initialize/change it from later Google claims; resolver and profile persistence tests pass.
- [x] PostgreSQL resolver tests cover concurrent access to one principal, issuer alias compatibility, legacy reference preservation, conflict rejection and unregistered no-create behavior; foundation suite covers registration rollback/concurrency.
- [x] Messaging test-verifier HTTP acceptance with real PostgreSQL and private MinIO: A/B exchange in authorized Inquiry, history survives database-backed retrieval, C/anonymous are denied, private attachment retrieval works.
- [ ] Real Google token, live two-account login and device acceptance remain unverified; test-verifier Messaging is not live-provider acceptance.

## P5.1B — Profile writes, contact, security and onboarding

- [x] Preserve and regress tested `user_profiles.display_name` save/refresh; production Google resolver is currently `PASS_GATED` while cutover gate is off.
- [ ] Define and approve additive schema only for fields actually required by MVP; after existing `000009` use the next verified free migration number; never change `000008`.
- [ ] Durable ordinary personal fields beyond display name; verified email and phone remain separate proof-bound fields. No approved additional-field schema exists.
- [ ] Reauthentication, session/audit/recovery contracts, verified email change with CAS, and Argon2id password setup/change/reset with appropriate proofs.
- [ ] Real email/SMS OTP provider or explicitly fail-closed deferred UI — never client-only verification.
- [ ] Private avatar media + metadata + cross-device readback.
- [ ] Persisted privacy/notification preferences with scope and safe defaults.
- [ ] Operator three-step onboarding to real Organization/authorization state; preserve current OCR-as-suggestion boundary.
- [ ] Private KYC evidence and manual-review lifecycle (no OCR auto-approval); provider/retention/permission approval required.
- [ ] Profile Android/API/PostgreSQL/MinIO two-account, logout/relogin and restart E2E.

P5.1 execution evidence and the feature-by-feature status matrix are in [profile-identity-acceptance.md](profile-identity-acceptance.md). Fresh backend suite: 456/456; isolated Identity/Profile/PostgreSQL suites: 23 tests pass; Messaging private-storage HTTP test: 1 pass. Android JVM: 216/216; APK builds and lint pass. Connected Android instrumentation was started on the local emulator, then stopped after 34/87 tests with 15 failures in existing onboarding/settings flows; no Android sources changed in this slice. Real Google acceptance remains blocked by the absence of a configured live ID token and the disabled runtime gate.

## P5.2 — Ledger Full-stack (after P5.1 P0)

- [ ] Selectively port Ledger from source commit `d9f79b8`; do not replay entire divergent feature commit.
- [ ] Map AssetWizard to actual Organization → Property → Room → Listing; preserve operational vs public data authorities.
- [ ] Real create/update/archive with server lifecycle blockers and ownership checks.
- [ ] Real Listing draft/publish flow, authorized visibility, and public/private asset image storage.
- [ ] Persist/show operator and tenant records from real Tenancy/Finance/Incident/Notice source; no synthetic financial truth.
- [ ] Finance read failure does not blank unrelated rental operational data; partial failure is visible.
- [ ] Open Messaging with authorized `inquiry`/`tenancy` context ID, not the generic chat list.
- [ ] Test full Owner/Room/Listing/Tenant cycle, restart, cross-account denial, image readback, finance failure and archive blockers.

## P5.3 — Discovery integration

- [ ] Await clean handed-off Discovery commit; never modify the active agent's worktree.
- [ ] Review and selectively port public Listing/filters/maps/detail UI, preserving Ledger IDs and publish state.
- [ ] Test Discovery → Inquiry → Messages with real auth and DB.

## P5.4 — Unified acceptance → main (separate approval)

- [ ] Frozen `000008` fingerprint and v1/payment migration parity; full migration/rollback gates.
- [ ] Backend typecheck/lint/build, complete unit/persistence/HTTP suites, MinIO private access tests.
- [ ] Android JVM, Debug/Release APK, lint, architectural/fixture isolation.
- [ ] On-device two-account Google, camera/gallery, lifecycle, light/dark/large-font, keyboard/accessibility.
- [ ] Reconcile unresolved risks in review; selective integration into unified only after passing gates.
- [ ] PR and user-approved merge to `main`; deployment readiness requires separately verified live providers.

## First-run evidence (2026-10-14)

- `pnpm exec tsx --test tests/core/profile-display-name-mvp.test.ts tests/core/identity-persistence-alignment.test.ts tests/verification/identity-foundation-freeze.test.ts`: **14 passed**, 0 failed.
- `pnpm exec tsx --test tests/integration/persistence/profile-persistence.integration.ts` against isolated `trooi_test` at `127.0.0.1:55518`: **1 passed**, 0 failed, migrations `000001`–`000009`.
- Initial handoff discrepancy: `IdentityAccessService.authenticateWithGoogle()` called `identity.ensureUser(principal.userId)`, and `AuthGuard.canActivate()` used its separately derived ID; neither resolved durable `auth_identities`. The implementation below replaces both paths with the shared resolver behind the disabled activation gate.
- Database structure/repository foundation is present but frozen contract explicitly says runtime activation is BLOCKED pending Account Verification/session/security cutover. Production Google Messages and security flows remain unverified.
- This branch is for implementation; these environment tests **do not** imply all Profile/Identity or Ledger features are implemented.
