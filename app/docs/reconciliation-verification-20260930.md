# Frontend backlog-v1 reconciliation — execution and verification

BRANCH: frontend/backlog-v1-reconciliation
BASELINE: 7669fca0c8af8fa24a5b48e1d5647c645c3cbb97
PREEXISTING HANDOFF HEAD: 25447b670c7be570d59b65b7161f4a4ec1ea0a9c
VERIFIED FEATURE COMMIT: 4a0e7feab83966ebb3c04a8a0b78ad1ec04fc376
FINAL SHA: see GitHub branch head; cleanup test/report is committed after verification.

## Changes by frontend lane
- F0: isolated clone of the already-existing frontend branch; fetch/prune and ff-only pull. Never copied the coordinator's 13 unapproved WIP files.
- F1: global USER.role removed from active auth/session and navigation. Demo session carries relationships; operating/tenant navigation is capability-guarded.
- F2: split PublicListing, OperationalRoom, Tenancy, organization/property, Charge/Payment/Allocation/Deposit/Receipt, Incident/Event and Dashboard read projections. Access-scoped operator, tenancy and finance containers.
- F3: Discovery reads only PUBLISHED public listings; no exact Room address, hard-coded map pins, booking state or chat. Inquiry is contact intent; repository command awaits published OpenAPI and fails closed now.
- F4: Operator read-only Organization/Property/Room/Listing, finance, incidents and backend-projected dashboards. Tenant portal shows CURRENT capabilities with scoped data where available and explicit pending states otherwise. No client business writes.
- F5: removed subscription/pricing/quota, active booking/chat flows, duplicate legacy RoomUi business model, debt-derived Payment and generic incident completion.
- F6: marketing-only web entry with responsive styling; legacy web business SPA is inactive, explicitly documented.
- F7: adapter integration deferred until Backend/Database lane GREEN and staging incorporates it. No API routes, DTOs, rules or OPEN policy invented.

## Tests actually executed on Windows DESKTOP-N80KI3D
- ./gradlew.bat testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest bundleRelease --console=plain : PASS.
- testDebugUnitTest XML: 9 tests, 0 failures, 0 errors (ContractBoundary 3, DebugProjection 2, FeatureProjections 2, AuthValidation 2).
- lintDebug: 0 errors, 20 non-blocking warnings.
- Debug APK and Android instrumentation test APK: compiled successfully.
- bundleRelease: PASS (R8 + vital lint), but AAB remains UNSIGNED: not a Play submission artifact.
- web/npm run check: PASS.
- web/npm test: PASS, 9/9 (3 active marketing tests plus 6 retained legacy source-unit tests).
- web/npm run test:browser: PASS, marketing HTTP 4/4 and Chrome rendered page.
- Static audit of active Android source found no UserRole, RoomUi, BookingUi, SubscriptionPlan or client-computed expected-minus-debt payment.
- connectedDebugAndroidTest: NOT RUN. ADB detects no physical device; this Windows machine has no installed Android emulator.

## Remaining contract-dependent gaps
- Actual Backend OpenAPI is unpublished. Release repository intentionally declines login, signup, password reset and Inquiry; actual end-to-end auth and business flows are NOT verified.
- Public Search/Map filters and live authorized Listing API are pending. Safe location placeholder replaces fake map pins.
- Tenant Terms acknowledgement, Deposit settlement, Payment Claim, Notices, Move-out, History, review eligibility and Trust Report await backend read/action contracts and any OPEN owner decisions.
- Owner lifecycle commands, finance reconciliation, Incident permitted actions and authorized dashboard refresh await backend DTOs/commands.
- Debug fixtures are visibly labeled illustrative; they are not production data or a substitute for integration.
- Web old SPA source retained inactive for controlled migration. Marketing page is the only production entry.
- Backend integration branch and staging were still at handoff/docs baseline 25447b6 on verification day. No Backend/Database Gate 1 completion was observed.

## Handoff protocol
- No files owned by Backend/Database or Canonical/Backlogs were edited.
- No staging merge, no force push, no branch history rewrite.
- After Backend GREEN and staging merge, pull/merge staging into this frontend branch, adapt repositories to actual OpenAPI and rerun every gate, including physical-device Android tests if available.
READY_TO_MERGE: NO (F7, Backend GREEN sync, end-to-end integration and device verification pending).
