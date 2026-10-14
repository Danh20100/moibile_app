# TrọƠi Ledger Rental Operations — Acceptance Report

Date: 2026-10-14

Branch: `feature/ledger-rental-ops`

Worktree: `D:\Projects\.worktrees\TroOi-Project\ledger-rental-ops`

Start HEAD: `d5bc63e212cd099472ea548afbd2214ac7926884`
Implementation HEAD before this acceptance-report commit: `b3e1cfd`. The report commit is the final branch tip; its exact hash is given in the completion handoff (a report cannot contain its own commit hash).
Recommendation: **partial_with_gates**

## Outcome

The missing private Asset photo path is implemented through AssetWizard → `BackendTroOiRepository` → authenticated Listing media APIs → PostgreSQL metadata and private MinIO object bytes → authenticated readback into app cache. PostgreSQL/MinIO/API tests prove JPEG and PNG validation, owner scope, outsider denial, order changes, removal, retry conflict handling, failure recovery and reconnect readback.

The existing backend tenancy, Terms, finance, incident, checkout/history and contextual Messaging authorities remain the source of truth. Android now has a Terms editor and a multi-charge billing cycle form, and supported manual-payment/settlement actions reach Backend authorization instead of failing at a client-only reauthentication placeholder. Manual payments remain `MANUAL_CASH` or `MANUAL_TRANSFER` with server-produced `USER_RECORDED`; no provider or gateway success is claimed.

The required combined Owner → Tenant → historical readback journey was **not** demonstrated through Android UI. The installed emulator launches to Google sign-in, and `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED` remains disabled. This report does not call the implementation `PASS_FULLSTACK` or live-Google acceptance.

## Feature matrix
| Feature | Status | Evidence and limit |
| --- | --- | --- |
| Existing Property/Room/Asset fields | `PASS_BACKEND_ONLY` | Existing P5.2B field mapping in [ledger-acceptance.md](ledger-acceptance.md); fresh Asset details HTTP/PostgreSQL test 1/1 verifies owner write/read, outsider denial and public projection privacy. |
| Private JPEG/PNG upload, durable metadata, order, cover and removal | `PASS_BACKEND_ONLY` | Authenticated HTTP/PostgreSQL/MinIO tests; standalone fixture images declared in `tests/fixtures/rental/asset-media-flow.json`; storage path below. Android callers compile and JVM contracts pass, but real UI upload/readback was not completed. |
| AssetWizard edit/save/reopen through Android | `BLOCKED` | Repository, transport and picker integration are implemented. Emulator was observed at Google sign-in. No authorized runtime test principal could enter Ledger while the Identity cutover gate is off. |
| Publish/unpublish/archive lifecycle | `PASS_BACKEND_ONLY` | Existing Listing/RentalLifecycle coordinator and atomic archive behavior retained; database guards and lifecycle tests pass. AssetWizard publish transport is enabled after required form validation. No public photo projection is added. |
| Tenancy / participants / terms | `PASS_BACKEND_ONLY` | Existing authoritative endpoints and transaction/lifecycle behavior retained. Android Terms entry/update/readback is added; no device flow or live-account terms creation was demonstrated. |
| Billing cycle and RENT/ELECTRICITY/WATER Charges | `PASS_BACKEND_ONLY` | Android form supports multiple approved charge types and saved Terms versions. Core finance/manual HTTP/isolated DB guard tests pass; Finance remains authoritative for totals. |
| Manual Payment, allocation, Deposit, Receipt | `PASS_BACKEND_ONLY` | 38/38 finance/manual-payment tests plus database guard tests. Source remains manual and verification is server-derived `USER_RECORDED`; no live money/provider webhook. Emulator UI payment was not manually submitted. |
| Incident timeline and status transitions | `PASS_BACKEND_ONLY` | Incident lifecycle behavior is covered by the 55/55 lifecycle suite and isolated persistence guards. No tenant/operator device session was available. |
| Checkout and historical records | `PASS_BACKEND_ONLY` | PostgreSQL rental guards verify checkout/Room/listing atomicity; history remains source-backed and no historical finance rows are removed. No restart-and-reopen Android acceptance. |
| Tenancy-context Messaging | `PASS_BACKEND_ONLY` | Real PostgreSQL/private MinIO Messaging integration 1/1 with isolated test verifier covers authorized contexts and outsider denial, including Tenancy context. This is not live Google authentication. |
| Complete JSON-driven rental operations scenario | `NOT_IMPLEMENTED` | The new versioned JSON describes the executable Asset media test flow. Existing J04 full monthly-operations YAML remains `spec_only`; the entire multi-domain journey is not yet one executable scenario. |
| Android UI → Backend → PostgreSQL/MinIO → Android readback | `BLOCKED` | No `PASS_FULLSTACK` claim: identity gate and owner onboarding contract block an authorized normal app session. |

