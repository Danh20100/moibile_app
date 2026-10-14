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

- [x] Review source commit `d9f79b8`; no UI files were ported because its AssetWizard removes several current data-entry steps and retains device-local images, while the current candidate already has amenity multi-select.
- [x] Add additive `000010_listing_asset_details` for ordinary operator Listing details without changing migrations `000001`–`000009` or frozen Identity `000008`.
- [x] Map AssetWizard name/type/address/public area/coordinates/area/rent/deposit/description/bedrooms/bathrooms/furnishing/amenities/rules/utility offers/minimum term/availability/bathroom arrangement/capacity/floor/status to Organization → Property → Room → Listing and owner-only detail persistence; nullable fields read back without fabricated values.
- [x] Enable Android Backend saves for drafts and active assets through Property → Room → Listing APIs and private Asset details GET/PUT. Stable request IDs support retry recovery; mismatched same-ID payloads and cross-parent conflicts reject. Session token checks prevent stale account readback from being applied.
- [x] Add client-generated UUID retry keys to Property, Room and Listing creation; same-parent retries return the committed row, conflicting ownership rejects.
- [x] Add authenticated Room and Property archive routes backed by the transaction coordinator. Room archive checks lifecycle, Tenancy history and open incidents before changing state, then archives the current Listing and Room atomically.
- [x] Preserve separate operational address/coordinates and public Listing projection; Android sends a two-decimal public coordinate projection, never the operational address or exact selected coordinates.
- [x] Add stable amenity ID/label/icon catalog and persist declared IDs in the private detail row. Discovery catalog handoff remains pending.
- [x] Finance read errors now preserve successful operational projections and surface a recoverable warning/retry. Amounts remain Finance-authoritative.
- [x] Owner/Tenant Messaging actions use a persisted active Tenancy context; PostgreSQL/S3 Messaging regression verifies A/B access and outsider denial with an isolated verifier.
- [ ] Ledger asset photos: no durable upload/metadata/retrieval API yet. Android rejects local paths before writing and keeps the draft; publication remains unavailable until private media round-trips.
- [ ] Connect and validate AssetWizard publication after asset media exists. Existing Listing lifecycle and soft archive guards remain authoritative; no public fields are exposed from private Asset details.
- [ ] Owner onboarding/Organization creation remains gated by the P5.1 identity/session/organization authorization contract; no owner or Organization is fabricated.
- [ ] Complete Android device-to-PostgreSQL Ledger acceptance. Google Identity runtime gate is still off; connected instrumentation stopped at 45/87 with 17 observed failures. Results and baseline comparison are in `ledger-acceptance.md`.

P5.2B verification (2026-10-14): `pnpm typecheck`, `pnpm lint`, `pnpm build`, full backend suite **466/466** with `DATABASE_URL` and `TEST_DATABASE_URL` scoped to isolated `trooi_test`, Database v1 conformance **58/58**, new HTTP/PostgreSQL Asset detail and restart tests **2/2**, archive behavior **4/4** and isolated archive guards **2/2**, Messaging PostgreSQL/private MinIO **1/1** (test verifier), Android JVM **222/222**, Debug/Release assembly, Android lint, architecture and fixture-isolation checks pass. Connected instrumentation discovered 87 tests, reached 45/87 and recorded 17 failures before stalling and being interrupted. Asset MinIO media and complete device acceptance are not implemented. No full-stack completion is claimed. See [ledger-acceptance.md](ledger-acceptance.md) for field mappings, migration/API details, evidence, instrumentation baseline comparison and remaining gates. Recommendation: **partial_with_gates**.

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

## P5.2 Rental Operations continuation — `feature/ledger-rental-ops`

The P5.2B evidence above is the original handoff snapshot. The continuation below supersedes its earlier Asset media limitation; the full Android acceptance gate remains open.

