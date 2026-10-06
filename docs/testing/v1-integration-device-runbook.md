# V1 device and sandbox runbook

Package: `com.trooi.app.backenddev`. No production payments. Do not paste secrets, logcat, or provider payloads into this file.

| Scenario | Status |
| --- | --- |
| adb device, Android/GMS versions | Emulator `emulator-5554`, `sdk_gphone64_x86_64`, Android 14 / API 34, GMS `versionName=26.34.36`. Not a physical device. |
| connectedBackendDebugAndroidTest | PASS, 5/5, on 2026-10-06 after the Compose host activity was merged into the `backendDebug` app. |
| force-stop then `monkey -p com.trooi.app.backenddev 1` | The process relaunched. This is not a Google sign-in. |
| Maestro `tests/e2e/maestro/v1-integration-navigation.yaml` | UNVERIFIED. `maestro` is not installed. |
| Google sign-in, selected context, revoked credential, offline/cancel | UNVERIFIED. No interactive Google account was used. |
| Native map tiles, pan/zoom, permission denial | UNVERIFIED. `MAPS_API_KEY` is blank, so the instrumented test only checks the unconfigured state. |
| MoMo sandbox HMAC, return, replay, public IPN | UNVERIFIED. No sandbox payment and no public IPN URL. |
| Listing report and deposit application on device | UNVERIFIED. |

```powershell
adb devices -l
adb -s emulator-5554 shell getprop ro.build.version.release
.\gradlew.bat :app:connectedBackendDebugAndroidTest -PtrooiInstrumentationBuildType=backendDebug --no-daemon
adb -s emulator-5554 shell am force-stop com.trooi.app.backenddev
adb -s emulator-5554 shell monkey -p com.trooi.app.backenddev 1
```

A blank Maps key, a missing Google sign-in, or a missing public IPN URL still blocks READY.
