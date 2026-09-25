Bối cảnh:
Dự án TrọƠi (EXE101/EXE202) cần một thiết kế database chính thức làm nền
cho backend, dựa trên mind map định vị sản phẩm, actors, core domains,
onboarding/trust/business model và roadmap MVP → GĐ2 → GĐ3.

Thêm mới:

1. schema.sql
   - DDL PostgreSQL đầy đủ, chạy được ngay bằng psql hoặc pgAdmin
     (Query Tool > Execute Script).
   - Domain MVP: users (actors), properties, rooms, room_status_history, room_operational_records, tenancies, tenants, billing_cycles, invoices/invoice_items, payments, receipts, incidents/incident_events/ incident_attachments, verifications, reports, audit_log, import_batches, subscriptions.
   - Domain mở rộng [GĐ2+] tách riêng, không ảnh hưởng MVP: partners, partner_categories, partner_quotations.
   - Có sẵn view v_tenancy_debt (công nợ tính động, không lưu trùng dữ
     liệu) và materialized view mv_property_dashboard (phục vụ dashboard occupancy/debt/incidents).

2. redis-design.md
   - Vai trò Redis đi kèm Postgres: cache dashboard, cache công nợ, session/OTP (trust), rate limiting (report/ticket), hàng đợi (sinh hóa đơn hàng loạt, xử lý import Excel/CSV), pub/sub cho ticket realtime.
   - Có bảng liệt kê rõ dữ liệu nào KHÔNG được lưu ở Redis (invoices, payments, receipts, audit_log — bắt buộc bền ở Postgres).

3. trooi.dbml
   - File mô tả schema theo cú pháp DBML, dán vào dbdiagram.io để vẽ lại sơ đồ khi cần chỉnh sửa nhanh (không dùng để tạo database thật).

4. ERD 3 mức (ảnh PNG, render từ mermaid):
   - erd-1-conceptual.png: chỉ thực thể + quan hệ, không thuộc tính.
   - erd-2-logical.png: có thuộc tính, đánh dấu PK/FK, kiểu dữ liệu chung.
   - erd-3a-physical-core.png / erd-3b-physical-partner.png: đầy đủ kiểu dữ liệu PostgreSQL, enum, bảng trung gian — khớp 100% với schema.sql.

Cách dùng:
- Chạy schema.sql để tạo database thật (local hoặc Supabase).
- Xem redis-design.md trước khi implement cache/queue ở backend.
- Dùng ERD để đối chiếu khi review hoặc báo cáo môn học.
