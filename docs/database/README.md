# TrọƠi Database Foundation

`docs/database/` là nguồn tài liệu chính thức cho database design của TrọƠi.

Mọi ERD, logical model, physical model và schema reference trong khu vực này phải tuân theo cùng một business truth: [`canonical-v3.7.md`](./canonical-v3.7.md).

## Authority chain

```text
Canonical v3.7 → TRUSTED SOURCE
    ↓
ERD LV1 → Conceptual → REVIEWED / FROZEN
    ↓
ERD LV2 → Logical → REVIEWED / FROZEN
    ↓
ERD LV3 → Physical → REVIEWED / FROZEN
    ↓
Validated PostgreSQL/PostGIS reference DDL
    ↓
Migration / backend implementation
```

Level thấp hơn không được tự thay đổi business meaning đã `[FROZEN]` ở level cao hơn.

## Structure

```text
docs/database/
├── README.md
├── canonical-v3.7.md
├── archive/
│   └── canonical-v3.6.md
├── tech-stack.md
├── erd/
│   ├── README.md
│   ├── trooi-erd-lv1-conceptual.json
│   ├── trooi-erd-lv2-logical.json
│   └── trooi-erd-lv3-physical.json
└── schema/
    └── trooi-schema-lv3.sql
```

Verification assets live in [`../../tests/database/`](../../tests/database/); SQL smoke coverage is the only nested test area.

## Responsibilities

- `canonical-v3.7.md`: Product & Domain Model authority; ownership, lifecycle, invariant và boundary `CURRENT / OPEN / FUTURE`.
- `erd/trooi-erd-lv1-conceptual.json`: conceptual domain topology.
- `erd/trooi-erd-lv2-logical.json`: logical entities, relationships và policy boundary.
- `erd/trooi-erd-lv3-physical.json`: physical database contract cho PostgreSQL/PostGIS.
- `schema/trooi-schema-lv3.sql`: executable reference DDL được render từ LV3; không phải migration baseline.
- `tech-stack.md`: vai trò của PostgreSQL/PostGIS, Redis và MinIO; không sở hữu business semantics.

Lucid chỉ là review/visual surface. Repository JSON là versioned ERD artifact.

## Current state

```text
Canonical v3.7          FROZEN / TRUSTED
ERD LV1                 REVIEWED / FROZEN
ERD LV2                 REVIEWED / FROZEN
ERD LV3                 REVIEWED / FROZEN
PostgreSQL/PostGIS DDL  VALIDATED REFERENCE — not a migration
ORM / migration tooling unselected
Migrations              not started
```

## Working rules

1. Đi từ Canonical → LV1 → LV2 → LV3 → schema/backend; không suy ngược business truth từ SQL.
2. Mỗi level chỉ thêm mức chi tiết thuộc trách nhiệm của level đó.
3. `[OPEN]` policy không được tự đóng ở tầng database/code.
4. `[FUTURE]` capability không được xuất hiện trong current core model khi Canonical chưa đổi trạng thái.
5. Khi thay đổi invariant `[FROZEN]`, cập nhật authority cao hơn trước rồi propagate xuống toàn chain.
6. Schema reference phải tiếp tục pass validator, smoke test và PostgreSQL catalog parity trước khi dùng làm migration input.

Xem chi tiết ERD tại [`erd/README.md`](./erd/README.md).