## AssetWizard and persistence mapping

Android caller path is `AssetWizard → TroOiViewModel → BackendTroOiRepository → BackendApi → NestJS`. Non-media Asset field mapping remains as documented in P5.2B. Summary:
| User data | Authoritative storage | Privacy / lifecycle |
| --- | --- | --- |
| Organization ownership | `organizations.primary_owner_user_id` and authorization queries | Caller cannot supply authority; test owner is pre-authorized. |
| Property name, exact address and operational coordinates | `properties.name`, `operational_address_text`, `operational_location` | Owner-only reads; exact address/point are excluded from public Listing projections. |
| Room name, occupancy and record lifecycle | `rooms.name_or_label`, `operational_state`, `record_lifecycle` | Occupancy is written by lifecycle commands only. |
| Listing ID, title, description, advertised rent and publication state | `listings.listing_id`, `public_title`, `public_description`, `public_price_projection`, `status` | Only existing published-listing projection is public. Advertised price does not become an agreed tenancy charge. |
| Asset type, public area label, floor area, advertised deposit, bedroom/bathroom counts, furnishing, amenity IDs, rules, utility offers, minimum term, availability, bathroom arrangement, capacity and floor | `listing_asset_details` (migration `000010`) | Private operational details; nullable values round-trip as null/empty. Advertised terms remain separate from Tenancy Terms and Deposit. |
| Photo media ID, MIME, size, position and created time | `listing_asset_media` (migration `000011`) | Only owner-authorized metadata routes expose it. Cover is position zero; no photo blob, Android path or S3 credential is canonical DB data. |
| Photo bytes | Private MinIO object key `rental-assets/<listing-id>/<media-id>.<jpg|png>` | Authenticated owner retrieval only. Object key and private bucket are not public Listing fields. Android cache files are disposable display cache. |

The Listing → media foreign key uses `ON DELETE NO ACTION`. `000011` is additive; migrations `000001`–`000010`, the frozen Identity `000008`, and historical tenancy/payment ownership remain untouched. The down migration refuses to drop uploaded user data. Reordering runs in one PostgreSQL transaction with deferred uniqueness and positions restricted to `0..9`. A repeated media UUID with different bytes conflicts; same-byte retry returns the existing metadata. On this branch, additive `000013` writes a per-Listing operation intent before MinIO PUT or DELETE. Upload intent stores object key, original position and SHA-256; an identical retry can finish the upload, while startup reconciliation removes unindexed bytes after an abandoned upload. Delete intent stores the same durable object metadata; the service then locks the Listing while deleting the MinIO object, deleting metadata, compacting positions and clearing the intent in one DB transaction. A failed operation leaves its intent for startup/request retry. Upload, reorder and public-consent mutations wait until that Listing has no pending intent; public reads hide pending media. The `000013` down migration refuses to drop pending work. PostgreSQL/MinIO fault-injection verification for both crash windows remains blocked by unavailable local PostgreSQL.

### Media routes