- [x] Continue from clean source HEAD `d5bc63e` in the requested isolated `feature/ledger-rental-ops` worktree; do not modify the prior candidate or Discovery worktree.
- [x] Add additive `000011_listing_asset_media`; keep `000001`–`000010` and frozen `000008` unchanged. Rollback refuses destructive data loss.
- [x] Add owner-authorized private Listing media upload/list/content/reorder/remove using shared S3-compatible storage, strict JPEG/PNG and size/dimension validation, idempotent media IDs, durable position/metadata and owner denial.
- [x] Connect AssetWizard picker, cover/reorder/remove actions, app-private upload staging and authenticated Backend readback. Local URI/cache is never canonical server media.
- [x] Add versioned Terms editing and multi-charge Billing entry to the existing Ledger Android route; keep advertised Listing offers separate from agreed Terms and Finance records.
- [x] Preserve manual `USER_RECORDED` payment provenance, server ownership checks, Payment/Deposit/Receipt conservation and existing rental lifecycle/atomic archive authority.
- [x] Add versioned JSON media scenario and standalone JPEG/PNG test images. J04 is now `backend_pass_only`; live Google and authenticated Android monthly-operations acceptance remain separate.
- [x] Compensate photo removal when PostgreSQL metadata deletion fails; surface HTTP 503 and retain the metadata row if MinIO restoration also fails. Crash-safe deletion intent/reconciliation remains a documented limitation.
- [x] Record the agreed monthly due day in Android Terms (`billingDayOrDueDateRule.day`) and read it back; MockWebServer contract test verifies the round trip.
- [ ] Complete Android UI → API → PostgreSQL/MinIO save/reopen for an authorized operator and tenant, including payment, incident, checkout and historical readback.
- [ ] Approve the Identity/session/audit cutover and Owner onboarding contract before ordinary Google users can create/claim Organizations. The runtime Identity gate remains disabled.
- [ ] Run complete monthly rental operations from a single executable fixture; no live provider or real money is required for manual-payment acceptance.

Current acceptance, detailed API/migration mapping, test evidence, emulator blocker and manual payment instructions: [ledger-rental-ops-acceptance.md](ledger-rental-ops-acceptance.md). Recommendation: **partial_with_gates** until Android full-stack and ordinary-account authorization evidence are available.

## First-run evidence (2026-10-14)

- `pnpm exec tsx --test tests/core/profile-display-name-mvp.test.ts tests/core/identity-persistence-alignment.test.ts tests/verification/identity-foundation-freeze.test.ts`: **14 passed**, 0 failed.
- `pnpm exec tsx --test tests/integration/persistence/profile-persistence.integration.ts` against isolated `trooi_test` at `127.0.0.1:55518`: **1 passed**, 0 failed, migrations `000001`–`000009`.
- Initial handoff discrepancy: `IdentityAccessService.authenticateWithGoogle()` called `identity.ensureUser(principal.userId)`, and `AuthGuard.canActivate()` used its separately derived ID; neither resolved durable `auth_identities`. The implementation below replaces both paths with the shared resolver behind the disabled activation gate.
- Database structure/repository foundation is present but frozen contract explicitly says runtime activation is BLOCKED pending Account Verification/session/security cutover. Production Google Messages and security flows remain unverified.
- This branch is for implementation; these environment tests **do not** imply all Profile/Identity or Ledger features are implemented.

Latest continuation verification (2026-10-14): Backend typecheck/lint/build PASS; `pnpm test` 468/468; database-v1 conformance 58/58; PostgreSQL photo compensation 1/1; real MinIO reconnect/readback 1/1; authenticated photo HTTP 1/1; Android JVM 223/223; Debug/Release APK, lint, Android-test Kotlin compilation PASS; focused `ProtectedRentalSubmissionTest` 1/1 on emulator. Full Android rental workflow remains gated at Google sign-in and is not `PASS_FULLSTACK`.
Follow-up regression: focused core Tenancy/Incident/archive/Finance/manual-payment/gateway behavior and HTTP suite **81/81**; isolated PostgreSQL rental/checkout, Finance and Billing guards **4/4**; Messaging PostgreSQL/MinIO two-account test-verifier integration **1/1**. No live Google, production payment provider or actual transfer was exercised.

