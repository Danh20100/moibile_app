# TrọƠi — ERD LV3 Physical Design

Status: `DRAFT_REVIEW`

## 1. Mục tiêu

LV3 ánh xạ ERD LV2 đã freeze sang một **PostgreSQL physical candidate** đủ chính xác để:

- review datatype, nullability, PK/FK, constraint và index;
- sinh `trooi-erd-lv3-physical.json` theo cách deterministic;
- sinh PostgreSQL DDL candidate có thể validate độc lập;
- dựng Lucid bằng **data-backed ERD** thật, không dùng loose shape;
- giữ đường đi rõ ràng tới ORM/migration mà chưa khóa ORM ở bước này.

LV3 không được thay đổi business meaning của Canonical v3.6 hoặc LV1/LV2 frozen.

## 2. Authority chain và input bắt buộc

```text
Canonical v3.6 — FROZEN / TRUSTED
→ ERD LV1 Conceptual — REVIEWED_FROZEN
→ ERD LV2 Logical — REVIEWED_FROZEN
→ ERD LV3 Physical Candidate — tài liệu này
```

Input chính thức:

- `docs/database/canonical.md`;
- `docs/database/erd/trooi-erd-lv1-conceptual.json`;
- `docs/database/erd/trooi-erd-lv2-logical.json`;
- `docs/superpowers/specs/2026-09-27-database-erd-lv2-logical-design.md`.

## 3. Physical target

Baseline physical platform:

```text
PostgreSQL
+ PostGIS
```

Canonical Search/Map `[FROZEN]` đã yêu cầu PostgreSQL + PostGIS + proper indexes. Vì vậy PostGIS là một phần của LV3 candidate, dù `docs/database/tech-stack.md` hiện chưa liệt kê extension này.

Baseline DDL phải có:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Không thêm ORM, migration framework hoặc database code generator vào spec này.

## 4. Naming convention

- PostgreSQL schema mặc định: `public`.
- Table dùng plural `snake_case` để tránh reserved identifier như `user`.
- Column dùng `snake_case`.
- Không dùng quoted identifier.
- Constraint prefix: `pk_`, `fk_`, `uq_`, `ck_`.
- Index prefix: `ix_`; partial unique index vẫn dùng `uq_`.
- Logical entity name vẫn được lưu trong physical JSON để truy ngược LV2.

Ví dụ:

```text
USER                 → users
TENANCY_TERMS        → tenancy_terms
PAYMENT_ALLOCATION   → payment_allocations
```

## 5. Primitive type policy

| Logical kind | PostgreSQL type | Rule |
| --- | --- | --- |
| Entity/FK identifier | `uuid` | application-generated; không yêu cầu UUID extension |
| Money | `numeric(18,2)` | không dùng float/double |
| Meter reading | `numeric(18,6)` | hỗ trợ decimal reading |
| Version | `integer` | positive |
| Rating | `smallint` | range chưa freeze nên chưa CHECK 1–5 |
| Calendar boundary | `date` | term/billing period/effective boundary |
| Business timestamp | `timestamptz` | event/action time |
| Human/free text | `text` | không đặt arbitrary varchar length |
| Structured rule/config | `jsonb` | chỉ khi LV2 có structured-but-unexpanded concept |
| Flexible event metadata | `jsonb` | không biến business core thành JSON blob |
| Geographic point | `geography(Point,4326)` | PostGIS |

State vocabulary đã freeze dùng `text + CHECK`, không dùng PostgreSQL native enum ở LV3.

Lý do:

- CHECK giữ vocabulary trong DB;
- migration thay vocabulary ít coupling hơn native enum;
- Lucid/DDL export vẫn nhìn thấy type đơn giản;
- không khóa ORM-specific enum mapping.

## 6. ID generation và destructive delete

Mọi PK là `uuid NOT NULL PRIMARY KEY`, **không có default generator trong candidate**. Backend hoặc migration fixture cung cấp UUID.

Business records không dùng `ON DELETE CASCADE` trong baseline. FK dùng `ON DELETE RESTRICT`/equivalent để tránh hard-delete làm mất lịch sử.

Archive/void/end là lifecycle nghiệp vụ; hard delete không phải lifecycle thay thế.

