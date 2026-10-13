# Kiểm thử manual các nút chuyển khoản

Ngày 13/10/2026, nhánh `recovery/payment-methods`. Component production được kiểm tra là `GatewayPaymentPanel` của commit `cacf164`. Bản sửa UI đã có trong APK; vòng này bổ sung thao tác manual và bằng chứng, không đổi nghiệp vụ thanh toán.

## Cách kiểm tra

Agent thao tác chạm, vuốt, nhập và xóa từng bước trên Android Emulator bằng `adb input`, rồi đọc ảnh màn hình và cây UI native. **Không dùng `performClick`, `performTextReplacement` hoặc test script tự chạy các case manual.**

Phiên dùng một Activity Android thật, mở chính component production trong host `PaymentManualSession` thuộc APK test. Host cung cấp dữ liệu/callback QA, bộ đếm và menu chọn trạng thái. Thanh điều khiển QA không được thêm vào APK sản phẩm. Việc đổi trạng thái chờ/lỗi/thành công qua menu là đặt fixture để kiểm tra UI, không phải phản hồi từ ngân hàng. Không kiểm thử đăng nhập, backend hoặc chuyển tiền thật trong phiên này.

Thiết bị: Android 16/API 36, `medium_phone`, 840 × 1800 px, density 420 dpi, rộng 320dp. Theme và fontScale 1.0/2.0 được chọn trên thanh QA. Ảnh giữ nguyên từ Android CLI; video là bản ghi native không cắt ghép.

Phiên hoàn chỉnh có log từ `2026-10-13T15:05:48Z` đến `15:23:14Z` (UTC). Một lần mở host trước đó gặp timeout Espresso, đã được sửa bằng Activity với vòng vẽ Android bình thường; lần thử thiết lập đó không tính PASS.

## Kết quả manual

13 nhóm case dưới đây đều PASS trong phiên hoàn chỉnh. Đây là các bước quan sát manual, tách biệt với số lượng test method tự động.

| Case | Thao tác và kết quả mong đợi | Kết quả thực tế | Bằng chứng |
| --- | --- | --- | --- |
| M01 | Mở màn, đúng nhãn chuyển khoản, không còn tiêu đề MoMo trong ảnh cũ | PASS: hiện Chuyển khoản ngân hàng | [Ảnh đầu phiên](manual-payment-20261013/01-initial.png) |
| M02 | Cuộn tới các nút, so chiều rộng/chiều cao/mép căn; kiểm tra lại ở tối/chữ 200% | PASS: cả bốn nút bằng nhau ở từng cỡ chữ; xem bảng số đo dưới | [Sáng](manual-payment-20261013/18-final-buttons.png), [tối](manual-payment-20261013/15-dark-large.png), [nút chính chữ lớn](manual-payment-20261013/16-dark-create.png) |
| M03 | Bấm Tiếp tục chuyển khoản và Làm mới, mỗi lần chỉ gọi một callback | PASS: đầu phiên Tạo 0→1, Làm mới 0→1; vẫn là Chờ thanh toán | [Ảnh sau bấm](manual-payment-20261013/03-reference.png), [log](manual-payment-20261013/events.txt) |
| M04 | Bấm xem mã, đọc ID/ngày giờ rồi bấm ẩn; thử lại với chữ lớn | PASS: mã hiện/ẩn đúng; cuối phiên nút trở về Xem mã giao dịch | [Mã thường](manual-payment-20261013/03-reference.png), [mã chữ lớn](manual-payment-20261013/17-dark-reference.png), [đã ẩn](manual-payment-20261013/18-final-buttons.png) |
| M05 | Nhập 999 đồng rồi bấm tạo, không cho ghi | PASS: nút khóa, bộ đếm tạo vẫn 1 | [Ảnh](manual-payment-20261013/04-below-min.png), [cây UI](manual-payment-20261013/04-invalid-layout.json) |
| M06 | Xóa trống số tiền, bấm tạo | PASS: nút khóa, bộ đếm tạo vẫn 1 | [Ảnh trống](manual-payment-20261013/06-empty.png), log không có CREATE cho giá trị trống |
| M07 | Nhập 3000.50, bấm tạo | PASS: báo ô nhập không hợp lệ, nút khóa, bộ đếm vẫn 1 | [Ảnh phần lẻ](manual-payment-20261013/07-fractional.png) |
| M08 | Nhập số hợp lệ, giữ bàn phím mở, cuộn tới nút và bấm | PASS: với 30.000 đồng, nút nhìn thấy và bấm được; bộ đếm tạo 1→2 | [Bàn phím](manual-payment-20261013/05-keyboard.png), [bấm khi bàn phím mở](manual-payment-20261013/08-create-with-keyboard.png) |
| M09 | Khi không được replay thì không có nút; chọn fixture cho replay và bấm | PASS: nút chỉ xuất hiện khi được phép; Mở lại 0→1, rồi 1→2 ở tối/chữ lớn | [Ảnh](manual-payment-20261013/09-replay.png), [log](manual-payment-20261013/events.txt) |
| M10 | Chọn đang xử lý, thử bấm tạo và làm mới | PASS: hai nút khóa; bộ đếm vẫn Tạo 2 / Làm mới 1 / Mở lại 1 | [Ảnh busy](manual-payment-20261013/10-busy.png), [cây UI](manual-payment-20261013/10-busy-layout.json) |
| M11 | Chọn lượt thuê kết thúc, thử tạo rồi làm mới | PASS: tạo vẫn 2, làm mới được và tăng 1→2 | [Ảnh](manual-payment-20261013/11-ended.png), log REFRESH case=3 |
| M12 | Chọn lỗi, cuộn đọc thông báo, thử tạo lại và làm mới | PASS: có lời báo lỗi; hai callback hoạt động, tổng Tạo 3 / Làm mới 3 | [Ảnh lỗi](manual-payment-20261013/12-error.png), log case=4 |
| M13 | Chọn SUCCEEDED thiếu payment, sau đó có đúng payment | PASS: trước là Đang đồng bộ khoản thanh toán; sau là Đã ghi nhận thanh toán; không nhận nhầm pending thành paid | [Đồng bộ](manual-payment-20261013/13-sync.png), [đã ghi nhận theo fixture](manual-payment-20261013/14-confirmed.png) |

