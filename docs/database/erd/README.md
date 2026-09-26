# TrọƠi ERD workspace

Thư mục này đã được reset trước khi dựng ERD mới.

**Hiện không có ERD snapshot nào được xem là hợp lệ.** Mọi ERD mới phải được dựng từ `../canonical.md` theo đúng thứ tự:

```text
Canonical
→ LV1 Conceptual
→ review/freeze
→ LV2 Logical
→ review/freeze
→ LV3 Physical candidate
→ database implementation
```

## Responsibility

- **LV1:** entity/domain backbone, ownership, lifecycle và cardinality chính.
- **LV2:** logical entities, junction/supporting entities và relationship chi tiết.
- **LV3:** PostgreSQL-oriented physical candidate: datatype, nullability, indexes và constraints.

## Snapshot naming

```text
trooi-erd-lv1-conceptual.json
trooi-erd-lv2-logical.json
trooi-erd-lv3-physical.json
```

Một level thấp hơn không được thêm business rule làm mâu thuẫn level cao hơn. Snapshot cũ không được dùng làm nguồn để rebuild ERD mới.
