# TrọƠi P5.2B — Ledger implementation and acceptance

Date: 2026-10-14  
Branch: `integration/profile-ledger-candidate`  
Start HEAD: `42536a298becbac2c3ec76f2df070f7a888330ae`
Implementation HEAD before this report commit: `c90891e14f340bf1ae8bf34a5d626d36d8a97ce2`. Final report commit and branch HEAD are stated in the completion handoff.
Recommendation: **partial_with_gates**

## Summary

Ledger drafts now have an additive, durable mapping for the AssetWizard's non-media fields. The authorized Android repository creates or updates Property → Room → Listing, saves private Listing asset details, then refreshes through the Backend. A new real HTTP/PostgreSQL test verifies persistence, restart readback, owner checks and separation from the public Listing projection. Stable client UUIDs and server payload comparisons make retries idempotent and reject reuse with different content.

The schema does not yet include asset photo metadata or upload/retrieval routes. Android therefore rejects a save containing local photos and rejects publish before writing; this is a visible error and the wizard keeps its draft. These limitations mean the full AssetWizard workflow is not `PASS_FULLSTACK`. Google runtime activation remains off behind `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED`; tests use isolated verifier fixtures only. Owner onboarding and Organization claims are not fabricated.

## AssetWizard → API → PostgreSQL mapping

All routes are under `/api/v1`. Android path: `AssetWizard → TroOiViewModel → BackendTroOiRepository → BackendApi → OkHttpBackendApi`.

| AssetWizard field | Authoritative persistence | Privacy and readback |
| --- | --- | --- |
| `propertyId` | `properties.property_id` | Stable client UUID; server enforces Organization ownership and same-payload retries. |
| `id` | `rooms.room_id` | Stable client UUID; server enforces the original Property on retries. |
| `publicListingId` / Listing identity | `listings.listing_id` | Stable UUID derived from Property + Room when first created; existing current Listing ID is reused. |
| `name` | `properties.name`, `rooms.name_or_label`, `listings.public_title` | Persisted as the operator name/room label/public title. |
| `operationalAddress` | `properties.operational_address_text` | Private owner-authorized Property read only. Excluded from Discovery Listing projections. |
| `operationalLatitude`, `operationalLongitude` | `properties.operational_location` | Exact point remains private. No Android device path or public API exposes it. |
| `publicArea` | `listing_asset_details.public_area_label` | Private operator detail until publication projection is explicitly extended. |
| `type` | `listing_asset_details.asset_type` | Private operator detail; round-tripped. |
| `area` | `listing_asset_details.area_square_meters` (`numeric(8,2)`) | Validated positive when non-null; nullable draft readback remains empty rather than fabricated. |
| `monthlyRent` | `listings.public_price_projection` | Advertised Listing price; never used to calculate Finance balances. |
| `advertisedDeposit` | `listing_asset_details.advertised_deposit` (`numeric(18,2)`) | Advertised offer only; separate from tenancy deposit requirement/fulfilment. |
| `description` | `listings.public_description` | Listing copy; only public via existing published Listing endpoint. |
| `bedrooms`, `bathrooms` | `listing_asset_details.bedrooms`, `.bathrooms` | Nullable integers; input is validated. |
| `furnishing` | `listing_asset_details.furnishing` | Nullable ordinary Listing detail. |
| `amenities` | `listing_asset_details.amenity_ids` | Stable IDs only; server rejects unknown IDs. Existing historical label-based records remain readable through the UI catalog mapping. |
| `rules` | `listing_asset_details.rules` | Operator-authored Listing details; public Listing endpoint does not include this private row. |
| `electricityOffer`, `waterOffer`, `serviceOffer` | `listing_asset_details.electricity_offer`, `.water_offer`, `.service_offer` | Advertised utility offers; not tenancy terms or charges. |
| `minimumTermMonths` | `listing_asset_details.minimum_term_months` | Optional positive bounded integer. |
| `availableFrom` | `listing_asset_details.available_from` (`date`) | Optional ISO date. |
| `bathroomArrangement`, `maxOccupants`, `floorLabel` | `listing_asset_details.bathroom_arrangement`, `.max_occupants`, `.floor_label` | Validated optional room details. |
| `status` | `listing_asset_details.management_status` (`DRAFT`/`ACTIVE`) | Operational management status is separate from public Listing lifecycle. Archive is represented by Room/Listing lifecycle, not a hard delete. |
| `listingStatus` | `listings.status` | Authoritative Listing lifecycle. Public reads return published Listings only. |
| `occupied` | `rooms.operational_state` | Reconstructed from server lifecycle state; client cannot write occupancy. |
| `photoUris`, `photoResources` | No durable Ledger mapping yet | Device paths/resources are not sent as canonical data. Non-empty photos fail closed before any API write. |