All routes are under `/api/v1` and require AuthGuard plus server-side Listing ownership:
| Route | Behavior |
| --- | --- |
| `GET /listings/:id/media` | List ordered private image metadata. |
| `POST /listings/:id/media` | Validate and upload bounded JPEG/PNG bytes, then persist metadata. Idempotent by `mediaId`. |
| `GET /listings/:id/media/:mediaId/content` | Authenticated base64 content read from private MinIO. |
| `PATCH /listings/:id/media/order` | Require an exact permutation of current media IDs; transactionally update position. |
| `DELETE /listings/:id/media/:mediaId` | Persist a delete intent, then delete object and metadata and compact order. On storage/DB failure return 503 and retain the intent for startup/retry reconciliation. |

The request body parser allows the bounded base64 envelope (8 MiB); the service rejects payloads over 5 MiB, unsupported MIME, invalid JPEG/PNG content and images over 16 megapixels. Migration `000013` commits an upload intent before MinIO PUT. An interrupted request leaves that intent; an identical SHA-256-bound retry can finish persisting metadata, while application startup deletes an unindexed object and clears the intent. Periodic bucket reconciliation remains useful for legacy or externally orphaned objects.

## Terms, billing and payment

The added Terms editor writes versioned data with explicitly user-entered rent, deposit requirement, dates, billing day, electricity/water arrangements and obligations. The Android form requires a due day from 1 through 31 and stores it in the existing `billingDayOrDueDateRule` JSON as `{ "day": n }`; its HTTP contract test checks request and readback. It does not copy rent from Listing. Billing now selects persisted Terms and accepts multiple `RENT`, `ELECTRICITY`, and `WATER` charges in one cycle. The existing backend JSON contract remains open for compatibility and does not itself enforce this Android shape/range; direct callers may still submit other rules. Behavior for due days 29–31 in shorter months remains unspecified.

The client-only `REAUTH_UNAVAILABLE` refusal was removed for ordinary authorized operator Ledger operations (Terms, Billing, manual Payment, allocation, Deposit and Receipt). Backend authentication, operator/participant ownership and finance invariants still apply. There is no step-up proof/session lifecycle yet; these operations rely on the existing authenticated session and API authorization. This is a deliberate MVP tradeoff, not a claim that reauthentication exists.

Manual emulator test steps once an already-authorized operator and linked tenant session are available:

1. Open the active Tenancy and Billing. Select the persisted Terms version and create the billing cycle with rent plus applicable utility Charges.
2. Record the amount actually received using `MANUAL_CASH` or `MANUAL_TRANSFER`; the operator's submit action is the explicit manual confirmation. Confirm the response is `USER_RECORDED` and the outstanding amount comes from Backend Finance.
3. Allocate the payment to the displayed Charge. For a Deposit, use a separate confirmed payment and a Deposit application; issue a Receipt only for the confirmed Payment.
4. Refresh or relaunch, then verify operator and tenant views show the same source-backed Charge, Payment, allocation, Deposit and Receipt history. Do not use provider checkout or claim `PROVIDER_VERIFIED` for a manual record.

These steps were **not manually executed on the emulator** because the app remained at sign-in and no authorized test account was available through the disabled Identity cutover gate.

## Verification evidence

The evidence table below records the earlier P5.2 runtime baseline. The additive `000013` continuation described above supersedes the former media deletion compensation behavior; its own unit/static evidence and outstanding PostgreSQL/MinIO fault-injection status are recorded in the continuation note under Remaining blockers.