## 7. Physical tables

### 7.1 Identity / Operating

#### `users`

```text
user_id uuid PK NOT NULL
```

Không thêm global role hoặc auth-provider columns ngoài LV2 trong candidate này.

#### `organizations`

```text
organization_id       uuid PK NOT NULL
primary_owner_user_id uuid NOT NULL FK → users.user_id
name                  text NOT NULL
```

#### `properties`

```text
property_id                uuid PK NOT NULL
organization_id            uuid NOT NULL FK → organizations.organization_id
name                       text NOT NULL
lifecycle_status           text NOT NULL CHECK ACTIVE|ARCHIVED
operational_address_text   text NOT NULL
operational_location       geography(Point,4326) NOT NULL
public_location_projection geography(Point,4326) NOT NULL
```

`operational_address_text + operational_location` là physical decomposition của LV2 `operational_location`; exact address không được mặc định public.

#### `rooms`

```text
room_id            uuid PK NOT NULL
property_id        uuid NOT NULL FK → properties.property_id
name_or_label      text NOT NULL
operational_state  text NOT NULL CHECK VACANT|OCCUPIED|MAINTENANCE|INACTIVE
record_lifecycle   text NOT NULL CHECK ACTIVE|ARCHIVED
```

### 7.2 Discovery

#### `listings`

```text
listing_id                 uuid PK NOT NULL
room_id                    uuid NOT NULL FK → rooms.room_id
status                     text NOT NULL CHECK DRAFT|PUBLISHED|UNPUBLISHED|ARCHIVED
public_title               text NOT NULL
public_description         text NOT NULL
public_price_projection    numeric(18,2) NOT NULL CHECK >= 0
public_location_projection geography(Point,4326) NOT NULL
```

Search/Map đọc `PUBLISHED` Listing projection, không đọc Property trực tiếp.

#### `listing_status_events`

```text
listing_status_event_id uuid PK NOT NULL
listing_id              uuid NOT NULL FK → listings.listing_id
from_status             text NOT NULL CHECK DRAFT|PUBLISHED|UNPUBLISHED|ARCHIVED
to_status               text NOT NULL CHECK DRAFT|PUBLISHED|UNPUBLISHED|ARCHIVED
reason_code             text NOT NULL
actor_type              text NOT NULL
actor_user_id           uuid NULL FK → users.user_id
trigger                  text NOT NULL
occurred_at             timestamptz NOT NULL
metadata                jsonb NULL
```

#### `inquiries`

```text
inquiry_id                uuid PK NOT NULL
listing_id                uuid NOT NULL FK → listings.listing_id
sender_user_id            uuid NULL FK → users.user_id
contact_intent_or_message text NOT NULL
status                    text NOT NULL
created_at                timestamptz NOT NULL
```

`INQUIRY.status` vocabulary chưa freeze nên LV3 không tự thêm CHECK values.

### 7.3 Rental lifecycle

#### `tenancies`

```text
tenancy_id uuid PK NOT NULL
room_id    uuid NOT NULL FK → rooms.room_id
status     text NOT NULL CHECK DRAFT|ACTIVE|ENDING|ENDED|CANCELLED
started_at timestamptz NULL
ended_at   timestamptz NULL
end_reason text NULL CHECK TERM_ENDED|TENANT_INITIATED|OPERATOR_INITIATED|MUTUAL|OTHER
```

Nếu cả `started_at` và `ended_at` có giá trị thì `ended_at >= started_at`.

#### `tenancy_participants`

```text
tenancy_participant_id uuid PK NOT NULL
tenancy_id             uuid NOT NULL FK → tenancies.tenancy_id
user_id                uuid NULL FK → users.user_id
role                   text NOT NULL CHECK PRIMARY|OCCUPANT
joined_at              timestamptz NOT NULL
left_at                timestamptz NULL
```

Nếu `left_at` có giá trị thì `left_at >= joined_at`.

#### `tenancy_terms`

