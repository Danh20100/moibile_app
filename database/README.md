# TrọƠi Database Workspace

`database/` chứa **executable persistence artifacts** của TrọƠi cho Database v1: migrations, seeds và
bootstrap cho môi trường phát triển. Runtime đã có migration/seed thật; thư mục này không còn là
placeholder.

## Cấu trúc hiện tại

```text
database/
├── README.md
├── migrations/
│   ├── 000001_initial_schema.ts        # migration schema khởi tạo Database v1
│   ├── 000002_prepare_initial_rollback.ts
│   └── sql/                            # SQL up/down đi kèm migration
├── seeds/
│   ├── development.ts                  # seed development chạy trên schema đã migrate
│   └── seed-data.ts
└── dev/
    └── 01-create-test-db.sql           # bootstrap database test cho môi trường dev
```

Migration được chạy qua `scripts/database/migrate.ts` (`pnpm db:migrate`), seed qua
`pnpm db:seed`, và PostgreSQL/PostGIS dev environment qua `pnpm db:dev:up`.

## Authority

```text
docs/database/v1/canonical.md
        ↓
docs/database/v1/erd/ — conceptual → logical → physical
        ↓
docs/database/v1/schema/ — executable SQL snapshot
        ↓
database/ — migrations / seeds
```

`database/` không được tự tạo business rule mới. Nếu physical design cần một rule chưa tồn tại trong
canonical hoặc ERD cấp cao hơn, phải đưa vấn đề ngược lên để review trước.

## Rules

- PostgreSQL/PostGIS là authoritative relational store cho business data.
- Migration đã được chia sẻ là history; không rewrite âm thầm.
- Seed chỉ dùng cho development/test/reference data hợp lệ, không chứa dữ liệu thật của tenant/customer.
- Không đặt ERD, review note hay business decision vào `database/`.
- Không dùng ORM model hoặc SQL để quyết định ngược domain model.
- Không đưa feature `[FUTURE]` trong canonical vào schema hiện tại chỉ để "chuẩn bị trước".

Tài liệu thiết kế bắt đầu tại [`docs/database/README.md`](../docs/database/README.md).
Provenance implementation ở [`docs/database/v1/implementation-history.md`](../docs/database/v1/implementation-history.md).
