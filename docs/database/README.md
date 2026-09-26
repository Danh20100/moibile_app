# Database foundation

`docs/database/` là nơi duy nhất chứa tài liệu thiết kế database của TrọƠi.

## Structure

```text
docs/database/
├── README.md
├── canonical.md
├── tech-stack.md
└── erd/
    └── README.md
```

## Authority

`canonical.md` là **trusted source** cho Product & Domain Model. ERD và schema phía dưới phải bám theo tài liệu này, không tự diễn giải business rule khác đi.

```text
canonical.md
    ↓
ERD LV1 — Conceptual
    ↓
ERD LV2 — Logical
    ↓
ERD LV3 — Physical candidate
    ↓
Schema / migrations
```

`tech-stack.md` chỉ mô tả trách nhiệm công nghệ, không sở hữu entity/cardinality/invariant.

`erd/` là workspace cho snapshot ERD mới sau khi dựng lại từ canonical.