```text
tenancy_terms_id             uuid PK NOT NULL
tenancy_id                   uuid NOT NULL FK → tenancies.tenancy_id
version                      integer NOT NULL CHECK > 0
rent_amount                  numeric(18,2) NOT NULL CHECK >= 0
agreed_deposit_requirement   numeric(18,2) NOT NULL CHECK >= 0
term_start                   date NOT NULL
term_end                     date NOT NULL
billing_day_or_due_date_rule jsonb NOT NULL
electricity_arrangement      jsonb NOT NULL
water_arrangement            jsonb NOT NULL
minimal_rental_conditions    jsonb NOT NULL
effective_from_cycle_boundary date NOT NULL
```

`term_end >= term_start`; Terms remains immutable/versioned business data.

#### `terms_acknowledgements`

```text
terms_acknowledgement_id uuid PK NOT NULL
tenancy_terms_id        uuid NOT NULL FK → tenancy_terms.tenancy_terms_id
tenancy_participant_id  uuid NOT NULL FK → tenancy_participants.tenancy_participant_id
user_id                 uuid NOT NULL FK → users.user_id
acknowledged_at         timestamptz NOT NULL
```

Same-Tenancy và linked-user consistency cần transaction guard; không thêm duplicate `tenancy_id` chỉ để tạo composite FK.

#### `tenancy_notices`

```text
tenancy_notice_id       uuid PK NOT NULL
tenancy_id              uuid NOT NULL FK → tenancies.tenancy_id
notice_type             text NOT NULL
issued_by_user_id       uuid NOT NULL FK → users.user_id
content_or_note         text NOT NULL
issued_at               timestamptz NOT NULL
acknowledged_by_user_id uuid NULL FK → users.user_id
acknowledged_at         timestamptz NULL
```

Physical consistency:

```text
acknowledged_by_user_id IS NULL ⇔ acknowledged_at IS NULL
```

`notice_type` vocabulary chưa freeze; không tự thêm enum/CHECK values.

### 7.4 Billing / Utility

#### `billing_cycles`

```text
billing_cycle_id uuid PK NOT NULL
tenancy_id       uuid NOT NULL FK → tenancies.tenancy_id
tenancy_terms_id uuid NOT NULL FK → tenancy_terms.tenancy_terms_id
period_start     date NOT NULL
period_end       date NOT NULL
```

`period_end >= period_start`.

#### `charges`

```text
charge_id               uuid PK NOT NULL
billing_cycle_id        uuid NOT NULL FK → billing_cycles.billing_cycle_id
charge_type             text NOT NULL CHECK RENT|ELECTRICITY|WATER
amount                  numeric(18,2) NOT NULL CHECK >= 0
utility_connection_id   uuid NULL FK → utility_connections.utility_connection_id
start_meter_reading_id  uuid NULL FK → meter_readings.meter_reading_id
end_meter_reading_id    uuid NULL FK → meter_readings.meter_reading_id
```

Row-local CHECK:

```text
RENT → utility_connection_id/start/end reading đều NULL
start/end reading có giá trị → utility_connection_id phải có giá trị
```

Manual utility path vẫn hợp lệ; ELECTRICITY/WATER không bắt buộc meter provenance ở mọi Charge.

#### `utility_connections`

```text
utility_connection_id uuid PK NOT NULL
room_id               uuid NOT NULL FK → rooms.room_id
utility_type          text NOT NULL CHECK ELECTRICITY|WATER
source_or_provider    text NOT NULL
meter_identifier      text NULL
```

Không thêm `max 1 active connection / room / type` vì LV2 đã bác bỏ constraint này.

#### `meter_readings`

```text
meter_reading_id      uuid PK NOT NULL
utility_connection_id uuid NOT NULL FK → utility_connections.utility_connection_id
reading_value         numeric(18,6) NOT NULL CHECK >= 0
recorded_at           timestamptz NOT NULL
recorded_by_user_id   uuid NULL FK → users.user_id
```

### 7.5 Payment / Receipt

#### `payments`

```text
payment_id            uuid PK NOT NULL
tenancy_id            uuid NOT NULL FK → tenancies.tenancy_id
amount                numeric(18,2) NOT NULL CHECK >= 0
source                text NOT NULL CHECK MANUAL_CASH|MANUAL_TRANSFER|GATEWAY
verification          text NOT NULL CHECK USER_RECORDED|PROVIDER_VERIFIED
confirmed_at          timestamptz NOT NULL
voided_or_reversed_at timestamptz NULL
correction_note       text NULL
replacement_payment_id uuid NULL FK → payments.payment_id
```