## P0 continuation — integration preview branch

- [x] `LED-P0-02`: Mock Ledger reads its explicitly historical debug finance fixture without calling DemoPay; Owner/Tenant Ledger stays available offline while checkout continues to fail closed when DemoPay is unavailable. Android debug unit test `FixtureCatalogTest.mockLedgerLoadsHistoricalFixtureWhenDemoPayIsOffline` passes. This is `PASS_ANDROID` only, not backend or full-stack acceptance.
- [x] `LED-P0-07` Backend acceptance: isolated PostgreSQL/MinIO HTTP integration `1/1` proves owner upload/readback, outsider denial, default-private approval, published public projection/content with `no-store`, and unpublish hiding. Separate MinIO reconnect/readback test passes `1/1` (`PASS_BACKEND`). Android owner-consent and Listing detail component checks remain UI-only evidence. `PASS_FULLSTACK` remains blocked pending authenticated Android API-backed acceptance.
- [ ] `LED-P0-03` remains blocked for Android AssetWizard: backend HTTP and PostgreSQL/MinIO readback are verified, but authenticated Android upload/reopen/restart and remove/order device flow have not been exercised.
- [ ] Identity G1 cutover/session/audit decision and live Google acceptance remain security gates; runtime resolution stays disabled and no new User/Organization is fabricated.
- [ ] `PRO-P0-03`: Organization POST derives `primaryOwnerUserId` from the verified principal, and authorization behavior tests cover owner spoofing/outsider scoping. Android keeps create fail-closed with `REAUTH_UNAVAILABLE` because server reauthentication/session proof is not implemented/approved. Backend behavior `13/13` and Android protected-submission/request-contract tests pass; this does not prove PostgreSQL or live onboarding. Do not remove the reauthentication gate.
- [ ] Identity P0 remains `BLOCKED`, with fresh backend persistence evidence: isolated PostgreSQL `identity-foundation.integration.ts` `2/2` and `identity-vnext.integration.ts` `20/20` pass, including concurrent durable binding, collision/alias rejection, ownership-reference preservation, CAS/session foundations, and migration guards. These do not resolve cutover/session/revocation policy or prove live Google/Android acceptance. Frozen Identity `000008` remains unchanged.
- [x] P0 lifecycle fixture now separates Owner and Tenant principals, publishes and activates through `RentalLifecycleCoordinator`, verifies the Listing unpublishes and Room becomes occupied after Terms acknowledgement, and asserts manual transfer remains server-derived `USER_RECORDED` after restart. `pnpm test:ledger:lifecycle-restart` provides a direct runner and resets only local `trooi_test`; schema/static fixture verification and lifecycle behavior tests run without services.
- [x] `LED-P0-06` `PASS_BACKEND`: J04 now combines versioned rental/payment fixture and private photo fixture in one executable isolated PostgreSQL/MinIO run. It asserts lifecycle and finance history, USER_RECORDED provenance, HTTP photo upload/readback, public-photo opt-in/unpublish, outsider denial, linked-Tenant reads and Nest API + DB client restart. The test verifier is not live Google. `LED-P0-03/04/05` Android journeys remain blocked; no `PASS_ANDROID` or `PASS_FULLSTACK` claim for J04.
- [ ] `LED-P0-04` remains `BLOCKED` for the complete Owner/Tenant Android journey. Fresh isolated PostgreSQL billing guards `1/1`, finance provenance/conservation/receipt guards `1/1`, and rental lifecycle guards `2/2` pass (`PASS_BACKEND` for these service/DB contracts only); they do not prove the full cross-account UI readback after restart.
- [x] `DIS-P0-01` Discovery seed now creates DRAFT and invokes the production `RentalLifecycleCoordinator` publish path; the API assertion checks published projection and USER status event. `tests/core/e2e-discovery-seed.behavior.test.ts` verifies publication is idempotent and excludes the private address.
- [ ] `DIS-P0-01` remains `BLOCKED`: lifecycle publish behavior and PostgreSQL/PostGIS public search pass (`PASS_BACKEND` for those slices), including publication filter, public projection/privacy, amenity allowlist, radius and price range. No authenticated Owner UI publish → Tenant Android feed/detail acceptance has run; seed data is test-only and does not claim live Identity or `PASS_FULLSTACK`.