The schema addition is `listing_asset_details`, one row per existing `listings.listing_id`, with a no-delete FK. It does not duplicate Organization, Property, Room, Tenancy, Deposit or Payment authority. Migration `000010_listing_asset_details` is additive; migrations `000001`–`000009`, the frozen Identity migration `000008`, and historical ownership/reference relationships are unchanged. Its down migration refuses destructive rollback.

## Implemented routes and authorization

| Route | Use and authorization |
| --- | --- |
| `GET /properties?organizationId=…`, `POST /properties`, `PATCH /properties/:id` | Existing Property routes. Controller authorization checks operated Organization/Property; exact address and operational coordinates are private. |
| `GET /rooms?propertyId=…`, `POST /rooms`, `PATCH /rooms/:id` | Existing Room routes. Controller checks operated Property/Room. Same-ID retries must match the original parent and payload. |
| `GET /listings?roomId=…`, `POST /listings`, `PATCH /listings/:id` | Existing Listing routes. Create accepts a stable ID; same-ID mismatched data rejects. |
| `GET /listings/:id/asset-details`, `PUT /listings/:id/asset-details` | Added private operator detail routes. Both call `assertOperatesListing`; service validates amenity IDs, numeric/date fields, edit lifecycle and ACTIVE requirements. |
| `POST /listings/:id/unpublish`, `POST /listings/:id/archive` | Existing authorized Listing lifecycle transitions. |
| `POST /rooms/:id/archive`, `POST /properties/:id/archive` | Existing atomic soft archive routes; server derives blockers and checks before mutation. Room archive coordinator remains unchanged. |
| `GET /listings/public` | Public Listing projection; the new private details table, exact address and exact operational coordinates are not returned. |

Asset save is sequential across Property, Room, Listing and asset details, so it is not one transaction. Each resource uses stable identity and same-payload retry checks; a retry recovers already committed rows and refuses conflicting ID reuse. If an API/process failure occurs midway, the UI reports failure, retains its entered draft and a retry resumes at the same IDs. Account token equality is checked before applying refresh results, preventing an old session response from replacing a new account's state.

## Feature matrix

| Feature | Status | Evidence / limit |
| --- | --- | --- |
| Property create/update/private address+coordinates | `PASS_BACKEND_ONLY` | Server authorization and PostgreSQL persistence/readback; exercised through AssetWizard repository transport code, no device-to-database acceptance claim. |
| Room create/update and occupancy readback | `PASS_BACKEND_ONLY` | Real PostgreSQL writes/reconnect readback and lifecycle authority. |
| Listing create/update and retry conflict rejection | `PASS_BACKEND_ONLY` | Stable UUID, same-payload retry and mismatched payload checks; actual Postgres restart test. |
| AssetWizard ordinary field persistence | `PASS_GATED` | Backend schema/routes/Android transport/repository mapping and tests exist. Android save rejects photos and publish, and connected device acceptance has not completed. |
| Draft edits and server readback | `PASS_BACKEND_ONLY` | Private Asset details GET/PUT tested through real Nest HTTP and PostgreSQL for owner and outsider. |
| Amenity catalog and durable IDs | `PASS_BACKEND_ONLY` | Stable catalog IDs persisted in `listing_asset_details.amenity_ids`, unknown IDs rejected. Cross-branch Discovery catalog handoff remains pending. |
| Publish/unpublish/archive from AssetWizard | `PASS_GATED` | Existing Listing lifecycle and archive authorities remain; AssetWizard publish refuses before write until asset media is durable/readable. |
| Room/Property archive blockers | `PASS_BACKEND_ONLY` | 4/4 archive behavior and 2/2 isolated PostgreSQL guard tests; Room archive remains atomic and soft. |
| Ledger asset photos / private MinIO metadata/retrieval | `NOT_IMPLEMENTED` | Messaging's separate private MinIO integration passes, but Ledger has no asset-media API/table. Device-local URIs are rejected before save. |
| Finance partial failure recovery | `PASS_GATED` | Repository retains operational snapshot and exposes recoverable finance errors/retry; Android unit test passes, device acceptance pending. No rent-based balance calculation. |
| Contextual Ledger Messaging | `PASS_GATED` | Owner/Tenant actions pass persisted Tenancy context IDs into the existing context-opening callback. Messaging A/B PostgreSQL/S3 regression passes with test verifier; device path remains unverified. |
| Organization onboarding/claim | `BLOCKED_SECURITY_CONTRACT` | Identity/session/Organization ownership contract remains open. No ownership is created from caller input. |
| Google runtime activation | `PASS_GATED` | `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED` remains disabled. Isolated test verifier is not live Google acceptance. |
| Android UI → Backend → PostgreSQL → UI | `BLOCKED_DEVICE` | Instrumentation stopped at 45/87 with 17 observed failures after making no progress for over 30 seconds; no `PASS_FULLSTACK` claim. |
| Capacity purchase/entitlement | `BLOCKED_SECURITY_CONTRACT` | No verified entitlement/payment contract; no local capacity mutation presented as a purchase. |