CHECK:

```text
replacement_payment_id IS NULL OR replacement_payment_id <> payment_id
replacement_payment_id IS NULL OR voided_or_reversed_at IS NOT NULL
```

Same-Tenancy replacement vẫn phải được DB/transaction verification kiểm tra; không destructive update Payment đã confirmed.

#### `payment_allocations`

```text
payment_allocation_id uuid PK NOT NULL
payment_id            uuid NOT NULL FK → payments.payment_id
charge_id             uuid NOT NULL FK → charges.charge_id
allocated_amount      numeric(18,2) NOT NULL CHECK >= 0
```

Không thêm UNIQUE `(payment_id, charge_id)` vì LV2 không cấm nhiều allocation records cùng pair.

#### `payment_claims`

```text
payment_claim_id           uuid PK NOT NULL
tenancy_id                 uuid NOT NULL FK → tenancies.tenancy_id
submitted_by_user_id       uuid NOT NULL FK → users.user_id
submitted_by_participant_id uuid NULL FK → tenancy_participants.tenancy_participant_id
claimed_amount             numeric(18,2) NOT NULL CHECK >= 0
evidence_reference         text NULL
status                     text NOT NULL
submitted_at               timestamptz NOT NULL
reviewed_by_user_id        uuid NULL FK → users.user_id
reviewed_at                timestamptz NULL
resulting_payment_id       uuid NULL FK → payments.payment_id
```

`PAYMENT_CLAIM.status` và evidence format vẫn `[OPEN]`; không invent vocabulary/JSON shape ở LV3.

Physical consistency: reviewed_by_user_id IS NULL <=> reviewed_at IS NULL.

`resulting_payment_id` phải unique khi non-null để một Payment không trở thành kết quả của nhiều Claim.

#### `receipts`

```text
receipt_id             uuid PK NOT NULL
payment_id             uuid NOT NULL FK → payments.payment_id
status                 text NOT NULL CHECK ISSUED|VOIDED
issued_at              timestamptz NOT NULL
voided_at              timestamptz NULL
replacement_receipt_id uuid NULL FK → receipts.receipt_id
```

CHECK:

```text
replacement_receipt_id IS NULL OR replacement_receipt_id <> receipt_id
replacement_receipt_id IS NULL OR status = 'VOIDED'
(status = 'ISSUED' AND voided_at IS NULL) OR (status = 'VOIDED' AND voided_at IS NOT NULL)
```

Max one current/non-voided Receipt per Payment được enforce bằng partial unique index ở Mục 9.

### 7.6 Deposit

#### `deposits`

```text
deposit_id uuid PK NOT NULL
tenancy_id uuid NOT NULL FK → tenancies.tenancy_id UNIQUE
```

Không có editable `expected_amount` và không có mutable state column; requirement ở Terms, state được derive.

#### `deposit_payment_applications`

```text
deposit_payment_application_id uuid PK NOT NULL
payment_id                     uuid NOT NULL FK → payments.payment_id
deposit_id                     uuid NOT NULL FK → deposits.deposit_id
applied_amount                 numeric(18,2) NOT NULL CHECK >= 0
applied_at                     timestamptz NOT NULL
```

#### `deposit_settlements`

```text
deposit_settlement_id uuid PK NOT NULL
deposit_id            uuid NOT NULL FK → deposits.deposit_id
refunded_amount       numeric(18,2) NOT NULL CHECK >= 0
retained_amount       numeric(18,2) NOT NULL CHECK >= 0
reason_or_note        text NOT NULL
acted_by_user_id      uuid NOT NULL FK → users.user_id
settled_at            timestamptz NOT NULL
```

#### `deposit_events`

```text
deposit_event_id       uuid PK NOT NULL
deposit_id             uuid NOT NULL FK → deposits.deposit_id
event_type             text NOT NULL CHECK RECEIVED|REFUNDED|RETAINED
amount                 numeric(18,2) NOT NULL CHECK >= 0
occurred_at            timestamptz NOT NULL
payment_application_id uuid NULL FK → deposit_payment_applications.deposit_payment_application_id
settlement_id          uuid NULL FK → deposit_settlements.deposit_settlement_id
```

