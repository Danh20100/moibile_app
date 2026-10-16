# SePay isolated test lane

Luồng này dùng để kiểm tra Checkout, IPN và idempotency **tách khỏi database demo**. Trên repository hiện tại, mọi profile nằm trong [docker-compose.yml](../../docker-compose.yml), mọi biến local có mẫu ở [.env.example](../../.env.example).

## Chuẩn bị test database

Từ thư mục root:

```powershell
Copy-Item .env.example .env
# Trong .env: cung cấp TROOI_STANDALONE_DB_PASSWORD, SEPAY_ISOLATED_DB_PORT
docker compose --env-file .env --profile sepay-isolated up -d --no-deps sepay-postgres
```

Database mới có hostname host `127.0.0.1`, port từ `SEPAY_ISOLATED_DB_PORT` (mặc định 55459), tên `trooi_sepay_isolated`. Profile này **không** trỏ sang volume cũ của project `trooi-sepay-standalone`. Không xóa/recreate volume tài chính cũ.

Trước khi chạy migrations hoặc các script kiểm thử, **kiểm tra `DATABASE_URL` của process trỏ đúng DB test và không có dữ liệu nhận tiền thật**. Không chạy `db:reset`, `down -v`, hoặc seed demo trong finance DB. Những script trong thư mục này mang tính fixture/dev, không phải phương án Production.

## Kiểm tra gateway an toàn

- SePay Production chỉ được bật trên finance DB được phép; các giá trị merchant, secret và signing key vẫn ở private `.env`, không nằm trong code/APK.
- IPN cần `X-Secret-Key`, REST provider đối chiếu invoice, amount, transaction và settlement. Browser return không phải bằng chứng.
- Public route proxy: `node scripts/sepay-standalone/public-sepay-proxy.cjs` (chỉ chạy khi đã review môi trường port 3101/3102 và tunnel HTTPS).
- Allowlist test: `node --test scripts/sepay-standalone/public-sepay-proxy.test.cjs`.
- Ngăn duplicate: cùng một provider callback không được tạo thêm Payment.
- **Không tự tạo giao dịch ngân hàng thật** chỉ để chạy unit test.

Các thông tin về số tiền giao dịch/URL ngrok và các cổng cũ không phải default config của dự án. Xem [README chung](../../README.md) để thiết lập phiên bản hiện tại.
