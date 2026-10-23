# Kịch bản test thủ công — chứng minh 112/112 PASS

Runbook để **bạn tự chạy** trên máy local. Không phải checklist CI (CI hiện không chạy `connectedDebugAndroidTest`).

| Mục | Giá trị |
| --- | --- |
| Repo | `D:\Semester 8\EXE2\backend\TroOi-Project` |
| Nhánh | `fix/android-instrumentation-stabilization-20261017` |
| HEAD tham chiếu | `445a5c6` (ghi lại SHA thực tế nếu đã commit thêm) |
| AVD | `Pixel_8`, API 34 (`google_apis_playstore`) |
| Task | `:app:connectedDebugAndroidTest` |
| Log ngoài `build/` | ví dụ `D:\Projects\.temp\TroOi-Android-UI-Fix-<ngày>\manual-full-N\` |

DemoPay chi tiết: [scripts/demo/README.md](../../scripts/demo/README.md).

---

## Định nghĩa PASS (chỉ claim khi đủ hết)

Một lần chạy được gọi **112/112 PASS** khi **đồng thời**:

- [ ] Log có `Starting 112 tests on Pixel_8…`
- [ ] XML: `tests="112"` `failures="0"` `errors="0"`
- [ ] `BUILD SUCCESSFUL`
- [ ] Không có `INSTRUMENTATION_ABORTED`, `device offline`, hay `Expected 112 tests, received N`

**Không đủ:** chỉ chạy isolated class/method xanh; progress Gradle hiện `114/112` với 2 skip — lấy **XML** làm chuẩn.

---

## 0. Chuẩn bị

```powershell
cd "D:\Semester 8\EXE2\backend\TroOi-Project"
git checkout fix/android-instrumentation-stabilization-20261017
git status -sb
git rev-parse HEAD
$env:GRADLE_USER_HOME = "$env:USERPROFILE\.gradle"
docker ps --format "table {{.Names}}\t{{.Status}}"
# Cần: trooi-project-backend-1, trooi-project-postgres-1 — healthy
```

```powershell
$runRoot = "D:\Projects\.temp\TroOi-Android-UI-Fix-$(Get-Date -Format yyyyMMdd)"
$runDir  = Join-Path $runRoot "manual-full-1"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
```

Ghi `meta.txt` trong `$runDir`: branch, HEAD SHA, ngày, AVD args (bước 2).

**Không:** sửa `.env`, reset/migration DB thật, SePay Production, `serve-mvp.cjs`.

---

## 1. DemoPay (bắt buộc cho RentPaymentFlowTest)

Chỉ dùng **`serve.cjs`**.

### Terminal A — giữ sống suốt suite

```powershell
cd "D:\Semester 8\EXE2\backend\TroOi-Project"
node node_modules/typescript/bin/tsc -p tsconfig.build.json
docker exec trooi-project-backend-1 mkdir -p /tmp/trooi-demo/scripts/demo
docker cp build trooi-project-backend-1:/tmp/trooi-demo/
docker cp scripts/demo/fixture.cjs trooi-project-backend-1:/tmp/trooi-demo/scripts/demo/fixture.cjs
docker cp scripts/demo/serve.cjs trooi-project-backend-1:/tmp/trooi-demo/scripts/demo/serve.cjs
docker exec -e NODE_PATH=/app/node_modules:/app/node_modules/.pnpm/node_modules -e NODE_ENV=development trooi-project-backend-1 node /tmp/trooi-demo/scripts/demo/serve.cjs
```

### Terminal B — relay, giữ sống

```powershell
cd "D:\Semester 8\EXE2\backend\TroOi-Project"
node scripts/demo/forward.cjs
```

### Xác minh (trước Gradle)

```powershell
node scripts/demo/verify.cjs
# Phải thấy dòng PASS: real PostgreSQL DemoPay…
```

- [ ] `verify.cjs` PASS  
- [ ] Không restart `serve.cjs` giữa suite (signing key đổi → pay URL cũ chết)

---

## 2. Cold boot AVD

Bằng chứng trước: `gpu=auto` + RAM 2048 dễ Watchdog / `INSTRUMENTATION_ABORTED`. Dùng:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$emu = "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"

& $adb emu kill 2>$null
Start-Sleep -Seconds 8

Start-Process -FilePath $emu -ArgumentList @(
  "-avd", "Pixel_8",
  "-no-snapshot-load", "-no-snapshot-save",
  "-wipe-data",
  "-memory", "4096",
  "-gpu", "swiftshader_indirect"
) -WindowStyle Minimized

do {
  Start-Sleep -Seconds 8
  $boot = (& $adb shell getprop sys.boot_completed 2>$null | Out-String).Trim()
  Write-Host "boot=$boot"
} while ($boot -ne "1")

Start-Sleep -Seconds 25   # settle sau wipe
```

Ghi meta: AvdId=`Pixel_8`, API=34, RAM process=4096, GPU=`swiftshader_indirect`, wipe=yes.

- [ ] `sys.boot_completed=1`

---

## 3. Ổn định thiết bị + reverse + Chrome

