# Tr??i ERD Foundation

Th? m?c n?y version-control chu?i ERD ?? review/freeze c?a Tr??i t? **Canonical Product & Domain Freeze v3.6**.

## Authority

```text
Canonical v3.6
? LV1 Conceptual
? LV2 Logical
? LV3 Physical
? PostgreSQL/PostGIS reference DDL
```

Kh?ng level n?o ???c thay ??i meaning c?a level cao h?n. Lucid kh?ng ph?i source of truth; JSON trong repository l? artifact ???c version-control.

## Status

```text
LV1 Conceptual  REVIEWED / FROZEN
LV2 Logical     REVIEWED / FROZEN
LV3 Physical    REVIEWED / FROZEN
```

## LV1 ? Conceptual

LV1 tr? l?i domain n?o t?n t?i, ownership ch?nh, lifecycle ch?nh v? cardinality c?t l?i. LV1 kh?ng s? h?u datatype, index, nullable hay PostgreSQL-specific detail.

Backbone:

```text
USER ? ORGANIZATION ? PROPERTY ? ROOM
ROOM ? LISTING / TENANCY / INCIDENT
TENANCY ? PARTICIPANT / TERMS / DEPOSIT / BILLING_CYCLE
BILLING_CYCLE ? CHARGE
PAYMENT ? ALLOCATION / DEPOSIT APPLICATION / RECEIPT
INCIDENT ? INCIDENT_EVENT
```

## LV2 ? Logical

LV2 l?m r? logical entities/relationships c?n ?? hi?n th?c capability v? invariant, g?m supporting concepts nh?:

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

Supporting entity kh?ng tr? th?nh ngu?n business truth th? hai.

C?c chi ti?t policy ch?a ch?t v?n n?m trong `openPolicies`; v? d? authoritative owner/vocabulary cho Room/property type filter, Charge over-allocation v? Review multiplicity.

## LV3 ? Physical

LV3 ?nh x? logical model sang PostgreSQL/PostGIS:

```text
columns / datatypes
PK / FK
nullability
CHECK / UNIQUE
indexes / partial indexes / GiST
transaction-sensitive guards
```

`trooi-erd-lv3-physical.json` l? physical contract ?? **REVIEWED / FROZEN**.

`../schema/trooi-schema-lv3.sql` l? validated executable reference DDL, kh?ng ph?i migration baseline. ORM/migration tooling ch?a ???c ch?n.

## Review invariants

- `USER` kh?ng c? global landlord/tenant role.
- Room operational state t?ch kh?i archive lifecycle.
- Published Listing ch? h?p l? v?i VACANT active Room d??i active Property.
- M?i Room t?i ?a m?t current non-archived Listing.
- M?i Room t?i ?a m?t non-terminal Tenancy (`DRAFT | ACTIVE | ENDING`).
- Khi Tenancy c?n `ENDING`, pre-rental interest ?i qua Inquiry; kh?ng t?o Draft Tenancy k? ti?p.
- Terms versioned; Billing Cycle gi? Terms provenance.
- Billing scope current ch? `RENT / ELECTRICITY / WATER`.
- Payment thu?c ??ng m?t Tenancy; allocation/application kh?ng cross-Tenancy.
- Deposit requirement thu?c Terms; fulfillment/settlement thu?c Deposit.
- Cumulative Deposit settlement kh?ng ???c v??t cumulative applied amount ?? th?c nh?n.
- Receipt ch? sinh t? confirmed Payment v? gi? history khi void/reissue.
- Room/Property archive b? ch?n khi c?n Incident m?.
- Dashboard, history projection v? notification kh?ng ph?i source of truth.

Danh s?ch business invariant ??y ?? n?m trong [`../canonical.md`](../canonical.md).

## Frozen artifact names

```text
trooi-erd-lv1-conceptual.json
trooi-erd-lv2-logical.json
trooi-erd-lv3-physical.json
```

B?t k? thay ??i n?o sau freeze ph?i ?i l?i ??ng authority chain v? review gate t??ng ?ng.
