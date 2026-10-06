# V1 device and sandbox runbook

Package: `com.trooi.app.backenddev`. No production payments. Do not paste secrets, logcat, or provider payloads into this file.

| Scenario | Status |
| --- | --- |
| adb device, Android/GMS versions | UNVERIFIED. SDK platform-tools `adb devices -l` on 2026-10-06 started the daemon and listed no devices. `adb` is not on PATH. |
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
.\gradlew.bat :app:installBackendDebug --no-daemon
.\gradlew.bat :app:connectedBackendDebugAndroidTest -PtrooiInstrumentationBuildType=backendDebug --no-daemon
maestro test tests/e2e/maestro/v1-integration-navigation.yaml
```

Missing device, Maps key, Google credential, or a public IPN URL blocks READY. It does not block the other implementation tasks.
