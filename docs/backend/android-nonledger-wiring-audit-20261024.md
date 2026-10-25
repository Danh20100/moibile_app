# TrọƠi — Android ↔ Backend audit (ngoại trừ tab Sổ)
Ngày: 24/10/2026. Local Debug APK, backend NestJS tại `127.0.0.1:3101`, một PostgreSQL `tro-oi`. Không reset/seed dữ liệu.

## Đối chiếu hợp đồng (không đánh đồng API tồn tại với E2E đã nghiệm thu)

| Phạm vi | Backend thật | Android | Kết luận |
| --- | --- | --- | --- |
| Google Login/Register | `identity-access/auth/challenge`, `auth/google`, `register/google` | Credential Manager + session repository | ĐÃ NỐI; không đổi package/SHA-1 |
| Refresh/logout | `auth/refresh`, `auth/logout` | Token rotation/clear session | ĐÃ NỐI, kiểm tra source/test |
| Email/password, email OTP, forgot password | Chưa có endpoints production | Real-mode nay chỉ hiển thị Google; form test/demo còn riêng | CHƯA CÓ BACKEND |
| Tên hiển thị | `GET/PATCH identity-access/profile` | `updateDisplayName`, Profile screen | ĐÃ NỐI; không chặn sai bằng PIN |
| Avatar | `GET/POST identity-access/profile/avatar` | Authenticated upload + readback | ĐÃ NỐI; chưa upload ảnh thật trong audit |
| Tên pháp lý, điện thoại, địa chỉ, đổi email | Chưa có write contract + verification tương ứng | Real-mode khóa sửa, hiển thị không hỗ trợ | CHƯA CÓ BACKEND |
| CCCD / KYC | **Đã có ML Kit OCR (Android), CompreFace server adapter, private S3/MinIO object adapter và state machine duyệt thủ công; chưa có API submit/status/review, durable record, reviewer authorization** | Không thu CCCD giả, không báo Verified | FOUNDATION DONE; BACKEND E2E NOT DONE |
| Provider link/unlink, PIN/password | Chưa có account provider/security write APIs | Real-mode không hiện nút link/unlink giả | CHƯA CÓ BACKEND |
| Đăng ký không gian chủ trọ | Operator Workspace có Google reauth + API Organization create | Profile real-mode chuyển vào Operator Workspace, tránh wizard legacy bị khóa | ĐÃ NỐI LUỒNG; chưa tạo Organization thật |
| Khám phá/tìm kiếm | `listings/public`, `listings/public/search`, public media | DiscoveryExperience, filter, map, public cards | ĐÃ NỐI, database chưa có listing công khai |
| Gửi yêu cầu liên hệ | `POST /inquiries` | submitInquiry trong Listing Detail | ĐÃ NỐI; cần listing thật để E2E |
| Báo cáo tin đăng | `POST /audit-trust/reports` | V1TrustGateway authenticated submit + receipt | ĐÃ NỐI theo contract; chưa submit report thật |
| Tin nhắn | `messaging/conversations`, messages, read, attachments | MessagingScreen + BackendTroOiRepository; polling 8 giây | ĐÃ NỐI theo contract; cần 2 users và Inquiry/Tenancy để E2E |
| Thông báo | `notifications` list/detail/read | Notification screens/ViewModel | ĐÃ NỐI theo contract; cần event thật để E2E |
| Cài đặt kênh marketing, privacy visibility | Chưa có persisted APIs; notification channels là OPEN policy | Không giả vờ đã lưu server | CHƯA CÓ BACKEND |
| Xóa tài khoản | Chưa có verified request/retention workflow | Chưa mở xác nhận xóa thành công | CHƯA CÓ BACKEND |
| Favorites / saved search | Canonical freeze xếp advanced favorites vào FUTURE | No fake persistence | FUTURE |
| Help, điều khoản, Android ngôn ngữ/quyền thông báo | Nội dung local và device intents | Không nhất thiết có API | KHÔNG PHẢI GAP BACKEND |
| **Tab Sổ, kỳ thu, ledger finance** | Không kiểm tra trong lượt này | Không thay đổi | **EXCLUDED** |

## Live evidence

