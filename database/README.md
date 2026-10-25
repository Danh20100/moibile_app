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
    └── 01-create-test-db.sh            # bootstrap DB test cũ (skip nếu trùng DB chính)
```

Migration được chạy qua `scripts/database/migrate.ts` (`pnpm db:migrate`), seed qua
`pnpm db:seed`, và PostgreSQL/PostGIS dev environment qua `pnpm db:dev:up`.

## Active local database: `tro-oi` (single application DB)

The local PostGIS 16 instance uses a **single application database named `tro-oi`** for app runtime and controlled manual/smoke testing. Docker Compose publishes PostgreSQL to `127.0.0.1:5432`, with data persisted in `trooi-project_postgres_persistence_data`. Connection credentials live exclusively in the ignored local `.env`, not in this document.

- Start: `docker compose up -d postgres`.
- Read status: `docker compose ps postgres`.
- Apply additive migrations only: `node --env-file=.env --import tsx scripts/database/migrate.ts up` or `pnpm db:migrate` when `DATABASE_URL` is exported into the process.
- Read-only checks and transactional smoke tests may use the same database.
- **Never** set `TEST_DATABASE_URL` to `tro-oi` for destructive integration suites. The shared DB is explicitly blocked from `resetPublicSchema()`; E2E seed/reset also refuses it.
- `db:migrate:down` is blocked for `tro-oi` to avoid dropping schema or data in a shared app runtime.
- Development `db:seed` intentionally accepts only `trooi_dev`. Do not bypass it to mix synthetic finance data into `tro-oi`.
- Full destructive migration/integration tests still require an isolated disposable database; they are **not** part of the one-DB runtime. Unit, static, UI and read-only smoke tests do not need one.
- Back up before migrations, data repair or high-risk testing. Keep dumps outside Git. Verify restore on a separate temporary instance before relying on them.
- Starting this database does **not** start the backend API, turn on Google Identity sessions, configure Release HTTPS, or activate SePay.

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
