-- ============================================================================
-- TrọƠi — PostgreSQL Schema
-- Nguồn: Mind map dự án (định vị SP, bề mặt SP, actors, core domains, EXE202,
--         GTM/pilot, roadmap) + Master Feature Map
-- Quy ước: bảng có ghi chú "-- [GĐ2]" hoặc "-- [GĐ3]" là mở rộng cho giai đoạn
--          sau, KHÔNG bắt buộc cho MVP nhưng được thiết kế sẵn để không phải
--          migrate lại toàn bộ schema khi lên giai đoạn tiếp theo.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";           -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";             -- tìm kiếm mờ (tên KH, địa chỉ)
CREATE EXTENSION IF NOT EXISTS "citext";              -- email không phân biệt hoa/thường

-- ============================================================================
-- 0. ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'admin',            -- Team TrọƠi
  'owner',            -- Chủ nhà (Payer)
  'operator',         -- Chủ trọ trực tiếp vận hành / người thân / nhân viên vận hành
  'tenant',           -- Người thuê
  'partner'           -- [GĐ2+] Điện/Nước/Điện lạnh/Khóa/Vệ sinh/Bảo trì
);

CREATE TYPE room_status AS ENUM (
  'vacant',           -- Trống
  'occupied',         -- Đang cho thuê
  'reserved',         -- Đã giữ chỗ
  'maintenance',      -- Đang bảo trì / không sẵn sàng
  'inactive'          -- Ngừng khai thác
);

CREATE TYPE tenancy_status AS ENUM (
  'active',
  'ended',
  'terminated_early'
);

CREATE TYPE charge_type AS ENUM (
  'rent',             -- Giá thuê
  'deposit',          -- Cọc
  'utility',          -- Điện/nước
  'service_fee',      -- Phụ phí dịch vụ
  'penalty',          -- Phạt trễ hạn
  'other'
);

CREATE TYPE invoice_status AS ENUM (
  'draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void'
);

CREATE TYPE payment_method AS ENUM (
  'cash', 'bank_transfer', 'in_app'   -- 'in_app' chỉ dùng thật ở [GĐ3]
);

CREATE TYPE incident_status AS ENUM (
  'open', 'in_progress', 'waiting_partner', 'resolved', 'closed', 'cancelled'
);

CREATE TYPE subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'cancelled', 'expired'
);

CREATE TYPE verification_status AS ENUM (
  'unverified', 'pending', 'verified', 'rejected'
);

-- ============================================================================
-- 1. ACTORS  (mind map: "Actors" — Payer / Operator / Tenant / Partner / Admin)
-- ============================================================================

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role                user_role NOT NULL,
  full_name           TEXT NOT NULL,
  phone               TEXT UNIQUE,                     -- Phone verification (EXE202 Trust)
  phone_verified_at   TIMESTAMPTZ,
  email               CITEXT UNIQUE,
  password_hash       TEXT,
  avatar_url          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at      TIMESTAMPTZ
);
CREATE INDEX idx_users_role ON users(role);

-- Một người thuê có thể không có tài khoản app (Tenant tối giản ở MVP)
CREATE TABLE tenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),        -- NULL nếu tenant chưa có account
  full_name           TEXT NOT NULL,
  phone               TEXT,
  id_number           TEXT,                             -- CCCD/CMND (tối giản, không lưu ảnh giấy tờ ở MVP)
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. PROPERTY & ROOM
-- ============================================================================

