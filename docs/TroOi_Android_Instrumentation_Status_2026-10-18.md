# Trạng thái ổn định Android instrumentation — 18/10/2026

Nhánh: `fix/android-instrumentation-stabilization-20261017`
HEAD trước các thay đổi này: `aa75c95`
Worktree: `D:\Semester 8\EXE2\backend\TroOi-Project`
Kết luận gate: **NOT_READY**

Phạm vi là ổn định instrumentation/UI E2E. Không thêm tính năng sản phẩm, không hạ kiểm soát bảo mật, không dùng SePay Production, không đụng `trooi_finance`.

## Đã làm được

- `LandlordOnboardingFlowTest` isolated **PASS** trên Pixel 8 API 34. Test ghim nguồn MOCK trước khi mở activity, chọn đúng ảnh specimen trong Photo Picker, chờ OCR xong rồi mới bấm tiếp, và sau khi hoàn tất hồ sơ vào không gian quản lý của organization vừa được cấp.
- `RentPaymentFlowTest` isolated **PASS** hai lần liên tiếp (1 phút 22 giây và 1 phút 26 giây). Đường đi là checkout CREATED, xác nhận có chữ ký trên DemoPay, deep link `trooi://payment/demo` đưa app trở lại, payment SUCCEEDED đúng 1.000đ, deep link giả không settle thêm, không tự phân bổ deposit/receipt, và checkout thứ hai còn CREATED.
- DemoPay isolated trên Postgres compose: host `postgres`, database `/trooi_dev`, `SEPAY_ENABLED=false`. `scripts/demo/verify.cjs` luôn kiểm tra lại URL sẽ mở, kể cả khi `DATABASE_URL` đã có sẵn, và thoát trước khi query nếu host không phải `postgres` hoặc database không phải `/trooi_dev`.
- Sổ fixture nhận đúng một payment DemoPay đã settle khi xác nhận. Deposit và receipt không bị đổi theo payment đó.
- Nút «Về Sổ» được gọi bằng semantics action vì nút nằm dưới fold; click theo tọa độ không tới callback.
- Gợi ý phiên thanh toán được `commit()` để lần đọc ngay sau đó thấy checkout đã rút khỏi danh sách chờ.
- Onboarding local ở chế độ demo preview không còn bị chặn bởi stub reauthentication. Đường backend vẫn fail-closed trên stub đó. Demo checkout cũng không gọi stub này trước khi tạo checkout thật.
- Sau khi hoàn tất hồ sơ chủ trọ, app chọn organization được cấp và mở trang tài sản của khu trọ đó.
- `:app:testDebugUnitTest` **PASS** (48 giây). `git diff --check` **PASS** trước các sửa tiếp theo.
- Full suite đầu: 112 chạy, 94 PASS, 18 FAIL.

## Sửa 18 lỗi sau suite 94/112

- Debug luôn nạp `fixtures/v1/` từ asset trong `Application.onCreate`, kể cả khi repository vẫn backend-backed. Routing MOCK/BACKEND không đổi. Bản release vẫn no-op.
- `AssetPublicationFlowTest` và `FixturePortfolioFlowTest` ghim MOCK trước activity. Photo picker chọn ảnh bằng tap thật, rồi chờ nút thêm.
- Screenshot null được thử lại tối đa 3 lần trong helper của rent, asset, portfolio và seeded account.
- `NativeRemainingStatesTest` đưa activity về `RESUMED` trước khi `ActivityScenario` đóng.
- Test bàn phím thanh toán bật `show_ime_with_hard_keyboard` và đọc inset IME từ cửa sổ.
- Portal người thuê không cần sửa assertion: nhãn vẫn đúng và class này PASS trong suite đầy đủ.
- Lần mở thanh toán thứ hai dùng semantics click rồi chờ `rent-payment-open`. Màn hình chào Chrome được tap trên node đã tìm thấy, không tìm lại rồi fail nếu node biến mất.

## Suite đầy đủ sau sửa

Pixel 8 API 34, userdata đã wipe, một job `:app:connectedDebugAndroidTest`.

