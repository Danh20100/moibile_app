# Trọ Ơi — Landing Page

Landing page kể chuyện bằng 3D cho dự án Trọ Ơi.

## Chạy local

Yêu cầu Python 3 để mở HTTP server:

```bash
git clone https://github.com/onsra520/TroOi-Landing-Page.git
cd TroOi-Landing-Page
python -m http.server 8080 --directory dist
```

Mở http://localhost:8080. Không mở trực tiếp `index.html` bằng `file://`, vì trang sử dụng JavaScript ES modules.

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `dist/index.html` | Nội dung tiếng Việt, các chương và điều hướng |
| `dist/style.css` | Giao diện, responsive và tiêu đề hai dòng |
| `dist/story.js` | Mô hình 3D, camera và hoạt ảnh theo cuộn |
| `dist/timeline.js` | Điểm dừng điều hướng và trạng thái hiển thị các cảnh |
| `dist/three.module.js` | Three.js 0.180.0, module dựng hình |
| `dist/three.core.js` | Three.js 0.180.0, module lõi |
| `THIRD_PARTY_LICENSES/three.txt` | Giấy phép của Three.js |

## Hành trình

1. Bản đồ uốn lượn với nhà và chung cư nhô lên, thu xuống.
2. Camera tiến vào căn phòng, nội thất tập hợp về đúng vị trí.
3. Hóa đơn được đóng dấu rồi thu vào điện thoại.
4. Nhân vật bước qua, chuyển sang cảnh nhân viên sửa máy lạnh.
5. Điện thoại phóng lớn, giới thiệu ứng dụng và các nền tảng tải.

Các nút điều hướng dừng tại trạng thái hoàn chỉnh của chương. Có chế độ giảm chuyển động và bố cục cho màn hình nhỏ.

## Chỉnh sửa

- Đổi nội dung tại `dist/index.html`.
- Đổi màu sắc, kích thước chữ và bố cục tại `dist/style.css`.
- Đổi mô hình, góc camera và chuyển động tại `dist/story.js`.
- Khi đổi thời gian hoạt ảnh, cập nhật điểm dừng trong `dist/timeline.js` để điều hướng vẫn kết thúc đúng cảnh.
- Khi thay đổi source, cập nhật query phiên bản CSS/JS trong HTML nếu cần tránh cache cũ.

## Triển khai

Đây là website tĩnh, không cần bước build hoặc cài npm. Đặt `dist` làm thư mục public trên dịch vụ static hosting hỗ trợ JavaScript modules.

## Lưu ý sản phẩm

- Hóa đơn và thông tin phòng là dữ liệu minh họa.
- App đang phát triển; Google Play và App Store hiện là nhãn “Sắp ra mắt”, chưa có đường dẫn tải thật.
- Font Be Vietnam Pro được tải qua Google Fonts; trang có font dự phòng.
- Bản nhập source đã được kiểm tra cú pháp, tham chiếu file, điểm dừng của năm chương và tọa độ đóng dấu. Chưa kiểm tra lại hiển thị bằng trình duyệt sau lần sửa bản 2.

## Giấy phép

Source dự án sử dụng MIT theo `LICENSE`. Three.js giữ giấy phép MIT riêng trong `THIRD_PARTY_LICENSES/three.txt`.