Ở tối/chữ 200%, agent còn bấm lại tạo/làm mới/mở lại, mở/ẩn mã rồi chuyển về sáng/chữ thường. Kết thúc phiên có **4 CREATE, 4 REFRESH, 2 REPLAY**; những lần bấm nút bị khóa không phát sinh callback. Log giữ nguyên cả các giá trị trung gian khi chỉnh sửa input.

## Số đo từ cây UI sau thao tác manual

| Cỡ chữ / theme | Tạo | Làm mới | Mở lại | Xem/ẩn mã |
| --- | --- | --- | --- | --- |
| 100%, sáng | 662 × 127 px | 662 × 127 px | 662 × 127 px | 662 × 127 px |
| 200%, tối | 662 × 210 px | 662 × 210 px | 662 × 210 px | 662 × 210 px |

Tất cả cùng mép trái x=89 và mép phải x=751. Các nút được đưa vào vùng nhìn thấy trước khi lấy số đo; không dùng chiều cao bị cắt ở mép vùng cuộn. Nguồn gốc: [cây UI thường](manual-payment-20261013/18-final-layout.json), [ba nút phụ chữ lớn](manual-payment-20261013/15-dark-large-layout.json), [nút chính chữ lớn](manual-payment-20261013/16-dark-create-layout.json).

## Video, hồi quy và APK

[Video manual gốc](manual-payment-20261013/manual-steps.mp4) dài 180,326 giây, 420 × 900 px, ghi các bước đầu của phiên: tạo, làm mới, xem/ẩn mã và bắt đầu thao tác input. Video không bao phủ toàn bộ 18 phút; các case còn lại có ảnh, cây UI và nhật ký riêng.

Sau phiên manual, chạy lại toàn bộ các lớp test tự động hiện có, tách host interactive khỏi suite:

| Kiểm tra | Kết quả |
| --- | --- |
| Unit backendDebug | 111 PASS, 0 fail/error/skip |
| Instrumentation tự động | 13 PASS, 0 fail; 43,812 giây |
| Compile APK test và lint | PASS; lint 0 error, 37 warning, 2 hint |
| Host manual | Mở và đóng hoàn chỉnh; `OK (1 test)` chỉ là vòng đời host, không thay thế 13 case manual ở trên |

Không phát hiện lỗi căn nút hoặc thao tác trong ma trận đã kiểm tra. Không suy rộng thành cam kết mọi màn/thiết bị hoặc provider live đều không có lỗi.

APK đã cài để manual: `artifacts/TroOi-chuyen-khoan-manual-verified.apk`. Đây là bản sao đúng binary backendDebug đã kiểm tra, SHA-256:

```text
5260EC11273E33F1DB0FB9AFAA7644E53E7DA3DA28813A6B75A9E9AAD242D648
```

Ảnh người dùng gửi còn tiêu đề và bố cục cũ. Cần cài/rebuild APK đã xác minh để thấy UI hiện tại; push code không tự thay app đang cài. APK backendDebug này vẫn cần cấu hình API theo môi trường dự án nếu dùng ngoài phiên QA.

## Mở lại phiên manual

```powershell
.\gradlew.bat --no-daemon :app:assembleBackendDebug :app:assembleBackendDebugAndroidTest '-PtrooiInstrumentationBuildType=backendDebug'
$taskAdb="$env:ANDROID_HOME/platform-tools/adb.exe"
& $taskAdb -s emulator-5554 install -r app/build/outputs/apk/backendDebug/app-backendDebug.apk
& $taskAdb -s emulator-5554 install -r app/build/outputs/apk/androidTest/backendDebug/app-backendDebug-androidTest.apk
& $taskAdb -s emulator-5554 shell am instrument -w -e class com.trooi.app.features.PaymentManualSession -e manualUi true com.trooi.app.backenddev.test/androidx.test.runner.AndroidJUnitRunner
```

Host chỉ mở khi có `manualUi=true`; chạy tự động mặc định sẽ bỏ qua host interactive. Người kiểm tra phải tự bấm/nhập/cuộn và kết thúc bằng nút Kết thúc phiên manual. Thiết lập SDK/Java cho máy Windows này xem [báo cáo build](payment-ui-20261013.md#chạy-lại).
