# TrọƠi — ERD LV1 Conceptual Design

**Date:** 2026-09-27  
**Status:** Design approved for written-spec review  
**Branch:** `database/schema-foundations`

## 1. Purpose

Thiết kế LV1 mô tả conceptual backbone của TrọƠi trước khi đi xuống logical/physical database design.

Nguồn domain duy nhất:

```text
docs/database/canonical.md
```

LV1 phải trả lời bốn câu hỏi:

1. Domain/entity khái niệm nào tồn tại?
2. Ai sở hữu hoặc liên kết với ai?
3. Cardinality cốt lõi nào đã được chốt?
4. Lifecycle/invariant nào phải nhìn thấy khi review?

LV1 không quyết định datatype, index, nullability hay PostgreSQL-specific constraint.

## 2. Scope

LV1 sẽ thể hiện các conceptual entities sau:

```text
USER
ORGANIZATION
PROPERTY
ROOM
LISTING
TENANCY
TENANCY_PARTICIPANT
TENANCY_TERMS
DEPOSIT
BILLING_CYCLE
CHARGE
PAYMENT
RECEIPT
INCIDENT
INCIDENT_EVENT
INQUIRY
REVIEW
TRUST_REPORT
```

Các entity supporting/junction chi tiết hơn được defer sang LV2.

## 3. Core backbone

```text
USER
  │
  ▼
ORGANIZATION
  │
  ▼
PROPERTY
  │
  ▼
ROOM
  ├────────────► LISTING
  ├────────────► TENANCY
  └────────────► INCIDENT
```

Semantics:

- `USER` là digital identity, không có global landlord/tenant role.
- `ORGANIZATION` là rental operating workspace.
- `PROPERTY` thuộc đúng một Organization.
- `ROOM` là rental unit identity và operational root bên trong Property.
- Listing/Tenancy/Incident là ba lifecycle khác nhau cùng bám vào Room.

## 4. Rental lifecycle cluster

```text
TENANCY
├── TENANCY_PARTICIPANT ── 0..1 ── USER
├── TENANCY_TERMS
├── DEPOSIT
└── BILLING_CYCLE
      └── CHARGE
```

Semantics:

- Tenancy là rental relationship của một Room theo thời gian.
- Participant có thể tồn tại trước khi linked User account xuất hiện.
- Terms là versioned business concept.
- Deposit giữ fulfillment/holding/settlement; requirement đến từ Terms.
- Billing Cycle thuộc Tenancy và giữ provenance về Terms version áp dụng.
- Charge là receivable obligation trong Billing Cycle.

MVP không cho phép nhiều non-terminal Tenancy song song trên cùng Room.

## 5. Money cluster

```text
PAYMENT
├── belongs to ── TENANCY
├── allocates to ── CHARGE
├── applies to ── DEPOSIT
└── produces ── RECEIPT
```

LV1 chỉ thể hiện business relationship.

Các junction entities sau không xuất hiện như node LV1:

```text
PAYMENT_ALLOCATION
DEPOSIT_PAYMENT_APPLICATION
```

Chúng được đưa vào LV2 để biểu diễn partial allocation, multi-charge allocation và deposit application chính xác mà không làm LV1 nặng chi tiết triển khai.

Một Payment không được cross-Tenancy.

## 6. Incident cluster

```text
ROOM
└── INCIDENT
      └── INCIDENT_EVENT
```

Incident là operational problem lifecycle của Room, không phải Trust Report.

LV1 cần làm rõ:

- một Room có thể có nhiều Incident theo thời gian;
- một Incident có timeline/event history;
- Incident không làm Room tự chuyển sang `MAINTENANCE`;
- Room/Property archive bị chặn khi còn Incident mở.

Chi tiết category, event type và closure reason thuộc LV2/LV3.

## 7. Discovery & Trust surface

Discovery/Trust được giữ trong LV1 dưới dạng vùng conceptual phụ để toàn bộ product surface không biến mất khỏi sơ đồ.

```text
USER ── optional sender account ──► INQUIRY ──► LISTING

TENANCY ── verification source ──► REVIEW ──► PROPERTY

LISTING ──┐
          ├──► TRUST_REPORT
REVIEW ───┘
```

Semantics:

- Inquiry là bridge giữa discovery và rental relationship, không phải prerequisite của Tenancy.
- Review chỉ dành cho rental history đủ điều kiện và target Property/Rental Experience.
- Review không target cá nhân landlord/operator.
- Trust Report target Listing hoặc Review trong MVP.
- Trust Report không tự động remove content.

Full messaging, saved search/favorites nâng cao và recommendation không thuộc LV1 hiện tại.

## 8. Cardinality rules carried into LV1

Các cardinality đã được canonical chốt và phải hiện rõ:

```text
USER 0..N ORGANIZATION
ORGANIZATION exactly 1 primary owner/operator USER
ORGANIZATION 0..N PROPERTY
PROPERTY exactly 1 ORGANIZATION

ROOM 0..N historical LISTING
ROOM max 1 current non-archived LISTING

ROOM 0..N historical TENANCY
ROOM max 1 non-terminal TENANCY

TENANCY_PARTICIPANT 0..1 linked USER
ACTIVE TENANCY exactly 1 active PRIMARY participant
ACTIVE TENANCY 0..N active OCCUPANT participants

PAYMENT exactly 1 TENANCY
PAYMENT 0..N RECEIPT historical
PAYMENT max 1 current/non-voided RECEIPT
```

Các minimum cardinality khác không được tự suy diễn nếu canonical chưa khóa rõ; LV2 có thể formalize sau khi business semantics tương ứng được xác nhận.

## 9. Lifecycle visibility

LV1 không cần vẽ đầy đủ mọi state transition như state machine diagram, nhưng phải ghi chú các lifecycle có ảnh hưởng trực tiếp tới relationship/cardinality:

```text
ROOM operational state:
VACANT | OCCUPIED | MAINTENANCE | INACTIVE

ROOM lifecycle:
ACTIVE | ARCHIVED

LISTING:
DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED

TENANCY:
DRAFT | ACTIVE | ENDING | ENDED | CANCELLED
```

Các invariant quan trọng phải được note cạnh relationship tương ứng, không lặp toàn bộ canonical vào từng entity box.

## 10. Diagram layout

LV1 nên chia thành các vùng trực quan rõ ràng:

- Identity / Operating: `USER → ORGANIZATION → PROPERTY → ROOM`
- Discovery: `LISTING → INQUIRY`
- Rental Lifecycle: `TENANCY → PARTICIPANT / TERMS / DEPOSIT / BILLING`
- Money: `PAYMENT → CHARGE / DEPOSIT / RECEIPT`
- Operations: `INCIDENT → INCIDENT_EVENT`
- Trust: `REVIEW / TRUST_REPORT`

`ROOM` và `TENANCY` nằm gần trung tâm vì đây là hai điểm nối phần lớn lifecycle.

## 11. Explicitly excluded from LV1

Không đưa các implementation/supporting details sau thành node LV1:

```text
PAYMENT_ALLOCATION
DEPOSIT_PAYMENT_APPLICATION
LISTING_STATUS_EVENT
TERMS_ACKNOWLEDGEMENT
TENANCY_NOTICE
PAYMENT_CLAIM
UTILITY_CONNECTION / METER_READING
NOTIFICATION delivery details
technical audit tables
read-model/dashboard tables
```

Chúng vẫn thuộc canonical capability khi được đánh `CURRENT/FROZEN`; việc không xuất hiện ở LV1 chỉ phản ánh mức abstraction.

Các feature `[FUTURE]` trong canonical không được đưa vào sơ đồ để “chuẩn bị trước”.

## 12. Output artifact

Sau khi spec này được duyệt, artifact LV1 sẽ được tạo tại:

```text
docs/database/erd/trooi-erd-lv1-conceptual.json
```

Snapshot JSON phải:

- đọc được độc lập trong code review;
- giữ entity name, relationship label và cardinality;
- không phụ thuộc vào internal shape ID của visual tool;
- không chứa datatype/column-level implementation;
- có metadata chỉ rõ source là `docs/database/canonical.md` v3.6;
- đủ ổn định để diff/version-control.

Nếu có visual companion trên Lucid, Lucid chỉ là collaboration surface; repository snapshot vẫn là artifact review/versioning của nhánh database.

## 13. Validation checklist

LV1 chỉ được xem là ready khi:

- không có global `USER.role`;
- Organization/Property ownership đúng canonical;
- Room operational lifecycle không bị trộn với Listing lifecycle;
- max-1 current Listing trên Room được thể hiện;
- max-1 non-terminal Tenancy trên Room được thể hiện;
- Participant optional-link với User được thể hiện;
- Terms/Deposit/Billing ownership không bị duplicate;
- Payment thuộc một Tenancy và không hàm ý cross-Tenancy allocation;
- Receipt giữ historical/current semantics;
- Incident tách khỏi Trust Report;
- Inquiry không bị biến thành prerequisite của Tenancy;
- Review gắn với verified rental history và Property/Rental Experience;
- Trust Report chỉ target Listing/Review trong MVP;
- không có feature `[FUTURE]` lọt vào conceptual core;
- không có datatype, index hoặc physical constraint làm nhiễu LV1.

Nếu một điểm cần business rule mới ngoài canonical, dừng tại LV1 và đưa câu hỏi ngược lên canonical thay vì tự quyết trong ERD.

## 14. Success criteria

LV1 thành công khi một reviewer có thể nhìn sơ đồ và trả lời được:

```text
Ai vận hành Property?
Room liên hệ với Listing/Tenancy/Incident như thế nào?
Tenant identity và rental participant khác nhau ở đâu?
Terms, Billing, Payment, Deposit, Receipt sở hữu truth nào?
Discovery nối vào rental lifecycle ở đâu?
Trust data nối vào rental history/public content ở đâu?
Cardinality nào đang bảo vệ lifecycle chính?
```

mà không cần suy đoán từ SQL hoặc implementation code.

Sau khi LV1 được review/freeze, mới bắt đầu LV2 logical model.
