# Database workspace

Thư mục này là **implementation skeleton** cho persistence layer của TrọƠi.

Ở giai đoạn `schema-foundations`, thư mục này chưa chứa database implementation thật. Mục đích của nó là giữ sẵn boundary rõ ràng để sau khi ERD LV3 và các invariant được review/freeze, team có thể bắt đầu migration/schema theo một hướng duy nhất.

## Structure

```text
database/
├── README.md
├── migrations/
│   └── README.md
└── seeds/
    └── README.md
```

## `migrations/`

Nơi dành cho các PostgreSQL migration có version trong giai đoạn implementation.

Hiện tại: **skeleton only**.

## `seeds/`

Nơi dành cho development/test/reference seed data trong giai đoạn implementation.

Hiện tại: **skeleton only**.

## Không đặt ở đây trong foundation stage

- ERD source/snapshot;
- schema thử nghiệm chưa được review;
- DBML song song với ERD;
- Redis design tự phát;
- ORM model dùng để quyết định ngược business model.

Các tài liệu thiết kế nằm tại `docs/database/`.

## Gate trước implementation

Chỉ bắt đầu tạo schema/migrations khi các điểm sau đã được chốt:

1. scope và domain ownership;
2. LV1 conceptual model;
3. LV2 logical model;
4. LV3 PostgreSQL physical candidate;
5. cardinality và lifecycle invariant quan trọng;
6. source-of-truth convention.