All database runs use isolated `trooi_test` at `127.0.0.1:55518`. Media MinIO tests use the local disposable `trooi-ledger-test` bucket and remove their test objects.
| Command / test | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `pnpm test` | 468/468 PASS (fresh final run with isolated `DATABASE_URL` and `TEST_DATABASE_URL`). |
| `pnpm test:conformance:database-v1` | 58/58 PASS |
| Core Tenancy, Incident, archive, Finance, manual-payment and gateway behavior | 81/81 PASS on the fresh focused behavior/HTTP run. |
| Isolated PostgreSQL rental/checkout, Finance and Billing guards | 4/4 PASS, rerun against `trooi_test`. |
| Asset details HTTP/PostgreSQL/public privacy | 1/1 PASS |
| Media validation + migration rollback guard | 2/2 PASS. |
| Asset media PostgreSQL ordering/retry/delete failure | 1/1 PASS; verified restoration after DB transaction failure, explicit 503 with retained metadata when restoration also fails, and MinIO delete failure retry. |
| Asset media MinIO upload, DB reconnect, readback and delete | 1/1 PASS |
| Asset media HTTP owner/outsider authorization | 1/1 PASS |
| Messaging PostgreSQL/MinIO integration | 1/1 PASS on fresh rerun (test verifier; not live Google). |
| Android JVM `:app:testDebugUnitTest` | 223/223 PASS, including Terms due-day HTTP payload/readback. |
| Android `:app:assembleDebug`, `:app:assembleRelease`, `:app:lintDebug`, `:app:compileDebugAndroidTestKotlin` | PASS. |
| Connected `ProtectedRentalSubmissionTest` | 1 test PASS on `emulator-5554` (Android 17); does not exercise the full Ledger workflow. |
| App install/launch | APK installed without clearing data; launched to Google sign-in. |
| Full connected rental operations UI acceptance | BLOCKED; no authenticated test account/session on device. |

The first full test run caught the Identity/KYC isolation static check flagging a direct Listing-module reference to the S3 adapter. The provider was moved to shared `ObjectStorageModule`; the guard still rejects KYC workflow primitives outside their approved boundaries. The fresh final backend suite then passed 468/468.

## Remaining blockers and risks

- Identity resolver activation remains gated by `TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED`; do not enable it until its session/cutover/audit contract is approved.
- Owner onboarding/Organization claim is a separate security-contract dependency. Tests seed a legitimate owner Organization and must not be read as product self-claim acceptance.
- No ordinary Google test account was signed into the emulator. The app cannot demonstrate AssetWizard photo upload, manual UI payments, tenant incident, checkout or restart readback in this run.
- The combined multi-domain rental workflow is not represented by one executable JSON fixture yet. Media tests are fixture-driven; `tests/e2e/journeys/J04-monthly-rental-operations.yaml` remains `spec_only`.
- Asset photo upload and deletion now use migration `000013` for durable intents and startup/request retry reconciliation. Focused behavior/static tests pass `9/9`; Identity freeze and database-contract tests pass `7/7`; typecheck, lint and build pass. Persistence fault-injection covers DB failure after MinIO PUT and after MinIO deletion, but is unrun because PostgreSQL is unavailable. This is not `PASS_BACKEND` or `PASS_FULLSTACK`.
- This report's original P5.2 continuation did not add public Listing photo projection. On `integration/discovery-ledger-ui-preview`, additive migration `000012` plus the opt-in public photo route/UI have since been implemented; authorization/readback integration remains blocked. See the current integration gap register's `LED-P0-07` evidence.
- No live SePay/MoMo test or real transfer was made. Manual Payment provenance remains distinct and server-authoritative.
- Step-up reauthentication was deferred for the authorized manual Ledger MVP. The Backend still enforces signed-in identity and resource ownership, but there is no recent-auth proof on these writes.
- MinIO cleanup handles request/DB failures and deterministic retry; an abrupt process death after object PUT can leave an unreachable private orphan pending future bucket reconciliation.

## Changed commits and worktree

- `12c8d30` — `feat(ledger): persist private asset photos`
- `946a916` — `feat(android): upload and reload private asset photos`
- `b3e1cfd` — `feat(ledger): connect terms and manual billing`
- `ae47387` — `fix(storage): surface failed asset removal compensation`
- Current Android due-day fix and acceptance-document commits are listed in the final completion handoff.
- The acceptance-report commit and exact final branch HEAD are listed in the completion handoff.
- No push/merge occurred, the source `integration/profile-ledger-candidate` worktree was not edited, and no other agent worktree was touched.
