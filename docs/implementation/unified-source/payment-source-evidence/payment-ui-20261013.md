# Kết quả sửa UI Trọ của tôi và thanh toán

Ngày kiểm tra: 13/10/2026. Nhánh: `recovery/payment-methods`. Điểm bắt đầu: `d1e16a034cd6ce40f197d2dec8d9a470338d14f9`.

## Kết quả

| Kiểm tra | Kết quả cuối |
| --- | --- |
| Toàn bộ unit test của Android backendDebug | 111 PASS, 0 fail, 0 error, 0 skip |
| Toàn bộ instrumentation test trong APK backendDebug | 13 PASS, 0 fail |
| Android lint | 0 error, 37 warning, 2 hint |
| Build app và APK instrumentation | PASS |
| Rà ảnh native sáng/tối, chữ 100%/200% | PASS trong các màn và trạng thái dưới đây |

Không phát hiện lỗi tràn ngang, nhãn bị giá trị dài che mất hoặc nút không thể tiếp cận trong phạm vi đã kiểm tra. Kết quả này không phải cam kết mọi màn khác trong ứng dụng đều không có lỗi.

## Thay đổi

- Trang Trọ của tôi dùng tên phòng thật khi có, chia thành hai nhóm: tiền thuê/thanh toán và thông tin lượt thuê. Tám hàng điều hướng cùng chiều rộng; hành động trả phòng có hộp xác nhận.
- Màn thanh toán đặt biểu mẫu chuyển khoản lên trước lịch sử, dùng đúng tên SePay đang được gateway Android chọn. Nút tạo, làm mới và mở lại có chiều rộng thống nhất, khóa khi đang xử lý hoặc lượt thuê chỉ được xem.
- Tiền và thời gian hiển thị theo tiếng Việt, múi giờ Việt Nam. Mã giao dịch nằm trong phần mở rộng. Ở chữ lớn, nhãn và giá trị xếp dọc để đọc trọn ngày giờ.
- Thông báo có tiêu đề và nội dung theo ngữ cảnh thay cho mã kỹ thuật; giữ nội dung thật và ID nguồn để mở đúng bản ghi. Trạng thái tải, trống, lỗi và kết quả có lời giải thích.
- Màu trạng thái theo theme Material thực tế; viền ô nhập và nút trả phòng có tương phản rõ hơn.

Không sửa backend, schema, giao thức thanh toán hoặc cách phân bổ tiền. Mở liên kết thanh toán không xác nhận đã nhận tiền. Màn gateway chỉ ghi đã nhận khi checkout thành công và danh sách payment có đúng resultingPaymentId.

## Môi trường và phạm vi kiểm thử

Android Emulator `medium_phone`, Android 16 / API 36, Google APIs Play Store x86_64. Kích thước kiểm tra 840 × 1800 px, density 420 dpi, tương ứng chiều rộng 320dp. Test mã giao dịch còn dùng container 280dp. Cỡ chữ 1.0 và 2.0 được đặt qua `LocalDensity`; theme sáng/tối đặt qua `TroOiTheme`.

Instrumentation chạy composable production trên Android thật trong emulator, dùng dữ liệu QA và callback kiểm thử. Kiểm tra điều hướng đối chiếu route/ID callback; không đăng nhập tài khoản thật, không tạo giao dịch ngân hàng, không xác minh webhook SePay live. Bài bản đồ kiểm tra cả trạng thái chưa cấu hình key, không xác nhận bản đồ live. Đây là phạm vi sửa giao diện, không phải một vòng E2E qua backend/provider.

Hai smoke test mới đã được chạy trước sửa và đều FAIL: mã dài làm mất nhãn, thông báo thanh toán còn hiện mã category. Cùng hai test đó PASS sau sửa.

## Test case và kết quả

Các hàng dưới là nhóm kiểm tra trong test, không cộng dồn thành số lượng test method. Tổng method thực tế là 111 unit + 13 instrumentation.

