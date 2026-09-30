# API Contract (OpenAPI)

`openapi.json` là contract OpenAPI được export từ backend TrọƠi hiện hành, dùng làm nguồn ổn định
để Frontend consume sau khi lane Backend+Database merge vào staging. Không suy endpoint/DTO từ
source code — đọc file này.

## Base path

Tất cả path trong contract nằm dưới server `/api/v1` (xem mục `servers` trong `openapi.json`).

## Phạm vi

Contract chỉ mô tả CURRENT-core capability. FUTURE scaffolding (Subscription/Pricing/Quota,
CSV/Excel bulk Onboarding) **không** được advertise ở đây. Search/Map chỉ expose public projection
(`/api/v1/listings/public`). Capability/relationship thay cho global landlord/tenant role.

## Regenerate

```powershell
pnpm openapi:generate            # ghi docs/api/openapi.json
pnpm openapi:generate <path>     # ghi ra path tùy chọn
```

Script chạy ở Nest preview mode nên không cần PostgreSQL hay chạy HTTP server. Contract cũng được
serve runtime tại `/docs` (Swagger UI) từ cùng một cấu hình ở `src/openapi.ts`.

Khi controller/DTO thay đổi, chạy lại `pnpm openapi:generate` và commit `openapi.json` để Frontend
luôn có bản mới nhất.
