# TroOi V1 Android frontend — progress and verification (2026-10-02)

- Branch: `frontend/v1-app-completion`
- Staging baseline consumed: `97a3897a3cd64da4fe0c5fb3baadcdc50101a8f6`; no staging merge.
- Fast-forward baseline: `b66eab938d8d555ff3405fac264cac0ad0df6367`.
- OpenAPI Git blob: `a6ae746a52a28d646c0c1f1fe06b9b8c61bc95f4`.
- Feature commit: `e071ba4f3c2619965b6e55c34a0da309a09ac9b3`.
- Contract-test commit: `4dfd11028b9501d251b18452c812da899128d68a`.
- Final branch SHA: see latest `git rev-parse HEAD` and final handoff response (the report commit cannot contain its own SHA).
- READY_TO_REVIEW: **NO**; backend contracts, Figma and device E2E are incomplete.

## Implemented Android work (source and unit-test coverage)

- Modular navigation: public Inquiry composer, operator Organization/Property/Room/known Listing and Listing-scoped Inquiry inbox/detail, nested Rental/Tenant workflows.
- Backend-supported operator create/edit for Organization, Property, Room, draft Listing; confirmation and typed 403/404/409/connection errors.
- Rental draft creation/cancel; ACTIVE move-out to ENDING; ENDING resume/checkout; participants list/add/link/leave; Terms and Notices reading.
- Billing Cycle read/create restricted to RENT, ELECTRICITY, WATER; confirmed manual Payment recording, allocation, Receipt read/issue/void.
- Incident list/report/detail and frozen lifecycle transitions with fresh backend state.
- Public Discovery filters area and numeric price on loaded PUBLISHED data; stable Listing semantic tag for DISC-02.
- Google-backed access stays relationship-derived; late authorized callbacks are guarded against logout; no global UserRole.

## Exact backend/domain blockers (NOT implemented or faked)

| Feature / screen | Required backend API / read model | Why blocked |
|---|---|---|
| Current Listing per Room | Room-linked Listing index/read endpoint or current Listing ID on Room | Only known Listing ID detail is exposed; no Room Listing discovery. |
| Listing lifecycle / Tenancy activation / manual Room transition | Documented allowed reasonCode, actorType, trigger and actor origin for published opaque command DTOs | Client must not invent identity or lifecycle intent. |
| Public availability filter | Availability in public Listing DTO/query | Cannot derive public availability from operational Room state. |
| Map/List synchronization | Verified public map integration and on-device checks | Public coordinates exist, but proper map interaction is unfinished. |
| Terms creation / version acknowledgement | Fully specified Terms nested value objects and safe derived acknowledgement actor | Cannot guess policy objects or submit client-authoritative user identity. |
| Notice issue/acknowledge | Issuer and acknowledger identity server derivation | Current DTO requires explicit actor user IDs. |
| Payment history list | Authorized GET Payment list/history | Current OpenAPI only has payment creation and lookup by ID. |
| Deposit application/settlement | Authorized deposit target lookup for opaque targetId and settlement endpoints | Cannot manufacture deposit target or refunds. |
| Incident event timeline | Event-history read projection | Incident detail only exposes current lifecycle status. |
| Dashboard | Server-owned Dashboard read model | No invented local totals/KPIs. |
| Notification Center and cross-actor delivery | Notification read/delivery contracts | No local synthetic notifications or policy assumption. |
| Former-rental and operator history | Complete authorized historical read projection | No reconstruction from client state. |
| Review | Review API and frozen eligibility/edit/moderation/rating policy | Explicitly OPEN; do not build rating UX. |
| Trust Report | Frozen login/evidence/moderation policy | Basic report endpoints exist, but workflow decisions remain OPEN. |
| Session restoration | Safe persistent Google session/credential restoration and live verification | Interactive Google login exists, persistence not proven. |

Blocker owner: Backend and the authority responsible for unresolved domain policy. Figma is also pending for final presentation. No backend/Canonical/migration files were changed.

## Verification on DESKTOP-N80KI3D

- `./gradlew.bat testDebugUnitTest lintDebug lintBackendDebug assembleDebug assembleBackendDebug assembleDebugAndroidTest bundleRelease --console=plain`: **PASS**, 189 Gradle tasks, debug/backendDebug APKs, instrumentation APK compiled and release AAB assembled.
- JUnit XML: **34 tests, 0 failed, 0 errors**. ContractBoundary 3, DebugProjection 2, FeatureProjections 2, BackendRuntimeContract 5, BackendTransport 6, AuthValidation 2, PublicDiscoveryFilters 4, V1CompletionContract MockWebServer 10.
- `lintDebug`: **0 errors, 27 warnings**. `lintBackendDebug`: **0 errors, 25 warnings**.
- Web unchanged: `npm run check` PASS; `npm test` **9/9 PASS**; `npm run test:browser` **4 HTTP routes and Chrome render PASS**.
- Real Android E2E: **NOT RUN**. ADB reported zero devices; no emulator and no Maestro executable on this machine. Existing DISC-01 therefore needs re-verification; DISC-02 now uses stable `public-listing-{id}` semantic tag but is NOT verified on a real device.
- Root `npm run e2e:coverage`: **NOT RUN**; `node_modules/.bin/tsx` is not installed. A static test catalog is not an executed E2E result.
- Backend DB/HTTP cross-actor production integration and Google live flow: **NOT VERIFIED**. MockWebServer HTTP tests are not a substitute.
- Release AAB build is not proof of store signing or deployment readiness.

## Still OPEN / explicitly FUTURE

OPEN: property-type filter vocabulary, Primary replacement, Payment Claim evidence/approval, over-allocation policy, partially funded Deposit requirement change, review moderation/edit/ratings, Trust Report login/evidence/moderation and Notification delivery/read policy.

FUTURE absent from implemented app flows: subscription/pricing/quota; CSV/Excel; advanced delegation; inventory; non-Rent/Electricity/Water charges; partner/dispatch; AI/OCR; realtime chat; saved search/favorites; instant booking/reservation; payment-gateway dependency; dynamic pricing; proration; public personal rating.

## Remaining gates and untouched scope

- Finish OpenAPI-supported workflows where contract is sufficient, and coordinate unclear actor/opaque fields with Backend. Only consume backend changes through the coordinator-approved staging integration path.
- Receive Figma, maintain feature-scoped ViewModel/Repository boundaries, complete relevant loading/empty/error/retry/denied/read-only state design.
- Run seeded Android device E2E (including DISC-01/DISC-02), authorized API/DB invariant checks and cross-actor journeys before changing READY_TO_REVIEW to YES.
- Master tracking remains `docs/design/v1-app-pov-checklist.md`; partial work is deliberately unchecked until design + backend + Android + E2E evidence exists.
- Intentionally untouched: `docs/database/v1/canonical.md`, ERD/schema/migrations, backend implementation, staging/main and local secrets. No merge to staging or force push.
