# CONFIG REFERENCE — `metadata.json` (v4)

Tài liệu này giải thích cấu trúc cấu hình đã có trong package, để Duy Anh không phải đoán field khi sửa data. Xem `RUNBOOK_DUY_ANH.md` để biết trình tự chạy.

| Nhánh JSON | Giữ/sửa | Ghi chú |
|---|---|---|
| `version`, `seedId` | Giữ | ID phục vụ stable UUID/idempotency trong staging. Đổi khi thực sự tạo một bộ dữ liệu mới, không đổi tùy tiện sau import. |
| `environment.mode` | Giữ `staging` | `productionPublicationEnabled` phải `false` và `publicListingStatus` phải `DRAFT`. |
| `environment.apiBaseUrlEnv` | Giữ `TROOI_API_BASE_URL` | Trỏ đến NestJS App backend. Chỉ HTTPS hoặc localhost HTTP. |
| `environment.databaseUrlEnv` | Giữ `TROOI_STAGE_DATABASE_URL` | Chỉ local PostgreSQL staging; không tunnel tới production. |
| `registration` | Giữ | OTP được backend gửi; Terminal nhập thủ công, không tự xác nhận. |
| `assignment` | Giữ counts 5/3/2/2 | `properties[].ownerKey` là mapping tĩnh đã random theo seed. |
| `verificationPolicy` | Giữ | Không giả trạng thái xác thực; tách KYC thực của từng người. |
| `operatorIdentity` | Đặt đúng ảnh riêng và `primaryAccountKey` | Chỉ định **một tài khoản** của đúng người sở hữu CCCD/selfie. Không tự dùng ảnh để KYC 4 account. |
| `media` | Giữ trừ env/bucket riêng | 40 ảnh nguồn, lưu MinIO staging với `public_approved=false`. |
| `businessRules` | Giữ `false` cho payment/tenant/entitlement | Không tạo fake business metrics. |
| `accounts[]` | **Điền đủ 4 account** | Xem chi tiết dưới. |
| `properties[]` | Chỉnh khi có thông tin được xác minh | 12 property + room + listing, ảnh và provenance. |

## `accounts[]`

- `key`: `owner_a`, `owner_b`, `owner_c`, `owner_d` (không trùng).
- `listingCount`: 5/3/2/2 (trùng số phần tử trong `properties` theo `ownerKey`).
- `registration.method`: `EMAIL_OTP`.
- `registration.fullName`: 2–80 ký tự, họ tên thực do chủ tài khoản điền.
- `registration.phone`: `0` + 9–10 chữ số, dùng cập nhật profile sau OTP.
- `registration.email`: email riêng, hợp lệ và không trùng; cần có quyền đọc thư để nhập mã OTP.
- `registration.passwordEnv`: tên env chứa mật khẩu 8–128 ký tự.
- `registration.confirmPassword`: `MATCH_PASSWORD`, biểu thị validation form; không tạo thêm mật khẩu.
- `registration.acceptedTerms`, `acceptedPrivacyPolicy`: để `null` trong config; người có quyền xác nhận tương tác ở terminal.
- `registration.otp`: `delivery=EMAIL`, `verificationMode=TERMINAL_PROMPT`, `codeLength=6`.
- `profile.displayName`: tên có thể cập nhật sau tạo account, `phoneNumber`/`residentialAddress` thông tin hồ sơ, `avatarPath` hiện chưa upload tự động.
- `landlordOnboarding`: `fullName`, `birthDate`, tài liệu CCCD/selfie, `cardReviewed`, `kycProcessingConsent`, `kycStatus`, `contactConfirmed`. **Một số field chỉ để cấu hình/handoff, CLI chưa gọi API tương ứng**. CCCD tập trung trong `operatorIdentity` chỉ dành cho primary account.
- `runtime`: `userId` ban đầu null. Runtime thật đọc từ `output/onboarding_state.json`, không điền thủ công.

## `operatorIdentity` — 3 đường dẫn JPEG thật

```json
{
  "primaryAccountKey": "owner_a",
  "idFrontPath": "private_kyc/front.jpg",
  "idBackPath": "private_kyc/back.jpg",
  "selfiePath": "private_kyc/selfie.jpg",
  "consentVersion": "kyc-auto-v1",
  "submissionMode": "EXPLICIT_TERMINAL_CONSENT",
  "reuseAsIdentityForOtherAccounts": false,
  "assurance": "FACE_SIMILARITY_ONLY",
  "autoSetOfficialVerified": false
}
```

Cần giữ `reuseAsIdentityForOtherAccounts=false`. Nếu ảnh CCCD chỉ thuộc người vận hành nhưng 4 account là 4 người khác, chỉ gửi ảnh cho account của người vận hành thực sự. Ảnh không ship trong ZIP, không lưu base64 vào metadata, không đưa vào Git.

## `properties[]` — 12 mục hoàn chỉnh

Mỗi mục có:

```text
properties[i]
├── key, ownerKey
├── property: name, address, location (latitude, longitude, accuracy)
├── room: name, operationalState, recordLifecycle, maxOccupants
├── listing
│   ├── title
│   ├── description.paragraphs[]  # 4 đoạn tiếng Việt, >= 150 từ
│   ├── monthlyRent, provisionalRentFromSourcePackage
│   ├── deposit, provisionalDepositFromSourcePackage
│   ├── areaSquareMeters, assetType, bedrooms, bathrooms
│   ├── amenityIds[], highlights[], furnishing, rules[]
│   ├── electricityOffer, waterOffer, serviceOffer
│   ├── minimumTermMonths, availableFrom
│   ├── bathroomArrangement, floorLabel, status
│   └── photos[]: path, sha256, bytes, contentType, position
└── provenance
    ├── sourceDocument, originalListingIndex, sourceContactName, sourcePhone
    ├── ownershipAuthorized, mediaRightsConfirmed, availabilityConfirmed
    ├── priceConfirmed, areaConfirmed, depositConfirmed
    ├── addressConfirmed, locationConfirmed, amenitiesConfirmed
    └── evidenceReferences[]
```

`listing.amenityIds` chỉ chứa ID của catalog backend:

| ID | Nhãn hiển thị |
|---|---|
| `wifi` | Wi-Fi |
| `air_conditioning` | Máy lạnh |
| `washing_machine` | Máy giặt |
| `kitchen` | Khu bếp |
| `private_bathroom` | WC riêng |
| `balcony` | Ban công |
| `parking` | Chỗ để xe |
| `elevator` | Thang máy |
| `security_camera` | Camera an ninh |

`highlights` là các đặc điểm như gác lửng, duplex, gần trường; backend hiện **không có danh mục tag công khai riêng** cho nhóm này. `description.paragraphs[]` chỉ là nội dung cho người thuê đọc, không trộn giải thích kỹ thuật.

**Trạng thái ban đầu**: `listing.status=DRAFT`, ảnh chưa được `public_approved`. Điều này được kiểm tra ở CLI; không đổi sang `PUBLISHED` để ép tool ghi vào production.

## Giá và chứng cứ nguồn

Danh sách lấy từ ZIP cung cấp; có các giá/diện tích giả định hoặc ước lượng và **một tin số 11 chưa có giá nguồn xác thực**. Trường `monthlyRent=null` không nên được thay bằng giá đoán rồi đăng thật. `provisionalRentFromSourcePackage` chỉ dùng cho DRAFT staging.

Các trường `provenance.*Confirmed` và `ownershipAuthorized` là danh sách kiểm tra nội bộ. Chỉ đặt `true` khi có căn cứ thực tế; **việc đặt cờ true không thay thế kiểm tra danh tính/quyền sở hữu**.