Provenance CHECK:

```text
RECEIVED → payment_application_id NOT NULL AND settlement_id IS NULL
REFUNDED|RETAINED → settlement_id NOT NULL AND payment_application_id IS NULL
```

Cross-row amount equality không thể là ordinary CHECK:

```text
RECEIVED.amount = linked Application.applied_amount
REFUNDED.amount = linked Settlement.refunded_amount
RETAINED.amount = linked Settlement.retained_amount
```

Baseline enforce bằng transaction guard; `DEPOSIT_EVENT.amount` vẫn được giữ vì Canonical v3.6 chưa được sửa.

### 7.7 Operations

#### `incidents`

```text
incident_id         uuid PK NOT NULL
room_id             uuid NOT NULL FK → rooms.room_id
reported_by_user_id uuid NULL FK → users.user_id
category            text NOT NULL CHECK ELECTRICAL|PLUMBING|ACCESS_SECURITY|ROOM_FACILITY|APPLIANCE|OTHER
status              text NOT NULL CHECK REPORTED|ACKNOWLEDGED|IN_PROGRESS|RESOLVED|CLOSED|REJECTED
closure_reason      text NULL
created_at          timestamptz NOT NULL
closed_at           timestamptz NULL
```

Không infer thêm status↔closed_at rule ngoài FSM đã freeze; lifecycle transitions được guard ở service/transaction layer.

#### `incident_events`

```text
incident_event_id    uuid PK NOT NULL
incident_id          uuid NOT NULL FK → incidents.incident_id
event_type           text NOT NULL
actor_user_id        uuid NULL FK → users.user_id
note                 text NULL
attachment_reference text NULL
from_status          text NULL CHECK REPORTED|ACKNOWLEDGED|IN_PROGRESS|RESOLVED|CLOSED|REJECTED
to_status            text NULL CHECK REPORTED|ACKNOWLEDGED|IN_PROGRESS|RESOLVED|CLOSED|REJECTED
occurred_at          timestamptz NOT NULL
```

`incident_events` là append-only business timeline; attachment reference trỏ tới object storage, không lưu binary trong PostgreSQL.

### 7.8 Review / Trust / Delivery

#### `reviews`

```text
review_id                    uuid PK NOT NULL
tenancy_id                   uuid NOT NULL FK → tenancies.tenancy_id
property_id                  uuid NOT NULL FK → properties.property_id
author_user_id               uuid NOT NULL FK → users.user_id
author_participant_id        uuid NOT NULL FK → tenancy_participants.tenancy_participant_id
overall_rating               smallint NOT NULL
comment                      text NOT NULL
landlord_response            text NULL
landlord_response_by_user_id uuid NULL FK → users.user_id
landlord_responded_at        timestamptz NULL
created_at                   timestamptz NOT NULL
```

Response fields phải coherent: hoặc cả response/actor/time đều NULL, hoặc cả ba đều có giá trị.

Không đặt rating range vì rating dimensions/scale policy chưa freeze ở LV2.

`property_id` là historical Review target theo LV2 #36; Room/Property reassignment không cascade update Review.

#### `trust_reports`

```text
trust_report_id            uuid PK NOT NULL
reporter_user_id           uuid NULL FK → users.user_id
listing_id                 uuid NULL FK → listings.listing_id
review_id                  uuid NULL FK → reviews.review_id
reason                     text NOT NULL CHECK INCORRECT_INFORMATION|MISLEADING_PRICE|WRONG_LOCATION|DUPLICATE_LISTING|INAPPROPRIATE_CONTENT|SUSPECTED_FRAUD|PRIVACY_VIOLATION|SPAM|OTHER
status                     text NOT NULL CHECK SUBMITTED|UNDER_REVIEW|RESOLVED|REJECTED
note_or_evidence_reference text NULL
created_at                 timestamptz NOT NULL
resolved_at                timestamptz NULL
```

Target XOR CHECK:

```text
exactly one of listing_id / review_id is NOT NULL
```

Trust Report không tự động remove content; đó là application/moderation behavior.

#### `notifications`

