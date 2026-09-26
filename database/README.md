# Database workspace

`database/` chỉ chứa **executable persistence artifacts** sau khi ERD LV3 đã được review.

## Current status

Database foundation đang ở giai đoạn thiết kế ERD. Hiện tại chưa có schema, migration hay seed executable nào được xem là canonical.

## Source flow

```text
docs/database/canonical.md
        ↓
docs/database/erd/ — LV1 → LV2 → LV3
        ↓
database/ — schema / migrations / seeds
```

## Rules

- Không đặt ERD hoặc design docs trong `database/`.
- Không viết schema/ORM trước rồi ép domain model chạy theo.
- Chỉ bắt đầu migration khi LV3 và các invariant liên quan đã được review.
- Migration đã chia sẻ là history; không rewrite âm thầm.
- Seed data không được trở thành nguồn business rule.

Các tài liệu thiết kế nằm tại `docs/database/`.
