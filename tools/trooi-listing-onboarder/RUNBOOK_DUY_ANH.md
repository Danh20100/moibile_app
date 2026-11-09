# RUNBOOK CHO DUY ANH — TrọƠi Listing Onboarder v4

> **Cách hiểu đúng**: ZIP này là một bộ công cụ CLI để chuẩn bị tài khoản hợp lệ và tạo **bản nháp** cho danh sách 12 phòng. Nó không tạo giấy tờ giả, không tự gắn KYC chính thức, không cấp slot giả, không làm giao dịch, và **không có lệnh xuất bản tin trên production**. Phải có quyền đối với nguồn tin, thông tin phòng và hình ảnh trước khi đăng ra công chúng.
>
> **Chưa chạy trên backend hoặc PostgreSQL thật** tại thời điểm bàn giao. Lệnh `validate`, `preview`, `onboard` khô và unit test đã chạy offline. `apply` cần môi trường staging phù hợp.

## 0. Kết quả Duy Anh cần có

- 4 cấu hình tài khoản `owner_a`, `owner_b`, `owner_c`, `owner_d`. Mỗi email thực và **có người sở hữu/điều khiển hộp thư**.
- 12 tin đã được chia **A:5, B:3, C:2, D:2**, tổng 40 ảnh và đủ mô tả dài, tag tiện ích chuẩn.
- Luồng nhập OTP ở Terminal: tại lượt A, Terminal hiện `OTP của <email>:`; điền 6 số được gửi thật qua email; hệ thống xác minh bằng API TrọƠi; sau đó thực hiện profile của account đó. `apply --execute` còn tạo các bản nháp tài sản/phòng/tin của account trước khi qua account kế tiếp.
- **Một bộ ảnh CCCD + selfie của đúng người vận hành** được cấu hình một lần tại `operatorIdentity`. Gửi KYC *chỉ cho tài khoản của chính người đó*, mặc định `owner_a`, sau khi có đồng ý rõ ràng; không dùng kết quả làm xác minh cho owner_b/c/d.
- Không có người thuê, không hóa đơn, không thanh toán, không doanh thu slot, không trạng thái KYC chính thức được tạo bởi tool.

## 1. Giải nén đúng vị trí

Giải nén **ZIP tại root repository `TroOi-Project`**, không giải nén tiếp trong thư mục `tools`:

```text
D:\Projects\TroOi-Project\
├── app\
├── src\
├── database\
├── tools\
│   └── trooi-listing-onboarder\
│       ├── metadata.json                  <- cấu hình trung tâm
│       ├── run.py                         <- CLI
│       ├── README.md
│       ├── RUNBOOK_DUY_ANH.md              <- file này
│       ├── CONFIG_REFERENCE.md            <- tra cứu từng field
│       ├── requirements.txt
│       ├── private_kyc\
│       │   └── PUT_IMAGES_HERE.txt         <- chưa có giấy tờ thật
│       ├── images\listing_01...listing_12\  <- 40 ảnh PNG
│       ├── tests\test_tool.py
│       └── output\                       <- tự sinh state/preview
└── package.json
```

Kiểm tra trong PowerShell:

```powershell
cd D:\Projects\TroOi-Project\tools\trooi-listing-onboarder
Get-ChildItem
py --version
```

Cần Python **3.10 trở lên**. Không cần Python package chỉ để `validate`, `preview`, `onboard` và `kyc`. `apply` mới cần PostgreSQL + S3 clients.

## 2. Nhập metadata.json — KHÔNG để trường đăng ký trống

Mở `metadata.json` bằng VS Code. Với **cả 4** phần tử trong `accounts`, sửa:

| Trường | Kiểu / yêu cầu | Ý nghĩa |
|---|---|---|
| `key` | Để nguyên `owner_a` đến `owner_d` | Khóa phân bổ 5–3–2–2 |
| `listingCount` | Giữ 5,3,2,2 | Không sửa trừ khi tái phân bổ toàn bộ |
| `registration.fullName` | Chuỗi, 2–80 ký tự | Họ tên thật của chủ tài khoản |
| `registration.phone` | `0` + 9–10 chữ số | SĐT hợp lệ của chủ tài khoản; Android coi là bắt buộc |
| `registration.email` | Email thực, mỗi tài khoản khác nhau | Nơi nhận mã OTP |
| `registration.passwordEnv` | **Tên** biến môi trường | Mật khẩu lưu trong terminal env, không ghi vào JSON |
| `registration.confirmPassword` | Giữ `MATCH_PASSWORD` | Kiểm tra hợp lệ đầu vào; backend không nhận confirmPassword |
| `registration.acceptedTerms`, `acceptedPrivacyPolicy` | `null` trong file | Người sử dụng chấp thuận tương tác ở Terminal, không tự động tick |
| `profile.displayName` | Tên hiển thị, có thể bằng họ tên | Backend chỉ cập nhật nếu khác tên đăng ký |
| `profile.phoneNumber` | Thông tin tham khảo | API contact dùng `registration.phone` khi cập nhật |
| `profile.residentialAddress` | `null` hoặc địa chỉ chính xác | Tuỳ chọn, tối đa 255 ký tự |
| `landlordOnboarding.fullName`, `birthDate` | Nếu chủ tài khoản cung cấp | Dữ liệu phục vụ onboarding, **không tự biến thành KYC** |
| `landlordOnboarding.cardReviewed`, `kycProcessingConsent` | Không gán mặc định `true` | Không được giả sự đồng ý hoặc kết quả kiểm tra |
| `runtime.userId` | Để `null` | Do API tạo; checkpoint tự quản lý |

**Lưu ý contract:** Android bắt buộc tên, điện thoại, email, mật khẩu, xác nhận mật khẩu và đồng ý điều khoản. Backend `/register/email/otp/request` hiện chỉ nhận `email`, `password`, `displayName`; tool hoàn thiện số điện thoại qua `/identity-access/profile/contact` sau xác minh OTP. OTP nhận `otpChallengeId` qua API rồi nhập 6 chữ số từ email.

**Cần sửa tài khoản trước khi chạy thực:**

```powershell
$env:TROOI_OWNER_A_PASSWORD = '<mat-khau-rieng-A-8-den-128-ky-tu>'
$env:TROOI_OWNER_B_PASSWORD = '<mat-khau-rieng-B-8-den-128-ky-tu>'
$env:TROOI_OWNER_C_PASSWORD = '<mat-khau-rieng-C-8-den-128-ky-tu>'
$env:TROOI_OWNER_D_PASSWORD = '<mat-khau-rieng-D-8-den-128-ky-tu>'
$env:TROOI_API_BASE_URL = 'https://<backend-THAT-cua-trooi>'
```

Giá trị `TROOI_API_BASE_URL` phải là **backend API thực** mà bạn có quyền sử dụng, *không phải* GitHub repo, trang Landing Page hay Admin React. Không dán password vào Slack/GitHub/ảnh chụp màn hình. Các biến `$env:` chỉ tồn tại trong phiên PowerShell hiện tại.

**Không ghi mã OTP, mật khẩu, session token hoặc ảnh CCCD vào metadata.json.**

## 3. Kiểm tra trước khi chạy

```powershell
py .\run.py validate
py .\run.py preview
py .\run.py validate --strict
py -m unittest discover -s tests -v
```

- `validate`: kiểm tra đủ 4 account/12 listing, cân bằng 5–3–2–2, mã tiện ích, mô tả trên 150 từ, 40 checksum ảnh, URL/path nội bộ. Có thể có **12 cảnh báo REVIEW** về thông tin chưa xác minh; đây không phải lỗi chương trình.
- `preview`: tạo `output/preview.md` + `preview.json`; xem nội dung sẽ vào tin đăng. **Không đồng nghĩa đã publish**.
- `validate --strict`: báo lỗi nếu chưa nhập đủ 4 email, họ tên, SĐT hoặc thiếu biến password. Chỉ chạy được sau bước 2.
- `unittest`: kiểm tra logic cục bộ, không gửi email, không tạo DB.

## 4. Queue OTP thực tế — chạy theo tài khoản

