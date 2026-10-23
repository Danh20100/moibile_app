# TRỌƠI — Android Instrumentation Stabilization Handoff

**Người nhận:** Duy Anh
**Ngày bàn giao:** 17/10/2026
**Trạng thái:** WIP / **CHƯA ĐỦ ĐIỀU KIỆN MERGE**
**Phạm vi:** ổn định instrumentation/UI end-to-end của Android; không triển khai tính năng mới
**Mục tiêu tiếp theo:** xử lý onboarding Photo Picker và DemoPay infrastructure, xác minh emulator, chạy full regression, review rồi merge qua PR.

> **Kết luận ngắn:** Nhánh sửa test đã được commit và push lên GitHub. Có 10/10 test targeted E2E/scroll PASS trong các lượt chạy được ghi nhận và 32/32 Account/Profile PASS theo log tập trung trước đó. **Landlord Onboarding vẫn FAIL**, **Rent Payment chưa chạy được vì backend DemoPay không kết nối**, đã có **Android system_server Watchdog crash** ở một lượt trước, và **full 112 instrumentation tests chưa được nghiệm thu**. Không được coi toàn bộ Android đã PASS chỉ vì các nhóm riêng lẻ xanh.

## 1. Repository, branch và trạng thái Git

| Thuộc tính | Giá trị |
|---|---|
| Repository | `https://github.com/onsra520/TroOi-Project` |
| Local worktree | `D:\Projects\.worktrees\TroOi-Project\android-ui-instrumentation-stabilization-20261017` |
| Working branch | `fix/android-instrumentation-stabilization-20261017` |
| Remote tracking | `origin/fix/android-instrumentation-stabilization-20261017` |
| Commit đã push | `aa75c95efacfd1cf22a74a90369c7721aa599b94` |
| Commit title | `test(android): stabilize instrumentation against current UI` |
| Baseline trước commit | `9c00241` (`merge: integrate free MapLibre fallback and Android regression tests`) |
| Push | **PASS** — remote branch trỏ đúng commit `aa75c95` |
| Local working tree sau push | **Clean**, ở lần kiểm tra sau commit/push |
| PR / merge | **Chưa tạo PR, chưa merge `main`** |

**GitHub branch:** https://github.com/onsra520/TroOi-Project/tree/fix/android-instrumentation-stabilization-20261017
**Tạo PR:** https://github.com/onsra520/TroOi-Project/pull/new/fix/android-instrumentation-stabilization-20261017

**Lưu ý:** `D:\Projects\TroOi-Project` (worktree/root khác) có thay đổi `.env.example` từ trước; **không tự ý stage, reset, overwrite hoặc nhập thay đổi đó**. Commit trên chỉ chứa 9 file Android test.

### 9 file đã sửa và push

- `tests/android/instrumentation/java/com/trooi/app/features/AssetPublicationFlowTest.kt`
- `tests/android/instrumentation/java/com/trooi/app/features/FixturePortfolioFlowTest.kt`
- `tests/android/instrumentation/java/com/trooi/app/features/LandlordOnboardingFlowTest.kt`
- `tests/android/instrumentation/java/com/trooi/app/features/MessagesFlowTest.kt`
- `tests/android/instrumentation/java/com/trooi/app/features/RedesignUiTest.kt`
- `tests/android/instrumentation/java/com/trooi/app/features/RentPaymentFlowTest.kt`
- `tests/android/instrumentation/java/com/trooi/app/features/SeededAccountFlowTest.kt`
- `tests/android/instrumentationDebug/java/com/trooi/app/features/AccountReworkTest.kt`
- `tests/android/instrumentationDebug/java/com/trooi/app/features/AccountSecurityUiTest.kt`

Các sửa đổi tập trung vào dialog xác nhận logout, selector Discovery hiện hành (`discovery-*` thay `explore-card-*`), điều hướng conversation, keyboard mode, điều kiện validate wizard, cập nhật contract onboarding và đồng bộ native Photo Picker. **Không có thay đổi production code trong commit này.** `git diff --check` PASS, `:app:compileDebugAndroidTestKotlin` BUILD SUCCESSFUL.

## 2. Bằng chứng kiểm thử đã có

