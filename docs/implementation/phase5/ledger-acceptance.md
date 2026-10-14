# TrọƠi P5.2 — Ledger implementation and acceptance

Date: 2026-10-14  
Branch: `integration/profile-ledger-candidate`  
Start HEAD: `ac4c0389000097f0b4099bc86c7eb0e0a2985d37`  
Implementation HEAD before the report-only commit: `bb2a045e596834c04cd1d4388e41e7036ad3e489`.  
Recommendation: **partial_with_gates**

## Summary

The candidate now has retry-safe, server-authorized Property, Room and Listing create/update paths, a Ledger repository mapping for the fields represented by the current database, and server-side Room/Property archive routes. Room archive is a soft lifecycle transition performed under database locks. It requires `INACTIVE`, rejects any Tenancy history and open incidents, and archives the current Listing in the same database transaction. Property archive also checks every child Room.

The schema does not represent most AssetWizard details or asset photos. Therefore this is not a complete Ledger Asset round trip: type, area, advertised deposit, amenities, rules, room details, furnishing, utility offers, term, availability and photos do not survive Backend readback. The app must not be represented as meeting the P5.2 full-stack definition for those fields. Publishing from the AssetWizard fails closed because a device-local photo is not a stored Listing image.

P5.1 identity activation remains gated by `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED` (default off). These tests do not enable it or accept live Google login. Creating or claiming an Organization remains unavailable without the approved identity/session/Organization onboarding contract.

## Selective Ledger source review

Reviewed source branch `temp/ledger-owner-tenant-ui-20261014` at `d9f79b8b8acfb33340a26c2cdfbc8658348d7cfb`. No source UI files were copied. Its AssetWizard replaces the candidate's existing seven-step field flow with a shorter flow while still using device-local media; it does not implement server persistence. The candidate already exposed multi-select amenities. This implementation adds a Ledger-owned stable amenity catalog, while Discovery integration remains deferred until its owner hands off a clean commit. No Discovery worktree was available at the task's specified path, and none was modified.

## Android → API → database mapping

All API paths below are under `/api/v1`. The app uses `AssetWizard → TroOiViewModel.saveLocalAsset/archiveLocalAsset → BackendTroOiRepository → BackendApi → OkHttpBackendApi`.

| AssetWizard value | Current persistence mapping | Readback / limit |
| --- | --- | --- |
| `propertyId` | `properties.property_id` | Client generated UUID; server only retries it within the same authorized Organization. |
| `id` | `rooms.room_id` | Client generated UUID; server only retries it under the same Property. |
| One authorized Organization | `properties.organization_id` | Repository accepts exactly one operated Organization from the session. Zero or multiple Organizations return an error; caller IDs do not grant access. |
| `name` | `properties.name`, `rooms.name_or_label`, `listings.public_title` | Saved/reloaded as the Room label; duplicated as the Property name and Listing title for the current single-asset wizard. |
| `operationalAddress` | `properties.operational_address_text` | Private authenticated Property data only. Never added to public Listing DTOs. |
| `operationalLatitude/Longitude` | `properties.operational_location` | Kept in the authenticated Property record. |
| `description`, `monthlyRent` | `listings.public_description`, `listings.public_price_projection` | Public only when the Listing is published. The server remains authoritative for price validation and publication eligibility. |
| Public coordinate | `properties.public_location_projection`, `listings.public_location_projection` | Android rounds the selected point to two decimal places for the public projection; exact operational coordinates and address are not copied into Discovery responses. |
| Listing identity | `listings.listing_id` | Stable name UUID derived from Room ID; same-parent POST retry returns the draft already committed. |
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
| `POST /rooms/:id/operational-state` | Existing RentalLifecycle route; used to unpublish and move an eligible Room to `INACTIVE`. |
| `POST /rooms/:id/archive` | Added authorized soft archive using `RentalTransactionCoordinator`; no caller-supplied blocker booleans. Any Tenancy history or open incident blocks archive pending retention/finance review. |
| `POST /properties/:id/archive` | Added authorized soft archive using the same transaction guard across child Rooms and Listings. |
| `GET /listings/public` | Existing public projection; contains Listing facts and coarse public coordinates, not Property address or operational coordinates. |