**Dry-run:**

```powershell
py .\run.py onboard
```

**Đăng ký thật (một account tại một thời điểm):**

```powershell
py .\run.py onboard --execute
```

Trình tự tại mỗi lượt:

1. Terminal hiện email đang chạy, hỏi xác nhận người chủ tài khoản đã đọc/đồng ý điều khoản. Người vận hành gõ `YES` **chỉ khi chủ tài khoản thực sự đồng ý**.
2. Tool gọi `POST /identity-access/register/email/otp/request`, backend gửi OTP tới email đó.
3. Terminal hiện `OTP của <email>:`. **Mở đúng hộp thư, lấy mã 6 chữ số và nhập vào terminal**; mã không lưu file.
4. Tool gọi `POST /identity-access/register/email/otp/verify` với `otpChallengeId` và OTP. Nếu thành công, backend trả `userId`, token phiên; tool chỉ lưu email, userId và thời điểm ở `output/onboarding_state.json` (KHÔNG lưu token).
5. Tool dùng session để gọi `PATCH /identity-access/profile/contact`. Sau đó sang tài khoản B/C/D.
6. `onboard` **không tạo room/listing**; để gắn draft room sau mỗi account trong queue cần `apply --execute` ở bước 7 (staging riêng).

Ví dụ tương tác:

```text
==== [1/4] owner_a -> 5 phòng ====
[owner_a] owner-a@domain.vn
Người có quyền sử dụng tài khoản đã đồng ý? Nhập YES để tiếp tục: YES
[OK] OTP đã yêu cầu gửi đến: owner-a@domain.vn
OTP của owner-a@domain.vn: ******
[OK] Đã tạo user: <uuid-do-backend-cap>
[OK] Đã cập nhật profile/contact qua API chính thức
... tiếp tục owner_b -> owner_c -> owner_d
```

**Nếu OTP hết hạn:** lệnh dừng, không lưu OTP. Đợi cooldown của hệ thống, chạy lại; nếu chưa có checkpoint cho account đang tạo thì sẽ yêu cầu OTP mới. Nếu email đã xác nhận trong lần chạy lỗi nhưng chưa kịp ghi checkpoint, tài khoản có thể đã tồn tại: kiểm tra backend, không cố tạo trùng; trong tình huống này phải xác minh `userId` với người phụ trách hệ thống trước khi khôi phục checkpoint.

**Nếu đã có checkpoint:** tool dùng endpoint `auth/password` và kiểm tra userId khớp, không tự đăng ký tài khoản trùng. Nếu cần đổi email, không sửa `metadata.json` đơn thuần: phải thực hiện luồng đổi email hợp lệ từ backend rồi đối chiếu checkpoint.

## 5. Ảnh CCCD/selfie — chỉ của người vận hành thật

Đặt **3 file JPEG thật** của đúng chủ tài khoản chỉ định trong:

```text
private_kyc/front.jpg   <- CCCD mặt trước
private_kyc/back.jpg    <- CCCD mặt sau cùng giấy tờ
private_kyc/selfie.jpg  <- selfie của chính người đó
```

`metadata.json` cấu hình **MỘT LẦN**, không cần lặp lại đường dẫn trong 4 account:

