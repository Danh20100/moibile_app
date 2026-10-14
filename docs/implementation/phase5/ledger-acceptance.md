# TrọƠi P5.2 — Ledger implementation and acceptance

Date: 2026-10-14  
Branch: `integration/profile-ledger-candidate`  
Start HEAD: `ac4c0389000097f0b4099bc86c7eb0e0a2985d37`  
First implementation slice HEAD (before safety-review follow-ups): `bb2a045e596834c04cd1d4388e41e7036ad3e489`.  
Final branch HEAD is the acceptance-report commit at handoff; the exact commit ID is reported in the task handoff because a commit cannot include its own hash.  
Recommendation: **partial_with_gates**

## Summary

The candidate has retry-safe, server-authorized Property, Room and Listing create/update APIs, plus server-side Room/Property archive routes. Room archive is now one soft lifecycle transition performed under database locks: it checks state and retention blockers before mutating the Room or Listing, then moves the Listing through unpublish/archive and archives the Room in one transaction. The Android AssetWizard save is deliberately fail-closed until its full draft has durable field mappings; it returns an error before making any write and retains the in-progress UI state.

The schema does not represent most AssetWizard details or asset photos. Therefore this is not a complete Ledger Asset round trip: type, area, advertised deposit, amenities, rules, room details, furnishing, utility offers, term, availability and photos do not survive Backend readback. The app must not be represented as meeting the P5.2 full-stack definition for those fields. Publishing from the AssetWizard fails closed because a device-local photo is not a stored Listing image.

P5.1 identity activation remains gated by `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED` (default off). These tests do not enable it or accept live Google login. Creating or claiming an Organization remains unavailable without the approved identity/session/Organization onboarding contract.

## Selective Ledger source review

Reviewed source branch `temp/ledger-owner-tenant-ui-20261014` at `d9f79b8b8acfb33340a26c2cdfbc8658348d7cfb`. No source UI files were copied. Its AssetWizard replaces the candidate's existing seven-step field flow with a shorter flow while still using device-local media; it does not implement server persistence. The candidate already exposed multi-select amenities. This implementation adds a Ledger-owned stable amenity catalog, while Discovery integration remains deferred until its owner hands off a clean commit. No Discovery worktree was available at the task's specified path, and none was modified.

## Android → API → database mapping

All API paths below are under `/api/v1`. Reads and Room archive use `AssetWizard/Ledger UI → TroOiViewModel → BackendTroOiRepository → BackendApi → OkHttpBackendApi`. Property/Room/Listing create/update APIs are implemented and authorized, but `BackendTroOiRepository.saveLocalAsset` currently returns a clear unavailable result before calling them because the API schema cannot preserve the full wizard draft. This prevents a success response that would discard entered fields.

| AssetWizard value | Current persistence mapping | Readback / limit |
| --- | --- | --- |
| `propertyId` | `properties.property_id` | Client generated UUID; server only retries it within the same authorized Organization. |
| `id` | `rooms.room_id` | Client generated UUID; server only retries it under the same Property. |
| One authorized Organization | `properties.organization_id` | The API requires the caller to operate the Organization; caller IDs alone do not grant access. Android save is gated and does not currently submit it. |
| `name` | `properties.name`, `rooms.name_or_label`, `listings.public_title` | Backend APIs persist these fields, but AssetWizard does not call the create/update routes while full draft persistence is gated. |
| `operationalAddress` | `properties.operational_address_text` | Private authenticated Property data only. Never added to public Listing DTOs. UI create/update remains gated. |
| `operationalLatitude/Longitude` | `properties.operational_location` | Backend Property API keeps the exact point private; UI create/update remains gated. |
| `description`, `monthlyRent` | `listings.public_description`, `listings.public_price_projection` | Backend Listing API persists these; they become public only after server-authorized publication. UI create/update remains gated. |
| Public coordinate | `properties.public_location_projection`, `listings.public_location_projection` | The Android request codec rounds selected points to two decimal places; create/update remains gated until full field persistence is supported. |
| Listing identity | `listings.listing_id` | API accepts a client UUID and same-parent retries return the existing draft. Android save does not currently submit it. |
| Room status / occupancy | `rooms.record_lifecycle`, `rooms.operational_state` | Reconstructed from authorized Room readback. No client-supplied occupancy or lifecycle authority. |
| Type, area, bedrooms/bathrooms, deposit offer, furnishing, amenities, rules, utility offers, minimum term, availability | No current durable column/API mapping | Backend readback cannot reconstruct these. They are not included in any `PASS_FULLSTACK` claim. Amenity IDs are stable in the local draft model only. |
| Photos | No asset upload/metadata API | Device-local URIs are not canonical. Publish returns an unavailable error before writing. Private MinIO was exercised for Messaging only, not Ledger media. |