```powershell
& $adb shell "svc power stayon true"
& $adb shell "input keyevent KEYCODE_WAKEUP"
& $adb shell "wm dismiss-keyguard"
& $adb shell "settings put global window_animation_scale 0"
& $adb shell "settings put global transition_animation_scale 0"
& $adb shell "settings put global animator_duration_scale 0"
& $adb shell "settings put secure show_ime_with_hard_keyboard 1"

# Chỉ force-stop — tránh pm clear Chrome trước full suite
& $adb shell "am force-stop com.android.chrome"

& $adb reverse --remove-all 2>$null
& $adb reverse tcp:3001 tcp:3001
& $adb reverse --list
# Kỳ vọng: dòng host-… tcp:3001 tcp:3001
```

- [ ] `mWakefulness=Awake` (tuỳ chọn: `adb shell dumpsys power | findstr mWakefulness`)
- [ ] `adb reverse --list` có 3001
- [ ] Một emulator / một job Gradle (không song song)

---

## 4. Logcat + full suite

```powershell
cd "D:\Semester 8\EXE2\backend\TroOi-Project"
$env:GRADLE_USER_HOME = "$env:USERPROFILE\.gradle"

& $adb logcat -c
$logcat = Join-Path $runDir ("logcat-" + (Get-Date -Format "HHmmss") + ".txt")
Start-Process -FilePath $adb -ArgumentList @("logcat","-b","all","-v","threadtime") `
  -RedirectStandardOutput $logcat -WindowStyle Hidden

$out = Join-Path $runDir "gradle-full.txt"
$sw = [Diagnostics.Stopwatch]::StartNew()
cmd /c "set GRADLE_USER_HOME=%USERPROFILE%\.gradle&& gradlew.bat :app:connectedDebugAndroidTest > `"$out`" 2>&1"
$code = $LASTEXITCODE
$sw.Stop()
Write-Host "EXIT=$code ELAPSED_SEC=$([int]$sw.Elapsed.TotalSeconds)"
```

- Không filter class/method.
- Tham chiếu thời gian: ~15–25 phút sau khi APK sẵn sàng.

- [ ] Lệnh đã chạy full `:app:connectedDebugAndroidTest`

---

## 5. Sao chép bằng chứng

```powershell
Copy-Item -Recurse -Force "app\build\outputs\androidTest-results" (Join-Path $runDir "androidTest-results")
Copy-Item -Recurse -Force "app\build\reports\androidTests" (Join-Path $runDir "androidTests-reports")

# Nếu có fail — dump từ FailureEvidenceListener:
& $adb pull "/storage/emulated/0/Android/data/com.trooi.app.backenddev/files/TroOiFailureEvidence" `
  (Join-Path $runDir "device-failure-evidence") 2>$null
```

---

## 6. Checklist xác minh

XML (chuẩn):

`app\build\outputs\androidTest-results\connected\debug\TEST-Pixel_8(AVD) - 14-_app-.xml`

```powershell
$x = Get-ChildItem -Recurse (Join-Path $runDir "androidTest-results\connected\debug") -Filter "TEST-*.xml" |
  Select-Object -First 1
Select-String -LiteralPath $x.FullName -Pattern 'testsuites tests='
Select-String -Path (Join-Path $runDir "gradle-full.txt") -Pattern "BUILD SUCCESS|BUILD FAILED|Starting .* tests|INSTRUMENTATION_ABORTED"
```

| Hạng mục | Kết quả (điền) |
| --- | --- |
| Starting 112 tests | |
| XML tests / failures / errors | |
| BUILD SUCCESSFUL | |
| Abort / device offline | Không / Có |
| EXIT + thời gian + đường dẫn `$runDir` | |
| HEAD SHA | |

Fail hoặc abort → **không** claim 112/112. Mở HTML report + `TroOiFailureEvidence` + logcat quanh fail.

---

## 7. Lặp cold boot (gate chắc)

| Lượt | Thư mục | PASS? | Ghi chú fail |
| --- | --- | --- | --- |
| 1 | `manual-full-1` | | |
| 2 | cold boot lại → `manual-full-2` | | |
| 3 | cold boot lại → `manual-full-3` | | |

Cùng test fail lặp lại ≈ lỗi thứ tự/state; đổi chỗ ≈ môi trường.

**Claim READY / 112/112 ổn định:** tốt nhất 3/3 đạt bước 6; tối thiểu 1 lượt đủ checklist nếu chỉ cần bằng chứng một lần.

---

## Không làm trong kịch bản này

- Merge `main` / sửa production chỉ để test xanh  
- Tăng timeout vô hạn, bỏ screenshot, nới assertion  
- `pm clear` Chrome trước full suite  
- Song song instrumentation khác trên cùng AVD  
- Fake DemoPay / deep link, SePay Production, reset dữ liệu thật  

---

## Tham chiếu nhanh lệnh một dòng (sau khi đã boot + DemoPay)

```powershell
cd "D:\Semester 8\EXE2\backend\TroOi-Project"
$env:GRADLE_USER_HOME = "$env:USERPROFILE\.gradle"
.\gradlew.bat :app:connectedDebugAndroidTest
```