```text
notification_id              uuid PK NOT NULL
recipient_user_id            uuid NOT NULL FK → users.user_id
category                     text NOT NULL
message_or_payload_reference text NOT NULL
delivery_status              text NOT NULL
created_at                   timestamptz NOT NULL
delivered_at                 timestamptz NULL
read_at                      timestamptz NULL
```

Notification là delivery record, không phải source of truth. Channel/category/delivery vocabulary vẫn `[OPEN]` nên không invent CHECK values.

## 8. Declarative uniqueness và partial indexes

LV3 candidate phải có tối thiểu:

```text
UNIQUE tenancy_terms(tenancy_id, version)
UNIQUE deposits(tenancy_id)
UNIQUE payment_claims(resulting_payment_id) WHERE resulting_payment_id IS NOT NULL
```

Partial unique indexes:

```sql
-- max 1 current/non-archived Listing per Room
UNIQUE (room_id) WHERE status <> 'ARCHIVED'

-- max 1 non-terminal Tenancy per Room
UNIQUE (room_id) WHERE status IN ('DRAFT','ACTIVE','ENDING')

-- at most 1 active PRIMARY participant per Tenancy
UNIQUE (tenancy_id) WHERE role = 'PRIMARY' AND left_at IS NULL

-- max 1 current Receipt per Payment
UNIQUE (payment_id) WHERE status = 'ISSUED'

-- a corrected Payment has at most one predecessor
UNIQUE (replacement_payment_id) WHERE replacement_payment_id IS NOT NULL
```

“At most one active PRIMARY” chỉ là phần DB-enforceable của invariant #8. “ACTIVE Tenancy phải có exactly one PRIMARY” cần transaction guard khi activate/leave participant.

## 9. Baseline indexes

PostgreSQL không tự tạo index cho FK. LV3 baseline tạo B-tree index cho FK lookup column trừ khi đã được PK/UNIQUE/partial unique cover.

Query-specific indexes tối thiểu:

```text
listing_status_events(listing_id, occurred_at)
tenancies(room_id, status)
tenancy_participants(tenancy_id, role, left_at)
billing_cycles(tenancy_id, period_start, period_end)
meter_readings(utility_connection_id, recorded_at)
payments(tenancy_id, confirmed_at)
incidents(room_id, status)
incident_events(incident_id, occurred_at)
notifications(recipient_user_id, created_at)
```

Search/Map indexes:

```sql
CREATE INDEX ix_listings_published_location
ON listings USING gist (public_location_projection)
WHERE status = 'PUBLISHED';

CREATE INDEX ix_listings_published_price
ON listings (public_price_projection)
WHERE status = 'PUBLISHED';
```

Search không được dùng `properties.operational_location`, vì exact location là private operational data.

## 10. Cross-row / cross-table transaction guards

LV3 baseline **không dùng trigger/stored procedure** để giả vờ mọi invariant là row constraint. Những rule cần đọc nhiều row/table phải được thực hiện trong một transaction service với row locking phù hợp.

Các guard bắt buộc:

| Invariant | Enforcement |
| --- | --- |
| Listing publish eligibility | lock Listing + Room + Property; validate VACANT/ACTIVE/ACTIVE trước publish |
| Room rời VACANT | cùng transaction unpublish current Listing |
| Property archive guard | validate child Room/Tenancy/Listing/Incident state |
| Room archive guard | validate INACTIVE + no nonterminal Tenancy + no open Incident |
| Tenancy activation | bảo đảm Room eligible và exactly one active PRIMARY |
| Tenancy ending/checkout | FSM + Room state transition trong cùng transaction |
| Billing cycle no overlap | lock Tenancy/billing range; query overlap trước insert/update |
| Billing cycle Terms provenance | Terms phải thuộc cùng Tenancy và đúng effective boundary |
| Payment allocation | Payment và Charge phải cùng Tenancy |
| Deposit payment application | Payment và Deposit phải cùng Tenancy |
| Payment amount cap | lock Payment + allocations/applications; tổng không vượt Payment.amount |
| Payment correction | replacement Payment phải cùng Tenancy; original phải void/reversed |
| Receipt issue | Payment phải confirmed/non-invalid theo receipt rule |
| Utility provenance | Connection thuộc Tenancy Room; utility type match; readings thuộc cùng Connection |
| Deposit event | provenance đúng loại + amount bằng source Application/Settlement |
| Open Incident archive blocker | archive transaction phải re-check open Incident |
| Review eligibility | Tenancy ENDED + eligible Participant/User link |
| Review historical Property target | capture target tại create; không cascade theo Room reassignment |
| Payment Claim participant/result | participant/result Payment phải cùng Tenancy |