Current routes and authorities:

| Route | Purpose and authorization |
| --- | --- |
| `POST /properties`, `PATCH /properties/:id`, `GET /properties?organizationId=…` | Existing Property service; controller requires operated Organization/Property authorization. |
| `POST /rooms`, `PATCH /rooms/:id`, `GET /rooms?propertyId=…` | Existing Room service; controller requires operated Property/Room authorization. Create accepts an optional client UUID for safe retry. Archived Rooms reject edits. |
| `POST /listings`, `PATCH /listings/:id`, `GET /listings?roomId=…` | Existing Listing route and lifecycle coordinator; create accepts an optional client UUID. Content remains a public projection and is not a tenancy or Payment record. |
| `POST /listings/:id/publish`, `POST /listings/:id/unpublish`, `POST /listings/:id/archive` | Existing authorized Listing lifecycle routes. Publish checks active Property ancestry, vacancy and required content. |
| `POST /rooms/:id/operational-state` | Existing RentalLifecycle route for authorized operational-state changes. Asset archive no longer calls it as a separate step. |
| `POST /rooms/:id/archive` | Added authorized soft archive using `RentalTransactionCoordinator`; no caller-supplied blocker booleans. Any Tenancy history or open incident blocks archive pending retention/finance review. |
| `POST /properties/:id/archive` | Added authorized soft archive using the same transaction guard across child Rooms and Listings. |
| `GET /listings/public` | Existing public projection; contains Listing facts and coarse public coordinates, not Property address or operational coordinates. |

No AssetWizard save writes occur in the current Android backend mode; the unavailable result leaves the form open and does not lose its draft. Backend create APIs accept stable IDs so future multi-request saves can recover from partially committed rows. Room archive is a single authorized endpoint and one database transaction; blocker errors occur before any Listing or Room state change.

## Feature matrix

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Property create/update and private read | `PASS_BACKEND_ONLY` | Authorized API and real Property service/repository PostgreSQL restart test. Android AssetWizard create/update is currently gated before API calls. |
| Room create/update/read | `PASS_BACKEND_ONLY` | Authorized API, PostgreSQL restart test, retry UUID test and Room authorization tests. Android AssetWizard create/update is gated. |
| Listing draft/update | `PASS_BACKEND_ONLY` | Authorized Listing API and persistence plus stable-ID retry through PostgreSQL test. Android AssetWizard create/update is gated. |
| Listing publish/unpublish | `PASS_GATED` | Existing lifecycle coordinator checks ancestry, vacancy and content; public projection remains scoped. App publish stays unavailable until private photo upload/readback exists. |
| Room/Property archive | `PASS_BACKEND_ONLY` | Protected routes; transaction tests prove blocker rejection leaves a published Listing and active Room unchanged, and eligible published Room archive is atomic. Any Tenancy history blocks archive conservatively. |
| Full AssetWizard persistence | `NOT_IMPLEMENTED` | Current schema drops wizard-only fields listed above. Do not call this Asset full-stack complete. |
| Amenity multi-select/catalog | `PASS_BACKEND_ONLY` | Multi-select already existed; stable ID/label/icon catalog now owns Ledger options. IDs are not yet persisted or connected to Discovery's public catalog. |
| Asset images / MinIO | `BLOCKED_SECURITY_CONTRACT` | No asset object metadata, upload authorization, or retrieval contract. Local URIs are not saved as server data. |
| Owner onboarding / Organization claim | `BLOCKED_SECURITY_CONTRACT` | P5.1 session and Organization ownership cutover is open; no Organization is created or assigned by Ledger. |
| Capacity/entitlement purchase | `BLOCKED_SECURITY_CONTRACT` | No verified entitlement/Payment contract; ViewModel remains unavailable and does not mutate capacity. |
| Operator/Tenant Rooms and lifecycle reads | `PASS_BACKEND_ONLY` | Existing authorized Organization/Property/Room/Tenancy projections. |
| Finance/Deposit/Receipt reads | `PASS_BACKEND_ONLY` | Values come from Finance APIs and confirmed Payment/Receipt sources; no rent arithmetic was added. A finance API failure can still fail the combined read instead of retaining operational data with a visible finance-only error. |
| Ledger finance partial-error recovery | `NOT_IMPLEMENTED` | Snapshot load still treats downstream calls as one operation. |
| Ledger contextual Messaging buttons | `NOT_IMPLEMENTED` | General Messaging context APIs and P5.1 test-verifier acceptance pass, but the current candidate Ledger does not wire these actions to persisted Inquiry/Tenancy IDs. |
| Google identity in product runtime | `PASS_GATED` | Shared resolver remains gated off. Normal protected Backend APIs are unavailable until P5.1 cutover approval; no production gate bypass. |
| Ledger Android device → PostgreSQL acceptance | `REGRESSION` | Current connected instrumentation run exceeded ten minutes without a completed report and was stopped. See baseline comparison below. |

