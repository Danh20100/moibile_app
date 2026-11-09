# TrọƠi Listing Onboarder v4 — 4 accounts + 12 listings

**HƯỚNG DẪN ĐẦY ĐỦ CHO DUY ANH:** mở [RUNBOOK_DUY_ANH.md](RUNBOOK_DUY_ANH.md) trước khi chạy. Xem [CONFIG_REFERENCE.md](CONFIG_REFERENCE.md) để biết chính xác từng trường `metadata.json`.

Bộ công cụ dùng **4 email hợp lệ**, xác minh OTP nhập vào Terminal theo queue; 12 tin phòng (phân bổ 5–3–2–2), 40 ảnh PNG, 12 mô tả dài 4 đoạn và các tiện ích trong catalog của TrọƠi.

**Đã bổ sung:** `operatorIdentity` trong metadata cho ảnh **CCCD mặt trước/mặt sau + selfie của chính người vận hành**, đặt riêng ở `private_kyc/`, kiểm tra JPEG bằng `kyc-check` và gửi cho **duy nhất tài khoản thực sự thuộc chủ giấy tờ** bằng `kyc --execute` / `onboard --execute --with-kyc` sau khi xác nhận bằng Terminal. Backend chỉ trả `FACE_SIMILARITY_ONLY`, không phải xác minh CCCD chính thức. Tool không dùng giấy tờ ấy để xác minh bốn người khác nhau.

## Khởi động nhanh (PowerShell)

```powershell
cd D:\Projects\TroOi-Project\tools\trooi-listing-onboarder
py .\run.py validate
py .\run.py preview
```

Sau khi điền **đủ cả 4 account** trong `metadata.json` và đặt **password trong env** (xem Runbook):

```powershell
py .\run.py validate --strict
py .\run.py onboard                   # dry run
py .\run.py onboard --execute         # yêu cầu OTP thật, 4 account qua queue
py .\run.py kyc-check                # kiểm tra 3 JPEG KHÔNG gửi
py .\run.py kyc --execute            # chỉ chủ account được chỉ định, cần consent
```

Để khi chạy queue tự thực hiện thêm KYC của **đúng primary account**: `py .\run.py onboard --execute --with-kyc` (ảnh phải có trước khi chạy).

Để import bản nháp vào **PostgreSQL staging local riêng biệt**: xem mục 7 trong Runbook về `apply --execute` và các biến env DB/MinIO. **Không có lệnh production publish, fake KYC, fake payment hoặc cấp slot miễn phí giả.**

## Cảnh báo kỹ thuật và nội dung

- `onboard --execute` tạo/xác minh tài khoản hợp lệ và cập nhật profile; **không insert phòng**. `apply --execute` mới xử lý tuần tự tài khoản → phòng **DRAFT** (chỉ staging local).
- `output/onboarding_state.json` giúp resume, không chứa password/OTP/token; không commit output hoặc metadata có dữ liệu cá nhân lên Git.
- Tin và ảnh trong nguồn chưa được xác nhận là phòng đang có thật/được phép đăng; không xuất bản thành phòng khả dụng trên app production mà chưa xác minh. Không tự set KYC VERIFIED hay `owner_slot_entitlements` đã thanh toán.
- Kiểm tra trạng thái `STATIC PASS` riêng với `OTP/DB/KYC RUNTIME NOT RUN` nếu chưa chạy thật.
