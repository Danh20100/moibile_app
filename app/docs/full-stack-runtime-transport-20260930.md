# Frontend full-stack runtime connection — transport foundation report

## Exact source and ownership
- BRANCH: `frontend/full-stack-runtime-connection`.
- TRANSPORT COMMIT: `0c58571d227deda0a9bf07fb67d44faadd0ca32b`.
- STAGING SHA SYNCED: `c630c3595de09bbbf90035011c368e3bf2ce7835` (already the second parent of the starting frontend branch commit `9c67431`; no redundant merge performed).
- OPENAPI SHA/CONTRACT USED: Git blob `7d6bb15500c3b40516b3a3aee08e878a46f31930`, `docs/api/openapi.json` at the above staging version.
- Frontend owned only `app/**`. Existing web marketing files and Backend/Database source were not edited.
- Backend support branch is separate. As checked during this work, it had new commit `ae659d7`, while staging still pointed to `c630c35`. Do not consume unmerged support schemas.

## Implemented now — Task 4 transport foundation
- Pinned OkHttp and MockWebServer `4.12.0`.
- `BACKEND_API_BASE_URL` comes from Gradle property `trooiApiBaseUrl` or env `TROOI_API_BASE_URL`. Default empty is an explicit UNCONFIGURED error, never a guessed production host.
- Release requires HTTPS; `backendDebug` permits local/emulator/LAN HTTP only and is separately debuggable.
- In-memory token provider and bearer interceptor send Google ID tokens only on explicitly protected calls. No client-issued session JWT or token logging. Missing/401 token is AUTH_EXPIRED and clears the existing token; logout also clears it.
- Network errors, configuration errors, 403, 401 and other HTTP errors have explicit transport outcomes.
- Raw `GET /listings/public` probe is the only wired endpoint. Its unparsed transport document is intentionally NOT mapped to a business UI projection until Backend OpenAPI gate is GREEN.
- `backendDebug` and Release delegate to a fail-closed repository without `DemoData` fallback. The default `debug` preview is still isolated.
- Production/backend-backed password, signup and reset forms are hidden behind a truthful Google-contract pending screen. No unsupported auth API has been invented.
- `backendDebug` Discovery includes a diagnostic button to test actual raw public HTTP without converting unverified fields into Listing business data.
- Moved fixture-dependent unit/instrumentation tests into their demo-debug-only source sets so backend-backed compile stays independent of `DemoData`.

## Configure manual transport probe after a local Backend is available
From the repository root on Windows:
```powershell
.\gradlew.bat :app:assembleBackendDebug -PtrooiApiBaseUrl=http://10.0.2.2:3000/
```
Install the backendDebug APK on a suitably configured emulator, or use your computer's private LAN address for a real phone. In Discovery, tap **Kiểm tra GET /listings/public**. This tests wire transport only. It does NOT prove PostgreSQL integration or correctly mapped production Listing DTOs.

## Verification on DESKTOP-N80KI3D
- Android: `testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest assembleBackendDebug lintBackendDebug bundleRelease` — PASS on transport commit source.
- Unit test XML: 15 tests, 0 failures/errors (including 6 `BackendTransportTest` MockWebServer tests and existing 9 tests).
- Lint: Debug 0 errors / 22 warnings, backendDebug 0 errors / 20 warnings.
- Instrumentation smoke test class successfully compiled into Debug Android test APK. Device execution: NOT RUN, ADB device list empty and no emulator installed.
- Debug APK, backendDebug APK and Release AAB generated. Release AAB remains UNSIGNED and is not a Play Store submission artifact.
- Web: `npm run check`, `npm test` (9/9), `npm run test:browser` (HTTP marketing 4/4 and headless Chrome render) — PASS.
- An attempted `testBackendDebugUnitTest` task was NOT AVAILABLE in this project's Gradle task graph; common transport tests were executed in `testDebugUnitTest` and backendDebug compiled/linted separately.

## Backend contract gaps — report to Duy Anh
### 1. POST /identity-access/auth/google
- CURRENT OPENAPI: operation exists but does not publish named request/success response DTO schemas.
- EXPECTED CLIENT NEED: typed Google ID token request, verified user/principal response and documented auth failures.
- BACKLOG/CANONICAL BASIS: identity-access, relationship-backed authority, Google token design decision.
- BLOCKING SCREEN/FLOW: Credential Manager → authenticated session. Never invent password/signup/reset routes.

### 2. GET /identity-access/me
- CURRENT OPENAPI: operation absent in synced staging contract.
- EXPECTED CLIENT NEED: typed `userId`, `operatedOrganizationIds[]`, `linkedTenancyIds[]` from server-verified relationships; protected bearer security.
- BACKLOG/CANONICAL BASIS: identity-access, organization and tenancy-participant.
- BLOCKING SCREEN/FLOW: authorized operator and tenant navigation and all protected reads.

### 3. GET /listings/public
- CURRENT OPENAPI: operation exists, 200 response has no public Listing JSON schema.
- EXPECTED CLIENT NEED: typed PUBLISHED public Listing projection with public-only geo; no exact operational address/tenant data.
- BACKLOG/CANONICAL BASIS: listing and search-map.
- BLOCKING SCREEN/FLOW: populated production Discovery; only raw HTTP diagnostic can run now.

### 4. POST /inquiries
- CURRENT OPENAPI: operation exists; typed request/success/error schemas and protected bearer metadata are not published.
- EXPECTED CLIENT NEED: authenticated, typed contact-intent request and backend acknowledgment, not booking/chat semantics.
- BACKLOG/CANONICAL BASIS: inquiry and identity-access.
- BLOCKING SCREEN/FLOW: production contact form / actual Inquiry write.

### 5. Scoped read operations
- CURRENT OPENAPI: staging document has 47 paths but `components.schemas` is empty; stable named response schemas are not yet available for selected scoped reads.
- EXPECTED CLIENT NEED: authorized Organization→Property→Room, linked Tenancy→Terms/Notices/Finance/Receipts and Incident read DTOs; backend-derived Dashboard read models where available.
- BACKLOG/CANONICAL BASIS: organization, property-room, tenant-portal, finance, incident and dashboard.
- BLOCKING SCREEN/FLOW: protected operator and tenant vertical slices. No UI-derived money or lifecycle truth.

## Next gate (not executed prematurely)
Wait for Backend auth/OpenAPI contract gate GREEN and coordinator merge to staging. Fetch/merge that new staging into this frontend branch (no rebase), verify exact OpenAPI SHA, then map transport DTOs, implement Google Credential Manager and scoped slices, run device-level full-stack smoke and rerun Android/Web gates. Never merge this frontend branch into staging before that final sync.

READY_TO_MERGE: NO — transport foundation is complete; production DTO integration and real Android→Backend→PostgreSQL runtime smoke are gated.