## Verification evidence

All database runs used the isolated `troii_test` database on `127.0.0.1:55518`; Messaging ran on its isolated database and private MinIO container. No credentials were printed or committed.

| Command / check | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `pnpm test` with `DATABASE_URL` and `TEST_DATABASE_URL` set to isolated `trooi_test` | PASS, 465/465, 0 failures |
| `pnpm test:conformance:database-v1` | PASS, 58/58 |
| `pnpm exec tsx --test tests/core/rental-transaction-archive.behavior.test.ts` | PASS, 4/4 |
| `pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/guards/rental-guards.integration.ts` with isolated PG | PASS, 2/2 |
| `pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/application-wiring.integration.ts tests/integration/listing-asset-details.http.integration.ts` with isolated PG | PASS, 2/2; migrations `000001`–`000010`, same-ID retry conflict, Asset details reconnect readback, owner authorization and public projection privacy |
| `pnpm exec tsx --test --test-concurrency=1 tests/integration/messaging.integration.ts` against `trooi-phase5-messaging` PostgreSQL + private MinIO | PASS, 1/1; A/B, private attachment, reconnect/history and outsider denial using test Google verifier, not live Google |
| Android `:app:testDebugUnitTest` | PASS, 222/222 |
| Android `:app:assembleDebug :app:assembleRelease :app:lintDebug` | PASS; unsigned Release APK |
| `python app/scripts/verify_frontend_architecture.py` | PASS |
| `python app/scripts/verify_fixture_isolation.py app/build/outputs/apk/debug/app-debug.apk app/build/outputs/apk/release/app-release-unsigned.apk` | PASS; 7 Debug JSON assets match source and 53 Release sentinels excluded |
| Frozen Identity verification | PASS as part of the fresh `pnpm test` suite; no historical migration changed |
| `:app:connectedDebugAndroidTest` | INCOMPLETE, 45/87 cases reached, 17 failures observed. The emulator stalled between cases and the run was interrupted; this is not green. |
| Asset MinIO upload / UI-to-PostgreSQL device acceptance | NOT IMPLEMENTED / not claimed |

## Android instrumentation baseline and current result

The P5.1 report records 34/87 cases reached with 15 failures, mainly Account/settings and Messages. The P5.2 handoff also records a separate XML artifact with 18 failed cases among 50 recorded cases, including Account, Onboarding, Ledger and Messaging. Those baseline artifacts disagree and were not reconciled. The fresh P5.2B run discovered 87 cases, reached 45/87, and had 17 observed failures before it was interrupted after more than 30 seconds without progress. Failure groups observed: 5 Account/settings cases, 3 AccountSecurity cases, AssetPublicationFlow, FixturePortfolioFlow, LandlordOnboardingFlow, MessagesFlow, 3 NativeAccountEntry cases, and 2 NativeMessagingStates cases. Because the current run reached more cases than the P5.1 report and is incomplete, these counts are evidence of regression status but are not a final apples-to-apples suite comparison. Raw partial logs remain under `app/build/outputs/androidTest-results/connected/debug/` (build output, not committed).

## Security and privacy findings

- Google Identity activation stays gated. Integration tests inject test verifiers only.
- Property private address and exact operational coordinates are accessed only through authorized Property APIs. Public Listing projection does not expose the new `listing_asset_details` row.
- Organization ownership is derived from session context; AssetWizard never trusts a caller-supplied Organization ID as authority.
- Advertised rent/deposit/utility offers remain distinct from TenancyTerms, Billing, Deposits and Payments.
- Save operations do not report success unless the APIs succeed and server refresh returns the saved Room/Listing under the same token.
- Asset photo bytes/metadata and public image projection remain missing. Publication through the Android wizard fails closed; no local URI is sent to Backend.
- Archive is soft and transactional; existing Tenancy/incident/finance blockers are preserved.

## Changes and commits

Implementation is committed in separate Backend, Android and documentation slices. Commit IDs and final status are supplied in the completion handoff after commits are created. No push or merge was performed.

## Remaining work

1. Add authorized private asset-photo upload/retrieval and durable metadata using the existing S3-compatible adapter; add bounded validation, removal/reorder, cleanup, and explicit public Listing media projection.
2. Connect publish/ready transitions to the AssetWizard once media round-trips; device/API failures must retain drafts.
3. Complete connected instrumentation and investigate the observed existing Account/settings failures. Do not call a partial run green.
4. Validate full Ledger UI behavior with the Identity activation gate and Organization onboarding contract unchanged; those product security gates remain separate from the test verifier.
5. Integrate the shared amenity catalog with Discovery only after the separate Discovery owner hands off a clean commit.

Recommendation remains **partial_with_gates**. The verified deliverable is durable ordinary Asset data with server authorization plus tested readback. Ledger media, publication through the wizard, completed Android device acceptance, live Google and Owner onboarding are not complete.
