# Database Schema Scope Review — TrọƠi

Status: **BLOCKING REVIEW — schema/ERD chưa được xem là canonical cho tới khi các mục Critical/High bên dưới được xử lý**

Applies to: `database/schema-foundations`

## 1. Mục tiêu tài liệu

Tài liệu này ghi lại các sai lệch cần sửa trong ERD/DBML/SQL của nhánh database để phù hợp với scope sản phẩm và kiến trúc backend hiện tại của TrọƠi.

Đây **không phải schema mới** và không tự thêm requirement mới. Nó là review contract để người làm database biết:

- phần nào đang đúng và có thể giữ;
- phần nào đang sai ownership/cardinality/lifecycle;
- phần nào phải thêm vì đã thuộc MVP scope;
- phần nào phải defer vì thuộc Phase 2/3;
- điều kiện nào phải đạt trước khi database branch được xem là sẵn sàng merge.

## 2. Review basis — đánh giá theo từng góc nhìn và use case

Database không được đánh giá chỉ theo kiểu "có bảng hay chưa". Mỗi phần được kiểm tra theo actor, capability, lifecycle và ownership của state.

| Góc nhìn | Capability cần được data model hỗ trợ |
| --- | --- |
| Payer / Owner | organization scope, property/room portfolio, subscription, dashboard, receivable/debt |
| Operator | room operation, tenancy, billing, receipt/payment record, incident handling, onboarding/import |
| Tenant User | xem rental context được phép, payment/receipt record, báo sự cố, xem trạng thái/lịch sử |
| Prospective Tenant | listing, discovery, map, saved listing, viewing appointment |
| Future Service Partner | chỉ Phase 2+, tiêu thụ incident demand qua controlled flow; không phải MVP core |
| Admin / Trust | verification, report, audit/history |
| System / Data Integrity | access scope, lifecycle, cardinality, financial invariants, historical record |

Các end-to-end flow cần dùng để cross-check schema gồm:

1. Authenticate an Actor.
2. Set Up a Rental Operation.
3. Start a Tenancy.
4. Track a Monthly Receivable and Payment Record.
5. Report and Resolve an Incident.
6. View an Operational Dashboard.
7. Tenant Operational Interaction.
8. Publish or Discover a Room.
9. Future Controlled Service Partner Connection — **không phải MVP core**.

## 3. Product scope mà database phải bảo vệ

### 3.1 Core positioning

TrọƠi là **sổ vận hành thuê trọ theo từng phòng/tài sản**, tập trung vào post-rental operations.

Core chain hiện tại:

```text
Organization → Property → Room → Tenancy → Billing → Receipt
```

Các capability hỗ trợ nhưng không được chiếm ownership của core chain:

```text
identity-access
incident
listing
onboarding
subscription
audit-trust
```

### 3.2 MVP

MVP cần support:

- organization/operating scope;
- property và room operational profile;
- tenant context cần thiết;
- tenancy lifecycle;
- giá thuê, tiền cọc, recurring charges/phụ phí;
- receivable/debt theo kỳ;
- payment record/receipt phục vụ đối chiếu;
- incident/ticket + attachment + history;
- dashboard read model cơ bản;
- tenant interaction tối giản;
- onboarding bằng template/bulk/CSV-Excel khi phù hợp;
- audit/history cho business fact quan trọng;
- subscription từ phía payer/operation.

### 3.3 Supporting surface

Các feature sau được phép tồn tại nhưng **không được định nghĩa lại core domain**:

- listing;
- discovery/search;
- map;
- saved listing;
- viewing appointment.

### 3.4 Không phải MVP core

Không được hard-code thành dependency bắt buộc của MVP:

- marketplace partner mở;
- partner matching đầy đủ;
- partner quotation như requirement bắt buộc của core incident flow;
- in-app payment/settlement hoàn chỉnh;
- AI/OCR bắt buộc;
- public rating mặc định;
- legal/dispute adjudication.