| Case | Thao tác / điều kiện | Kết quả |
| --- | --- | --- |
| UI-01 | Mở tổng quan sáng, 320dp; bấm đủ thanh toán, khoản phải thu, cọc, biên nhận, điều khoản, thông báo, lịch sử, sự cố | PASS: 8 route/ID đúng; hàng cùng chiều rộng, nằm trong container |
| UI-02 | Lặp lại tổng quan ở theme tối, chữ 200% | PASS: cuộn tới và bấm được đủ 8 đích |
| UI-03 | Mở yêu cầu trả phòng, hủy, mở lại rồi xác nhận | PASS ở cả hai theme: hủy gọi callback 0 lần; xác nhận gọi 1 lần |
| UI-04 | Checkout CREATED; bấm tạo, làm mới và mở lại | PASS: callback đúng; trạng thái chờ không báo đã nhận tiền |
| UI-05 | Checkout SUCCEEDED nhưng danh sách chưa có payment; sau đó thêm đúng payment | PASS: hiển thị đang đồng bộ trước, đã ghi nhận sau; replay biến mất |
| UI-06 | Lượt thuê ENDED, sau đó ACTIVE nhưng busy | PASS: không tạo được giao dịch; làm mới được khi ENDED và bị khóa khi busy |
| UI-07 | Checkout FAILED và lỗi tạo; nhập `1000.50` | PASS: lời báo lỗi xuất hiện; nút tạo bị khóa cho phần lẻ |
| UI-08 | Theme tối, chữ 200%, số tiền 50 triệu, checkout UNKNOWN; mở mã giao dịch | PASS: tạo/làm mới/mở lại tiếp cận được; không nhận nhầm thành công; đọc được mã |
| UI-09 | Bấm ô tiền để mở IME; nhập 1.500.000; cuộn tới nút; Tab và Enter bằng key event Android | PASS: IME có chiều cao > 0, ô nhập hiện và có focus, nút hiện, Tab chuyển focus, Enter gọi tạo 1 lần |
| UI-10 | PAYMENT_CONFIRMED với message `payment:<id>` | PASS: tiêu đề tiếng Việt; bấm thông báo giữ đúng notificationId |
| UI-11 | Chi tiết thông báo tối, chữ 200%; đánh dấu đọc, mở nguồn | PASS: hai callback nhận đúng ID; ngày giờ xếp dọc, không tách chữ số cuối |
| UI-12 | Thông báo không có sourceId, đang tải, không tìm thấy | PASS: không hiện nút mở nguồn khi thiếu ID; tải/trống có lời giải thích |
| UI-13 | UUID dài, container 280dp, chữ 200% | PASS: nhãn và giá trị đều hiện; không chồng nhau và nằm trong container |
| REG-01 | SourceNavigationSmokeTest và SessionHintsPersistenceTest | PASS: giữ điều hướng nguồn và thông tin lưu phiên |
| REG-02 | Ba NativeMapSmokeTest hiện có | PASS: marker public, camera search, trạng thái thiếu key và private pin |
| UNIT-01 | Định dạng tiền, số rất lớn và nguồn không phải số | PASS: giữ độ chính xác BigDecimal, không tự bịa giá trị |
| UNIT-02 | Ngày UTC qua ranh giới ngày Việt Nam và nguồn không parse được | PASS: ngày/giờ đúng, nguồn không hợp lệ được giữ nguyên |
| UNIT-03 | Pending/unknown/failed và verification chưa biết | PASS: không gắn nhãn đã nhận tiền |
| UNIT-04 | Nội dung tham chiếu nội bộ, JSON và category chưa biết | PASS: không lộ mã nội bộ, không khẳng định đã tất toán |
| UNIT-05 | Nội dung thông báo thật do người dùng viết | PASS: giữ nguyên nội dung |

Các unit test còn lại của variant được chạy đầy đủ trong cùng lệnh Gradle; tổng 111 test đã đọc từ XML kết quả, không suy ra chỉ từ thông báo build thành công.

Runner cuối:

```text
com.trooi.app.features.NativeMapSmokeTest:...
com.trooi.app.features.RentalFlowUiTest:......
com.trooi.app.features.RentalPresentationSmokeTest:..
com.trooi.app.features.SessionHintsPersistenceTest:.
com.trooi.app.features.SourceNavigationSmokeTest:.

Time: 25.333

OK (13 tests)
```

