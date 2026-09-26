# TrọƠi ERD Workspace

Thư mục này dùng để dựng và version-control ERD của TrọƠi từ **Canonical Product & Domain Freeze v3.6**.

Nguồn duy nhất để dựng ERD mới là [`../canonical.md`](../canonical.md). Không dùng snapshot hoặc ERD cũ để suy ngược business model.

## Build order

```text
Canonical v3.6
→ LV1 Conceptual
→ review / freeze
→ LV2 Logical
→ review / freeze
→ LV3 Physical Candidate
→ review
→ database implementation
```

Không bỏ qua level. Một level thấp hơn không được thay đổi meaning của level cao hơn.

## LV1 — Conceptual

Mục tiêu: trả lời **domain nào tồn tại, ai sở hữu gì, lifecycle chính chạy như thế nào và cardinality cốt lõi là gì**.

Không đưa datatype, index, nullable hay PostgreSQL-specific detail vào LV1.

Backbone từ canonical:

```text
USER
→ ORGANIZATION
→ PROPERTY
→ ROOM

ROOM
├── LISTING
├── TENANCY
└── INCIDENT

TENANCY
├── TENANCY_PARTICIPANT
├── TENANCY_TERMS
├── DEPOSIT
└── BILLING_CYCLE

BILLING_CYCLE
→ CHARGE

PAYMENT
├── TENANCY
├── CHARGE
├── DEPOSIT
└── RECEIPT

INCIDENT
→ INCIDENT_EVENT
```

Cardinality tối thiểu phải thể hiện:

```text
USER 0..N ORGANIZATION
ORGANIZATION exactly 1 primary owner/operator USER
ORGANIZATION 0..N PROPERTY
PROPERTY exactly 1 ORGANIZATION

ROOM max 1 current LISTING
ROOM max 1 non-terminal TENANCY

PAYMENT 0..N RECEIPT historical
PAYMENT max 1 current/non-voided RECEIPT
```

## LV2 — Logical

Mục tiêu: làm rõ entity/relationship cần để hiện thực capability và invariant.

Các supporting/junction concept canonical yêu cầu xem xét ở LV2:

```text
PAYMENT_ALLOCATION
DEPOSIT_PAYMENT_APPLICATION
LISTING_STATUS_EVENT
TERMS_ACKNOWLEDGEMENT
TENANCY_NOTICE
PAYMENT_CLAIM
UTILITY_CONNECTION / METER_READING
REVIEW
TRUST_REPORT
NOTIFICATION
```

LV2 phải giữ nguyên ownership đã chốt; supporting entity không được trở thành nguồn business truth thứ hai.

## LV3 — Physical Candidate

Mục tiêu: ánh xạ logical model sang PostgreSQL-oriented design:

```text
columns / datatypes
PK / FK
nullability
unique constraints
check constraints
indexes
transaction-sensitive guards
```

LV3 vẫn là **candidate để review**, chưa phải migration.

## Invariants phải luôn nhìn thấy khi review ERD

- `USER` không có global landlord/tenant role.
- Room operational state tách khỏi archive lifecycle.
- `Listing = PUBLISHED` chỉ hợp lệ khi Room `VACANT`, Room/Property đều active.
- Mỗi Room tối đa một current non-archived Listing.
- Mỗi Room tối đa một non-terminal Tenancy: `DRAFT | ACTIVE | ENDING`.
- Khi Tenancy còn `ENDING`, MVP không tạo Draft Tenancy tiếp theo; pre-rental interest đi qua Inquiry.
- Terms luôn versioned; Billing Cycle giữ Terms provenance.
- Billing scope hiện tại chỉ `RENT / ELECTRICITY / WATER`.
- Payment thuộc đúng một Tenancy; allocation/application không cross-Tenancy.
- Deposit requirement thuộc Terms; Deposit fulfillment/settlement thuộc Deposit.
- Receipt chỉ sinh từ confirmed Payment và không overwrite history.
- Room/Property archive bị chặn khi còn Incident mở.
- Dashboard, history projection và notification không phải source of truth.

Danh sách đầy đủ nằm trong canonical; README này chỉ là checklist làm việc nhanh.

## Snapshot naming

Khi từng level được tạo lại và review, dùng tên:

```text
trooi-erd-lv1-conceptual.json
trooi-erd-lv2-logical.json
trooi-erd-lv3-physical.json
```

Nếu visual tool được dùng để collaboration, JSON trong repository phải là snapshot review/versioning phù hợp, không được xem là nguồn domain cao hơn canonical.

## Gate

Chỉ chuyển level khi level hiện tại:

1. bám đúng canonical;
2. không còn mâu thuẫn ownership/cardinality/lifecycle;
3. không đưa feature `[FUTURE]` vào core model;
4. đã được review trước khi downstream artifact được tạo.