| Terms acknowledgement consistency | Terms and Participant must belong to the same Tenancy; action User must match the linked participant User |
| Review author identity | Author Participant must belong to Review Tenancy and be linked to author_user_id |
| Receipt replacement | Replacement Receipt must belong to the same Payment; predecessor must be VOIDED |

Guard service phải re-check state **trong transaction**, không chỉ dựa vào request-time validation.

## 11. No-overlap policy

`BILLING_CYCLE` no-overlap được giữ bằng transaction guard + index baseline.

Không bật `btree_gist` chỉ để dùng exclusion constraint trong LV3 baseline. Sau khi schema candidate review xong, có thể cân nhắc:

```text
btree_gist + EXCLUDE USING gist
```

nhưng đó là physical optimization riêng, không phải điều kiện để hiểu domain.

## 12. Append-only / immutable records

Các record sau không được destructive edit theo workflow bình thường:

```text
listing_status_events
incident_events
tenancy_terms (sau khi version được sử dụng)
deposit_events
confirmed payments
issued/voided receipt history
```

DB schema không dùng trigger để cấm UPDATE trong baseline; repository/service permission phải thể hiện contract này và tests phải cover.

## 13. `[OPEN]` policy handling

LV3 không được biến `[OPEN]` policy thành accidental database truth.

Các field vẫn dùng generic `text/jsonb` hoặc nullable representation cho tới khi policy được chốt, gồm:

- Payment unallocated handling;
- Payment Claim evidence/confirmation permission/status vocabulary;
- Deposit requirement change after partially held;
- Review minimum occupancy/edit/moderation/rating dimensions;
- Review target correction authority;
- Trust Report login/rate-limit/moderation/evidence policy;
- Notification channels/category/delivery vocabulary.

Không thêm table mới chỉ để “giải quyết” policy đang OPEN.

## 14. Reconciliation markers

Hai marker LV2 phải carry nguyên vào LV3:

```text
>> UPSTREAM-RECONCILE: Deposit Event amount ownership.
>> UPSTREAM-RECONCILE: Review historical Property target semantics.
```

LV3 phát hiện thêm một gap từ Canonical Search/Map:

```text
>> UPSTREAM-RECONCILE: Canonical §8 [FROZEN] yêu cầu filter "Room / property type",
nhưng LV1/LV2 hiện không có authoritative owner/attribute/vocabulary cho type.
LV3 không tự invent enum hoặc Listing-only projection. Sau ERD3 phải quyết định owner,
vocabulary và propagation trước khi executable schema/migration được freeze.
```

Documentation drift marker:

```text
>> DOC-RECONCILE: docs/database/tech-stack.md hiện liệt kê PostgreSQL/Redis/MinIO
nhưng chưa ghi PostGIS, trong khi Canonical §8 [FROZEN] đã chốt PostGIS cho Search/Map.
Sau ERD3 cleanup, cập nhật tech-stack doc để phản ánh trusted source; không sửa Canonical.
```

Các marker `>>` chỉ được xóa ở post-LV3 reconciliation pass.

## 15. Lucid master ERD contract

LV3 Lucid **không phải architecture map**. Nó phải là data-backed database ERD thật.

Master ERD bắt buộc:

- đúng 29 physical tables từ baseline LV2;
- table name đúng physical name;
- hiển thị toàn bộ physical columns;
- hiển thị PostgreSQL datatype;
- đánh dấu PK/FK;
- hiển thị **mọi FK relationship**, kể cả actor/account/delivery FK;
- dùng Crow's Foot từ ERD engine;
- không suppress relationship chỉ vì line dài;
- không dùng domain container làm source schema;
- không thêm loose table rectangle để thay data-backed entity.

Three >> UPSTREAM-RECONCILE markers and one >> DOC-RECONCILE marker stay as notes outside the master ERD; notes do not participate in schema export.

