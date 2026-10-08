## CURRENT LIVE DEMO FREEZE — 2026-10-08 15:46 Asia/Saigon

**Authoritative presentation checkpoint.** `/goal` is PAUSED at the user's request. All development checkpoints below are historical. No further implementation until the user resumes. Current app is open on **tenant Nguyễn Ngọc Lan → Khám phá**, light mode, emulator-5554 / Pixel_8, with screen stay-awake. All source changes, uncommitted work, database, catalog and session context are retained. No source edits, commit, push, merge, rebase, reset, stash, clean, fixture reset or service restart occurred in this freeze.

### Verified presentation state

- Latest `assembleDebug`: **BUILD SUCCESSFUL in 5s**, all tasks up-to-date. Log: `runtime/demo-freeze-current-build.log`. Installed current APK launched normally; no crash observed on this smoke run.
- Fresh native tenant login → Sổ → Explore → An Nhiên Listing Detail; owner login → Sổ; Messages account separation, persistence and light/dark checks: **OK (2 tests), 44.146s**. Log: `runtime/demo-freeze-current-smoke.log`.
- Additional direct owner login → Sổ → occupied A02 management detail → published vacant C01 cards: successful. Current catalog remains **6/6**, including canonical published An Nhiên. No purchase, archive, edit or publication mutation was performed during this freeze.
- Actual tenant Sổ → Payment **1.000đ** → zero-fee review → Chrome DemoPay → explicit confirmation → native **Thanh toán đã được xác nhận** and payment-history acknowledgment: successful. Bottom **Về Sổ** completed the flow before returning to Explore. Read-only session-hint inspection confirms tenant `fixture-user-lan` and an empty pending-checkout payload; no unfinished checkout remains.
- Read-only PostgreSQL audit before/after: **8 → 9 gateway Payments, all PROVIDER_VERIFIED**, zero automatic allocations, receipts or deposit applications. The ninth is this explicit 1.000đ smoke simulation. Existing eight payments were preserved; no real funds moved.
- Final native success and ready Explore captures were visually inspected: `runtime/demo-freeze-current-payment-success.png`, `runtime/demo-freeze-current-ready.png`.
- PostgreSQL/backend containers healthy; web running; existing DemoPay runner container PID **185** and hidden Windows relay PID **31660** retained. Localhost:3001 listener and ADB reverse `tcp:3001` active. MainActivity is the top resumed activity.

### Working accounts

Synthetic debug password for all accounts: **`TroOi2026!`**.

| Email | Identity | Use |
|---|---|---|
| `tenant@trooi.local` | Nguyễn Ngọc Lan | Prepared starting account; Explore, occupied A02, Payment, Messages |
| `owner@trooi.local` | Trần Thu Hà | Owner Sổ, asset management, existing publication, 6/6 capacity |
| `onboarding@trooi.local` | Phạm Thảo Linh | QA only; already onboarded with preserved 1/1 L01 |

Switch via **Hồ sơ → scroll to Đăng xuất → Đăng nhập**. No role toggle.

### Exact live script — approximately 5 minutes

1. Start on prepared tenant **Khám phá**. Open **Căn hộ An Nhiên**; show gallery, rental type, 28 m², 3.200.000đ/month, landlord Hà, amenities, rental costs and rules. Return with the back arrow. Share and public area map are available, but optional for the short script.
2. Tap **Sổ**: show A02, 5.200.000đ rent, October rent/electricity/water and held deposit. Say: “Payments are recorded separately; bills remain subject to reconciliation.”
3. Tap **Thanh toán**, replace the amount with **1000**, **Tiếp tục**, verify **1.000đ / phí 0đ**, **Mở trang thanh toán**. Chrome: **Xác nhận thanh toán → Về TrọƠi**. Wait for native **Thanh toán đã được xác nhận**; use **Kiểm tra thanh toán** if needed. Show pending reconciliation, then press the bottom **Về Sổ**. This explicit action adds one simulated Payment; no real money moves.
4. Optional **Tin nhắn → Hà / A02**. Show repair context. If saving a note, explain **Chưa gửi · Lưu trên thiết bị**; it is not delivered to the other account.
5. **Hồ sơ → scroll → Đăng xuất**; log in as **owner@trooi.local**. Show **Sổ → 6/6 đang quản lý → A02** management detail. Return and scroll to a vacant **Phòng C01** with **Tin đăng đang hiển thị**, or the existing An Nhiên card farther down. Explain occupied/public state and management capacity are separate. Annual additional capacity is **259.000đ per slot/year**. Use existing records; skip purchase, edit, archive and publication changes live.
6. Finish on Owner Sổ, or log back into tenant and return to Explore. Keep emulator and all services running.

### Required services and recovery commands

Required: PostgreSQL **5432**, normal backend **3000**, isolated DemoPay fixture runner plus local relay **3001**, Android emulator/ADB with reverse **3001**. Web **4173** is running and left intact. Do not restart healthy services; DemoPay restart rotates signed browser capabilities.

From Android worktree `D:\Projects\.worktrees\TroOi-Project\design-app-ui-redesign`:

```powershell
$adbTool = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
& $adbTool devices
& $adbTool -s emulator-5554 reverse tcp:3001 tcp:3001
& $adbTool -s emulator-5554 shell am start -n com.trooi.app/.MainActivity
& $adbTool -s emulator-5554 shell svc power stayon true
```

Current verified presentation APK is preserved separately, **24,223,230 bytes**, SHA256 **DA0421E0017A78E47F3D1DE09B6BB430646B060A75E8AA10F03F095ACC7AF830**:

```powershell
# Only if installation is damaged; -r preserves app data.
& $adbTool -s emulator-5554 install -r docs/demo/runtime/trooi-demo-current-stable-debug.apk
& $adbTool -s emulator-5554 shell am start -n com.trooi.app/.MainActivity
```

Older previously verified fallback remains `runtime/trooi-demo-frozen-debug.apk`, SHA256 **93EB1BDD34A79F3AD50B42DFDB408B2C88B488254AB9285C88F964178C829798**. Prefer the current verified copy; the older APK predates graph/map/share improvements and is an emergency fallback, not the current checkpoint.

Inspect before recovery:

```powershell
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
Get-NetTCPConnection -LocalPort 3001 -State Listen
docker exec trooi-project-backend-1 sh -c 'ps -eo pid,args | grep scripts/demo/serve.cjs'
```

Only if stopped:

```powershell
docker start trooi-project-postgres-1 trooi-project-backend-1
# Existing staged runner, only when absent; leave this terminal open.
docker exec -e NODE_PATH=/app/node_modules:/app/node_modules/.pnpm/node_modules -e NODE_ENV=development -w /tmp/trooi-demo trooi-project-backend-1 node scripts/demo/serve.cjs
```

In a separate terminal from `D:\Projects\.worktrees\TroOi-Project\integration-v1-current`, only if no localhost:3001 listener exists:

```powershell
node scripts/demo/forward.cjs
```

After a runner restart, native **Mở lại trang thanh toán** obtains a fresh URL using the same immutable intent. A return link alone never proves payment success. The runner has no `/health` route; 404 is expected there. Do not use `verify.cjs` during preparation; it adds another Payment. Never use `down -v`, fixture reset, app clear-data or emulator wipe.

For an actually unresponsive emulator, first relaunch the app. Last resort: `adb -s emulator-5554 reboot`, wait for boot, restore reverse and launch. If the existing Pixel_8 AVD is stopped and snapshot boot remains offline, preserve userdata with `emulator.exe -avd Pixel_8 -no-snapshot-load -no-snapshot-save`; do not start a second emulator while the current one is working.

### Known limits / resume checklist

No blocker was observed on this bounded live script. Messages are local unsent notes only; **Đặt lịch xem** remains a development notice, so do not demonstrate it as a completed booking. Payment confirmation does not allocate bills or produce a receipt. Owner capacity is full at 6/6; an additional active asset would require explicit simulated purchase. Public map tiles depend on network and are optional. Earlier Android 16 ART native crashes remain a historical emulator risk; this fresh build, two native tests and manual payment/launch completed without a crash.