## Verification evidence

| Command / check | Result |
| --- | --- |
| `pnpm typecheck` | PASS after the archive controller dependency wiring and test-constructor updates |
| `pnpm lint` | PASS, zero ESLint errors |
| `pnpm build` | PASS |
| `pnpm test` with `DATABASE_URL` and `TEST_DATABASE_URL` set to isolated `trooi_test` on port 55518 | PASS, 463 passed / 0 failed. An initial run against the `.env` default port 5432 failed the public Listing runtime smoke test because the database was unreachable; the isolated rerun passed. |
| `pnpm test:conformance:database-v1` | PASS, 58 passed / 0 failed |
| Property/Room/Listing/lifecycle/authorization core tests | PASS; included in `pnpm test` |
| `node --import tsx --test --test-concurrency=1 tests/integration/persistence/application-wiring.integration.ts` against isolated `trooi_test` at port 55518 | PASS, 1 test; migrations 000001–000009, Property/Room/Listing create retry, and PostgreSQL client restart/readback |
| `node --import tsx --test --test-concurrency=1 tests/integration/persistence/guards/rental-guards.integration.ts` against isolated `trooi_test` at port 55518 | PASS, 2 tests; confirmed blocked archive leaves Room/Listing unchanged and eligible published Room archives durably in PostgreSQL |
| Profile/Identity/PostgreSQL/freeze batch | PASS, 25 passed / 0 failed; isolated PostgreSQL at port 55518 |
| `node --import tsx --test tests/integration/messaging.integration.ts` | PASS, 1 test; separate PostgreSQL + private MinIO, test Google verifier, A/B message/history/attachment and outsider denial. This is not live Google acceptance. |
| `:app:testDebugUnitTest` | PASS, 220 / 220, including a regression proving unsupported AssetWizard save makes zero Backend requests |
| `:app:assembleDebug :app:assembleRelease :app:lintDebug` | PASS after follow-up changes; Release APK unsigned |
| `python app/scripts/verify_frontend_architecture.py` | PASS |
| `python app/scripts/verify_fixture_isolation.py <debug.apk> <release.apk>` | PASS; 7 Debug JSON assets match source and 53 Release sentinels are excluded |
| `:app:connectedDebugAndroidTest` | INCOMPLETE; ran longer than ten minutes on the attached emulator without a finished report, then stopped. No green result claimed. |
| Live Google and Ledger asset storage/device E2E | NOT RUN / BLOCKED; no live Google token acceptance, and no asset media endpoints exist. |

## Android instrumentation baseline and current result

The P5.1 handoff records an instrumentation attempt that reached 34/87 cases with 15 failures in Account/settings, onboarding and Messages UI. The P5.2 task handoff also records a prior XML artifact with 18 failed cases among 50 recorded cases, including Account, Onboarding, Ledger and Messaging. The raw XML was not present in this worktree when checked, so those two historical counts are preserved as separate handoff evidence rather than reconciled.

The fresh P5.2 connected run remained active past ten minutes without creating a completed JUnit report. It is an incomplete current run, not a pass and not a comparable failure count. APK builds, JVM tests and lint pass independently.

## Security, schema and storage findings

