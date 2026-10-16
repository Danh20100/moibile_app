# Tài liệu kỹ thuật TrọƠi

Nhánh chính chỉ giữ các tài liệu **được source/test sử dụng**, không giữ handoff, Superpowers plans, audit theo phiên và ảnh/video evidence cũ. Những tài liệu đã loại khỏi working tree vẫn có trong lịch sử Git.

| Nhóm | Vai trò |
| --- | --- |
| [API](api/README.md) | OpenAPI contract; [openapi.json](api/openapi.json) do script sinh ra |
| [Database](database/README.md) | Database v1/vNext, ERD, schema, các ràng buộc nghiệp vụ cần kiểm chứng |
| [Contexts](contexts/README.md) | Tóm tắt hệ thống và luồng giữa các layer |
| [Backlogs](backlogs/README.md) | Acceptance criteria nghiệp vụ còn được E2E YAML tham chiếu |
| [Design V1](designs/README.md) | Product/design/Android contract hiện hành |

Hướng dẫn **chạy, build và cấu hình** nằm trong [README root](../README.md). Chi tiết theo chức năng nằm cạnh code tại [src/modules](../src/modules/), [integrations](../src/integrations/) và [tests](../tests/).

Trước khi loại bỏ thêm bất kỳ tài liệu nào trong các nhóm trên, kiểm tra tham chiếu trong test/CI và chạy:

```powershell
python scripts/verify_docs_links.py --scope all
pnpm test:conformance:database-v1
```

Không coi tài liệu cũ là bằng chứng tính năng đang hoạt động; test và runtime mới là nguồn kiểm chứng.