The broader `/goal` is **incomplete and paused**, not declared complete by this demo checkpoint. Resume only after explicit user instruction. Remaining: requirement-by-requirement audit of the full original attachment; reconcile shared fixture/tenancy/history graph acceptance; full-app loading/error/empty, light/dark, keyboard, navigation, overflow, large-text and accessibility review; reassess contact/viewing against exact scope; fresh final relevant backend payment/authz gates; final whole-source/spec review and accurate acceptance/report/handoff. Preserve current 9 verified gateway Payments, catalog 6/6, local notes and both APK snapshots on resumption.

---
# TrọƠi demo completion — working report

Checkpoint at 2026-10-08 10:33 Asia/Saigon. This is not a completion claim. The full attached product brief remains the acceptance scope.

## Current worktrees

- Android: `D:/Projects/.worktrees/TroOi-Project/design-app-ui-redesign`
- Branch: `design/app-ui-redesign`
- HEAD: `c49bb716baaa33c4659d492953ee81283d9918bd`
- Backend: `D:/Projects/.worktrees/TroOi-Project/integration-v1-current`
- Branch: `integration/v1-current`
- HEAD: `4048127bbaee8b1519e2c047ff7ca2663a87c91b`
- Both worktrees had existing dirty work. It has been retained. No commit, push, merge, reset, stash or history rewrite was performed.

## Seeded debug accounts

These are synthetic fixture credentials compiled only into the Android debug source set. They are not production credentials or Google tokens.

| Account | Identifier | Password | Initial relationship |
| --- | --- | --- | --- |
| Nguyễn Ngọc Lan | tenant@trooi.local | TroOi2026! | Linked tenant; no operated organization |
| Trần Thu Hà | owner@trooi.local | TroOi2026! | Operated organization; no linked tenant POV |
| Phạm Thảo Linh | onboarding@trooi.local | TroOi2026! | Dedicated onboarding QA fixture; no initial rental or operator relationship |

Logout before logging in as the other account. Debug identity restoration uses an app-private non-secret fixture user ID. Release/backendDebug still use the existing Google authentication path.

## Implemented and inspected in this stream

- Strict debug credentials; separate account identities and capabilities.
- Read graph scoped to each account, with matching Room/Property/Tenancy/finance/incident IDs for Căn hộ A02.
- Debug session restoration; logout clears identity and hints.
- Profile and Sổ no longer display POV switches.
- Explore preserves rental context when switching root tabs.
- Debug listing metadata and five bundled photos live in `app/src/debug`; release/backendDebug have empty fixture inventory.
- Explore uses unique large photo cards with monthly prices, category chips and search.
- The occupied A02 listing is unpublished, while distinct apartment and room listings remain public.
- Tenant ledger photo, compact charge rows, deposit and history; owner photo card, operational totals and receivables.
- Profile hero, identical centered shortcuts, exact Kết nối message, flat rows, account details and rental history.
- Monthly price parser supports formatted Vietnamese VND labels as well as existing raw decimal and triệu formats.
- Terracotta actions and neutral surfaces replace the rejected green report treatment. The travelling notch remains.

## Verification evidence

Android command:

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug assembleBackendDebug lintDebug compileDebugAndroidTestKotlin --console=plain
```

The latest full check passed: 156 unit tests, zero failures; both APK build tasks, lintDebug, instrumentation Kotlin compilation and assembleDebugAndroidTest succeeded. The latest lint report contains 60 warnings and 2 hints, no errors. The new warning is the existing ProfileScreen optional Modifier parameter ordering. Six obsolete session-sandbox tests were replaced with navigation, persistent model/repository and public-listing checks. The `UseKtx` suggestion is on the durable SharedPreferences write: this path explicitly checks `commit()`'s Boolean result rather than hiding a failed write.

Actual app runtime command:

```powershell
.\gradlew.bat connectedDebugAndroidTest '-Pandroid.testInstrumentationRunnerArguments.class=com.trooi.app.features.SeededAccountFlowTest' --console=plain
```

One end-to-end instrumentation test passed on Pixel 8 / Android 16. It logs out, logs in as the tenant, opens Sổ, Explore, Listing Detail top and lower sections, Profile, rental history, then logs out and logs in as the owner and inspects owner Sổ and Profile. It asserts the absence of POV switches. Ten screenshot captures per pass are saved under `runtime/TroOiRuntime/`. The retained captures (timestamps 1791406095217 through 1791406107506) wait for native transitions. Earlier premature and superseded captures were removed from the worktree. The latest actual-app test passed after the login/IME and tenant-name changes.

Backend command in the backend worktree:

```powershell
node --import tsx --test tests/core/demo-gateway.behavior.test.ts tests/core/demo-gateway.http.test.ts tests/core/payment-gateway.behavior.test.ts tests/core/payment-gateway.http.test.ts tests/core/resource-authorization.behavior.test.ts
```

87 tests passed, zero failed/skipped. Coverage includes checkout creation, signed confirmation, provider/amount/identity mismatch, idempotency, one Payment, no automatic allocation/deposit application/Receipt, authorization, notifications and rollback. This proves backend behavior under the test harness; it does not prove Android payment end to end.

`git diff --check` passed at the checkpoint.

## Remaining required work

1. Expand/finish the canonical fixture graph, including public and previous rental entities, and remove remaining seeded sandbox content from main code.
2. Landlord onboarding is implemented and runtime-verified below; include it in the final whole-app dark/accessibility review.
3. Finish the whole-app visual and accessibility pass, including dark theme and remaining empty/error surfaces. The owner asset wizard, local photo picker/gallery, draft resume, preview, activation and publication now work through the persistent repository.
4. Annual capacity purchase, explicit review/confirmation, archive and reactivation are implemented and runtime-tested. Review the subscription surface in the final whole-app audit; it remains a dedicated local entitlement, not backend rental finance.
5. Owner asset detail now shows the asset's tenant, terms, receivables, confirmed payments, deposits, incidents, activity and listing state. Keep financial projections scoped by Room as backend integration progresses.
6. Android backend-confirmed DemoPay is implemented and verified at the latest checkpoint below. Include its error/dark/large-text states in the final whole-app audit; preserve backend-only confirmation and immutable recovery intents.
7. Make Messages coherent with isolated local conversations if no backend messaging contract is available.
8. Complete Listing Detail costs, rules/public map/landlord sections and meaningful contact behavior.
9. Audit remaining developer/fixture labels in unfinished normal flows. Onboarding, slot and asset surfaces no longer expose the old sandbox labels; payment simulation disclosure appears only on payment and purchase surfaces.
10. Profile/onboarding instrumentation expectations now match the real routes and validation; retain coverage during the remaining integration work.
11. Exercise the remaining mandated runtime screens, correct defects, complete Impeccable audit/polish and full source/spec review, and rerun all final gates.
12. Update this report with the complete morning demo script, final evidence, gaps and readiness disposition.

The configured `trooi-project-backend-1` container was observed restarting with `getaddrinfo EAI_AGAIN postgres`; no PostgreSQL container was present in the running-container inventory. No secrets or database passwords were read or changed. The already-configured PostgreSQL service was subsequently launched with `docker compose -p trooi-project -f docker-compose.yml up -d postgres`, and the existing backend was restarted. Both containers are healthy; `GET /api/v1/health` returned HTTP 200 and public inventory is reachable. Backend fixture authentication is still required for seeded-account payment verification.

## Status

### Asset and capacity repository checkpoint

- Added `LocalManagement` with active/draft/archive states, base capacity 1, annual expiry, idempotent purchases, activation/publication validation and archive usage release. Saving an existing active asset preserves its management slot.
- The debug repository stores owner catalog JSON in app-private SharedPreferences under the fixture account ID. Failed durable writes do not report success. Seed data remains in `DemoData`; production repository methods explicitly report unsupported functionality.
- Published local assets supplement public discovery using public area only. Drafts, occupied assets and archived assets stay out of discovery. Owner Room/Property/listing projections use the same local IDs; existing tenancy, charge, payment and deposit records are preserved.
- Repository authorization rejects tenant mutations and access capabilities forged for the other account. Logout and account changes preserve catalog data while hiding private owner projections from tenants.
- Focused model/repository tests passed. The current full unit suite has 152 tests, zero failures. The emulator test `LocalManagementPersistenceTest` passed on Pixel 8 / Android 16 using real SharedPreferences, repository recreation, duplicate purchase, archive and cross-account read checks. Wizard visual verification is documented in the next checkpoint.
- The test uses a separate preferences file and clears it afterward; it does not alter the app's normal catalog or seed account session.
- Runtime command: `.\gradlew.bat connectedDebugAndroidTest '-Pandroid.testInstrumentationRunnerArguments.class=com.trooi.app.features.LocalManagementPersistenceTest' --console=plain`.
- The repository work is now connected to the wizard, local gallery, publication detail and purchase confirmation described below.

### Owner asset flow runtime checkpoint

The session-only slot model, its seeded `Studio S01`, and its form/sheet have been removed. The owner screen now reads `localManagement` from the repository, renders its photos and listing state, and opens an asset-specific detail dialog.

The wizard supports Phòng trọ/Căn hộ, precise private address, separate public area, a private location pin, area, bedrooms/bathrooms, furnishing, description, monthly advertised rent/deposit, utilities and other advertised costs, available-from text, minimum term, amenities and house rules. The private pin now uses a visual native map with pan, zoom, tap selection and an accessible center action. It geocodes only the public area as an initial camera position. No raw-coordinate fields are shown. Selection requires a positioned, loaded viewport; precise coordinates stay private. No Maps key or machine configuration was changed.

The native Android photo picker copies selected images to app-private files, validates readable images and caps each at 20 MB. User-created galleries support up to ten images, cover selection, upward reordering and removal. Decoding is bounded and off the UI thread. Canceled unsaved wizard selections can leave private unused files; storage cleanup is a future maintenance task. Saved and archived asset photos are retained.

Drafts can be saved at full capacity and resumed from Owner Sổ. Completion offers separate save-without-publication and publish actions. Preview uses the same detail layout as the published listing. Public projection includes public area and listing metadata, never the private address or operational coordinates. Publishing synchronizes the canonical local asset ID across owner detail, Explore card and listing detail. No tenancy or rental-finance records are created.

At full capacity, activation first saves the draft, then shows price/review and an explicit simulated purchase confirmation. Annual entitlement persistence changes 1/1 → 1/2; continuing publication changes usage to 2/2. Archive changes usage to 1/2 and removes the public listing; reactivation returns to 2/2 without a second purchase. Tests compare finance and tenancy records before/after these operations.

The combined runtime command passed all six tests on Pixel 8 / Android 16:

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug assembleBackendDebug lintDebug compileDebugAndroidTestKotlin connectedDebugAndroidTest '-Pandroid.testInstrumentationRunnerArguments.class=com.trooi.app.features.LedgerUiTest,com.trooi.app.features.AssetPublicationFlowTest,com.trooi.app.features.LocalManagementPersistenceTest,com.trooi.app.features.SeededAccountFlowTest' --console=plain
```