**Thiết bị:** AVD `Medium_Phone_API_37.0`, Android API 37, `emulator-5554` tại thời điểm chạy. Cấu hình AVD: `C:\Users\TranTien\.android\avd\Medium_Phone.avd\config.ini`. Chỉ tìm thấy system image Android 37.0 (Google Play x86_64) trên máy lúc kiểm tra; chưa thử API khác.

| Nhóm / test | Kết quả xác minh | Log |
|---|---|---|
| Account/Profile focused | **32/32 PASS** theo log bàn giao trước đó; chưa rerun nhóm này sau commit | `account-focused-r4.log` |
| `MessagesFlowTest.localConversationFlowPersistsAndSeparatesAccounts` | **1/1 PASS**, 2m10s | `messages-isolated-20261017.log` |
| `AssetPublicationFlowTest.ownerDraftPhotosPurchasePublishRestartAndArchiveUseOneCatalog` | **1/1 PASS**, 2m38s sau sửa Photo Picker race | `asset-isolated-r2-20261017.log` |
| `FixturePortfolioFlowTest` + `SeededAccountFlowTest` | **2/2 PASS**, 1m51s | `fixture-seeded-focused-20261017.log` |
| `ScrollSmokeTest` (6 tests) | **6/6 PASS**, 1m26s | `scroll-focused-20261017.log` |
| `LandlordOnboardingFlowTest` | **FAIL**, nhiều lần isolated; chưa pass | `onboarding-isolated-20261017.log`, `onboarding-isolated-r2-20261017.log`, `onboarding-isolated-r3-20261017.log` |
| `RentPaymentFlowTest` | **BLOCKED/FAIL prerequisite**, không kết nối DemoPay | `payment-focused-20261017.log` |
| Full instrumentation (baseline khoảng 112 test) | **CHƯA CHẠY LẠI ĐẦY ĐỦ/CHƯA NGHIỆM THU** | Baseline cũ `e2e-r3.log`, không phải bằng chứng final |