The client save flow makes separate Property, Room and Listing requests, so a network failure can leave committed earlier steps. Stable UUIDs make retry find/update those rows; no atomicity claim is made across the requests. Room archival likewise uses separate unpublish/state-transition/archive API calls; if a later call fails, the Room may remain inactive or the Listing unpublished and the user must retry. The archive transaction itself is atomic.

## Feature matrix

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Property create/update and private read | `PASS_BACKEND_ONLY` | Real Property service/repository PostgreSQL restart test; controller owner checks and Android request mapping exist. No live app-to-HTTP UI acceptance. |
| Room create/update/read | `PASS_BACKEND_ONLY` | Real Room service/repository PostgreSQL restart test; retry UUID test; Room authorization tests. Full AssetWizard details are not represented. |
| Listing draft/update | `PASS_BACKEND_ONLY` | Existing Listing persistence plus stable-ID retry through PostgreSQL test. Android maps title, description, price and public location only. |
| Listing publish/unpublish | `PASS_GATED` | Existing lifecycle coordinator checks ancestry, vacancy and content; public projection remains scoped. App publish stays unavailable until private photo upload/readback exists. |
| Room/Property archive | `PASS_BACKEND_ONLY` | New protected routes; atomic archive guard test rejects Tenancy history and checks soft lifecycle retention. Any historical Tenancy blocks archive conservatively; no financial settlement proof is implemented. |
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
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, zero ESLint errors |
| `pnpm build` | PASS |
| `pnpm test` | PASS, 461 passed / 0 failed |
| `pnpm test:conformance:database-v1` | PASS, 58 passed / 0 failed |
| Property/Room/Listing/lifecycle/authorization core tests | PASS; included in `pnpm test` |
| `node --import tsx --test --test-concurrency=1 tests/integration/persistence/application-wiring.integration.ts` against isolated `trooi_test` at port 55518 | PASS, 1 test; migrations 000001–000009, Property/Room/Listing create retry, and PostgreSQL client restart/readback |
| Profile/Identity/PostgreSQL/freeze batch | PASS, 25 passed / 0 failed; isolated PostgreSQL at port 55518 |
| `node --import tsx --test tests/integration/messaging.integration.ts` | PASS, 1 test; separate PostgreSQL + private MinIO, test Google verifier, A/B message/history/attachment and outsider denial. This is not live Google acceptance. |
| `:app:testDebugUnitTest` | PASS, 219 / 219 |
| `:app:assembleDebug :app:assembleRelease :app:lintDebug` | PASS; Release APK unsigned |
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
- Room/Property archive never hard-deletes. Any Tenancy history currently blocks archive, which is deliberately conservative because the archive contract does not prove all historical finance/deposit obligations are settled.
- Asset photos are not uploaded. Messaging's private MinIO test is not evidence for Ledger media.
- Identity resolution runtime stays disabled. Test-verifier account bindings remain isolated to test code.
- Ledger asset save spans multiple API transactions. A partial network failure may leave durable Property/Room/Listing rows; the client-generated IDs support recovery by retry.

## Commits

- `f4b885e` — `feat(ledger): add authorized Property Room Listing persistence`
- `bb2a045` — `feat(ledger): add stable amenity catalog`
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
- `tests/fixtures/payment/application-restart.json`
- `tests/fixtures/payment/application-restart.schema.json`
- `tests/integration/persistence/application-wiring.integration.ts`
- `tests/support/application-restart-fixtures.ts`
- `docs/implementation/phase5/execution-checklist.md`
- `docs/implementation/phase5/ledger-acceptance.md`

## Recommendation

**partial_with_gates**. Backend-owned base Property/Room/Listing writes, lifecycle guards, retry behavior, and PostgreSQL readback are reviewable. Full AssetWizard field persistence, Ledger media, partial finance recovery, contextual Ledger Messaging actions, owner onboarding, live Google activation, and successful emulator acceptance remain outstanding.
