# TrọƠi Phase 5 — Full-stack execution checklist

Status: **IN PROGRESS** (2026-10-14). This checklist records verified implementation/evidence, not a release claim.

## Scope, sources, and invariants

- Baseline: `integration/unified-source-candidate` at `c7873d3` (Phase 4 `9d56009` + local Gradle config hygiene).
- Execution branch: `integration/phase5-profile-ledger-candidate`, isolated worktree `D:\Projects\.worktrees\TroOi-Project\phase5-profile-ledger-candidate`.
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

- [ ] Review G1-A/G1-E/G1-S activation/cutover decisions and required audit/session boundary; do not bypass frozen runtime `BLOCKED` state.
- [ ] Implement one shared proof→principal resolution boundary used by **both** Google login and protected-request AuthGuard; avoid raw deterministic-ID bypass.
- [ ] Resolve two historical Google issuer aliases to one stable existing User; never match ownership via equal email, merge Users, or rekey financial/rental FKs.
- [ ] Atomically create new User + canonical `auth_identities` binding + verified `user_emails` + `user_profiles`, only with verified Google proof and approved registration semantics.
- [ ] Preserve existing edited Profile/email, reject unverified email for new registration, reject duplicate email and ambiguous legacy principals fail-closed.
- [ ] Add per-principal race tests, alias conflict tests, verified email test and rollback proof on fresh isolated PostgreSQL.
- [ ] Verify two independent Google accounts can open authorized Inquiry/Tenancy Messages and outsider cannot access messages/media; no seeded fake binding in production.
- [ ] Get actual live Google and two-account device acceptance before declaring account identity activation complete.

## P5.1B — Profile writes, contact, security and onboarding

- [ ] Preserve and regress tested `user_profiles.display_name` save/refresh across Google logins.
- [ ] Define and approve additive schema only for fields actually required by MVP; after existing `000009` use the next verified free migration number; never change `000008`.
- [ ] Durable contact/personal info updates with correct ownership; verified email and phone are **not** generic self-edit fields.
- [ ] Reauthentication, session/audit/recovery contracts, verified email change with CAS, and Argon2id password setup/change/reset with appropriate proofs.
- [ ] Real email/SMS OTP provider or explicitly fail-closed deferred UI — never client-only verification.
- [ ] Private avatar media + metadata + cross-device readback.
- [ ] Persisted privacy/notification preferences with scope and safe defaults.
- [ ] Operator three-step onboarding to real Organization/authorization state; preserve current OCR-as-suggestion boundary.
- [ ] Private KYC evidence and manual-review lifecycle (no OCR auto-approval); provider/retention/permission approval required.
- [ ] Profile Android/API/PostgreSQL/MinIO two-account, logout/relogin and restart E2E.

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
- Runtime discrepancy proven: `IdentityAccessService.authenticateWithGoogle()` calls `identity.ensureUser(principal.userId)`, and `AuthGuard.canActivate()` calls `verifyGoogleIdToken()` and uses the raw derived User ID. Neither resolves durable `auth_identities`. Do not enable only one side.
- Database structure/repository foundation is present but frozen contract explicitly says runtime activation is BLOCKED pending Account Verification/session/security cutover. Production Google Messages and security flows remain unverified.
- This branch is for implementation; these environment tests **do not** imply all Profile/Identity or Ledger features are implemented.