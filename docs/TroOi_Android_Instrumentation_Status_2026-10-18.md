# Trạng thái ổn định Android instrumentation — 18/10/2026

Nhánh: `fix/android-instrumentation-stabilization-20261017`  
HEAD trước các thay đổi này: `aa75c95`  
Worktree: `D:\Semester 8\EXE2\backend\TroOi-Project`  
Kết luận gate: **NOT_READY**

Phạm vi là ổn định instrumentation/UI E2E. Không thêm tính năng sản phẩm, không hạ kiểm soát bảo mật, không dùng SePay Production, không đụng `trooi_finance`.

## Đã làm được

- `LandlordOnboardingFlowTest` isolated **PASS** trên Pixel 8 API 34. Test ghim nguồn MOCK trước khi mở activity, chọn đúng ảnh specimen trong Photo Picker, chờ OCR xong rồi mới bấm tiếp, và sau khi hoàn tất hồ sơ vào không gian quản lý của organization vừa được cấp.
- `RentPaymentFlowTest` isolated **PASS** hai lần liên tiếp (1 phút 22 giây và 1 phút 26 giây). Đường đi là checkout CREATED, xác nhận có chữ ký trên DemoPay, deep link `trooi://payment/demo` đưa app trở lại, payment SUCCEEDED đúng 1.000đ, deep link giả không settle thêm, không tự phân bổ deposit/receipt, và checkout thứ hai còn CREATED.
- DemoPay isolated trên Postgres compose: host `postgres`, database `/trooi_dev`, `SEPAY_ENABLED=false`. `scripts/demo/verify.cjs` chỉ tự gán `DATABASE_URL` bên trong container khi thiếu, và thoát nếu không đúng host/database đó.
- Sổ fixture nhận đúng một payment DemoPay đã settle khi xác nhận. Deposit và receipt không bị đổi theo payment đó.
- Nút «Về Sổ» được gọi bằng semantics action vì nút nằm dưới fold; click theo tọa độ không tới callback.
- Gợi ý phiên thanh toán được `commit()` để lần đọc ngay sau đó thấy checkout đã rút khỏi danh sách chờ.
- Onboarding local ở chế độ demo preview không còn bị chặn bởi stub reauthentication. Đường backend vẫn fail-closed trên stub đó. Demo checkout cũng không gọi stub này trước khi tạo checkout thật.
- Sau khi hoàn tất hồ sơ chủ trọ, app chọn organization được cấp và mở trang tài sản của khu trọ đó.
- `:app:testDebugUnitTest` **PASS** (48 giây). `git diff --check` **PASS**.
- Full `:app:connectedDebugAndroidTest` đã chạy hết 112 test trên cùng emulator. Không có Watchdog API 37. Máy này chỉ có API 34.

## Chưa làm được

- Full suite **không PASS**: 94 PASS, 18 FAIL, 0 skip, 112 đã chạy, khoảng 33 phút 25 giây. Không được coi là 112/112.
- 12 test account (`AccountReworkTest`, `AccountSecurityUiTest`) fail với `Debug fixture assets must be initialized before use`, từ rất sớm trong suite.
- `AssetPublicationFlowTest` và `FixturePortfolioFlowTest` timeout.
- `NativeRemainingStatesTest` không thấy activity về `DESTROYED` (dừng ở `PAUSED`).
- `NativeTenantStatesTest` timeout.
- `PaymentIntegrationUiTest` timeout 5 giây.
- `RentPaymentFlowTest` trong full suite fail vì `takeScreenshot()` trả về null khi emulator đang tải nặng. Bản isolated sau đó vẫn PASS. Không được lấy kết quả suite này làm bằng chứng luồng thanh toán hỏng.
- Chưa review độc lập, chưa sync `origin/main`, chưa mở PR, chưa merge.

## Lệnh đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `LandlordOnboardingFlowTest` isolated | PASS |
| `RentPaymentFlowTest` isolated | PASS, rồi PASS lại sau khi dọn log tạm |
| `:app:testDebugUnitTest` | PASS, 48 giây |
| `:app:connectedDebugAndroidTest` | FAIL, 94/112, 33 phút 25 giây |
| `git diff --check` | PASS |

## Ngoài phạm vi commit

- `docs/TroOi_Android_Instrumentation_Handoff_Duy_Anh_2026-10-17.md` là tài liệu giao việc, không phải kết quả thực hiện.
- `gradle.properties` local chỉ tăng heap Gradle và đang bị gitignore.