## 4. Source-of-truth rule

Hiện tại không được chấp nhận tình trạng:

```text
Draw.io ≠ DBML ≠ schema.sql ≠ backend domain contract
```

Thứ tự authority cần tuân theo:

```text
Project/Product Context
        ↓
End-to-End Use Cases
        ↓
Bounded-context ownership + invariants
        ↓
ERD LV1 — Conceptual
        ↓
ERD LV2 — Logical
        ↓
ERD LV3 — Detailed/Physical candidate
        ↓
DBML / schema.sql / migrations
```

Nếu hai tầng phía trên mâu thuẫn, **không được tự chọn một interpretation ở tầng database**.

## 5. Merge blockers hiện tại

### DB-01 — Thiếu `Organization` [CRITICAL]

**Hiện tại:** model lấy `USER → PROPERTY` làm trục chính.

**Vấn đề:** operating scope của TrọƠi là organization-level. Một người có thể tham gia nhiều operation khác nhau và giữ role khác nhau theo từng scope.

**Required direction:**

```text
USER
  ↓
ORGANIZATION_MEMBERSHIP
  ↓
ORGANIZATION
  ↓
PROPERTY
```

`Organization` là scope cao nhất cho entitlement và vận hành; `Property` thuộc organization.

---

### DB-02 — `USER.role` single-role không đủ [CRITICAL]

**Hiện tại:** `USER.role` / `users.role` được dùng như business role authority.

**Vấn đề:** một người thật có thể đồng thời là payer và operator, hoặc là operator ở nhiều organization/property khác nhau.

**Không dùng:**

```text
USER.role = owner | operator | tenant | partner | admin
```

làm source of truth duy nhất.

**Required direction:** role theo relationship/scope, ví dụ:

```text
ORGANIZATION_MEMBERSHIP
- organization_id
- user_id
- role
- status
```

Identity/account type có thể tồn tại riêng, nhưng không được thay thế business membership.

---

### DB-03 — `PROPERTY.owner_id` + `operator_id` đóng cứng access model [CRITICAL]

**Hiện tại:** property gắn trực tiếp một owner và một operator.

**Vấn đề:** không biểu diễn tốt co-owner, manager, staff, owner tự vận hành, operator nhiều property hoặc chuyển giao quyền vận hành.

**Required direction:** property thuộc `Organization`; quyền thao tác được resolve qua membership/access policy thay vì hai FK singleton.

---

### DB-04 — Subscription gắn `owner_id` thay vì operating scope [CRITICAL]

**Hiện tại:** subscription gắn user/owner.

**Vấn đề:** entitlement áp dụng cho operation gồm nhiều property/room/operator, không phải chỉ cho một account cá nhân.

**Required direction:** subscription gắn `organization_id` hoặc product-account scope đã được architecture xác nhận.

---

### DB-05 — `ROOM` đang bị trộn operational state với public listing [CRITICAL]

**Hiện tại:** room chứa/được dùng trực tiếp cho public price/status/image/amenity, saved room và appointment.

**Vấn đề:** `Room` và `Listing` có lifecycle khác nhau.

Ví dụ:

```text
Room operational state:
vacant | occupied | maintenance | inactive

Listing publish state:
draft | published | paused | unpublished | expired
```

Một room có thể tồn tại và vận hành mà không có public listing.

**Required direction:**

```text
PROPERTY
  ↓
ROOM
  ├── TENANCY
  ├── INCIDENT
  └── LISTING
        ├── LISTING_IMAGE
        ├── LISTING_AMENITY
        ├── SAVED_LISTING
        └── VIEWING_APPOINTMENT
```

`SAVED_ROOM` và appointment/discovery relation phải được review để chuyển sang listing boundary khi chúng là public-surface behavior.

---

### DB-06 — Tenancy chỉ support một tenant [HIGH]

