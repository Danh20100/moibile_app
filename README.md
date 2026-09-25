# TrọƠi — Database Foundation

Nhánh `database/schema-foundations` chỉ xây dựng **foundation cho lớp dữ liệu**. Mục tiêu hiện tại là thống nhất scope, ERD, quy ước và cấu trúc làm việc trước khi viết schema/migration thật.

## Trạng thái hiện tại

- Chưa có PostgreSQL schema executable được xem là canonical.
- Chưa có migration SQL.
- Chưa có seed SQL.
- Không dùng các ERD `.drawio` cũ làm source of truth.
- Bộ ERD đang review được duy trì trên **Lucid** và snapshot vào repository dưới dạng JSON.

## Cấu trúc foundation

```text
database/
├── README.md
├── migrations/
│   └── README.md
└── seeds/
    └── README.md

docs/database/
├── README.md
├── schema-scope-review.md
├── tech-stack.md
└── erd/
    ├── README.md
    ├── TroOi_ERD_LV1_TongQuan.json
    ├── TroOi_ERD_LV2_LogicDB.json
    └── TroOi_ERD_LV3_ChiTiet.json
```

## Luồng làm việc

```text
Product scope / use cases
        ↓
ERD LV1 — Conceptual
        ↓
ERD LV2 — Logical
        ↓
ERD LV3 — Physical candidate
        ↓
Foundation review / freeze
        ↓
PostgreSQL schema + migrations
        ↓
Backend persistence
```

## Nguyên tắc

1. Không viết schema trước rồi mới ép ERD chạy theo.
2. Một business rule chỉ được hạ xuống LV3 khi không mâu thuẫn với scope/LV1/LV2.
3. Lucid là visual collaboration source; JSON trong repo là review/versioning snapshot.
4. `database/` hiện chỉ là implementation skeleton cho giai đoạn sau.
5. Khi foundation chưa freeze, không coi bất kỳ SQL/ORM model nào là authoritative.

Xem `docs/database/README.md` để bắt đầu review database foundation.