```json
"operatorIdentity": {
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

**Quan trọng:** `primaryAccountKey` chỉ được là account đăng ký bởi **người trùng với chủ CCCD/selfie**. Nếu giấy tờ là của người vận hành, nhưng `owner_a` khai là cá nhân khác, **không được gửi ảnh**. Dùng một bộ CCCD của một người để hiển thị 4 người khác nhau là đã KYC không được hỗ trợ. Nếu bốn account đều do một người thực sự vận hành, việc này cần được thể hiện đúng là cùng người điều hành, không phải 4 cá nhân độc lập.

Cách kiểm tra ảnh **offline**, không gửi đi:

```powershell
py .\run.py kyc-check
```

Mỗi ảnh phải là JPEG tối đa **1.500.000 bytes** và tối thiểu 100 bytes theo giới hạn backend hiện hành. File extension là `.jpg`, không dùng PNG giả dạng JPEG.

Sau khi tài khoản `owner_a` đã xác minh email qua OTP và có checkpoint:

```powershell
py .\run.py kyc                # dry-run, không gửi ảnh
py .\run.py kyc --execute      # gửi 3 ảnh của đúng owner_a sau consent
```

Terminal hiện rõ account/email/userId nhận ảnh và hỏi xác nhận `CONSENT OWNER_A`. Tool đăng nhập owner_a, xác nhận token có cùng `userId`, sau đó gọi `POST /identity-verification/auto-check` trên backend chính thức. Ảnh chỉ được gửi lúc submit, **không được viết vào database, output, checkpoint** bởi tool. Kết quả là `AUTO_CHECK_PASSED` hoặc `NEEDS_RETRY`, `assurance=FACE_SIMILARITY_ONLY`: đây **không phải** xác minh CCCD chính thức hay xác minh bốn account.

Muốn chạy queue gộp với kiểm tra ảnh của `owner_a` ngay sau OTP, trước khi qua chủ tiếp theo:

```powershell
py .\run.py onboard --execute --with-kyc
```

Có thể dùng `apply --execute --with-kyc` ở staging khi đã cấu hình đầy đủ bước 7. **Không chạy cả `kyc --execute` và `onboard --execute --with-kyc` liên tiếp nếu không cần**: backend giới hạn số lần kiểm tra/ngày.

**Quy tắc lưu trữ:** Thư mục `private_kyc/` và `metadata.json` nằm trong `.gitignore`; không đưa lên GitHub, không gộp ảnh giấy tờ vào ZIP giao người khác, không gửi qua chat. Duy Anh cần quyền truy cập riêng tư được chủ giấy tờ cho phép để vận hành, không cần giữ bản sao sau khi hoàn tất.

## 6. Khác biệt giữa onboarding và nhập phòng

| Lệnh | Gửi OTP | KYC | Ghi DB phòng | Công khai |
|---|---|---|---|---|
| `validate` / `preview` | Không | Không | Không | Không |
| `onboard` | Không | Không | Không | Không |
| `onboard --execute` | Có | Không | Không | Không |
| `onboard --execute --with-kyc` | Có | 1 account thật được chỉ định | Không | Không |
| `kyc-check` | Không | Kiểm ảnh offline | Không | Không |
| `kyc --execute` | Không | 1 account thật được chỉ định | Không | Không |
| `apply` | Không | Không | Không (dry-run) | Không |
| `apply --execute` | Có hoặc login lại | Không | **Có, staging DRAFT** | Không |
| `apply --execute --with-kyc` | Có hoặc login lại | 1 account thật | **Có, staging DRAFT** | Không |

## 7. Import các phòng DRAFT vào staging biệt lập (tuỳ chọn)

**Chỉ dùng nếu Duy Anh đã có local PostgreSQL TrọƠi chứa schema migration và MinIO local riêng biệt.** `apply` từ chối remote host/production và từ chối DB name khác `trooi_dev`, `trooi_test`, `trooi_demo`. **Không dùng localhost tunnel đến production.**

```powershell
py -m pip install -r .\requirements.txt
$env:TROOI_API_BASE_URL = 'http://127.0.0.1:3000'             # ĐIỀN CỔNG BACKEND LOCAL THỰC TẾ
$env:TROOI_STAGE_DATABASE_URL = 'postgresql://<user>:<pass>@127.0.0.1:5432/trooi_dev'
$env:TROOI_STAGE_MEDIA_ENDPOINT = 'http://127.0.0.1:9000'
$env:TROOI_STAGE_MEDIA_BUCKET = 'trooi-demo-university'
$env:TROOI_STAGE_MEDIA_ACCESS_KEY = '<local-key>'
$env:TROOI_STAGE_MEDIA_SECRET_KEY = '<local-secret>'