**112 chạy, 106 PASS, 6 FAIL, 0 skip, 33 phút 1 giây.** Không phải 112/112.

Hai lượt trước đó không tính: system UI chết (`FinalizerWatchdogDaemon` trên `HardwareRenderer`) rồi `DeadSystemException` / hộp thoại `Process system isn't responding`. Không phải Watchdog API 37. Máy này chỉ có API 34.

Sáu fail của lượt 112:

- `AccountSecurityUiTest.loginEmailActionIsNextKeyboardFocusAfterBackButton` — ô email không nhận focus.
- `AccountSecurityUiTest.backendLoginEmailGateCanBeActivatedByKeyboard` — không thấy `Chưa thể thực hiện`.
- `NativeRemainingStatesTest.reportErrorRetainsCappedNoteReasonAndBusyBlocksSubmission` — hàng lý do không `isChecked`. Lần chạy riêng sau đó method này PASS; các method khác của class fail vì `takeScreenshot()` null.
- `PaymentIntegrationUiTest.paymentPanelKeepsConfirmationAndWriteGuardsWhileActionsRemainReachable` — activity kẹt `PAUSED` khi đóng.
- `RentPaymentFlowTest.confirmationRequiresBackendThenRetiresOnlyVerifiedIntent` — Chrome sau wipe hiện `Use without an account` và tap chào không ổn định. Isolated trước wipe đã PASS. Lần riêng sau suite đi qua xác nhận rồi timeout ở `rent-payment-refresh`.
- `SeededAccountFlowTest.separateAccountsOpenCorrectLedgerAndPublicPhotosWithoutPovSwitch` — `takeScreenshot()` null. Helper đã được thử lại 3 lần sau suite; chưa có suite đầy đủ mới.

16/18 tên fail cũ PASS trong lượt 112. Hai tên còn lại là report `isChecked` và rent Chrome. Bốn test account security cũ và portal PASS.

## Sửa 6 fail của lượt 106/112

Năm class đích chạy cùng nhau sau khi emulator được bật lại, không wipe: **20/20 PASS, 4 phút 54 giây**.

- Hai test bàn phím email gọi `setInTouchMode(false)` trước TAB/ENTER, chờ focus hoặc dialog, rồi trả touch mode. Nút `Thay đổi email` với `demoPreview = false` vẫn chỉ mở biên `Chưa thể thực hiện`.
- Hàng lý do báo cáo được chờ tối đa 2 giây tới khi `isChecked`. Ảnh `takeScreenshot()` null được thử lại khoảng 2 giây, rồi đọc framebuffer bằng `screencap` nếu API vẫn trả null.
- `PaymentIntegrationUiTest` ẩn IME và `moveToState(RESUMED)` trong `@After`, trước khi scenario đóng.
- `SeededAccountFlowTest` ghim MOCK trước activity vì máy này mặc định backend và đăng nhập email không mở sổ. Assertion sổ và ảnh công khai giữ nguyên.
- Checkout giả fail ngay nếu chưa có `checkoutId`. Nếu Chrome còn foreground thì đưa app lên rồi mới chờ `rent-payment-refresh`. Checkout thứ hai vẫn phải CREATED. `interpretPaymentReturn` không đổi.

## Suite đầy đủ sau sửa 6 fail

Một job `:app:connectedDebugAndroidTest` không lọc class, Pixel 8 API 34, sau lượt 20/20.

**Không phải 112/112.** Gradle báo `INSTRUMENTATION_ABORTED: System has crashed` sau 21 phút 22 giây. Runner nhận 63/112 rồi dừng ở test 64. `Can't find service: activity`, adb `closed`, process emulator thoát. Logcat lấy được không có stack `FinalizerWatchdogDaemon`. Không gọi đây là Watchdog API 37. Không wipe userdata: máy đã tắt hẳn, không còn session để xác nhận package service mất lâu dài.

Trước khi system chết, hai assertion fail:

- `NativeDiscoveryStatesTest.noGoogleBillingRendersFreeMapLibreInBothThemes` — `takeScreenshot()` null.
- `NativeMessagingStatesTest.rejectedLocalSaveKeepsDraftAndValidatesBeforeCallingTheRepository` — không thấy `message-save`.
- `NativeOwnerStatesTest.scopedOwnerProjectionAndSourceNavigationRenderInBothThemes` — fail cùng lúc activity service biến mất.

Sáu tên fail của lượt 106/112 nằm trong nhóm 20/20, nhưng chưa được chứng minh bằng một suite đầy đủ PASS.

## Chưa làm được

- Chưa có suite 112/112 trên HEAD cuối.
- Chưa review độc lập, chưa sync `origin/main`, chưa mở PR, chưa merge.
- Gate vẫn **NOT_READY**.

## Lệnh đã chạy

| Lệnh | Kết quả |
| --- | --- |
| Nhóm account, asset, portfolio, remaining (30 test) | 28 PASS; account notification và asset picker fail rồi được sửa |
| `AssetPublicationFlowTest` isolated | PASS |
| `PaymentIntegrationUiTest` + `NativeTenantStatesTest` | Portal PASS; keyboard fail rồi PASS sau khi đọc inset IME |
| `RentPaymentFlowTest` isolated trước wipe | PASS |
| `:app:connectedDebugAndroidTest` sau wipe | 106/112, 33 phút 1 giây |
| Lượt suite bị `INSTRUMENTATION_ABORTED` | Không đủ 112, system UI chết |
| Năm class còn lại của lượt 106/112 | 20/20 PASS, 4 phút 54 giây |
| `:app:connectedDebugAndroidTest` không lọc | Aborted, 63/112 nhận được, 21 phút 22 giây, system crashed |

## Job đầy đủ 19/10/2026

Pixel 8 API 34, userdata đã wipe lúc boot, một job `:app:connectedDebugAndroidTest` không lọc class. DemoPay isolated: `node scripts/demo/verify.cjs` PASS trước job. Log Gradle: `app/build/reports/androidTests/connected/debug/index.html` (bị ghi đè bởi job instrumentation sau).

**112 chạy, 105 PASS, 7 FAIL, 0 skip, 1 giờ 1 phút 24 giây.** Không `INSTRUMENTATION_ABORTED`. Không phải 112/112.

Bảy fail:

- `AccountReworkTest.phoneVerificationDirtyBackAndReentryAt320dp` — hộp mật khẩu còn sau 8 giây.
- `AccountReworkTest.notificationSelectionSurvivesBackAndMarketingDoesNotDisableSecurity` — cùng hộp mật khẩu.
- `NativeTenantStatesTest.paymentFieldKeepsHeaderAndActionAboveDockedKeyboard` — cây accessibility rỗng.
- `NativeTenantStatesTest.portalKeepsLinkedProjectionAndSelectedNavigationInBothThemes` — `takeScreenshot()` null.
- `NativeTenantStatesTest.paymentValidationAndRejectedCheckoutRetainAmountWithoutConfirmation` — `takeScreenshot()` null.
- `RentPaymentFlowTest.confirmationRequiresBackendThenRetiresOnlyVerifiedIntent` — không tới «Xác nhận thanh toán».
- `SeededAccountFlowTest.separateAccountsOpenCorrectLedgerAndPublicPhotosWithoutPovSwitch` — screenshot null sau cả `screencap`.

`NativeMessagingStatesTest.rejectedLocalSaveKeepsDraftAndValidatesBeforeCallingTheRepository` isolated PASS sau khi ghim MOCK. Máy này mặc định backend nên counter là `501/4000`, không phải `501/500`.

Hai ảnh tenant null được gắn vòng `screencap` sau job này. Job 105/112 không gồm vòng đó. Gate vẫn **NOT_READY**.

## Ngoài phạm vi commit

- `docs/TroOi_Android_Instrumentation_Handoff_Duy_Anh_2026-10-17.md` là tài liệu giao việc, không phải kết quả thực hiện.
- `gradle.properties` local chỉ tăng heap Gradle và đang bị gitignore.
