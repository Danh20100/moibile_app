# Kết quả đổi nhãn chuyển khoản và căn đều nút

Nhánh `recovery/payment-methods`, bổ sung từ commit `683bc65`. Ngày kiểm tra: 13/10/2026.

## Kết quả cuối

| Kiểm tra | Kết quả |
| --- | --- |
| Toàn bộ unit test Android backendDebug | 111 PASS, 0 fail, 0 error, 0 skip |
| Toàn bộ instrumentation test backendDebug | 13 PASS, 0 fail |
| Build APK app và APK test | PASS |
| Lint | 0 error, 37 warning, 2 hint |
| Đo bốn nút trên Android | Cùng chiều rộng, chiều cao và mép trái, sai lệch tối đa 1px |

Không phát hiện lỗi căn chỉnh hoặc thao tác trong các trạng thái đã kiểm tra. Kiểm thử UI dùng dữ liệu QA trên emulator; không thực hiện chuyển tiền ngân hàng thật và không xác nhận webhook live.

## Đã sửa

- Tiêu đề dùng **Chuyển khoản ngân hàng**; hướng dẫn và CTA dùng **Tiếp tục chuyển khoản**, **Tạo chuyển khoản mới**, **Thử mở lại chuyển khoản**.
- Đổi nốt hai câu hướng dẫn còn nhắc MoMo trong Trợ giúp và portal người thuê sang chuyển khoản ngân hàng.
- Bốn nút tạo/tiếp tục, làm mới, mở lại và xem/ẩn mã giao dịch cùng chiều rộng, mép căn và chiều cao. Nút chính xanh đậm, các nút phụ cùng component xanh nhạt.
- Chiều cao tối thiểu lấy từ số đo thực tế của hai dòng chữ bằng Compose TextMeasurer và padding native. Không cố định chiều cao khiến chữ lớn bị cắt.
- Test cũ về phân bổ tiền cọc đọc đúng component gateway hiện tại, thay cho tìm khối UI bằng tiêu đề MoMo đã bị xóa.

Gateway Android vốn đang tạo giao dịch SePay. Thay đổi này làm UI gọi đúng chuyển khoản, không thay đổi API, idempotency hoặc điều kiện xác nhận tiền.

## Case và kết quả

| Case | Kiểm tra | Kết quả |
| --- | --- | --- |
| T-01 | Tiêu đề ngân hàng hiện; tiêu đề Thanh toán MoMo không còn trong panel | PASS |
| T-02 | Đo tạo/làm mới/mở lại/xem mã ở theme sáng, chữ 100%, rộng 320dp | PASS: cùng chiều rộng, chiều cao, mép trái |
| T-03 | Đo lại đủ bốn nút ở theme tối, chữ 200%, rộng 320dp | PASS: cùng chiều rộng, chiều cao, mép trái; nhãn dài không bị cắt |
| T-04 | Bấm tạo/làm mới/mở lại; mở và ẩn mã giao dịch | PASS: callback đúng, mã hiện/ẩn đúng |
| T-05 | CREATED, UNKNOWN, SUCCEEDED chưa có payment, SUCCEEDED đã có payment, FAILED | PASS: chờ và đang đồng bộ không báo đã nhận; thành công chỉ hiện khi có đúng payment |
| T-06 | Lượt thuê ENDED, đang busy, số tiền có phần lẻ | PASS: khóa đúng các hành động ghi, làm mới theo trạng thái |
| T-07 | Mở bàn phím, nhập tiền, Tab đến nút và Enter | PASS: ô/nút tiếp cận được, tạo gọi đúng một lần |
| T-08 | Tám đích trong Trọ của tôi, hủy/xác nhận trả phòng, thông báo, điều hướng nguồn, lưu phiên, bản đồ | PASS trong toàn bộ bộ instrumentation hiện có |
| T-09 | Các unit test hiện có, gồm transport/checkout/deposit và định dạng hiển thị | 111 PASS |

Test hình học đã tái hiện lỗi trước sửa: hai case sáng/tối FAIL vì khác chiều rộng. Khi tăng chữ, test tiếp tục phát hiện lệch chiều cao giữa nút một và hai dòng. Bản cuối đo trực tiếp chữ bằng Compose và cả hai case đều PASS, sau đó toàn bộ 13 instrumentation đều PASS.

Môi trường: Android 16/API 36, emulator `medium_phone`, 840 × 1800 px, density 420 dpi, tương ứng rộng 320dp. FontScale 1.0/2.0 và theme sáng/tối được đặt trong test harness; component và hành động là code production với dữ liệu/callback QA.

Runner cuối:

```text
com.trooi.app.features.NativeMapSmokeTest:...
com.trooi.app.features.RentalFlowUiTest:......
com.trooi.app.features.RentalPresentationSmokeTest:..
com.trooi.app.features.SessionHintsPersistenceTest:.
com.trooi.app.features.SourceNavigationSmokeTest:.

Time: 38.563

OK (13 tests)
```

Lint còn 37 warning và 2 hint như tổng số của vòng trước. Kết quả 0 error không có nghĩa 0 warning.

## Ảnh và APK

Ảnh chụp native, không chỉnh sửa; số tiền, ID và tên phòng là dữ liệu kiểm thử. Một số ảnh được chụp tại vị trí cuộn hoặc khi nút có focus/pressed; không phải toàn bộ chiều dài trang.

- [Chuyển khoản và bốn nút](transfer-ui-20261013/payment-light-pending.png)
- [Ảnh sau bước đo các nút](transfer-ui-20261013/payment-light-actions.png)
- [Trạng thái đã ghi nhận theo fixture](transfer-ui-20261013/payment-light-confirmed.png)
- [Trạng thái lỗi](transfer-ui-20261013/payment-light-error.png)
- [Theme tối, chữ 200%](transfer-ui-20261013/payment-dark-large.png)
- [Sau thao tác Tab/Enter](transfer-ui-20261013/payment-keyboard.png)

APK mới trên máy: `artifacts/TroOi-chuyen-khoan-backendDebug.apk`, bản sao đúng APK đã cài và kiểm thử. SHA-256: `5260EC11273E33F1DB0FB9AFAA7644E53E7DA3DA28813A6B75A9E9AAD242D648`. APK là backendDebug để kiểm tra, không phải bản release production. Cần cài/rebuild bản mới để thay giao diện cũ trong hai ảnh được gửi; thao tác push code không tự cập nhật app đã cài.

## Chạy lại

```powershell
.\gradlew.bat --no-daemon :app:testBackendDebugUnitTest :app:lintBackendDebug :app:assembleBackendDebug :app:assembleBackendDebugAndroidTest '-PtrooiInstrumentationBuildType=backendDebug'
$taskAdb="$env:ANDROID_HOME/platform-tools/adb.exe"
& $taskAdb -s emulator-5554 install -r app/build/outputs/apk/backendDebug/app-backendDebug.apk
& $taskAdb -s emulator-5554 install -r app/build/outputs/apk/androidTest/backendDebug/app-backendDebug-androidTest.apk
& $taskAdb -s emulator-5554 shell am instrument -w com.trooi.app.backenddev.test/androidx.test.runner.AndroidJUnitRunner
```

Thiết lập SDK, kích thước emulator và tùy chọn Java cần cho máy Windows này được ghi trong [báo cáo vòng trước](payment-ui-20261013.md#chạy-lại). Kiểm tra chuỗi `OK (13 tests)` trong runner thay vì chỉ dùng exit code của `am instrument`.