Auxiliary Lucid pages/views có thể được tạo để review Financial/Rental/Trust dễ hơn, nhưng:

```text
master data-backed ERD = schema review/export surface
auxiliary view          = presentation only
```

Constraint như CHECK, partial index hoặc transaction guard không được suy ngược từ việc Lucid không render đầy đủ chúng.

## 16. Repository artifacts sau khi implementation plan được duyệt

LV3 execution phải tạo:

```text
docs/database/erd/trooi-erd-lv3-physical.json
docs/database/schema/trooi-schema-lv3.sql
Lucid data-backed master ERD
```

`trooi-erd-lv3-physical.json` lưu:

- mapping Logical Entity → physical table;
- columns/types/nullability;
- PK/FK;
- CHECK/UNIQUE;
- indexes/partial indexes;
- transaction guards;
- PostGIS requirements;
- OPEN policies;
- reconciliation markers.

`trooi-schema-lv3.sql` là executable **DDL candidate**, chưa phải migration history.

SQL và physical JSON phải được sinh/đối chiếu từ cùng spec; Lucid phải lấy đúng physical table/column/FK set, không re-derive business semantics.

## 17. Validation gate cho LV3 execution

Trước khi đưa LV3 cho review, phải có fresh evidence cho các check sau:

1. Canonical vẫn v3.6 trusted/frozen; LV1 và LV2 đều `REVIEWED_FROZEN`.
2. Physical inventory có đúng 29 baseline tables; không có `[FUTURE]` table.
3. Mọi LV2 attribute được map sang physical column hoặc physical decomposition được giải thích rõ.
4. Mọi FK column trỏ đúng target và nullability phù hợp LV2 presence.
5. Frozen vocabulary có CHECK; OPEN vocabulary không bị invent.
6. Partial uniqueness cover current Listing, nonterminal Tenancy, active PRIMARY và current Receipt.
7. PostGIS location columns và GiST Published-Listing index tồn tại.
8. SQL candidate apply thành công trên disposable PostgreSQL + PostGIS environment.
9. Catalog introspection xác nhận table/PK/FK/unique/check/index expected set.
10. Lucid master chứa đúng physical table set, types và tất cả FK lines.
11. `git diff --check` và repository tests pass trước commit/freeze.

SQL apply test phải chạy từ database rỗng; không được chỉ syntax-highlight hoặc parse text.

PostgreSQL/PostGIS runtime version dùng cho verification phải được ghi rõ trong implementation evidence; spec này không khóa ORM theo version đó.

## 18. Reconciliation gate sau ERD3

Sau khi LV3 được review xong, **trước migration baseline**, chạy một pass riêng:

```text
Canonical ↔ LV1 ↔ LV2 ↔ LV3 ↔ tech-stack docs
```

Search toàn bộ marker bắt đầu bằng `>>` và xử lý từng marker theo:

```text
PROMOTE upstream
KEEP lower-layer only
REJECT / remove
DOC-SYNC
```

Chỉ sau pass này mới tạo baseline sạch không còn reconciliation debt đã resolve.

## 19. Ngoài scope của LV3 design

Không nằm trong spec này:

- chọn Prisma / TypeORM / Drizzle / MikroORM / framework khác;
- migration history hoặc production rollout;
- data backfill/import;
- provider-specific auth identity tables chưa có trong Canonical/LV2;
- Redis key design;
- MinIO bucket/key lifecycle;
- backup/restore/replication policy;
- database user/role permission matrix;
- pricing/subscription/quota;
- partner marketplace;
- AI/OCR;
- proration;
- advanced team/delegation;
- các entity `[FUTURE]` khác.

Trigger/stored procedure cũng không nằm trong baseline. Nếu implementation review chứng minh transaction guard không đủ an toàn cho một invariant cụ thể, trigger phải được đề xuất riêng và review trước.

## 20. Approval gate

Approval của spec này chỉ cho phép bước tiếp theo:

```text
write LV3 implementation plan
```

Nó **không** tự động cho phép tạo SQL/JSON/Lucid.

Implementation chỉ bắt đầu sau khi:

1. written spec này được user review/approve;
2. implementation plan được viết và user chọn execution mode.