This covers three ledger UI tests, actual app/native-picker publication/archive/reactivation, actual SharedPreferences persistence, and the separate seeded-account app flow. Earlier runs encountered Android 16 native ART crashes and outdated picker accessibility selectors. The emulator was rebooted without clearing data; both isolated and combined reruns then passed. The Android 16 picker test now handles its accessibility descriptions and Done action.

The asset test was also run directly through ADB (`am instrument -w -r -e class com.trooi.app.features.AssetPublicationFlowTest com.trooi.app.test/androidx.test.runner.AndroidJUnitRunner`): OK, one test. The app was then force-stopped and reopened. Its owner session, 2/2 capacity and locally copied Phòng C01 gallery survived. `runtime/owner-process-restored.png` and `runtime/owner-persistent-photo.png` were inspected. At that earlier checkpoint, the emulator had the owner account restored with A02 and the newly published C01; adding another active asset reaches the capacity confirmation flow.

Latest combined-run captures in `runtime/TroOiRuntime` have timestamps 1791422593393–1791422649288. They include owner asset detail, type selection, basics, private pin, gallery/cover controls, preview, actual detail preview, full capacity, purchase review, post-purchase capacity, new asset, published listing/detail/costs, archive, and fresh captures of both accounts' core flows. Capture count does not imply all 25 required acceptance areas are complete: rent payment, landlord onboarding, Messages and dark-theme review remain outstanding.

### Owner review corrections — 2026-10-08