**Thư mục log:** `D:\Projects\.temp\TroOi-Android-UI-Fix-20261017\`.

**Cách đọc:** 10 test PASS là `1 Messages + 1 Asset + 2 Fixture/Seeded + 6 Scroll`; **không cộng 32/32 thành kết quả full suite**, vì là lượt kiểm thử khác và chưa chạy lại sau commit. Những report Gradle ở `app/build/reports/androidTests/connected/debug/` có thể bị ghi đè giữa các lượt; log theo tên bên trên mới là nhật ký dễ đối chiếu.

## 3. Blocker A — Landlord Onboarding / native Photo Picker

**Ưu tiên:** P0 đối với acceptance nhánh Android.
**Trạng thái:** OPEN; không có bằng chứng toàn flow PASS.

### Contract UI đã xác nhận từ source

File production: `app/src/main/java/com/trooi/app/features/profile/LandlordOnboardingScreen.kt`.

1. Bước giới thiệu (`step=0`).
2. Chọn **hai ảnh CCCD** (`onboarding-id-front`, `onboarding-id-back`) ở `step=1`.
3. Kiểm tra/chỉnh họ tên và ngày sinh, tick `onboarding-identity-accept` ở `step=2`.
4. Điền điện thoại/email, tick xác nhận liên hệ và `onboarding-acknowledgement` ở `step=3`.
5. Submit để cấp quyền operator; `step=4` hiển thị `Hồ sơ chủ trọ đã sẵn sàng.`. **Tạo tài sản đầu tiên diễn ra trong Operator Workspace, không nằm trong onboarding.**

Test cũ giả định nhập thông tin trước CCCD, có `selfie`, tạo `Căn hộ L01` ngay trong onboarding và đợi nhãn `Thay ảnh` — tất cả đều không khớp UI hiện tại. Commit `aa75c95` đã cập nhật lại trình tự và assertions: quyền operator được cấp khi submit; không tự phát sinh tài sản, listing, tenancy hay tài chính; khả năng phục hồi quyền sau restart/login; không thay đổi catalog của owner fixture.

### Lỗi thực tế theo từng lần isolated

| Lượt | Điểm FAIL | Diễn giải |
|---|---|---|
| `onboarding-isolated-20261017.log` | `No compose hierarchies found in the app` ở `pickSingle` | Test gọi Compose semantics lúc native picker còn điều khiển window |
| `onboarding-isolated-r2-20261017.log` | `ComposeTimeoutException` sau 15s ở `pickSingle` | Đã xử lý root rỗng và nhãn `Đổi ảnh`, nhưng callback/picker chưa xác nhận thành công |
| `onboarding-isolated-r3-20261017.log` | `Native photo picker did not show media` (khoảng `pickSingle` line 88 ở lượt đó) | Không tìm thấy thumbnail theo accessibility matcher hiện có |

`pickSingle()` hiện dùng native accessibility (`icon_thumbnail` hoặc content description bắt đầu `Photo taken`) để chọn ảnh; có xử lý xác nhận `Done` tùy trạng thái native picker và chờ Compose hiển thị `Đổi ảnh`. Những matcher này **chưa đủ bền trên API 37**. Có bổ sung thông tin `activeWindow`/nodes vào exception nhằm hỗ trợ diagnostic, **chưa được chạy lại sau sửa bổ sung diagnostic đó**.

### Nhiệm vụ cho Duy Anh

1. Reproduce test isolated trên một AVD sạch; thu thập **package/window hiện tại**, accessible nodes/IDs/text/descriptions, screenshots và logcat xung quanh `PickVisualMedia`.
2. Kiểm tra ảnh specimen có thật sự được chèn vào MediaStore và hiện trong native picker; lọc đúng ảnh test, không chọn thumbnail theo vị trí ngẫu nhiên nếu picker đang lẫn media của các lượt trước.
3. Xác định picker phiên bản này trả kết quả ngay khi chọn hay cần `Done`; đợi **callback/điều kiện quan sát được**, không dùng sleep dài để che race.
4. Kiểm chứng `identityPhoto()` trả Bitmap và UI đã chuyển từ `Chọn ảnh` sang `Đổi ảnh` **cho cả front/back** trước khi chuyển bước.
5. Hoàn tất test để verify quyền operator, isolation fixture, dữ liệu cá nhân không bị lưu trong fixture theo assertion và restore sau app recreation/login.
6. Chạy ít nhất một lượt isolated PASS, sau đó đưa test vào full regression.

**Không được làm:** tắt validation CCCD, giả callback picker, bỏ các assertions isolation, hoặc tuyên bố PASS khi chỉ mới đi qua dialog.

## 4. Blocker B — Rent Payment / DemoPay local infrastructure

**Ưu tiên:** P0 đối với acceptance thanh toán.
**Trạng thái:** OPEN — test chưa đến được assertions ledger do dịch vụ không kết nối.

**Test:** `RentPaymentFlowTest.confirmationRequiresBackendThenRetiresOnlyVerifiedIntent`.

**Lỗi:** `IllegalStateException: Chưa kết nối được dịch vụ thanh toán. Vui lòng thử lại.`
**Điểm lỗi:** `DemoPaymentClient` trước khi hoàn thành browser payment flow. Đây là thiếu prerequisite; **không chứng minh backend payment domain sai**, cũng **chưa chứng minh domain đúng**.

### Những gì đã xác minh

- `app/src/debug/java/com/trooi/app/core/demo/DemoPaymentClient.kt` dùng mặc định `http://localhost:3001/api/v1`.
- `scripts/demo/README.md` ghi cách chạy **DemoPay local PostgreSQL runner** (bộ test giao dịch mô phỏng; không chuyển tiền thật).
- Chưa có process lắng nghe cổng `3001` trong lần kiểm tra.
- `adb reverse --list` rỗng; chưa có reverse `tcp:3001`.
- Docker CLI có trên máy nhưng Docker Engine báo không kết nối được qua `dockerDesktopLinuxEngine`; không có bằng chứng container backend/PostgreSQL đã sẵn sàng.
- Đường dẫn CLI được thấy: `C:\Users\TranTien\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`. **Chưa xác minh vị trí executable GUI Docker Desktop**, nên không hardcode đường dẫn launcher.

### Luồng phục hồi khuyến nghị

