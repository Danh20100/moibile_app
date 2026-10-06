# V1 device and sandbox runbook

Package: `com.trooi.app.backenddev`. API base for the emulator: `http://10.0.2.2:3000`. No production payments. Do not paste secrets, logcat, or provider payloads into this file.

Maps key and MoMo sandbox credentials stay in the local Gradle user properties and `.env`. They are not in git.

| Scenario | Status |
| --- | --- |
| adb device, Android/GMS versions | Emulator `emulator-5554`, `sdk_gphone64_x86_64`, Android 14 / API 34, GMS `versionName=26.34.36`. Not a physical device. |
| connectedBackendDebugAndroidTest | 4 passed, 1 skipped, 0 failed, on 2026-10-06 after the Maps key was compiled in. `missingMapsKeyRendersConfigState` skipped because the key is present. That skip is not tile proof. |
| force-stop then `monkey -p com.trooi.app.backenddev 1` | The process relaunched. One event injected. This is not a Google sign-in. |
| Maestro `tests/e2e/maestro/v1-integration-navigation.yaml` | PASS, exit 0. The title is one text node, `Tìm phòng` plus a newline, so the assertion is `(?s).*Tìm phòng.*`. Run Maestro with `-Dfile.encoding=UTF-8` on Windows. |
| Google sign-in, selected context, revoked credential, offline/cancel | UNVERIFIED. `GOOGLE_CLIENT_ID` and `GOOGLE_WEB_CLIENT_ID` are empty. A blank client id used to replace guest discovery with “Không khôi phục được phiên”; `1bc1683` treats that as no restore credential. Sign-in itself still fails closed. |
| Native map tiles and zoom | Tiles visible on the emulator map screen (country labels, Google logo). One “Zoom in” tap moved the camera from a world view to West Africa. Screenshot: `%TEMP%` copy of `C:\Users\ROG\.maestro\tests\2026-10-06_220507\trooi-map-zoom\takeScreenshot\trooi-map-zoomed.png`. |
| Pan, permission denial, marker to listing, private/public picker on device | UNVERIFIED. |
| MoMo sandbox HMAC | FAIL as an integration blocker. Direct create to `https://test-payment.momo.vn` returned HTTP 200, `resultCode` 0, message `Thành công.`, and no `signature` field. The client rejected it with `MomoVerificationError`. Do not accept that response. |
| MoMo return, replay, repeated IPN, dashboard transId | UNVERIFIED. No MoMo Test wallet payment and no OTP. |
| Public IPN URL | Configured as `https://instance-amendment-propose-indicates.trycloudflare.com/api/v1/finance/checkouts/momo/ipn`. Tunnel health was HTTP 200 during this run. The quick tunnel ends when that process stops. |
| Listing report and deposit application on device | UNVERIFIED. No signed-in user. |

```powershell
$env:JAVA_TOOL_OPTIONS = "-Dfile.encoding=UTF-8"
adb devices -l
adb -s emulator-5554 shell getprop ro.build.version.release
.\gradlew.bat :app:connectedBackendDebugAndroidTest -PtrooiInstrumentationBuildType=backendDebug --no-daemon
maestro test tests/e2e/maestro/v1-integration-navigation.yaml
adb -s emulator-5554 shell am force-stop com.trooi.app.backenddev
adb -s emulator-5554 shell monkey -p com.trooi.app.backenddev 1
```

`:app:testBackendDebugUnitTest` is not a task in this project. A blank Google client id, an unsigned MoMo create response, or an unfinished wallet payment still blocks READY.