- Room details now capture private/shared WC, maximum occupants and optional floor; apartments retain bedroom/WC counts. Public detail uses these facts without inventing apartment rooms for a room listing. Shared WC excludes the private-bathroom amenity, including validation at the local catalog boundary. Nullable additions preserve previously stored catalogs without fabricating missing facts.
- Tenant cards preserve ACTIVE, ENDING, ENDED, CANCELLED, DRAFT or unavailable lifecycle. Current rentals are selected ahead of history; missing projections hide raw IDs and the finance entry. Owner detail and cards treat ENDING as a current rental and retain agreed terms.
- Owner asset cards display their own charge outstanding labels. Unknown allocation stays unknown; confirmed payments are not subtracted to infer receivables.
- Draft metadata is not projected as an active vacant operational Room. Archived empty rooms become inactive. Stopping local management of occupied A02 preserves its physical occupancy, tenancy and finance history; management capacity is a separate product entitlement.
- Private pin selection uses native pan/zoom/tap, public-area geocoding and visible map tiles. It requires positioning and a loaded viewport. Obsolete requests cancel; drawing is clipped; HTTP caching, bounded requests and off-main TLS/cache cleanup are implemented. OpenTopoMap permits application embedding with attribution and no mass downloading; the visible attribution links to its [provider information and license](https://opentopomap.org/about). This remains an online map, with retry on unavailable tiles. No exact address is sent for initial area geocoding or included in public detail.
- The original OSM tile host reset HTTPS connections from both the emulator and Windows curl. IPv4 ordering did not fix it and was removed. OpenTopoMap rendered the actual Bình Thạnh map. Runtime selection asserts a plausible area location and publication retains the selected draft coordinates.
- Focused source/spec reviewers accepted the lifecycle, metadata, receivable, projection, map-selection, cancellation and clipping corrections. Runtime exposed main-thread TLS closure; moving cleanup to the existing dispatcher executor resolved it.
- Final six-test runtime rerun passed in 69.971 seconds through ADB: three ledger UI tests, actual app publication/recreation/archive/reactivation, persistence and both accounts. Earlier map availability, TLS disposal, native ART crash and offscreen lazy-list assertion failures are not counted as passes. The emulator was rebooted with data preserved; the scroll assertion now brings the capacity header into view.
- The final full Android command passed 155 unit tests, both APK builds, lint (59 warnings, 2 hints, no errors) and instrumentation compilation. Runtime captures now include structured room details in addition to the prior owner and account flows. Map, room-details, receivable card and public metadata/cost captures were inspected. A final small status-bar contrast correction follows the dialog surface; a fresh full Android check passed, and `runtime/wizard-system-bars.png` confirms visible icons. A true force-stop/reopen preserved the owner session and 4/4 catalog (`runtime/owner-process-restored.png`).
- Repeated real UI test purchases were persisted, as intended: the owner now has 4/4 management usage, A02 and three locally created C01 assets. No rental-finance records were added by those capacity purchases. The screenshots and current capacity reflect this test history, rather than an assumed fresh 1/1 installation.

| Label | Current status |
| --- | --- |
| IMPLEMENTED | PARTIAL — accounts, visual foundation, landlord onboarding and owner asset/capacity flows implemented; remaining flows listed above |
| TESTED | YES at the named checkpoint; final full-scope verification remains |
| SOURCE_REVIEWED | PARTIAL — contracts and changed stream reviewed; final independent review remains |
| PRODUCT_SPEC_ALIGNED | PARTIAL — full original scope remains active |
| RUNTIME_VISUAL_VERIFIED | PARTIAL — accounts, full landlord onboarding and owner asset/capacity/publication inspected; rent payment, Messages and whole-app dark-theme review remain |
| DEMO_READY | NO |

### Landlord onboarding checkpoint — 2026-10-08 09:14

- `LandlordOnboardingScreen.kt` now provides intro, editable legal name/birth date, CCCD front/back, face photo or native camera, local identity acknowledgement, phone/email confirmation, the existing first-asset wizard, review/terms and completion into Owner Sổ. Invalid dates, incomplete identity/contact and missing first-asset photos prevent continuation. Local confirmations explicitly do not claim government or SMS verification.
- Personal/contact inputs and identity bitmaps are transient Compose memory. They are not saved to instance state, preferences, files or the backend. Rental photos use the existing app-private asset media path. Closing enrollment drops identity inputs; final success clears them immediately. A cancelled rental wizard can still leave the previously documented unused rental-media files.
- `LocalLandlordApplication.kt`, the repository contract/debug implementation and `TroOiViewModel.kt` validate final confirmation and atomically persist only organization membership plus first-asset catalog. Session-generation checks prevent an obsolete completion from overwriting a newer account. Production/backendDebug retain explicit unsupported conversion until a real onboarding contract exists.
- Session-only landlord unlocking and its navigation store are removed. Profile/Sổ derive context from relationships. A member without rental/operator relationships is labeled “Thành viên TrọƠi”. Converted tenants retain their linked tenancy and existing finance; a newly converted member has no fabricated tenancy, payments or receivables.
- Debug catalogs are keyed by each user ID. Cross-account Room/Property collisions are rejected; new owner operational/media projections and recent notices remain scoped to their own assets/tenancies. Published catalogs still supplement discovery with public-only metadata.
- Original Lan and Hà accounts remain unchanged for direct testing. Linh is a dedicated third QA account. The actual-app onboarding test resets only Linh's QA membership/catalog before its run, never original-account data. All identity images are generated specimens marked “SPECIMEN - NOT A DOCUMENT” and removed from MediaStore afterward. Retained screenshots contain synthetic inputs only.
- Two independent read-only review axes accepted source/spec behavior. Standards review identified the normalized-birth-date assertion gap; the test now checks legal name, both date formats, phone and email. Activity recreation is documented separately from process death.

Runtime commands:

```powershell
adb -s emulator-5554 shell am instrument -w -r -e class 'com.trooi.app.features.RedesignUiTest,com.trooi.app.features.LocalManagementPersistenceTest,com.trooi.app.features.SeededAccountFlowTest,com.trooi.app.features.LandlordOnboardingFlowTest' com.trooi.app.test/androidx.test.runner.AndroidJUnitRunner
adb -s emulator-5554 shell am instrument -w -r -e class 'com.trooi.app.features.LandlordOnboardingFlowTest' com.trooi.app.test/androidx.test.runner.AndroidJUnitRunner
adb -s emulator-5554 shell am instrument -w -r -e class 'com.trooi.app.features.AssetPublicationFlowTest,com.trooi.app.features.LedgerUiTest' com.trooi.app.test/androidx.test.runner.AndroidJUnitRunner
```

The first command passed all 11 existing checks but failed the newly added onboarding picker helper at the asset photo confirmation. The helper now waits for the native Done/Add control instead of assuming a 300 ms transition. The corrected onboarding rerun passed: **OK (1 test), 58.921 seconds**. It exercised all stages, native photo selection, no capability before final confirmation, a private Căn hộ L01 at 4.2 million/month, durable 1/1 capacity, Activity recreation/relogin, no persisted personal/contact input and original tenant/owner separation. Earlier incorrect profile callback expectations and snackbar-obscured test taps were corrected and passed in the first command; failed runs are not counted as successful suites.

The final owner regression passed **OK (4 tests), 73.683 seconds**: three ledger UI checks plus actual native-photo purchase/publication/recreation/archive/reactivation. The original owner now has **5/5** persisted management capacity (A02 and four created C01 assets); purchases did not create rental-finance records. Linh retains a separate **1/1** private L01. No global app reset occurred.

A manual login as Linh followed by `am force-stop com.trooi.app` and relaunch restored L01, its local photograph and 1/1 Owner Sổ directly. `runtime/TroOiRuntime/onboarding-process-restored.png` records the actual process-restart result. The new owner ledger's previously blank tenant/charge/payment sections now show clear empty-state text; `onboarding-owner-empty-states.png` was inspected after this correction.

Eight onboarding captures with timestamps **1791425309780–1791425347251** were pulled into `runtime/TroOiRuntime`. Intro, personal details, local identity acknowledgement, contact, first asset, review, completion and owner result were inspected. No clipping, keyboard obstruction or dialog system-bar contrast defects were found. This closes the bounded onboarding visual pass, not the full application's remaining acceptance review.

The final Android command passed in **1m 4s**:

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug assembleBackendDebug lintDebug compileDebugAndroidTestKotlin assembleDebugAndroidTest --console=plain
```

**154 unit tests, zero failures/errors; 60 lint warnings, 2 hints, no errors.** `git diff --check` passed (Git emitted line-ending normalization warnings only). Backend/PostgreSQL remained healthy; no backend changes were made in this stream. Android backend-confirmed rent payment, Messages, fixture expansion/public-map/contact completion and the full-app final audit still prevent `DEMO_READY = YES`.

### Real PostgreSQL payment foundation — 2026-10-08 09:49

The payment foundation now runs the reviewed checkout and settlement code against actual PostgreSQL, through a separate localhost fixture API. Android end-to-end payment remains pending; this is stronger backend evidence, not a payment-screen completion claim.

- Backend helpers added under `integration-v1-current/scripts/demo`: `fixture.cjs`, `serve.cjs`, `forward.cjs`, `verify.cjs` and a startup README. Production AppModule, Google auth and MoMo were not edited. The existing dirty authorization/settlement work was preserved.
- The runner authenticates only the three synthetic fixture identities, issues random 15-minute in-memory bearers and derives session capabilities from persisted organization/participant relationships. It binds loopback. It accepts only explicit DEMO checkout creation and blocks MoMo callbacks. A source-review finding about case-insensitive Express routes was corrected by normalizing paths; mixed-case requests are now tested and rejected.
- Additive reserved UUID fixtures connect real User/Organization/Property/Room/Tenancy/Terms/Billing/Charge/Payment/Deposit records for A02. Historical manual records and the historical deposit application are seed facts, distinct from gateway settlement. Existing money records and lifecycle are never reset.
- Host `.env` authentication failed with `28P01`. The runner instead uses the existing configured backend container's connection, without extracting credentials or changing PostgreSQL passwords. Code is staged separately in `/tmp/trooi-demo`. A loopback Docker TCP relay and `adb reverse tcp:3001 tcp:3001` expose the API/browser origin at `http://localhost:3001/api/v1`.
- PostgreSQL initially lacked `gateway.gateway_checkouts`. Existing repository migrations `000003`–`000006` were inspected and applied through the configured container connection using node-pg-migrate. No new migration or financial meaning was authored; existing records remain intact.
- `node scripts/demo/verify.cjs` passed against real HTTP and PostgreSQL after the final guard correction. It checks invalid credentials/bearers, persisted capabilities, outsider access, omitted/non-DEMO/mixed-case provider rejection, blocked mixed-case MoMo callbacks, amount/idempotency conflict, read-only handoff, signed confirmation, duplicate success, one GATEWAY/PROVIDER_VERIFIED Payment and zero automatic allocation/deposit application/Receipt.
- Each successful probe explicitly confirms one simulated 1,000 VND payment. The current preserved backend fixture contains three such gateway probe payments plus its two historical manual transfers. No real money transfers. Charges remain unallocated; confirmed money is not reported as a settled bill.
- Restarting the isolated runner rotates its transient signing key. Existing Payment history remains, but old signed pay URLs become stale. The Android integration must refresh/replay the same immutable intent rather than infer payment or issue a second intent automatically. Keep the current runner alive for the demo.
- Independent standards/spec reviewers accepted the corrected runner boundary. The source review does not replace the actual HTTP/PostgreSQL probe.

Fresh backend command:

```powershell
node --import tsx --test tests/core/demo-gateway.behavior.test.ts tests/core/demo-gateway.http.test.ts tests/core/payment-gateway.behavior.test.ts tests/core/payment-gateway.http.test.ts tests/core/resource-authorization.behavior.test.ts
```

**87 passed, zero failed/cancelled/skipped; 6,699.7087 ms.** Detailed evidence is in backend `build/demo-payment-check.log`. Node syntax checks and `git diff --check` passed. Startup/replay instructions are in the backend `scripts/demo/README.md`.

Android transport groundwork now supports an explicit provider argument while omitting provider by default, preserving MoMo behavior. Local DemoPay pay URLs require explicit opt-in, the exact local pay path and no credentials/query/fragment. DEMO returns also require opt-in and refresh only the remembered checkout ID; forged query status/IDs cannot confirm payment. Two unit checks cover provider serialization and local handoff/return boundaries.

The full Android command passed in **1m 53s**: `testDebugUnitTest assembleDebug assembleBackendDebug lintDebug compileDebugAndroidTestKotlin`. **156 unit tests, zero failures/errors; 60 lint warnings, 2 hints, no errors.** Both source-review axes accepted the Android boundary additions. These are transport checks; the installed app has not yet exercised the new payment flow.

The [verified backend settlement sequence](demo-payment-sequence.html) documents the real probe path and explicitly labels Android wiring as pending. Archify delivery passed all nine showcase checks with zero errors/warnings; automated light/dark desktop viewport checks passed after a compact layout correction, and the 1440×900 light capture was inspected. The final frozen source is `demo-payment-sequence.compact.json`; the earlier source is retained as draft evidence.

Remaining payment work: align the Android fixture IDs with the backend UUID graph while preserving existing 5/5 owner catalog data; establish the scoped fixture bearer bridge; implement/review the tenant payment review, browser handoff, return refresh and source-backed history; style the simulation browser page; and verify forged return, restart/retry and actual native/browser completion. Messages, public detail/map/contact completion, fixture expansion and full-app final audit remain in scope. `DEMO_READY = NO`.
## Android DemoPay integration checkpoint — 2026-10-08 10:33 Asia/Saigon

The tenant payment path is now implemented against the actual PostgreSQL demo API. The earlier sequence artifact remains historical evidence of the backend probe; its Android-pending label describes that earlier checkpoint.

Implemented changes:

- Android's A02 organization/property/room/tenancy use the backend reserved UUID graph. Legacy persisted A02 IDs are normalized on read, preserving additional assets, media, archive/publication state and purchased capacity. Synthetic local account IDs remain session/catalog aliases; the debug-only client validates their actual backend UUID principal and exact persisted capability set before each operation.
- `DemoPaymentClient` exists only in `app/src/debug`. It reuses BackendClient, OkHttpBackendApi and V1PaymentGateway. Bearers are scoped to one serialized operation and cleared in `finally`; they are never stored or logged. Local HTTP is permitted only for explicit loopback/emulator hosts in the debug network policy. Release/backendDebug Google and MoMo paths remain unchanged.
- Authorized charge/payment/deposit projections come from PostgreSQL. Local asset mutations retain the last authorized finance read; they cannot replace newly confirmed money with seed history. Missing allocation data remains unknown. Owner summaries distinguish unknown totals from absent records.
- Tenant Sổ opens amount entry, review and browser payment. A user-scoped immutable intent is synchronously saved before POST. Retries reuse the same UUID key and amount; uncertain attempts cannot be replaced by a second intent. Checkout ID, tenancy, provider and amount must match the remembered intent.
- Browser confirmation is explicit. The simulation page uses a static CSS CSP hash, no scripts, no-store and strict origin verification. The original no-referrer policy suppressed Chrome's form origin and caused rejection; strict-origin now preserves the origin without forwarding the signed URL path. Financial/auth guards were not relaxed.
- A return URI only opens payment navigation. Android then fetches the remembered checkout, requires SUCCEEDED plus a resulting Payment ID, and refreshes actual Payment history before showing confirmation. It states that allocation/receivable reconciliation is pending. Explicit Done retires only a matching, backend-verified completed hint; a subsequent payment receives a fresh key.
- Initial/stale authorized-read failures and missing payment finance have a wired retry. Errors remain product-facing without raw transport or security diagnostics.

Verification completed:

- Final exact Android gate: `testDebugUnitTest assembleDebug assembleBackendDebug lintDebug compileDebugAndroidTestKotlin` — BUILD SUCCESSFUL in 8 seconds; 158 unit tests, zero failures; lint 0 errors, 60 warnings, 2 hints. Instrumentation APK assembled separately.
- Fresh backend payment/authorization suite: 87 passed, zero failed/cancelled/skipped, 5,665.2888 ms. Both worktree diff checks passed.
- `RentPaymentFlowTest` — actual Android → Chrome → explicit signed DemoPay POST → app return → backend checkout/history confirmation; OK (1 test), 20.25 seconds. It also checks unchanged charges/deposit, no receipts, forged return after success with no duplicate Payment, explicit completion/new UUID, and a forged success return before the second confirmation remaining CREATED with no added Payment.
- Read-only PostgreSQL audit: 6 persisted gateway payments, all PROVIDER_VERIFIED; zero automatic allocations, receipts or deposit applications across them. These include three earlier HTTP probes and three explicit browser confirmations made while correcting the native test harness. Abandoned/unconfirmed checkouts are retained; no financial records were reset.
- Actual app force-stop/relaunch preserved the pending 2,000đ checkout ID, amount and key byte-for-byte. Sổ reloaded from the backend and opening payment restored that pending state. The successful Payment history remains backend-persisted.
- Standards and product-spec reviews accepted the corrected stream. Findings about retiring completed hints, unknown owner totals and retry behavior were fixed and re-reviewed. The browser referrer correction was separately source-reviewed.
- Light runtime captures inspected: review with all three charges, browser confirmation, native success, restored pending payment. Native keyboard, sticky actions, photo identity, monthly amounts and no-settled-charge language are visible. This verifies the payment stream on Pixel 8 Android 16; it does not claim a full-app/dark/large-text audit.

Evidence:

- `runtime/payment-instrumentation.log`
- `runtime/payment-review.png`
- `runtime/payment-browser-confirmed.png`
- `runtime/payment-success.png`
- `runtime/payment-restored-ledger.png`
- `runtime/payment-restored-pending.png`
- `runtime/payment-restart-before.json` contains non-secret immutable recovery identity only.

Runtime tooling notes: Chrome's first-run screen was completed without an account and optional notifications declined. Native tests use actual touch injection for Chrome virtual controls, enable native accessibility window retrieval and wait through browser/app transitions. Earlier harness failures are not counted as passes. The emulator also repeatedly hit native Android 16 ART SIGABRT/SIGSEGV; preserving-data reboots recovered it. No product Java exception or data reset was used to hide these failures.

Payment stream: IMPLEMENTED = YES; TESTED = YES; SOURCE_REVIEWED = YES; PRODUCT_SPEC_ALIGNED = YES; RUNTIME_VISUAL_VERIFIED = YES (light phone scope above).

Overall DEMO_READY = NO. Messages, remaining public detail/map/contact functionality, complete fixture graph expansion, full-app light/dark/overflow/navigation audit and final requirement-by-requirement completion audit remain in the original scope.
Both-account regression after payment integration: SeededAccountFlowTest passed (1 test), 20.145 seconds. It re-exercised direct tenant/owner POV, public imagery/detail, profiles and rental history. Existing owner catalog and four valid slot entitlements remain 5/5; no capacity purchase occurred during payment testing. Current captures include runtime/payment-owner-ledger.png. The native light review found repeated allocation-technical wording on the owner card; it was replaced with actual billed amounts plus one plain waiting-for-reconciliation line, without inventing a balance.

Final owner copy correction: all five Android gates passed again in 56 seconds (158 unit tests; lint 0 errors, 60 warnings, 2 hints). The rebuilt debug APK was installed and the owner 5/5 ledger with billed amounts and reconciliation note was rendered and inspected in the confirmation pass. The successful payment test log remains the explicit browser/financial flow evidence; the later copy change does not alter checkout behavior.

### Bounded native payment audit

Platform verdict: PASS for the inspected phone surfaces: Compose/Material controls, labelled native back action, Android IME insets, scrollable content, and the preserved native root navigation. This is not the whole-app final audit.

| Dimension | Score | Evidence / limitation |
|---|---:|---|
| Accessibility | 2/4 | Labelled amount field/actions and 48dp controls; Material text roles. TalkBack traversal and large-font runtime coverage remain pending. |
| Performance | 3/4 | Existing network client performs IO off the main thread; one serialized authenticated operation; no added dependency. No frame-time benchmark performed. |
| Appearance / theming | 3/4 | Semantic Material colors and type; light review/success/pending captures inspected. Dark phone review remains pending. |
| Platform conformance | 3/4 | Native amount/review/recovery and actual external browser handoff work; screenshot-confirmed keyboard and sticky actions. Existing travelling-notch navigation intentionally preserved. |
| Adaptivity | 2/4 | Scroll and IME handling verified on Pixel 8 portrait. Tablet, landscape and large-text coverage remain part of the full-app audit. |
| Total | 13/20 | Bounded phone evidence; remaining verification prevents a broader acceptance claim. |

The one visual correction from the inspection batch was the owner's repeated allocation terminology. The confirmation pass verified billed amounts plus a single reconciliation note. No further polishing loop was performed.

## DEMO FREEZE checkpoint — 2026-10-08 11:15 Asia/Saigon

**LIVE DEMO READY for the script below. Original /goal PAUSED at the user's request; full specification acceptance remains incomplete.** No source implementation was changed during this freeze. All uncommitted work is preserved; no commit, push, merge, rebase, reset, stash, clean, database reset or catalog reset was performed.

The existing Pixel 8 / Android 16 emulator (`emulator-5554`) is running, with TrọƠi foregrounded on **tenant Explore**, light mode and screen stay-awake enabled. Final screenshot: `runtime/demo-ready-explore.png`.

### Frozen APK and fresh smoke evidence

- `assembleDebug`: BUILD SUCCESSFUL in 4 seconds, current build up to date. Prior complete gate: 160 unit tests, zero failures; lint zero errors, 61 warnings, 2 hints.
- Stable presentation APK copied to `runtime/trooi-demo-frozen-debug.apk` (24,223,230 bytes). SHA256: `93EB1BDD34A79F3AD50B42DFDB408B2C88B488254AB9285C88F964178C829798`. Use this copy for recovery; do not rebuild new features during the presentation.
- `SeededAccountFlowTest`: **OK (1 test), 20.075 seconds**, tenant login/Explore/public detail and owner login/Sổ/profile. Log: `runtime/accounts-freeze-smoke.log`.
- `MessagesFlowTest`: **OK (1 test), 26.082 seconds**, local notes, persistence, account separation, search/empty state, light/dark. Log: `runtime/messages-freeze-smoke.log`; dark chat capture inspected at `runtime/messages-freeze-dark.png`. Messages are device-local unsent notes, not network delivery.
- `RentPaymentFlowTest`: **OK (1 test), 52.948 seconds**, actual Android → Chrome → explicit DemoPay confirmation → backend-verified success/history, duplicate-return protection and forged-return rejection. Log: `runtime/payment-freeze-smoke.log`.
- The test's second 2,000đ pending checkout was subsequently reopened through normal app controls, explicitly confirmed in Chrome and returned to the app. Normal completion returned to Sổ, then Explore. No checkout/payment was deleted.
- Final read-only PostgreSQL audit: **8 GATEWAY payments, all PROVIDER_VERIFIED; 0 automatic allocations, 0 receipts, 0 deposit applications**. Freeze smoke added one explicit 1,000đ confirmation and the above 2,000đ confirmation; all earlier confirmed payments remain.
- Owner read-only inspection: **5/5 capacity preserved**, occupied A02 remains unpublished; existing vacant C01 listings show “Tin đăng đang hiển thị”. Asset detail opened successfully. Captures: `runtime/demo-owner-detail.png`, `runtime/demo-owner-publication.png`. No asset, publication or capacity mutation was needed for this smoke.

### Working accounts

All are synthetic local debug accounts; password **`TroOi2026!`**:

| Account | Email | Presentation use |
|---|---|---|
| Nguyễn Ngọc Lan | `tenant@trooi.local` | Explore, A02 Sổ, actual DemoPay, local Messages |
| Trần Thu Hà | `owner@trooi.local` | Owner Sổ, preserved 5/5 assets/publication/capacity |
| Phạm Thảo Linh | `onboarding@trooi.local` | QA only; already onboarded, private L01 and 1/1 capacity |

Switch accounts using **Hồ sơ → scroll → Đăng xuất → Đăng nhập**. There is no role toggle.

### Exact live script (about 5 minutes)

1. Start on the prepared tenant **Khám phá** screen. Open **Căn hộ An Nhiên**, show photographs, 3.200.000đ/month and detail sections; use the native back arrow.
2. Tap **Sổ**. Show occupied A02, 5.200.000đ monthly rent, October rent/electricity/water and held deposit. Explain that confirmed payments remain separate from bill reconciliation.
3. Tap **Thanh toán**. Enter **1000** (1.000đ simulation), **Tiếp tục**, review amount and zero fee, then **Mở trang thanh toán**. In Chrome press **Xác nhận thanh toán**, then **Về TrọƠi**. Wait for **Thanh toán đã được xác nhận**; if needed press **Kiểm tra thanh toán**. Show the pending-reconciliation wording, then **Về Sổ**. Only this explicit simulation confirms a payment; no real funds move.
4. Optional **Tin nhắn**: open the Hà/A02 conversation, show the repair discussion. Save a short note with **Lưu** and point out **Chưa gửi · Lưu trên thiết bị**. Do not claim delivery or automatic replies.
5. **Hồ sơ → Đăng xuất**. Log in as `owner@trooi.local`. Show **Sổ**, **5/5 đang quản lý**, occupied A02 and its detail. Back and scroll to a vacant **Phòng C01** showing **Tin đăng đang hiển thị**. Explain management capacity is distinct from public listing state and costs **259.000đ per slot/year**. Use existing records; no purchase/archive/publication changes are needed live.
6. Finish on Owner Sổ, or log back in as tenant and return to Explore. Keep the app, emulator and service processes open.

### Required services and recovery

At freeze: PostgreSQL and normal backend containers healthy; web container running. Isolated DemoPay runner remains alive as container PID **15100**. The host relay had stopped during interruption and was restored as a hidden process, host PID **5460**, listening on `127.0.0.1:3001`. ADB reverse is active. Do not restart healthy services: restarting DemoPay invalidates old signed browser URLs.

Run Android commands from this worktree:

```powershell
$adbTool = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
& $adbTool devices
& $adbTool -s emulator-5554 reverse tcp:3001 tcp:3001
& $adbTool -s emulator-5554 shell am start -n com.trooi.app/.MainActivity
& $adbTool -s emulator-5554 shell svc power stayon true
```

If app installation is damaged, preserve its data with `-r`:

```powershell
& $adbTool -s emulator-5554 install -r docs/demo/runtime/trooi-demo-frozen-debug.apk
& $adbTool -s emulator-5554 shell am start -n com.trooi.app/.MainActivity
```

Inspect services before starting anything:

```powershell
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
Get-NetTCPConnection -LocalPort 3001 -State Listen
docker exec trooi-project-backend-1 sh -c 'ps -eo pid,args | grep scripts/demo/serve.cjs'
```

Only if the named containers are stopped: `docker start trooi-project-postgres-1 trooi-project-backend-1`. Never run `down -v`, reset, migration down or fixture reset. From `D:\Projects\.worktrees\TroOi-Project\integration-v1-current`, only if the corresponding process is absent:

```powershell
# DemoPay: use existing staged build; keep this terminal running.
docker exec -e NODE_PATH=/app/node_modules:/app/node_modules/.pnpm/node_modules -e NODE_ENV=development -w /tmp/trooi-demo trooi-project-backend-1 node scripts/demo/serve.cjs
# Separate terminal, relay only if no localhost:3001 listener exists:
node scripts/demo/forward.cjs
```

After a runner restart, return to native Payment and use **Mở lại trang thanh toán** to replay the same immutable intent and receive a valid URL. Do not infer success from a return link. The runner has no `/health` endpoint; a 404 there is not an outage. Avoid `verify.cjs` during presentation preparation: it adds a simulated payment.

If the emulator actually becomes unresponsive, first try normal app relaunch. Last resort, preserving data: `adb -s emulator-5554 reboot`, wait for boot, restore reverse forwarding and launch again. Do not wipe AVD/app data.

### Known limits and work reserved for /goal resumption

- No blocker was observed on the scripted smoke paths. Android 16 emulator ART native crashes occurred earlier in the session; avoid repeated instrumentation/reboots during the live demo. Fresh freeze tests and normal launch passed.
- Messages support local unsent notes only. Remote send/delivery is not implemented. External map/network-dependent interactions and unfinished contact/share actions are outside the live script.
- Do not claim all bills paid after DemoPay: provider-verified Payment is recorded, reconciliation/allocation remains pending. Existing confirmed money and catalog must remain preserved.
- Owner capacity is full (5/5). Adding another active asset requires the explicit annual simulated-capacity purchase; skip this mutation for the live script.
- Resume only after the user releases the freeze: remaining public detail/share/contact/map completion, complete fixture graph expansion, full-app light/dark/overflow/navigation/accessibility/large-text audit, final requirement-by-requirement acceptance and final reports. Reconcile the completed Messages stream evidence with the original spec; the original whole-goal `DEMO_READY = NO` statements remain historical/full-spec status, not a rejection of this bounded live script.
- Existing `git diff --check` reports one trailing blank line in `DiscoveryPlaceholderScreens.kt`; left untouched during freeze. No source cleanup, new features or full-app acceptance testing was performed in demo operations.

## Development resumed — 2026-10-08 13:50 Asia/Saigon

The user reactivated the original `/goal`; the demo freeze above is now a historical checkpoint. The full objective remains active and incomplete. The frozen APK remains unchanged with its documented SHA256 and is available for presentation recovery.

Authoritative inspection found Docker stopped and no connected emulator. Starting the configured Docker Desktop recovered the existing PostgreSQL/backend/web containers. The existing staged DemoPay runner was absent and was restarted without rebuilding or resetting data (container PID 185); host relay PID 31660 listens on localhost:3001. This runner restart rotates browser capabilities: use the existing immutable-intent replay control if an old payment URL is encountered. PostgreSQL read-only audit still proves all **8 provider-verified gateway Payments**, with zero automatic allocations, receipts or deposit applications. No new payment confirmation was performed in this resumed stream.

The Pixel_8 AVD initially remained ADB-offline despite reconnect and bridge restart. A cold boot with `-no-snapshot-load -no-snapshot-save` restored it without wiping userdata. ADB reverse was restored. Actual session restoration selected owner Sổ with its preserved 5/5 catalog; the app was left open on Explore after the share inspection.

### Listing Detail native Share

The former Share placeholder now opens Android's native text share chooser. `ListingFixture.shareText()` deliberately projects only title, rental type, public area and monthly asking price, with TrọƠi context. Local image URIs, operational address/coordinates, private metadata and a fabricated public web link are excluded. Sharing is hidden for unpublished asset previews. An unavailable chooser reports a readable retry message through the existing snackbar.

Files: `ListingDetailScreen.kt`, `ListingFixtures.kt`, and `LocalListingTest.kt`. The existing local-listing privacy test now checks the exact shared text and exclusion of private address/media paths. One trailing blank line in `DiscoveryPlaceholderScreens.kt` was removed to restore the required diff check; no other cleanup was performed.

Verification:

- Exact Android five-gate command passed in **1m 58s**: `testDebugUnitTest assembleDebug assembleBackendDebug lintDebug compileDebugAndroidTestKotlin`. **160 tests, zero failures/errors; lint 0 errors, 61 warnings, 2 hints.** Log: `runtime/listing-share-gates.log`.
- `git diff --check`: exit **0**; line-ending warnings only, recorded in `runtime/resume-diff-check.log`.
- Independent Standards review: no hard violations or actionable heuristic findings. Independent Spec review: no material defects or scope creep in this bounded Share patch. Neither source review substitutes for whole-goal acceptance.
- Rebuilt regular APK installed with `-r`; actual An Nhiên detail → Share opens Android's sheet with the expected public text. `runtime/listing-share-sheet.png` was captured and visually inspected. The sheet was dismissed; nothing was sent to another person/application.

Share stream: **IMPLEMENTED = YES; TESTED = YES; SOURCE_REVIEWED = YES; PRODUCT_SPEC_ALIGNED = YES; RUNTIME_VISUAL_VERIFIED = YES (light Pixel 8 / Android 16 chooser only).** Overall full-spec **DEMO_READY remains NO**.

Remaining goal work: public contact/viewing and map completion, fixture graph consolidation/expansion (including resolving cross-surface metadata discrepancies), full-app light/dark/overflow/navigation/accessibility/large-text verification, and the final explicit requirement-by-requirement audit/report. Messages already passed the bounded freeze runtime test; incorporate that evidence rather than rebuilding its completed functionality. No commit, push, merge, rebase, reset, stash or clean was performed.

## Public detail map and fixture consistency — 2026-10-08 13:58 Asia/Saigon

The existing public detail now renders an in-app area map from an explicit public projection. It reuses the current OpenTopoMap tile renderer rather than adding a map dependency or requiring a Google key. The asset picker remains editable by default; public detail opts into read-only mode, requires a supplied public point, disables picking and hides the center-pin CTA. Panning and labelled 48dp zoom controls remain available. Area copy explicitly distinguishes this public projection from the exact operational address. Local previews omit the map.

`ListingFixture` now carries an optional public point. `publicRentalDetail` obtains it through the existing published-only `publicMapPoint` boundary. Local assets without an explicitly supported public coordinate remain without a map; operational coordinates are never used as fallback. Debug An Nhiên and the Bình Thạnh room have isolated coarse synthetic projections, not claims about real property addresses. DemoData forwards those same projections into the public listing read. The unpublished, occupied A02 has no public map point and remains absent from Explore.

The A02 detail fixture previously said 35 m² while the canonical owner asset said 32 m². Both card/detail now use 32 m², preserving persisted catalog and finance. A focused graph test checks name, public area, size and occupied/public separation. The local projection test checks explicit published public point propagation, suppression for drafts and no operational-pin fallback.

Verification:

- Initial five Android gates passed in 1m 15s; final gate after the bounded dark-loading correction passed in **57 seconds**. Final results: **161 unit tests, zero failures/errors; lint 0 errors, 61 warnings, 2 hints**. Exact command remains `testDebugUnitTest assembleDebug assembleBackendDebug lintDebug compileDebugAndroidTestKotlin`. Logs: `runtime/public-map-gates.log`, `runtime/public-map-final-tests.log`, `runtime/public-map-final-gates.log`.
- `git diff --check`: exit **0**, log `runtime/public-map-diff-check.log`.
- Standards and Spec reviewers accepted the bounded public-map/metadata stream; Standards also accepted the final semantic-color/accessibility correction.
- Actual rebuilt APK installed and An Nhiên detail scrolled to the public map. Light map tiles loaded and were inspected in `runtime/listing-public-map-light.png`. The first dark capture caught loading and exposed a hardcoded light canvas; corrected to the theme's `surfaceVariant`. Final dark tiles, area copy, rules, attribution, zoom controls and sticky monthly CTA were inspected in `runtime/listing-public-map-dark-final.png`. There is no pin-selection button on this public surface. Returned the emulator to light mode with the app open.
- Read-only PostgreSQL audit remains **8 provider-verified gateway Payments**, no automatic allocations/receipts/deposit applications. No confirmation, catalog reset or capacity purchase occurred.

Public detail map/A02 consistency stream: **IMPLEMENTED = YES; TESTED = YES; SOURCE_REVIEWED = YES; PRODUCT_SPEC_ALIGNED = YES; RUNTIME_VISUAL_VERIFIED = YES (Pixel 8 light/dark scope above)**. This is not the full-app audit. The original whole-goal **DEMO_READY remains NO**.

Remaining work now excludes this public detail map implementation: audit the full fixture graph and its ownership/catalog relationships, complete any required public contact/viewing behavior without inventing backend APIs, verify missing states and full-app navigation/large-text/overflow, then perform the final requirement-by-requirement acceptance audit and report. The frozen presentation APK is retained unchanged.

## Advertised rental costs and graph audit — 2026-10-08 14:29 Asia/Saigon

Source investigation proved a required detail section was missing for all three seed fixtures: their advertised deposit/utility offers were stored among rules, leaving `costs` empty and suppressing “Chi phí thuê”. These existing offers now populate the existing cost projection; rules contain household conditions only. The public Bình Thạnh room has no specified tariff and explicitly asks the reader to discuss electricity/water with the landlord rather than inheriting A02's rate. No financial entity, agreed Tenancy Terms, purchase or confirmation was created.

Listing Detail also displays the explicit rental type beneath its title. The runtime inspection caught the sticky footer still referring deposit readers to “Điều cần biết”; it now says “Xem chi phí thuê”. Files changed in this stream: debug `ListingFixtures.kt`, main `ListingDetailScreen.kt`, and `ListingFixturesTest.kt`.

Verification: initial exact five Android gates passed in **1m 2s**, then final gates passed in **51s** after the footer correction. **162 unit tests, zero failures/errors; lint 0 errors, 61 warnings, 2 hints**. `git diff --check` exit **0**. Logs: `runtime/listing-costs-gates.log`, `runtime/listing-costs-final-gates.log`, `runtime/listing-costs-diff-check.log`. Both Standards and Spec reviewers accepted the bounded metadata/type change; Spec also accepted the footer correction. Actual rebuilt APK installed with `-r`. Cost sections were captured and inspected in `runtime/listing-costs-light.png` and `runtime/listing-costs-dark.png`; the final category/footer correction was rendered and inspected in `runtime/listing-costs-final.png`. The app remains open in light mode. Frozen presentation APK hash is unchanged.

Cost/type stream: **IMPLEMENTED = YES; TESTED = YES; SOURCE_REVIEWED = YES; PRODUCT_SPEC_ALIGNED = YES; RUNTIME_VISUAL_VERIFIED = YES (bounded phone surfaces above)**.

### Confirmed fixture-graph gap, still open

`ListingFixtures.resolve("demo-studio")` names Trần Thu Hà as landlord. Its seeded conversation also uses Lan/Hà identities. However, `DemoData.ownerManagement` contains only A02, and the repository simply concatenates seeded public listings with separately saved local assets. There is no canonical An Nhiên Room/Property association in Hà's management catalog. Likewise the public room and previous B03 history have stable presentation IDs but lack a fully expressed shared owner/property/room/tenancy graph. A passing card-to-detail test does not establish these relationships.

The original goal's centralized, consistent graph requirement therefore remains **INCOMPLETE**. The next graph change must establish canonical relationships and update all dependent projections while preserving existing assets/photos/entitlements/local notes and PostgreSQL money. It must not silently purchase capacity, reassign ownership or turn an advertised listing into an active tenancy. Full-app state/accessibility/navigation audits and the final requirement-by-requirement report also remain required. No blocker prevents continued implementation; `/goal` remains active and whole-spec **DEMO_READY = NO**.

## Shared rental graph checkpoint — 2026-10-08 15:34 Asia/Saigon

The specific An Nhiên ownership/catalog gap above is repaired. `DemoRentalGraph` now supplies shared stable Room/Property/Listing/owner identities and asset facts for A02, An Nhiên, Nam's public room and the previous B03 rental. Public details are derived from those assets through the existing public projection. Public names, monthly asking prices, type, size, images, amenities, offers and rules no longer come from a separately authored listing record. B03 history uses the canonical previous asset's identity/name/location/images. The original A02 PostgreSQL IDs and tenancy remain unchanged.

`LocalRentalAsset` supports an optional explicit Listing identity with the old computed identity as its nullable backward-compatible fallback. Edits preserve that association. Shared catalog validation protects graph-reserved asset/property/listing identities, canonical ownership, alias uniqueness and cross-account collisions before either normal saves or landlord onboarding writes preferences. Tests cover both forged onboarding aliases and foreign graph assets whose owner has no login account. No production auth or backend contracts changed.

Owned public listings are derived from the current saved catalog, while foreign public inventory is projected from the same graph. Archiving the canonical asset removes its public listing and cannot resurrect it through debug detail fallback. Conversations retain their existing IDs and local note storage, but use the canonical An Nhiên asset context so names and covers follow catalog edits. Public seed ordering is retained without reordering or rewriting the catalog.

### Capacity and preservation

- Fresh debug fixtures describe a pre-existing 2/2 portfolio: A02 plus vacant An Nhiên, one free slot plus a clearly named historical local entitlement valid until 2027-10-01. This seed fact is not a performed runtime purchase and creates no rental-finance record.
- Existing saved portfolios receive the missing An Nhiên as **DRAFT only**. Reconciliation grants no entitlement, uses no capacity, overwrites no asset or media, and does not reactivate an already archived asset. It is idempotent.
- On this emulator, the preserved 5/5 portfolio received that draft. The actual native wizard displayed the explicit **259.000đ / 1 năm** review, accepted a simulated capacity purchase, and activated/published An Nhiên. The current owner portfolio is now **6/6**, with all five earlier assets and their photographs/metadata unchanged and one additional actual local entitlement. This is the current demo count; earlier 5/5 notes are historical checkpoints.
- No new tenancy was created for An Nhiên. Advertised rental conditions remain separate from the existing A02 Tenancy Terms. PostgreSQL still has **8 provider-verified gateway Payments**, with zero automatic allocations, receipts or deposit applications. No gateway confirmation occurred in this graph stream.

### Verification and limitations

- Final exact five Android gates plus `assembleDebugAndroidTest` passed in **3m 13s**. **164 unit tests, zero failures/errors; lint 0 errors, 61 warnings, 2 hints**. Log: `runtime/fixture-graph-confirmation-gates.log`. Earlier gate logs are retained as separate checkpoints. `git diff --check` exit **0**, log `runtime/fixture-graph-diff-check.log`.
- Native regression: **OK (5 tests), 80.659 seconds**. Classes: FixturePortfolioFlowTest, SeededAccountFlowTest, MessagesFlowTest, and the two LocalManagementPersistenceTest methods. Log: `runtime/fixture-graph-regression.log`. It checks the canonical listing/catalog relationship, both account POVs, conversation persistence/account separation, catalog recreation, capacity idempotency and preservation of finance and existing assets. Persistence tests clear only their dedicated test preference namespaces, never the actual app catalog/database.
- Earlier native attempts are not counted as passes. The first exposed missing fixture max-occupant metadata; corrected to the two-person rule already declared. The second completed the explicit purchase/publication and preservation assertions, then failed on an offscreen Explore card. The test now waits and scrolls correctly; its successful retry did not purchase another slot.
- Source Standards and Spec reviews accepted the corrected stream after findings about identity checks in onboarding and foreign reserved IDs were fixed and re-reviewed. Review of the final occupant/date/order corrections found no material issue.
- Captured and inspected: `runtime/fixture-graph-capacity-review.png`, `runtime/fixture-graph-owner-final.png`, `runtime/fixture-graph-owner-capacity.png` (6/6), and `runtime/fixture-graph-detail-confirmed.png`. The earlier screenshot named `fixture-graph-detail.png` caught the outgoing Explore transition and is not the final detail visual evidence. Light mode is restored and the app is left open on Explore.
- The [fixture projection boundary map](fixture-projections-compact.html) passed all nine Archify delivery checks with zero errors/warnings and automated browser checks in light/dark desktop sizes. Its 1440×900 light capture was visually inspected. Final source: `fixture-projections.compact.json`; SHA256 `30e226ea3ca9f741a482d0e2c930cbe86fdb679f036ba24d46b3f8161ec96230`. The earlier larger artifact is retained as draft evidence of the corrected overflow. Browser receipt: `runtime/fixture-projections-compact-browser.json`.

Graph stream: **IMPLEMENTED = YES; TESTED = YES; SOURCE_REVIEWED = YES; PRODUCT_SPEC_ALIGNED = YES; RUNTIME_VISUAL_VERIFIED = YES (bounded native phone evidence above)**. The frozen presentation APK remains unchanged at its recorded hash; current debug APK contains this graph repair.

The original whole-goal **DEMO_READY remains NO** until the explicit requirement-by-requirement completion audit and full-app state/navigation/accessibility/large-text/overflow review are complete. Reassess unsupported contact/viewing actions against the exact original scope rather than inventing an API or success claim. Remaining work must include fresh final backend payment gates and accurate final handoff/status evidence. `/goal` remains active; no commit, push, merge, rebase, reset, stash or clean was performed.