**Hiện tại:** các ERD dùng `tenant_id` trực tiếp trong tenancy; SQL/DBML ở nhánh lại có cách model khác.

**Vấn đề:** một tenancy có thể có primary tenant + occupants hoặc nhiều tenant participant.

**Required direction:**

```text
TENANCY
  ↓
TENANCY_PARTICIPANT
  ├── tenant/user reference
  └── participant role
```

Cardinality giữa LV1/LV2/LV3/DBML/SQL phải thống nhất.

---

### DB-07 — Billing đang duplicate mutable financial truth [CRITICAL]

Không được để các field có thể tự lệch nhau mà DB vẫn hợp lệ.

Ví dụ nguy hiểm:

```text
billing_cycle.paid_amount != SUM(payment.amount)
receipt.total_amount != payment.amount
billing_cycle.total_amount != SUM(charge.amount)
```

**Required direction:**

```text
TENANCY
  ↓
BILLING_CYCLE / RECEIVABLE
  ↓
CHARGE
  ↓
PAYMENT_RECORD
  ↓
RECEIPT
```

- charge là line item thay vì fixed column `electricity_amount`, `water_amount`, `service_amount`, ...;
- amount aggregate nên derive khi hợp lý;
- nếu denormalize vì performance thì phải có invariant/transactional rule rõ ràng;
- receipt không được duplicate amount nếu không có semantic riêng.

---

### DB-08 — Utility billing thiếu dữ liệu đối chiếu [HIGH]

Chỉ lưu `electricity_amount` / `water_amount` là chưa đủ cho operational record.

Cần xem xét snapshot theo kỳ:

```text
meter_start
meter_end
quantity
unit_price_snapshot
amount
```

hoặc model tương đương.

Mục tiêu: cả operator và tenant có thể giải thích được "khoản này được tính từ đâu".

---

### DB-09 — Thiếu history/audit ở core lifecycle [CRITICAL]

Sản phẩm là operational record nên không thể chỉ giữ current state.

Cần review tối thiểu:

- room status/history;
- tenancy lifecycle transitions hoặc business events cần truy vết;
- incident event timeline;
- receipt/payment confirmation history khi flow yêu cầu;
- audit event cho business fact quan trọng.

`TICKET_HISTORY` hiện tại là hướng đúng nhưng chưa đủ để thay toàn bộ audit/history requirement.

---

### DB-10 — Incident history cần event semantics rõ hơn [HIGH]

Chỉ lưu `status`, `changed_by`, `changed_at`, `note` sẽ yếu khi cần reconstruct timeline.

Nên hướng tới append-only event semantic như:

```text
INCIDENT_EVENT
- incident_id
- actor_id
- event_type
- from_status
- to_status
- comment/metadata
- created_at
```

Incident tiếp tục sở hữu incident lifecycle; không được biến thành partner marketplace.

---

### DB-11 — Partner Phase 2/3 đang được thiết kế quá sâu vào core [HIGH]

`partner`, `partner_quotation`, `assigned_partner_id`, `waiting_partner` có thể là future design, nhưng không được làm core schema phụ thuộc vào partner marketplace khi scope này chưa được chốt ở MVP.

**MVP rule:** incident phải chạy được hoàn chỉnh khi chủ trọ/operator tự xử lý hoặc dùng service bên ngoài hệ thống.

Future partner layer chỉ tiêu thụ incident demand/reference qua controlled boundary.

---

### DB-12 — Thiếu onboarding/import state [HIGH]

MVP có template/bulk input/CSV-Excel.

Không nhất thiết onboarding sở hữu property/room data, nhưng nếu import là async/batch cần xem xét persistence cho:

```text
IMPORT_BATCH
IMPORT_RESULT / ROW_ERROR (nếu cần)
```

Onboarding chỉ orchestrate; sau khi confirmed, destination domain sở hữu data.

---

### DB-13 — Thiếu Trust/Verification/Report/Audit layer [HIGH]

