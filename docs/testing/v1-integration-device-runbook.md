# V1 device and sandbox runbook

Package: `com.trooi.app.backenddev`. No production payments. Do not paste secrets, logcat, or provider payloads into this file.

| Scenario | Status |
| --- | --- |
| adb device, Android/GMS versions | UNVERIFIED. SDK platform-tools `adb devices -l` on 2026-10-06 started the daemon and listed no devices, including a recheck the same day. `adb` is not on PATH. |
| installBackendDebug with local backend URL, Google client ID, Maps key | UNVERIFIED |
| connectedBackendDebugAndroidTest | UNVERIFIED |
| Maestro `tests/e2e/maestro/v1-integration-navigation.yaml` | UNVERIFIED if Maestro is not installed |
| Google sign-in, context, force-stop, relaunch | UNVERIFIED |
| Native map tiles, picker, permission denial | UNVERIFIED |
| MoMo sandbox HMAC, return before/after IPN, replay | UNVERIFIED |
| Listing report and deposit application on device | UNVERIFIED |

Commands, when a device and local env are present:

```powershell
adb devices -l
adb -s <serial> shell getprop ro.build.version.release
adb -s <serial> shell dumpsys package com.google.android.gms | Select-String versionName
.\gradlew.bat :app:installBackendDebug --no-daemon
.\gradlew.bat :app:connectedBackendDebugAndroidTest -PtrooiInstrumentationBuildType=backendDebug --no-daemon
maestro test tests/e2e/maestro/v1-integration-navigation.yaml
adb -s <serial> shell am force-stop com.trooi.app.backenddev
adb -s <serial> shell monkey -p com.trooi.app.backenddev 1
```

None of the device, Google, map, or MoMo sandbox commands above were executed. There is no serial to pass to `adb -s`.

Missing device, Maps key, Google credential, or a public IPN URL blocks READY. It does not block the other implementation tasks.
