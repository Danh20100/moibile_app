# TrọƠi Android runtime modes — current architecture (2026-10-10)

## Build variants

Exactly two build types: `debug` and `release`. The former `backendDebug` build type was retired; its independent backend repository now routes through a debug-only runtime source chooser.

- `debug`: **Mock** or **Backend** source, persisted in app-private SharedPreferences. No DEV button, bubble, or test control is displayed in the app.
- `release`: **Backend only**. The release source set binds `BackendTroOiRepository` and an empty `ListingFixtures`; `DemoData`, mock payment client, and fixture repository exist only in `src/debug`.

## Debug usage — external HTML test console

1. Build and launch `app:debug` in Android Studio, with an Emulator connected via ADB.
2. Double-click `tools/ui-test-control/start-control.cmd` (requires Node.js), or run `node tools/ui-test-control/server.cjs`.
3. In the browser, open **http://127.0.0.1:4177**, choose a flow, enter synthetic test parameters, then click **Enter Screen**.
4. Choose **Mock Data** in the HTML console for fixture-based testing without backend, or **Real Backend** for actual API transport and Google Credential Manager integration.
5. Switching sources resets session, tokens, and UI state. Switching is refused if a pending checkout needs reconciliation.
6. Backend mode is **fail-closed**: missing credentials, wrong API URL, network failures or 401/403 responses never silently fall back to fixtures.

The HTML control server binds to loopback only, invokes ADB and is not part of the Android APK. The Debug-only parser and bridge execute screen commands without bypassing access permissions or auto-submitting forms/payment. The Release variant has a no-op parser and bridge. The setting survives app restarts but is ignored by Release; a freshly installed Debug app starts in Mock mode.

For web console features and safety details, see `tools/ui-test-control/README.md`.

## Machine-specific backend configuration

Use Gradle properties (`trooiApiBaseUrl`, `trooiGoogleWebClientId`, `trooiMapsApiKey`) or environment variables (`TROOI_API_BASE_URL`, `TROOI_GOOGLE_WEB_CLIENT_ID`, `TROOI_MAPS_API_KEY`). Never commit actual secrets, credentials, local `.env`, keystores, or real endpoint hosts.

Example build command (URL illustrative only):

```powershell
.\gradlew.bat :app:assembleDebug -PtrooiApiBaseUrl=https://backend.example.test/
```

Debug permits local HTTP only for explicit approved loopback/emulator hosts, enforced by `BackendEnvironment` and the debug network security config. Release requires HTTPS.

## Verification

```powershell
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin :app:assembleRelease
```

Compile and packaging success do **not** prove real Google OAuth, map key acceptance, payment-provider settlement, or application E2E tests. The release APK may require signing before installation/distribution.

## Historical notes

The September 2026 and early-October runbooks describe the former `backendDebug` variant. They are historical test evidence, not the current build contract. The former `androidTestBackendDebug` smoke tests were moved into `androidTestDebug`; they test common behaviors rather than requiring a third build type.