Cần data model cho các capability đã thuộc trust scope, tối thiểu ở mức cần thiết:

- verification status/history;
- report thông tin sai;
- audit business fact;
- actor reference + timestamp + reason/metadata phù hợp.

Không xây public reputation/rating system như mặc định MVP.

---

### DB-14 — Authentication/Profile/Business role đang bị trộn [HIGH]

Không ép mọi authenticated user phải có local password hoặc fabricated business profile.

Database phải cho phép external identity/auth integration mà không biến `password_hash NOT NULL` thành dependency bắt buộc của mọi actor.

Identity/access, profile presentation và business membership cần được phân biệt về responsibility.

---

### DB-15 — Map/location support chưa đủ [MEDIUM]

Nếu listing/discovery/map được triển khai, chỉ `address`/`district` là chưa đủ cho map projection.

Cần xác định location model phù hợp, ví dụ latitude/longitude hoặc geospatial representation. Không mặc định PostGIS nếu chưa có requirement truy vấn spatial nâng cao.

---

### DB-16 — LV1/LV2/LV3 và SQL đang không đồng nhất [CRITICAL]

Các artifacts hiện tại không mô tả cùng một model.

Ví dụ SQL/DBML có nhiều entity không xuất hiện trong 3 ERD, trong khi ERD có discovery entities không được phản ánh tương đương trong SQL.

Trước khi implementation tiếp tục phải chọn **một canonical model** và propagate xuống toàn bộ artifacts.

## 6. Financial and lifecycle invariants cần được định nghĩa trước physical schema

Tối thiểu cần quyết định và encode ở domain/database layer phù hợp:

```text
amount >= 0
quantity >= 0
period_start <= period_end
start_date <= end_date (khi end_date tồn tại)
```

Cần quyết định rõ:

- một room có được có nhiều active tenancy cùng lúc không;
- một billing cycle được identify theo calendar period như thế nào;
- charge có được sửa sau khi cycle issued không;
- payment record được void/reverse như thế nào;
- receipt cardinality với payment là `1:1`, `1:0..1` hay loại khác;
- financial correction dùng update-in-place hay append/reversal event;
- money aggregate nào là derived, projection hay authoritative state.

Không dùng fixed `billing_cycle_days = 30` để đại diện monthly calendar billing.

## 7. Keep / Rework / Add / Defer

| Nhóm | Thành phần | Hành động |
| --- | --- | --- |
| KEEP | Property → Room concept | Giữ, nhưng Property phải thuộc Organization |
| KEEP | Room → Tenancy concept | Giữ sau khi làm rõ active-tenancy invariant |
| KEEP | Incident Category / Ticket / Attachment | Giữ và tăng event/history semantics |
| KEEP | Junction table cho M:N | Giữ pattern relational |
| REWORK | User role | Chuyển sang scoped membership/access |
| REWORK | Property owner/operator FK | Thay bằng organization + membership/access |
| REWORK | Subscription owner FK | Gắn operating/product scope |
| REWORK | Room public discovery data | Tách Listing projection |
| REWORK | Saved Room / Appointment | Gắn Listing nếu là discovery behavior |
| REWORK | Tenancy tenant FK | Chuyển participant relation |
| REWORK | Billing fixed columns/aggregates | Chuyển charge-based model + invariants |
| ADD | Organization | MVP core |
| ADD | Organization Membership | MVP core/access scope |
| ADD | Listing | Supporting surface nhưng boundary riêng |
| ADD | Operational history / Audit | MVP operational record |
| ADD | Utility usage snapshot | Khi utility được tính/đối chiếu theo kỳ |
| ADD | Onboarding import state | Khi import/bulk flow cần persistence |
| ADD | Verification / Report | Trust scope |
| DEFER | Full partner marketplace | Phase 2/3 |
| DEFER | Partner quotation/take-rate | Chỉ khi scope future được phê duyệt |
| DEFER | Full in-app settlement | Phase 3 |
| DEFER | AI/OCR dependency | Roadmap |

