# Database design documentation

`docs/database/` là khu vực **design/review** cho database foundation của TrọƠi. Nó tách biệt với `/database`, nơi chỉ dành cho implementation artifacts ở giai đoạn sau.

## Structure

```text
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

## Tài liệu chính

### `schema-scope-review.md`

Ghi nhận scope alignment, domain boundary, các finding và invariant cần giải quyết trước khi database implementation được coi là ổn định.

### `tech-stack.md`

Ghi nhận vai trò của PostgreSQL, Redis và object storage trong data layer. Đây là tài liệu technology responsibility, không thay thế ERD/domain model.

### `erd/`

Chứa snapshot JSON của ba ERD đang được maintain/review trên Lucid:

- **LV1 — Conceptual:** backbone nghiệp vụ và ownership/lifecycle chính;
- **LV2 — Logical:** entity/relationship chi tiết theo capability;
- **LV3 — Physical candidate:** kiểu dữ liệu và constraint định hướng PostgreSQL.

## Source-of-truth direction

```text
Project scope / use cases
        ↓
ERD LV1
        ↓
ERD LV2
        ↓
ERD LV3
        ↓
Foundation freeze
        ↓
Database implementation
```

Không dùng artifact implementation cũ để quyết định ngược lại conceptual/logical model.

## Boundary

```text
docs/database/ = scope, design, review, ERD snapshots
/database/     = future executable persistence workspace
```
