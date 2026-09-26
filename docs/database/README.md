# TrọƠi Database Foundation

`docs/database/` là nơi duy nhất chứa **database design documentation** của TrọƠi.

Mọi ERD, logical model và physical candidate trong khu vực này phải xuất phát từ cùng một business truth: [`canonical.md`](./canonical.md).

## Trusted source

[`canonical.md`](./canonical.md) là **Trusted Source duy nhất cho Product & Domain Model**.

Nó chốt:

- product scope và ranh giới MVP;
- domain ownership;
- cardinality chính;
- state machine và lifecycle;
- source-of-truth rule;
- cross-domain invariants;
- phân loại `CURRENT / OPEN / FUTURE`.

Một thiết kế phía dưới mâu thuẫn với nội dung `[FROZEN]` phải được sửa lại. Không “fix” canonical bằng cách âm thầm đổi schema.

## Design flow

```text
canonical.md
    ↓
ERD LV1 — Conceptual
    ↓ review / freeze
ERD LV2 — Logical
    ↓ review / freeze
ERD LV3 — Physical Candidate
    ↓ review
PostgreSQL schema / migrations
```

## Structure

```text
docs/database/
├── README.md
├── canonical.md
├── tech-stack.md
└── erd/
    └── README.md
```

### `canonical.md`

Business/domain authority. Không phải ERD, không phải schema, không phải implementation note.

### `tech-stack.md`

Chỉ mô tả trách nhiệm công nghệ của PostgreSQL, Redis và MinIO. Tài liệu này không sở hữu entity, cardinality hay lifecycle.

### `erd/`

Workspace cho LV1/LV2/LV3 mới được dựng trực tiếp từ canonical.

## Current state

```text
Canonical v3.6          FROZEN / TRUSTED
ERD LV1                 chưa dựng lại
ERD LV2                 chưa dựng lại
ERD LV3                 chưa dựng lại
Executable schema       chưa bắt đầu
Migrations              chưa bắt đầu
```

Các policy `[OPEN]` trong canonical không chặn LV1 nếu ownership/boundary đã rõ. Tuy nhiên, một policy `[OPEN]` phải được chốt trước khi nó ảnh hưởng tới migration hoặc workflow được implement.

## Working rules

1. Đi từ LV1 xuống LV3, không đi ngược từ SQL lên domain.
2. Mỗi level chỉ thêm mức chi tiết phù hợp với trách nhiệm của nó.
3. Level thấp hơn không được silently thêm business semantics mới.
4. Không dùng ERD/snapshot cũ làm input cho lần rebuild này.
5. Feature `[FUTURE]` không được xuất hiện trong core model hiện tại nếu canonical chưa đổi trạng thái.
6. Khi thay đổi một invariant `[FROZEN]`, cập nhật canonical trước rồi propagate xuống ERD/schema.

Bắt đầu dựng ERD tại [`erd/README.md`](./erd/README.md).