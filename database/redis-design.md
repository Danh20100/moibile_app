# TrọƠi — Redis: vai trò & key design

Redis không thay PostgreSQL — Postgres vẫn là nguồn sự thật (source of truth)
cho mọi dữ liệu vận hành/tài chính. Redis chỉ dùng cho những việc PG làm chậm
hoặc không phù hợp: cache đọc nhanh, đếm/rate-limit, hàng đợi, real-time.

## 1. Cache Dashboard (Occupancy / Debt / Incidents / Operational summary)

Mind map liệt kê Dashboard là 1 domain riêng — đây là nơi Redis có giá trị
nhất vì dashboard bị đọc liên tục nhưng dữ liệu gốc (rooms, invoices,
incidents) thay đổi không liên tục.

- Key: `dash:property:{property_id}` → JSON hash của `mv_property_dashboard`
  (occupied_rooms, vacant_rooms, total_debt, open_incidents)
- TTL: 60–120s (đủ để chịu tải pilot 5–10 chủ trọ / 50–300 phòng), hoặc
- Invalidate chủ động: sau khi `payments`, `invoices`, `incidents`,
  `room_status_history` thay đổi → xoá key tương ứng + trigger
  `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_dashboard` (job nền).

```
SET dash:property:{id} '{"occupied":12,"vacant":3,"debt":4500000,"open_incidents":2}' EX 90
```

## 2. Công nợ theo tenancy (đọc nhiều — app tenant + app operator)

- Key: `debt:tenancy:{tenancy_id}` → số tiền nợ hiện tại
- Cập nhật (không TTL, cập nhật chủ động) mỗi khi có `payment` mới hoặc
  `invoice` mới phát sinh, thay vì query lại toàn bộ mỗi lần mở app.

## 3. Session / Auth

- Key: `session:{token}` → `{user_id, role}`, TTL theo phiên đăng nhập.
- Vì có nhiều role dùng chung 1 app (Owner/Operator/Tenant/Partner/Admin),
  lưu `role` ngay trong session để tránh query `users` mỗi request.

## 4. OTP / Phone verification (Trust — EXE202)

- Key: `otp:phone:{phone}` → mã OTP, TTL 5 phút.
- Key: `otp:attempts:{phone}` → đếm số lần thử sai, TTL 15 phút — chặn
  brute-force mà không cần ghi vào Postgres cho mỗi lần thử.

## 5. Rate limiting

- `report:rate:{user_id}` — giới hạn số lần gửi "Report thông tin sai"/phút,
  tránh spam report trong giai đoạn pilot.
- `incident:rate:{tenant_id}` — giới hạn tần suất tạo ticket trùng lặp.

## 6. Hàng đợi việc nền (Redis Streams hoặc List + BLPOP)

Các việc không cần đồng bộ ngay với người dùng, nên đẩy qua queue thay vì xử
lý trong request:

- `queue:invoice_generation` — sinh `billing_cycles` + `invoices` hàng loạt
  vào đầu chu kỳ cho tất cả tenancy active (job chạy theo lịch).
- `queue:import_batch` — xử lý file Excel/CSV từ `import_batches` (Onboarding
  bulk room creation) ở background, cập nhật `success_count`/`error_count`
  khi xong.
- `queue:notification` — nhắc thu tiền, cảnh báo công nợ, cập nhật trạng thái
  ticket (đẩy tới tenant/operator qua app/SMS).

## 7. Realtime cho Incident/Ticket (Sự cố)

- Redis Pub/Sub kênh `incident:{property_id}` — khi `incident_events` có
  record mới (status_changed/comment), publish để app operator/tenant nhận
  cập nhật realtime mà không cần polling Postgres liên tục.

## 8. Những gì KHÔNG nên để trong Redis

- Không lưu bản chính của `invoices`, `payments`, `receipts`, `audit_log` —
  đây là dữ liệu tài chính/pháp lý bắt buộc phải bền (durable) và có thể
  truy vấn/đối soát, nên chỉ ở Postgres.
- Không dùng Redis làm nơi lưu file đính kèm (`incident_attachments`) — chỉ
  lưu URL, file thật ở object storage (S3-compatible).

## 9. Theo giai đoạn (bám roadmap)

| Giai đoạn | Redis dùng thêm cho |
|---|---|
| MVP | Dashboard cache, debt cache, session, OTP |
| GĐ2 | Realtime ticket pub/sub, hàng đợi partner discovery/quotation |
| GĐ3 | Idempotency key cho in-app payment (`payment:idem:{ref}`), cache promoted listing, cache kết quả AI/OCR |