1. **Đọc `scripts/demo/README.md` từ branch hiện tại trước khi làm.** Xác minh loại runner đang cần (`scripts/demo/serve.cjs` cho DemoPay isolated; không nhầm với `serve-mvp.cjs` có guard riêng), vị trí backend/container và cấu hình database.
2. Khởi động Docker Engine bằng installation thực tế, `docker info`, `docker ps`; xác minh backend/PostgreSQL đang dùng **database development/test cô lập** và không trỏ tới Production. Không in hoặc copy secrets vào log/handoff.
3. Kiểm tra migrations và fixture chỉ theo README **sau khi xác minh đúng database**. **Không tự chạy reset/down/migration đụng dữ liệu thật**, không cấp thêm quyền môi trường để né guard.
4. Start local DemoPay runner; xác nhận HTTP service ở `127.0.0.1:3001` và probe an toàn các route/health được tài liệu cho phép. Browser pay URL phải cùng local origin.
5. Chạy `adb -s emulator-5554 reverse tcp:3001 tcp:3001` rồi `adb -s emulator-5554 reverse --list`.
6. Chạy `node scripts/demo/verify.cjs` **chỉ trên isolated test DB**; tài liệu ghi verifier tạo simulated payment mới nên không chạy tùy tiện trên dữ liệu cần bảo toàn.
7. Chạy isolated `RentPaymentFlowTest`: kiểm tra checkout CREATED -> browser explicit signed confirmation -> backend verified SUCCEEDED -> Payment đúng số tiền -> chống duplicate/forged deep link -> không tự allocate deposit/receipt -> trạng thái pending được xử lý đúng.
8. Ghi nhận kết quả HTTP/backend, ADB và instrumentation vào log mới.

**Boundary bắt buộc:** Không dùng SePay Production để “cho test xanh”, không sửa backend authorization/verification guard, không tự tạo settlement hoặc mock `SUCCEEDED` chỉ theo deep link.

## 5. Vấn đề môi trường — Android API 37 Watchdog

**Ưu tiên:** P1 (hoặc nâng P0 nếu tái xuất hiện trong full regression).

Ở một lượt chạy E2E cũ, logcat ghi nhận:

```text
Watchdog: *** WATCHDOG KILLING SYSTEM PROCESS:
Blocked in monitor com.android.server.wm.WindowManagerService ... for 63s
android.anim: ScreenCaptureInternal.nativeCaptureLayers
... AbsAppSnapshotController.createSnapshot
AndroidRuntime: Process: com.android.systemui
DeadSystemException: The system died
```

Đây là **system_server/WindowManager bị Watchdog kill**, không phải bằng chứng trực tiếp TrọƠi app crash. Nhiều test có `uiAutomation.takeScreenshot()` và chuyển native window nên screenshot/snapshot/GPU là hướng điều tra hợp lý, **chưa được kết luận root cause**. Các lượt E2E isolated về sau có PASS, vì vậy lỗi có tính tái hiện không ổn định.

**Cần làm:** kiểm tra logcat `system_server`, WindowManager, SurfaceFlinger, EGL/GPU/screenshot; thử AVD API ổn định khác nếu được phép cài system image; tránh test song song chung emulator; ghi lại cấu hình AVD và mức ổn định. Không che lỗi bằng tăng timeout vô hạn hoặc bỏ mọi screenshot mà không bảo toàn mục đích kiểm thử.

## 6. Acceptance gate trước khi merge

Merge **chỉ khi** các điều kiện dưới đây được xác minh từ HEAD cuối cùng:

- [ ] `LandlordOnboardingFlowTest` isolated PASS, đủ assertions trên contract hiện tại.
- [ ] DemoPay isolated HTTP/backend verification PASS; `RentPaymentFlowTest` isolated PASS.
- [ ] Emulator/test infrastructure đủ ổn định; watchdog root cause được xử lý hoặc có môi trường thay thế đã phê duyệt cùng giới hạn ghi rõ.
- [ ] Rerun **toàn bộ** `:app:connectedDebugAndroidTest` trên HEAD cuối (số lượng dự kiến từ baseline là 112; xác minh lại discovery count thực tế), 0 unexplained failures/skips.
- [ ] Các unit/core/backend test liên quan đến code bị tác động và required CI đều PASS.
- [ ] `git diff --check` PASS; không credential, không dữ liệu private, không ngoài phạm vi, không production/security downgrade.
- [ ] Independent review không có Critical/High findings; PR mô tả giới hạn còn lại và bằng chứng có thể audit.
- [ ] Đồng bộ với `origin/main` mới nhất (merge/rebase tùy policy), rerun gate cần thiết sau khi đồng bộ.
- [ ] **Chỉ sau đó** merge PR vào `main`, kiểm tra trạng thái CI/remote sau merge rồi mới dọn worktree.