CREATE TABLE properties (                               -- Khu trọ / tài sản
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES users(id),   -- Payer: Chủ nhà
  operator_id         UUID REFERENCES users(id),            -- Operator vận hành chính
  name                TEXT NOT NULL,
  address             TEXT NOT NULL,
  ward                TEXT,
  district            TEXT,
  city                TEXT,                                  -- tách để lọc theo khu vực pilot
  total_rooms         INT NOT NULL DEFAULT 0,
  verification_status verification_status NOT NULL DEFAULT 'unverified', -- Basic owner/property verification
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_properties_owner ON properties(owner_id);
CREATE INDEX idx_properties_city  ON properties(city);

CREATE TABLE rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  code                TEXT NOT NULL,                     -- "P101"
  floor               TEXT,
  area_sqm            NUMERIC(6,2),
  status              room_status NOT NULL DEFAULT 'vacant',
  base_rent           NUMERIC(14,0),                      -- Giá thuê niêm yết (VND)
  base_deposit        NUMERIC(14,0),                      -- Cọc niêm yết
  attributes          JSONB NOT NULL DEFAULT '{}',         -- trường tự do: máy lạnh, số người tối đa...
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, code)
);
CREATE INDEX idx_rooms_property_status ON rooms(property_id, status);

-- Sổ vận hành thuê trọ theo từng phòng — "Hồ sơ vận hành phòng"
CREATE TABLE room_operational_records (
  room_id             UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  last_meter_electric NUMERIC(12,2),
  last_meter_water    NUMERIC(12,2),
  notes               TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lịch sử vận hành / thay đổi trạng thái phòng (append-only)
CREATE TABLE room_status_history (
  id                  BIGSERIAL PRIMARY KEY,
  room_id             UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  from_status         room_status,
  to_status           room_status NOT NULL,
  changed_by          UUID REFERENCES users(id),
  reason              TEXT,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_room_status_history_room ON room_status_history(room_id, changed_at DESC);

-- ============================================================================
-- 3. RENTAL LIFECYCLE  (Bắt đầu thuê -> ... -> Trả phòng)
-- ============================================================================

CREATE TABLE tenancies (                                 -- 1 hợp đồng thuê / vòng đời thuê 1 phòng
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES rooms(id),
  status              tenancy_status NOT NULL DEFAULT 'active',
  rent_amount         NUMERIC(14,0) NOT NULL,             -- Giá thuê áp dụng cho hợp đồng này
  deposit_amount      NUMERIC(14,0) NOT NULL DEFAULT 0,
  billing_cycle_days  INT NOT NULL DEFAULT 30,            -- chu kỳ thu tiền định kỳ
  start_date          DATE NOT NULL,
  end_date            DATE,                               -- NULL nếu đang hiệu lực
  moved_out_at        TIMESTAMPTZ,
  moved_out_reason    TEXT,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenancies_room ON tenancies(room_id, status);

CREATE TABLE tenancy_tenants (                            -- nhiều người thuê / phòng
  tenancy_id          UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  is_primary          BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (tenancy_id, tenant_id)
);

-- Ai là người chịu chi phí vận hành (Payer) cho hợp đồng — có thể khác owner
CREATE TABLE tenancy_payers (
  tenancy_id          UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  payer_user_id       UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (tenancy_id, payer_user_id)
);

-- ============================================================================
-- 4. FINANCE  (Charges / Billing cycles / Công nợ / Payment / Receipt)
-- ============================================================================

CREATE TABLE charge_definitions (                         -- danh mục phụ phí có thể tái sử dụng
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID REFERENCES properties(id),      -- NULL = mặc định toàn hệ thống
  type                charge_type NOT NULL,
  name                TEXT NOT NULL,
  unit                TEXT,                                -- "kWh", "m3", "tháng"...
  default_unit_price  NUMERIC(14,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE billing_cycles (                              -- 1 kỳ thu tiền của 1 tenancy
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id          UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  due_date            DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenancy_id, period_start)
);
CREATE INDEX idx_billing_cycles_due ON billing_cycles(due_date);

CREATE TABLE invoices (                                    -- hóa đơn phát sinh trong 1 kỳ
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_cycle_id    UUID NOT NULL REFERENCES billing_cycles(id) ON DELETE CASCADE,
  status              invoice_status NOT NULL DEFAULT 'draft',
  total_amount        NUMERIC(14,0) NOT NULL DEFAULT 0,
  paid_amount         NUMERIC(14,0) NOT NULL DEFAULT 0,
  issued_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TABLE invoice_items (
  id                  BIGSERIAL PRIMARY KEY,
  invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  charge_definition_id UUID REFERENCES charge_definitions(id),
  type                charge_type NOT NULL,
  description         TEXT,
  quantity            NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price          NUMERIC(14,2) NOT NULL,
  amount              NUMERIC(14,0) GENERATED ALWAYS AS (ROUND(quantity * unit_price)) STORED
);

CREATE TABLE payments (                                    -- Payment record
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID NOT NULL REFERENCES invoices(id),
  amount              NUMERIC(14,0) NOT NULL,
  method              payment_method NOT NULL DEFAULT 'cash',
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by         UUID REFERENCES users(id),           -- operator ghi nhận thu tiền
  external_ref        TEXT                                 -- [GĐ3] mã giao dịch cổng thanh toán
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);

CREATE TABLE receipts (                                     -- Receipt (biên nhận)
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          UUID NOT NULL REFERENCES payments(id),
  receipt_no          TEXT NOT NULL UNIQUE,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url             TEXT,
  is_system_generated BOOLEAN NOT NULL DEFAULT true         -- [GĐ3]: "system receipt" formal hơn
);

-- Công nợ: dùng VIEW thay vì bảng vật lý, tránh lệch dữ liệu với invoices/payments
CREATE VIEW v_tenancy_debt AS
SELECT
  t.id AS tenancy_id,
  t.room_id,
  COALESCE(SUM(i.total_amount - i.paid_amount) FILTER (WHERE i.status IN ('issued','partially_paid','overdue')), 0) AS outstanding_amount,
  MIN(bc.due_date) FILTER (WHERE i.status IN ('issued','partially_paid','overdue')) AS earliest_due_date
FROM tenancies t
JOIN billing_cycles bc ON bc.tenancy_id = t.id
JOIN invoices i ON i.billing_cycle_id = bc.id
GROUP BY t.id, t.room_id;

-- ============================================================================
-- 5. INCIDENT  (Sự cố / Ticket)
-- ============================================================================

CREATE TABLE incident_categories (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE               -- Điện, Nước, Khóa, Vệ sinh, Bảo trì...
);

CREATE TABLE incidents (                                   -- Ticket
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES rooms(id),
  reported_by         UUID REFERENCES users(id),           -- tenant hoặc operator
  category_id         INT REFERENCES incident_categories(id),
  title               TEXT NOT NULL,
  description         TEXT,
  status              incident_status NOT NULL DEFAULT 'open',
  assigned_partner_id UUID REFERENCES users(id),            -- [GĐ2+] Partner nhận xử lý
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ
);
CREATE INDEX idx_incidents_room_status ON incidents(room_id, status);

CREATE TABLE incident_attachments (
  id                  BIGSERIAL PRIMARY KEY,
  incident_id         UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  file_url            TEXT NOT NULL,
  uploaded_by         UUID REFERENCES users(id),
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incident_events (                              -- Event history (append-only timeline)
  id                  BIGSERIAL PRIMARY KEY,
  incident_id         UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  actor_id            UUID REFERENCES users(id),
  event_type          TEXT NOT NULL,                        -- 'status_changed','comment','assigned'...
  from_status         incident_status,
  to_status           incident_status,
  comment             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_events_incident ON incident_events(incident_id, created_at);

-- ============================================================================
-- 6. TRUST, LEGAL & PRIVACY (EXE202)
-- ============================================================================

CREATE TABLE verifications (                                -- phone / owner / property verification
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type        TEXT NOT NULL,                        -- 'user' | 'property'
  subject_id          UUID NOT NULL,
  method              TEXT NOT NULL,                         -- 'otp_phone','manual_review'...
  status              verification_status NOT NULL DEFAULT 'pending',
  reviewed_by         UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at         TIMESTAMPTZ
);

CREATE TABLE reports (                                       -- "Report thông tin sai"
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id         UUID REFERENCES users(id),
  subject_type        TEXT NOT NULL,
  subject_id          UUID NOT NULL,
  reason              TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open',           -- open/reviewed/dismissed
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (                                      -- Audit log (data minimization: chỉ log ID + action)
  id                  BIGSERIAL PRIMARY KEY,
  actor_id            UUID REFERENCES users(id),
  action              TEXT NOT NULL,
  entity_type         TEXT NOT NULL,
  entity_id           UUID,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ============================================================================
-- 7. ONBOARDING  (bulk creation / import / template / copy last month)
-- ============================================================================

CREATE TABLE import_batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID NOT NULL REFERENCES properties(id),
  uploaded_by         UUID REFERENCES users(id),
  source              TEXT NOT NULL,                          -- 'excel_csv','template','assisted'
  file_url            TEXT,
  row_count           INT,
  success_count       INT,
  error_count         INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. BUSINESS MODEL  (Subscription — doanh thu MVP)
-- ============================================================================

CREATE TABLE subscription_plans (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  price_per_month     NUMERIC(14,0) NOT NULL,
  max_rooms           INT,                                     -- giới hạn theo gói
  features            JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES users(id),
  plan_id             INT NOT NULL REFERENCES subscription_plans(id),
  status              subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start DATE NOT NULL,
  current_period_end   DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_owner ON subscriptions(owner_id, status);

-- ============================================================================
-- 9. [GĐ2+] PARTNER DOMAIN — discovery / verification / quotation
-- ============================================================================

CREATE TABLE partner_categories (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE                     -- Điện, Nước, Điện lạnh, Khóa, Vệ sinh, Bảo trì
);

CREATE TABLE partners (
  id                  UUID PRIMARY KEY REFERENCES users(id),
  category_id         INT REFERENCES partner_categories(id),
  service_area        TEXT,
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  rating_avg          NUMERIC(3,2)
);

CREATE TABLE partner_quotations (                              -- Quotation [GĐ2]
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id         UUID NOT NULL REFERENCES incidents(id),
  partner_id          UUID NOT NULL REFERENCES partners(id),
  amount              NUMERIC(14,0),
  note                TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',           -- pending/accepted/rejected
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 10. DASHBOARD SUPPORT — materialized view làm nguồn cache cho Redis
-- ============================================================================

-- Dùng 3 subquery độc lập (thay vì JOIN trực tiếp) để tránh nhân đôi số liệu
-- do fan-out giữa incidents và công nợ trên cùng property.
CREATE MATERIALIZED VIEW mv_property_dashboard AS
SELECT
  p.id AS property_id,
  room_counts.occupied_rooms,
  room_counts.vacant_rooms,
  room_counts.total_rooms,
  COALESCE(debt.total_debt, 0)          AS total_debt,
  COALESCE(inc.open_incidents, 0)       AS open_incidents
FROM properties p
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE r.status = 'occupied') AS occupied_rooms,
    COUNT(*) FILTER (WHERE r.status = 'vacant')   AS vacant_rooms,
    COUNT(*)                                      AS total_rooms
  FROM rooms r WHERE r.property_id = p.id
) room_counts ON true
LEFT JOIN LATERAL (
  SELECT SUM(d.outstanding_amount) AS total_debt
  FROM tenancies t
  JOIN rooms r2 ON r2.id = t.room_id
  JOIN v_tenancy_debt d ON d.tenancy_id = t.id
  WHERE r2.property_id = p.id AND t.status = 'active'
) debt ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS open_incidents
  FROM incidents i
  JOIN rooms r3 ON r3.id = i.room_id
  WHERE r3.property_id = p.id
    AND i.status NOT IN ('resolved','closed','cancelled')
) inc ON true;

CREATE UNIQUE INDEX idx_mv_property_dashboard ON mv_property_dashboard(property_id);
-- Refresh định kỳ (cron/job): REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_dashboard;
-- Redis sẽ cache kết quả của view này (xem redis-design.md) để dashboard load tức thời.
