# TrọƠi ERD Foundation

Thư mục này version-control chuỗi ERD đã review/freeze của TrọƠi từ **Canonical Product & Domain Freeze v3.7**.

## Authority

```text
Canonical v3.7
→ LV1 Conceptual
→ LV2 Logical
→ LV3 Physical
→ PostgreSQL/PostGIS reference DDL
```

Không level nào được thay đổi meaning của level cao hơn. Lucid không phải source of truth; JSON trong repository là artifact được version-control.

## Status

```text
LV1 Conceptual  REVIEWED / FROZEN
LV2 Logical     REVIEWED / FROZEN
LV3 Physical    REVIEWED / FROZEN
```

## LV1 — Conceptual

LV1 trả lời domain nào tồn tại, ownership chính, lifecycle chính và cardinality cốt lõi. LV1 không sở hữu datatype, index, nullable hay PostgreSQL-specific detail.

Backbone:

```text
USER → ORGANIZATION → PROPERTY → ROOM
ROOM → LISTING / TENANCY / INCIDENT
TENANCY → PARTICIPANT / TERMS / DEPOSIT / BILLING_CYCLE
BILLING_CYCLE → CHARGE
PAYMENT → ALLOCATION / DEPOSIT APPLICATION / RECEIPT
INCIDENT → INCIDENT_EVENT
```

## LV2 — Logical

LV2 làm rõ logical entities/relationships cần để hiện thực capability và invariant, gồm supporting concepts như:

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

Supporting entity không trở thành nguồn business truth thứ hai.

Các chi tiết policy chưa chốt vẫn nằm trong `openPolicies`; ví dụ authoritative owner/vocabulary cho Room/property type filter, Charge over-allocation và Review multiplicity.

## LV3 — Physical

LV3 ánh xạ logical model sang PostgreSQL/PostGIS:

```text
columns / datatypes
PK / FK
nullability
CHECK / UNIQUE
indexes / partial indexes / GiST
transaction-sensitive guards
```

`trooi-erd-lv3-physical.json` là physical contract đã **REVIEWED / FROZEN**.

`../schema/trooi-schema-lv3.sql` là validated executable reference DDL, không phải migration baseline. ORM/migration tooling chưa được chọn.

## Review invariants

- `USER` không có global landlord/tenant role.
- Room operational state tách khỏi archive lifecycle.
- Published Listing chỉ hợp lệ với VACANT active Room dưới active Property.
- Mỗi Room tối đa một current non-archived Listing.
- Mỗi Room tối đa một non-terminal Tenancy (`DRAFT | ACTIVE | ENDING`).
- Khi Tenancy còn `ENDING`, pre-rental interest đi qua Inquiry; không tạo Draft Tenancy kế tiếp.
- Terms versioned; Billing Cycle giữ Terms provenance.
- Billing scope current chỉ `RENT / ELECTRICITY / WATER`.
- Payment thuộc đúng một Tenancy; allocation/application không cross-Tenancy.
- Deposit requirement thuộc Terms; fulfillment/settlement thuộc Deposit.
- Cumulative Deposit settlement không được vượt cumulative applied amount đã xác nhận.
- Receipt chỉ sinh từ confirmed Payment và giữ history khi void/reissue.
- Room/Property archive bị chặn khi còn Incident mở.
- Dashboard, history projection và notification không phải source of truth.

Danh sách business invariant đầy đủ nằm trong [`../canonical-v3.7.md`](../canonical-v3.7.md).

## Frozen artifact names

```text
trooi-erd-lv1-conceptual.json
trooi-erd-lv2-logical.json
trooi-erd-lv3-physical.json
```

Bất kỳ thay đổi nào sau freeze phải đi lại đúng authority chain và review gate tương ứng.