Nếu full suite còn FAIL, ghi nhận phân loại `production defect` / `test defect` / `infrastructure defect` dựa trên log, không sửa assertion để né fail.

## 7. Lệnh tiếp quản (PowerShell trên máy của dự án)

```powershell
$w = 'D:\Projects\.worktrees\TroOi-Project\android-ui-instrumentation-stabilization-20261017'
Set-Location $w

git status -sb
git log -1 --oneline
git remote -v
git fetch origin

git diff --check

# Kiểm tra Android emulator
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb reverse --list

# Dùng Gradle cache của lượt kiểm thử trước
$env:GRADLE_USER_HOME = 'D:\Projects\.temp\TroOi-Gradle-MapLibre'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

# Compile test trước khi instrumentation
.\gradlew.bat :app:compileDebugAndroidTestKotlin --no-daemon --console=plain

# Onboarding isolated
.\gradlew.bat :app:connectedDebugAndroidTest `
  '-Pandroid.testInstrumentationRunnerArguments.class=com.trooi.app.features.LandlordOnboardingFlowTest' `
  --no-daemon --console=plain

# Payment isolated (CHỈ SAU KHI DemoPay test backend được kết nối)
.\gradlew.bat :app:connectedDebugAndroidTest `
  '-Pandroid.testInstrumentationRunnerArguments.class=com.trooi.app.features.RentPaymentFlowTest' `
  --no-daemon --console=plain

# Full regression SAU KHI blockers PASS
.\gradlew.bat :app:connectedDebugAndroidTest --no-daemon --console=plain
```

**Cảnh báo:** Không chạy nhiều instrumentation Gradle jobs trên cùng một emulator đồng thời. `connectedDebugAndroidTest` có thể cài lại app, thay fixture session và thay nội dung HTML report ở thư mục build.

## 8. Phương thức báo cáo tiến độ cho người bàn giao

Mỗi lần làm xong một blocker cần gửi:

1. **Exact branch, HEAD SHA, worktree status**.
2. Lỗi trước và sau: **test name, stack trace/line, nguyên nhân dựa trên chứng cứ**.
3. **Diff scope**: test-only hay có production code, lý do bắt buộc.
4. **Lệnh chạy thực tế, số PASS/FAIL/SKIP, thời gian, log/report path**, phân biệt isolated với full suite.
5. Tác động backend/db: tên môi trường được kiểm tra, những thao tác migration/seed/settlement đã thực hiện (không lộ secrets).
6. Remaining blockers, acceptance gate và đề xuất `READY_FOR_PR_REVIEW` / `NOT_READY`.

### Điều tuyệt đối không làm

- Không tự merge `main` trước khi có đủ gate và review.
- Không đụng `.env.example` hoặc các thay đổi chưa commit thuộc worktree khác.
- Không thay thế payment verification bằng fake UI/deep link.
- Không bypass validation onboarding, security hoặc dữ liệu cách ly tài khoản chỉ để test PASS.
- Không kết luận nguyên nhân Watchdog do TrọƠi/MapLibre khi chưa có bằng chứng.
- Không ghi nhận 112/112 PASS khi chưa chạy full suite trên HEAD cuối.

## 9. Next action tối ưu

**Đường găng:** (1) khôi phục DemoPay **test-only** và chốt RentPayment E2E → (2) điều tra native Photo Picker và chốt onboarding → (3) ổn định môi trường, chạy full instrumentation/CI → (4) review PR → (5) merge nếu toàn bộ gate PASS. Có thể đảo (1)/(2) nếu người thực hiện có môi trường Android tốt hơn, nhưng không được dùng blocker này để bỏ qua blocker kia.

**Tình trạng bàn giao:** Commit `aa75c95` đã được push, chưa merge. Duy Anh có thể checkout ngay branch trên và tiếp tục từ đúng trạng thái hiện có.