Lint vẫn còn 37 warning và 2 hint, chủ yếu về phiên bản thư viện/SDK, API và quy ước Compose hiện có. Không đánh đồng kết quả 0 error với 0 warning; không nâng dependency ngoài yêu cầu UI này.

## Ảnh native

Ảnh được chụp trực tiếp bằng Compose `captureToImage`, không chỉnh sửa hình. Tên phòng, số tiền và ID trong ảnh là dữ liệu kiểm thử. Một số ảnh đang ở vị trí cuộn hoặc trạng thái focus/pressed; chúng không phải toàn bộ chiều dài trang. Banner QA thuộc test harness, không thêm vào sản phẩm.

| Trạng thái | Bằng chứng |
| --- | --- |
| Tổng quan sáng | [Đầu trang](payment-ui-20261013/rental-light-top.png), [cuối trang](payment-ui-20261013/rental-light-bottom.png) |
| Tổng quan tối, chữ 200% | [Đầu trang](payment-ui-20261013/rental-dark-large-top.png), [cuối trang](payment-ui-20261013/rental-dark-large-bottom.png) |
| Thanh toán sáng | [Chờ](payment-ui-20261013/payment-light-pending.png), [đã ghi nhận theo fixture](payment-ui-20261013/payment-light-confirmed.png), [lỗi](payment-ui-20261013/payment-light-error.png) |
| Thanh toán tối, chữ 200% | [Ảnh](payment-ui-20261013/payment-dark-large.png) |
| Bàn phím và focus | [Ảnh sau chuyển focus bằng Tab/Enter](payment-ui-20261013/payment-keyboard.png); IME mở được xác nhận trong test trước khi chuyển focus |
| Chi tiết thông báo tối, chữ 200% | [Ảnh](payment-ui-20261013/notification-dark-large.png) |

## Chạy lại

Trên máy Windows này JDK Unix-domain socket không hoạt động; tùy chọn theo process dưới đây buộc JDK dùng đường dự phòng TCP. Không đổi cấu hình Java/Gradle đã commit.

```powershell
$env:ANDROID_HOME='C:/Users/KHANH BANG/AppData/Local/Android/Sdk'
$env:JDK_JAVA_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:/Users/KHANH_BANG_TroOi_Test_NoUnixSocket'
$env:JAVA_TOOL_OPTIONS=$env:JDK_JAVA_OPTIONS
.\gradlew.bat --no-daemon :app:testBackendDebugUnitTest :app:lintBackendDebug :app:assembleBackendDebug :app:assembleBackendDebugAndroidTest '-PtrooiInstrumentationBuildType=backendDebug'

$taskAdb="$env:ANDROID_HOME/platform-tools/adb.exe"
& $taskAdb -s emulator-5554 shell wm size 840x1800
& $taskAdb -s emulator-5554 shell wm density 420
& $taskAdb -s emulator-5554 install -r app/build/outputs/apk/backendDebug/app-backendDebug.apk
& $taskAdb -s emulator-5554 install -r app/build/outputs/apk/androidTest/backendDebug/app-backendDebug-androidTest.apk
& $taskAdb -s emulator-5554 shell am instrument -w com.trooi.app.backenddev.test/androidx.test.runner.AndroidJUnitRunner
```

Phải kiểm tra runner có `OK (13 tests)`; lệnh `am instrument` có thể trả exit code 0 dù test fail. Sau kiểm tra reset kích thước/density của emulator. Không thêm token, endpoint riêng hay keystore vào Git để chạy các test này.

APK kiểm thử: `app/build/outputs/apk/backendDebug/app-backendDebug.apk`. SHA-256: `7529560AD3EA79D8ECABE99AAEBA4037479E62A5EBBF0F6615067A9251839C0E`. Đây là backendDebug, không phải bản phát hành đã ký production; cần cấu hình backend của môi trường khi dùng app với dữ liệu thật.