## P1 continuation — public amenity projection

- [x] `DIS-P1-01`: expose stable, allowlisted amenity IDs only for published Listings in public feed and spatial search; Android maps them through the existing owner `AmenityCatalog` and renders detail without reading demo fixture facts.
- [ ] `BLOCKED` acceptance: PostgreSQL/PostGIS HTTP query tests are authored but require the unavailable local PostgreSQL. Android emulator detail UI component test passes `2/2`; service behavior tests `5/5`, backend typecheck/lint/build, and Android JVM `241/241` pass. This is `PASS_ANDROID` component evidence only; do not claim `PASS_BACKEND`/`PASS_FULLSTACK`.

## P1 continuation — Asset photo deletion recovery

- [x] `LED-P1-01` implementation: migration `000013` persists one upload/delete operation intent per Listing. Upload uses a SHA-256-bound intent before MinIO PUT; delete uses an intent before object removal and metadata compaction. Startup reconciliation removes unindexed bytes after interrupted upload and completes pending deletion; same-request retries are safe. Conflicting media mutations are blocked while recovery is pending, and public reads suppress pending media.
- [x] `PASS_BACKEND` integration acceptance: `pnpm test:ledger:media-faults` runs the migration and injects PostgreSQL failure after MinIO PUT and after object deletion/before DB commit against isolated `trooi_test` and real local MinIO. Fresh-service startup reconciliation removes abandoned upload bytes and safely completes deletion; transient storage failure is retryable. Two runs pass `1/1`. No live provider or Android acceptance is implied; no `PASS_FULLSTACK` claim.

## P1 continuation — Messaging read watermark

- [x] Make read watermark updates atomic and monotonic with PostgreSQL `GREATEST`, so a delayed older request cannot move the stored timestamp backwards.
- [x] Add concurrent newer/stale watermark regression assertions to `tests/integration/messaging.integration.ts`.
- [x] `MSG-P1-02` `PASS_BACKEND`: the isolated `messaging_test` PostgreSQL/MinIO HTTP integration asserts concurrent stale/new read-watermark updates preserve the greatest timestamp; fresh runs pass `1/1` twice. This does not imply live Google or `PASS_FULLSTACK`.

## P1 continuation — Messaging history pagination

- [x] Add additive bounded cursor API (`GET /messaging/conversations/:id/messages/page`) with participant authorization, deterministic `(created_at, message_id)` keyset ordering, strict cursor validation, and batched attachment hydration. Preserve the legacy all-messages response contract.
- [x] Android initially loads 50 messages and offers explicit older-page loading; merges are deduplicated by message ID and sorted chronologically. Added a native UI test for the load-older action.
- [x] Backend paging acceptance: cursor tests `2/2`, PostgreSQL/MinIO HTTP integration `1/1` on repeat runs (page ordering including equal timestamps, outsider denial, private image and reconnect), and backend typecheck/lint/build pass (`PASS_BACKEND`). Android JVM `241/241`, instrumentation compilation, and targeted emulator `olderMessagePageCanBeRequestedFromConversation` pass (`PASS_ANDROID` for the UI component). `PASS_FULLSTACK` remains blocked pending an authenticated Android session against the API runtime. A full `NativeMessagingStatesTest` class run had two unrelated existing accessibility-label failures; do not treat that class as passing.