## 8. Target conceptual direction

Đây là **direction**, không phải physical schema đã chốt:

```text
USER / IDENTITY
      │
      ▼
ORGANIZATION_MEMBERSHIP
      │
      ▼
ORGANIZATION ─────────────── SUBSCRIPTION
      │
      ▼
PROPERTY
      │
      ▼
ROOM
 ├────────────── TENANCY
 │                  │
 │                  ▼
 │              BILLING_CYCLE
 │                  │
 │                  ▼
 │                CHARGE
 │                  │
 │                  ▼
 │            PAYMENT_RECORD
 │                  │
 │                  ▼
 │               RECEIPT
 │
 ├────────────── INCIDENT
 │                  │
 │                  ▼
 │            INCIDENT_EVENT
 │
 └────────────── LISTING
                    ├── LISTING_IMAGE
                    ├── LISTING_AMENITY
                    ├── SAVED_LISTING
                    └── VIEWING_APPOINTMENT
```

Cross-cutting:

```text
AUDIT / TRUST
ONBOARDING
IDENTITY / ACCESS
```

Future service partner layer không được đặt vào core chain của MVP.

## 9. Quy ước cho ERD artifacts

Source `.drawio` phải được lưu trong:

```text
docs/database/erd/
```

Quy ước file:

```text
TroOi_ERD_LV1_TongQuan.drawio
TroOi_ERD_LV2_LogicDB.drawio
TroOi_ERD_LV3_ChiTiet.drawio
```

Vai trò:

- **LV1**: conceptual entities + business cardinality, không sa vào datatype.
- **LV2**: logical model, resolve M:N, ownership và relation rõ ràng.
- **LV3**: detailed/physical candidate, thêm datatype/constraint/index/delete policy sau khi LV1/LV2 đã đúng.

PNG/SVG export chỉ là view artifact; `.drawio` mới là editable source của diagram.

## 10. Definition of Done trước khi schema được xem là canonical

- [ ] `Organization` + scoped membership/access đã được model.
- [ ] Single `USER.role` không còn là business-role authority duy nhất.
- [ ] Property ownership/access không còn bị giới hạn một owner + một operator singleton.
- [ ] Subscription entitlement gắn đúng operating/product scope.
- [ ] Room operational lifecycle và Listing publish lifecycle được tách.
- [ ] Tenancy participant cardinality được chốt.
- [ ] Billing/charge/payment/receipt không có duplicate mutable truth không kiểm soát.
- [ ] Monthly billing không dùng 30-day drift model.
- [ ] Utility amount có đủ dữ liệu để đối chiếu khi scope yêu cầu.
- [ ] Incident/history/audit đủ để reconstruct business timeline cần thiết.
- [ ] Onboarding/import boundary được xử lý đúng ownership.
- [ ] Trust/verification/report scope tối thiểu được model.
- [ ] Partner marketplace không còn là dependency bắt buộc của MVP incident flow.
- [ ] LV1, LV2, LV3, DBML và `schema.sql` mô tả cùng một canonical model.
- [ ] Constraint/cardinality được kiểm chứng bằng use case, không chỉ bằng diagram aesthetics.
- [ ] Schema/migration implementation chỉ bắt đầu sau khi domain ownership và invariants ở trên được chốt.

## 11. Kết luận

Database hiện tại có các phần relational hữu ích, đặc biệt ở Property/Room, Tenancy concept và Incident history direction. Tuy nhiên, schema chưa phù hợp để được xem là foundation cuối cùng vì đang thiếu operating scope, trộn Room với Listing, single-role hóa actor, và chưa bảo vệ financial/history invariants của một sản phẩm "sổ vận hành".

Ưu tiên sửa **domain ownership và lifecycle trước**, sau đó mới tối ưu datatype, Redis/cache, materialized view hoặc physical indexing.