- No migration was added. Historical migrations `000001`–`000009` and frozen Identity migration `000008` remain unchanged.
- Property address and operational location stay behind authenticated Property routes. Discovery reads Listing public projections only. The Android create codec rounds public coordinates to two decimal places.
- Property, Room and Listing create retries carry caller-generated UUIDs. Server code returns an existing row only within its original Organization/Property/Room scope; cross-scope ID reuse rejects.
- Room/Property archive never hard-deletes. Any Tenancy history currently blocks archive, which is deliberately conservative because the archive contract does not prove all historical finance/deposit obligations are settled. Room archive blockers are checked before any Listing/Room mutation in the same transaction.
- Asset photos are not uploaded. Messaging's private MinIO test is not evidence for Ledger media.
- Identity resolution runtime stays disabled. Test-verifier account bindings remain isolated to test code.
- Android AssetWizard save currently returns a visible unavailable error before any API write because the Backend schema cannot persist all entered fields. The form remains open; no claim of successful draft persistence is made. Backend create APIs still accept stable IDs so future complete saves can recover from partially committed rows.

## Commits

- `f4b885e` — `feat(ledger): add authorized Property Room Listing persistence`
- `bb2a045` — `feat(ledger): add stable amenity catalog`
- `1717b18` — `fix(ledger): make Room archive atomic`
- `08639f4` — `fix(ledger): reject lossy AssetWizard saves`
- `c51efa8` — first acceptance checklist/report commit (updated by the final acceptance commit)
- Acceptance checklist/report are committed separately after implementation; the final branch tip is given in the final task handoff.

## Changed files

- `app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt`
- `app/src/main/java/com/trooi/app/core/model/AmenityCatalog.kt`
- `app/src/main/java/com/trooi/app/core/model/LocalManagement.kt`
- `app/src/main/java/com/trooi/app/core/network/BackendApi.kt`
- `app/src/main/java/com/trooi/app/core/network/BackendClient.kt`
- `app/src/main/java/com/trooi/app/core/network/dto/BackendDtos.kt`
- `app/src/main/java/com/trooi/app/core/network/dto/BackendJsonCodec.kt`
- `app/src/main/java/com/trooi/app/features/ledger/AssetWizard.kt`
- `src/infrastructure/database/database.module.ts`
- `src/modules/listing/contracts/index.ts`
- `src/modules/listing/dto/index.ts`
- `src/modules/listing/services/listing.service.ts`
- `src/modules/property/controllers/property.controller.ts`
- `src/modules/property/dto/index.ts`
- `src/modules/property/services/property.service.ts`
- `src/modules/rental-lifecycle/services/rental-lifecycle.coordinator.ts`
- `src/modules/room/controllers/room.controller.ts`
- `src/modules/room/dto/index.ts`
- `src/modules/room/services/room.service.ts`
- `src/persistence/guards/rental-transaction-coordinator.ts`
- `tests/android/unit/java/com/trooi/app/core/model/AmenityCatalogTest.kt`
- `tests/android/unit/java/com/trooi/app/core/network/BackendRuntimeContractTest.kt`
- `tests/conformance/database-v1/property-room.lifecycle.test.ts`
- `tests/core/listing.behavior.test.ts`
- `tests/core/property.behavior.test.ts`
- `tests/core/room.behavior.test.ts`
- `tests/core/rental-transaction-archive.behavior.test.ts`
- `tests/core/resource-authorization.behavior.test.ts`
- `tests/integration/persistence/guards/rental-guards.integration.ts`
- `tests/fixtures/payment/application-restart.json`
- `tests/fixtures/payment/application-restart.schema.json`
- `tests/integration/persistence/application-wiring.integration.ts`
- `tests/support/application-restart-fixtures.ts`
- `docs/implementation/phase5/execution-checklist.md`
- `docs/implementation/phase5/ledger-acceptance.md`

## Follow-up safety review

A post-implementation review found two correctness issues and both are fixed in the follow-up slice: Backend AssetWizard save now fails before writing if fields lack durable mappings, and Room archive checks blockers before any Listing/Room state changes inside one transaction. Regression tests cover the no-write save response and archive rollback behavior. The optional transaction-coordinator injection was also made required in both archive controllers so missing module wiring fails at startup.

Fresh follow-up verification: archive transaction behavior **4/4** core, **2/2** real PostgreSQL; Backend AssetWizard fail-closed repository regression **1/1**. The full backend and Android gates listed above were rerun after these changes.

## Recommendation

**partial_with_gates**. Backend-owned base Property/Room/Listing writes, lifecycle guards, retry behavior, and PostgreSQL readback are reviewable. Full AssetWizard field persistence, Ledger media, partial finance recovery, contextual Ledger Messaging actions, owner onboarding, live Google activation, and successful emulator acceptance remain outstanding.
