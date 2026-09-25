# TrọƠi ERD snapshots

Thư mục này lưu **versioned JSON review snapshots** của ba ERD hiện được maintain trên Lucid.

## Source model

Lucid là visual collaboration source dùng để thảo luận/chỉnh sửa. JSON trong repository giúp team review/version-control cùng source code và docs.

> Các file JSON này **không phải native Lucid backup/import format**. Chúng intentionally bỏ canvas metadata như tọa độ, màu sắc và internal shape ID khi những dữ liệu đó không cần cho database review.

## Files

| File | Level | Purpose | Lucid document |
| --- | --- | --- | --- |
| `TroOi_ERD_LV1_TongQuan.json` | LV1 — Conceptual | Business/domain backbone | `535786d8-68da-4dd9-97ae-6c02178470be` |
| `TroOi_ERD_LV2_LogicDB.json` | LV2 — Logical | Detailed logical model | `3d20b82a-652f-480c-a4cf-21d69fabe9f8` |
| `TroOi_ERD_LV3_ChiTiet.json` | LV3 — Physical candidate | PostgreSQL-oriented physical candidate | `4149b201-d7b5-4c75-97ac-1e047cd517dd` |

## Responsibility by level

### LV1

Trả lời: domain nào tồn tại, ai sở hữu gì, backbone lifecycle chạy ra sao.

Không dùng LV1 để quyết định column/datatype chi tiết.

### LV2

Trả lời: capability cần entity nào, relationship/cardinality nào và boundary nằm ở đâu.

### LV3

Trả lời: physical candidate trên PostgreSQL cần datatype, nullability, unique/check constraint nào.

LV3 vẫn là **candidate để review**, chưa phải executable schema.

## Synchronization rule

```text
Product / business scope
        ↓
LV1 conceptual
        ↓
LV2 logical
        ↓
LV3 physical candidate
        ↓
Repository JSON snapshots
        ↓
Foundation freeze
        ↓
PostgreSQL implementation
```

Một level thấp hơn không được silently thêm business rule làm mâu thuẫn level cao hơn. Nếu Lucid thay đổi, snapshot JSON tương ứng cần được refresh trước khi downstream implementation được xem là aligned.

## Không dùng

Các `.drawio` ERD cũ trên branch trước đây không còn là source of truth cho foundation này.
