# TrọƠi · HTML UI Test Control (local, Debug only)

A desktop browser control desk for driving the **actual Android Compose app** on the Android Studio Emulator.

**This is not a second TrọƠi product**, production admin console, or backend API interface. No button, bubble or overlay is added to the Android UI.

## Start

1. Open `design-app-ui-redesign` in Android Studio and select **Debug**.
2. Start your Emulator and click Run to install the latest Debug APK.
3. Double-click **`start-control.cmd`** in this directory.
4. The browser opens **http://127.0.0.1:4177**. Choose a flow and click **Enter Screen**.

Alternative: `node tools/ui-test-control/server.cjs` from the repository root.

The server uses Windows Android SDK at `%LOCALAPPDATA%\Android\Sdk`. For a custom SDK installation set `ANDROID_HOME` before starting it. Node.js is required; no npm install or database is required.

## What works

- Navigate to existing Android screens by their **real ViewModel routes** (Welcome, Login, Register, Forgot Password, Discovery, Map, Ledger, Tenant and Owner flows).
- **ACTIVE AVD** is selected at the top of the **left sidebar**, without a permanently displayed device column.
- Login, Register, Password Recovery and Listing Detail fields are **pre-filled with synthetic test data** when you select their flow.
- On Login, choose a known **Tenant / Owner / Onboarding** Mock persona; the defaults match `DemoData.authenticate()` in the debug source set. Click **Reset demo values** to restore the selected preset.
- The Register defaults fill a synthetic Vietnamese name, a test phone and email, plus a demo password. Test data is not automatically submitted.
- Listing Detail defaults to the mock listing `demo-studio`; use a different real listing ID for Backend mode.
- Switch the **Debug** repository mode between Mock and Backend, subject to the app's pending-checkout safeguards.
- Optional **Screen Preview** in the top bar opens a dismissible popup with an ADB screenshot and optional 4-second auto-refresh. There is no persistent right-side device pane.
- Run with no in-app DEV controls. Screen navigation uses the same session/capability guards as ordinary user navigation.

**Not implemented or deliberately restricted:** no automatic login, no actual account registration, no API fixture seeding, no automatic payment confirmation, no permission bypass, no deep data/tenant setup for every form, and no live screen casting (the browser shows periodic screenshots only).

## Safety

- The HTTP server only binds `127.0.0.1`. It does not serve to LAN/WAN.
- Android receives local ADB commands through a **debug-only test intent parser**. The Release source set contains a no-op parser/bridge.
- There is no exported Android service, system overlay, privileged permission, or webview inside the app.
- Input values are not persisted by the HTML control server. However, text passed via ADB command arguments can be visible to other processes while the command runs. **Use synthetic credentials only.**
- Requests return *command delivered*, never claim that protected navigation, authorization, or payment succeeded. Verify in screenshot or the Android Studio Emulator.
- Backend mode is real. It never silently falls back to Mock if API/auth is unavailable.
- Stop the server by closing its Node process (or restarting the computer). Port can be changed using `TROOI_TEST_PORT`; `start-control.cmd` assumes default 4177.

## Test command bridge

The local server calls Android Studio's ADB executable without invoking a shell:

`adb -s emulator-5554 shell am start -n com.trooi.app/.MainActivity -a com.trooi.app.action.DEBUG_TEST_CONTROL --es trooi_test_route login --es trooi_test_identifier_b64 ZGVtb0B0cm9vaS50ZXN0`

Field values use URL-safe Base64 UTF-8 to preserve Vietnamese characters, spaces and punctuation across the ADB device shell.

The Debug-only parser in `src/debug/java/com/trooi/app/ui/DebugTestIntent.kt` parses the intent. `DebugTestBridge` calls the real ViewModel; Login/Register/Forgot forms only take initial values, never auto-submit.

The controls are deliberately isolated from `release`. Re-run Debug when code changes; the HTML launcher does not build or install APKs for you.