- Docker `backend` và `postgres` healthy. `GET /health` 200.
- `GET /listings/public` 200; valid geographic public search 200.
- `POST /identity-access/auth/challenge` LOGIN 201; verified response `success.data.purpose` và `success.data.nonce` present (không ghi token).
- Không Bearer: `GET /identity-access/me`, `GET /identity-access/profile`, `GET /messaging/conversations`, `GET /notifications`, `POST /audit-trust/reports` đều 401.
- `BackendRuntimeContractTest` PASS sau khi bỏ sự phụ thuộc kết quả nghiệp vụ vào Android Log trong JVM test.
- APK compile/install Debug PASS với `com.trooi.app`; SHA-1 đã đăng ký không đổi; ADB reverse `tcp:3101` tới local.
- **Chưa có** thử nghiệm E2E bằng hai tài khoản và listing/messaging/notification thực. Không gọi kiểm thử không thực hiện là PASS.

## Các sửa đổi đã thực hiện

1. Làm rõ Google-only Auth/Register khi backend thật, không cho form mật khẩu/OTP thiếu API giả vờ chạy.
2. Chuyển điểm vào chủ trọ của Profile backend thật sang Operator Workspace có Google reauthentication + Organization API.
3. Profile thật: tên hiển thị/avatar giữ API hiện hữu; không trình bày link/unlink Google hoặc sửa legal name, phone, address như đã hỗ trợ.
4. KYC hiển thị rõ backend **đã có các primitive OCR/CompreFace/S3/manual review**, nhưng **chưa có API, data persistence và policy duyệt hoàn chỉnh**; không thu thập CCCD hoặc báo xác minh giả.
5. Guard Android warning logs để không làm sai kết quả nghiệp vụ khi JVM Android Log không tồn tại.
6. Giữ nguyên phần Sổ/UI ledger đã làm trước đó; không đụng database hoặc OAuth client.

## Kiểm tra bổ sung KYC trên các nhánh và runtime

- Đã rà `feature/account-verification` (`f5bbebc`) và `integration/profile-identity-kyc-candidate` (`e5e6c6d`), thay vì chỉ nhìn module trong main. Tài liệu chính xác: `docs/implementation/account-verification/MVP-KYC-foundation.md` nói rõ backend primitives under test, **not an enabled production eKYC workflow**.
- Trong `main`: `src/integrations/compreface/compreface-verifier.ts`, `src/infrastructure/object-storage/private-s3-object-storage.adapter.ts` và `src/modules/identity-verification/domain/manual-verification.workflow.ts`; Android ML Kit OCR ở `features/profile/CitizenIdOcr.kt`. Phần CompreFace và workflow trùng feature branch; adapter S3 có thay đổi thêm ở main.
- PostgreSQL live `tro-oi` **không có** `identity_verifications` hoặc `media_objects`. Tài liệu schema vNext giữ cả hai trong `excludedTables`; migration hiện tại không tạo hai bảng này.
- Không có NestJS controller cho `verification/kyc` hoặc endpoint upload, check-status, reviewer decision trong `src`.
- Runtime backend: `COMPREFACE_ENABLED=false`, `OBJECT_STORAGE_ENABLED=false`. Chưa hề mở xác minh thật.
- Test primitives mới: **15 PASS, 0 FAIL** (`manual-verification.workflow`, `compreface-verifier`, `private-s3-object-storage`). Đây không phải chứng cứ KYC Android ↔ backend E2E đã PASS.

## Cổng nghiệm thu tiếp theo

1. Backend product/security phải chốt model/profile legal identity, OTP/step-up, KYC retention/deletion & reviewer authorization, privacy/notification preferences và verified account deletion trước khi mở các nút save.
2. Kiểm thử E2E với listing PUBLISHED, inquiry hợp lệ, 2 user được phân quyền, hội thoại và notification thật. Không tự seed `tro-oi`.
3. Kiểm thử thao tác tạo Organization qua fresh Google reauth bằng tài khoản được chủ sở hữu chọn; không tự tạo workspace.
4. Bản local này là Debug APK dùng backend thật, **chưa phải HTTPS + signed Release**.

Lệnh cài local:
```powershell
cd D:\Projects\TroOi-Project
docker compose up -d postgres backend
adb reverse tcp:3101 tcp:3101
.\gradlew.bat :app:installDebug -PtrooiApiBaseUrl=http://127.0.0.1:3101 --console=plain
adb shell am start -n com.trooi.app/.MainActivity
```