py .\run.py apply               # chỉ mô phỏng lệnh
py .\run.py apply --execute     # phải gõ STAGING để xác nhận
```

**Cảnh báo port**: `3000`, `5432`, `9000` chỉ là ví dụ. Dùng đúng cấu hình local đang chạy. Các tên biến môi trường này lấy từ `metadata.json`, không hardcode credentials vào file.

`apply` chạy **Account A (OTP/login → profile → 5 DRAFT) → B (3 DRAFT) → C (2 DRAFT) → D (2 DRAFT)**. Nó kiểm tra email đã xác nhận trong đúng DB trước khi tạo organization/property/room/listing. Ảnh được đưa lên MinIO local, các ảnh có `public_approved=false`; listing có status `DRAFT`. Không sửa schema, không ghi bất cứ bảng KYC, slot, thanh toán, người thuê nào.

Một owner mặc định có 1 phòng miễn phí trong API app, các room thêm cần quyền quản lý hợp lệ. Import trực tiếp qua SQL trên staging chỉ là fixture, **không cấp thêm quota hợp lệ trên App production**. Đừng nhầm `apply` là lệnh tạo slot miễn phí được công nhận trên sản phẩm thật.

## 8. Xem và đối soát từng phòng

Mở `output/preview.md`, hoặc trong `metadata.json` xem `properties[]`:

- `ownerKey`: tài khoản quản lý đã phân bổ theo thứ tự 5/3/2/2.
- `property`: tên tài sản, địa chỉ, tọa độ/độ chính xác.
- `room`: tên phòng, `VACANT`, số người.
- `listing.title`, `description.paragraphs`: nội dung người tìm thuê đọc; không nhúng thuật ngữ kỹ thuật như `seed`, `dev`, `mock` trong lời giới thiệu.
- `listing.monthlyRent`, `deposit`, `provisionalRentFromSourcePackage`: giá nguồn; tin 11 chưa có giá được xác minh.
- `listing.amenityIds`: **chỉ** ID thuộc 9 tiện ích backend: `wifi`, `air_conditioning`, `washing_machine`, `kitchen`, `private_bathroom`, `balcony`, `parking`, `elevator`, `security_camera`.
- `listing.highlights`: đặc điểm không thuộc danh mục tiện ích cố định, ví dụ gác lửng/duplex; hiện chưa có field riêng trong DB, tool dùng nội dung mô tả.
- `listing.photos`: 3–4 ảnh/tin, tổng 40, sha256 chống tráo ảnh.
- `provenance`: trường nào có chứng cứ, giấy phép hình ảnh, tính sẵn có. **Đây là phần nội bộ và không được chèn vào `public_description`.**

**Khi chưa có nguồn tin được xác thực, không đưa tin DRAFT thành PUBLISHED.** Những trường không xác định phải hỏi bên sở hữu, không tự bịa giá điện/nước, cọc, diện tích hoặc trạng thái phòng còn trống.

## 9. Resume / checkpoint / rollback

`output/onboarding_state.json` lưu `seedId`, account key, email, userId đã xác minh, thời gian. `output/preview.*` chứa dữ liệu phòng để review. `.gitignore` bảo vệ toàn bộ `output/`.

- Nếu tool lỗi khi xử lý owner C, **không xóa state ngay**; giải quyết lỗi và chạy lại. A/B sẽ được login bằng mật khẩu thay vì gửi lại OTP; staging import đã checkpoint sẽ bỏ qua.
- Nếu một account đã xác minh trong backend nhưng checkpoint bị mất, **không tự ghép userId tùy ý**. Người quản trị backend phải kiểm tra mapping thực trước khi khôi phục.
- Nếu thay email hoặc chuyển chủ sở hữu của property đã import, phải kiểm toán và xử lý dữ liệu trước, không dựa vào `ON CONFLICT DO NOTHING` để âm thầm đổi chủ.
- Không có lệnh `rollback` tự động đối với dữ liệu thật. Trên staging, backup và xác định những ID do seed tạo trước khi dọn; không xóa hàng loạt dữ liệu không thuộc seed.
- Không lưu refresh token, OTP, mật khẩu trong log/state.

## 10. Troubleshooting cho Duy Anh

| Hiện tượng | Nguyên nhân thường gặp | Xử lý |
|---|---|---|
| `validate --strict` báo thiếu email/phone | Chưa điền `accounts[].registration` | Điền đúng từng account trong metadata |
| Thiếu biến `TROOI_OWNER_*_PASSWORD` | Chưa export trong PowerShell hiện tại | Set 4 biến và chạy lại trong cùng terminal |
| `403/401` khi cập nhật profile | Session hoặc password chưa hợp lệ | Kiểm tra endpoint login, tài khoản và môi trường backend |
| Không thấy OTP trong inbox | SMTP, spam, cooldown, email sai | Xem log backend và hộp thư chủ tài khoản; không đoán mã |
| `OTP_INVALID` / `OTP_EXPIRED` | Sai mã/nhập trễ | Yêu cầu mã mới sau cooldown; không ép DB xác minh |
| `EMAIL_ALREADY_REGISTERED` | Email đã được đăng ký trước | Không dùng email mới để né lỗi; kiểm tra tài khoản và checkpoint |
| `kyc-check` thiếu file | Chưa đặt JPEG ở `private_kyc/` | Đặt `front.jpg`, `back.jpg`, `selfie.jpg`, xác nhận quyền sử dụng |
| KYC trả `NEEDS_RETRY` | So khớp không đủ | Chủ giấy tờ chụp lại ảnh phù hợp, đừng tự set passed |
| KYC trả 429 | Quá giới hạn | Dừng và tuân thủ giới hạn hệ thống |
| `apply` từ chối DB host | Không phải localhost | Không bypass bảo vệ; chỉ dùng PostgreSQL local staging độc lập |
| `apply` từ chối bucket | Không có MinIO hoặc bucket không đúng | Tạo bucket riêng `trooi-demo-*` trên localhost |
| Room thiếu do quota | App giới hạn 1 slot miễn phí/tài khoản | Cần quy trình cấp quyền bổ sung hợp lệ, không giả provider payment |
| Tin không thấy ngoài tìm kiếm | Tin là `DRAFT` và ảnh chưa public approve | Đúng thiết kế staging; chưa được publish |
| Hình ảnh không hiển thị | MinIO/object key/public flag | Kiểm tra bucket, key, quyền xem ảnh; không sửa public flag trên môi trường không xác minh |

## 11. Ranh giới production và bàn giao cuối

Để đăng 12 tin thật trên app cho người dùng, cần thông tin phòng có thực, quyền đăng của chủ tài sản/người đại diện, tính chính xác địa chỉ, giá/điện/nước, ảnh có quyền sử dụng, trạng thái còn trống, KYC đúng chủ thể, và quyền quota quản lý phòng được cấp hợp lệ. **Công cụ này chưa được phép tự công khai hoặc gắn KYC cho người khác**.

Duy Anh bàn giao kết quả bằng checklist:

- [ ] `validate`: 0 ERROR; báo số `REVIEW` thực tế.
- [ ] `preview`: đúng 12 tin và 40 ảnh, mô tả dài, tag/ảnh đúng.
- [ ] `validate --strict`: PASS sau khi nhập 4 account hợp lệ và env mật khẩu.
- [ ] Từng OTP được người sở hữu hộp thư xác nhận; 4 `userId` là backend-issued.
- [ ] KYC của **đúng một chủ thể** (nếu có đồng ý): ghi trạng thái `FACE_SIMILARITY_ONLY`, không gọi là KYC chính thức.
- [ ] `apply --execute` chạy trên staging riêng (nếu áp dụng); DB migration có sẵn, không sửa schema.
- [ ] Kiểm tra 5–3–2–2 DRAFT, 40 ảnh không public-approved, 0 tenancy/payment/entitlement mới.
- [ ] Không commit `metadata.json`, `private_kyc`, `output`, `.env`, password/token lên GitHub.
- [ ] Ghi rõ phần nào STATIC PASS, phần nào OTP/DB/KYC RUNTIME NOT RUN hoặc FAILED, và blocker còn lại.

**Không chạy lệnh production ngầm. Mọi thao tác ghi cần lệnh `--execute` và sự chấp thuận của người có quyền.**
