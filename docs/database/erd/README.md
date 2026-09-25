# TrọƠi ERD Sources

Thư mục này chứa **editable source** của các ERD database dưới định dạng `.drawio`.

## Quy ước level

| File | Vai trò |
| --- | --- |
| `TroOi_ERD_LV1_TongQuan.drawio` | Conceptual ERD — entity chính, business relationship và cardinality cấp cao |
| `TroOi_ERD_LV2_LogicDB.drawio` | Logical ERD — resolve M:N, junction table, ownership/reference rõ hơn |
| `TroOi_ERD_LV3_ChiTiet.drawio` | Detailed/physical candidate — datatype, constraint, index/delete policy sau khi logical model đã được chốt |

## Source-of-truth rule

ERD phải bám theo `docs/database/schema-scope-review.md` và project/backend domain contract hiện hành.

Không chấp nhận tình trạng:

```text
LV1 ≠ LV2 ≠ LV3 ≠ DBML ≠ schema.sql
```

Khi thay đổi domain model:

1. cập nhật conceptual model nếu ownership/cardinality thay đổi;
2. propagate sang logical model;
3. cập nhật detailed/physical candidate;
4. sau đó mới cập nhật DBML/SQL/migration tương ứng.

PNG/SVG chỉ là export để review; không phải editable source.
