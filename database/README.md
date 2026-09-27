# TrọƠi Database Workspace

`database/` là nơi chứa **executable persistence artifacts** của TrọƠi sau khi thiết kế ERD đã đi tới LV3 và được review.

Hiện tại thư mục này chưa chứa schema, migration hay seed executable. Đây là chủ đích: business model phải được chốt ở tầng canonical/ERD trước khi hạ xuống PostgreSQL.

## Authority

```text
docs/database/canonical-v3.7.md
        ↓
docs/database/erd/ — LV1 → LV2 → LV3
        ↓
database/ — schema / migrations / seeds
```

`database/` không được tự tạo business rule mới. Nếu physical design cần một rule chưa tồn tại trong canonical hoặc ERD cấp cao hơn, phải đưa vấn đề ngược lên để review trước.

## Implementation gate

Chỉ bắt đầu persistence implementation khi:

1. LV1 conceptual đã được review/freeze;
2. LV2 logical đã được review/freeze;
3. LV3 physical candidate đã được review;
4. cardinality, lifecycle và cross-domain invariant liên quan đã rõ;
5. các mục `[OPEN]` ảnh hưởng trực tiếp tới schema đang triển khai đã được chốt.

## Khi implementation bắt đầu

Cấu trúc có thể mở rộng theo nhu cầu thực tế, ví dụ:

```text
database/
├── README.md
├── schema/
├── migrations/
└── seeds/
```

Tên tool/migration framework chưa được quyết định ở đây.

## Rules

- PostgreSQL là authoritative relational store cho business data.
- Migration đã được chia sẻ là history; không rewrite âm thầm.
- Seed chỉ dùng cho development/test/reference data hợp lệ, không chứa dữ liệu thật của tenant/customer.
- Không đặt ERD, review note hay business decision vào `database/`.
- Không dùng ORM model hoặc SQL để quyết định ngược domain model.
- Không đưa feature `[FUTURE]` trong canonical vào schema hiện tại chỉ để “chuẩn bị trước”.

Tài liệu thiết kế bắt đầu tại [`docs/database/README.md`](../docs/database/README.md).
