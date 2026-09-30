# Handoff — Duy Anh — Full-stack Contract Support

**Vai trò:** Backend + Database contract support
**Branch:** `backend/full-stack-contract-support`
**Base:** staging sau coordination-doc commit
**Không merge staging trực tiếp.**

## Đọc trước khi làm

1. `docs/superpowers/specs/2026-09-30-full-stack-runtime-connection-design.md`
2. `docs/superpowers/plans/2026-09-30-full-stack-runtime-connection.md`
3. `docs/api/openapi.json`
4. `docs/backlogs/v1/identity-access.md`
5. Canonical/Database v1 khi chạm invariant.

## Tình trạng đầu vào

Backend+Database Gate 1 đã GREEN tại `31eb586` và đã merge staging bằng `c4a28c8`.
Phase này không rebuild persistence. Nhiệm vụ chính là làm contract đủ an toàn/đủ rõ để Android consume.
## P0 — sửa auth trước

Finding đã xác minh:

- `AuthGuard` hiện chỉ check header bắt đầu bằng `Bearer `;
- arbitrary non-empty bearer chưa được verify;
- Google verifier thật chỉ chạy trong `POST /identity-access/auth/google`.

Phải sửa để protected route verify Google ID Token thật và attach verified principal vào request context.
Test bắt buộc: invalid bearer → 401; valid fake-verifier token → request đi tiếp; public route không yêu cầu token.

Không tạo custom JWT/session system mới trong phase này.

## P0 — session context

Thêm `GET /identity-access/me` đọc current verified user và trả tối thiểu:

```text
userId
operatedOrganizationIds[]
linkedTenancyIds[]
```

Không nhận `userId` từ client. Không global role.
## P0 — OpenAPI client contract

Current generated contract có `components.schemas = {}` và phần lớn request/response business endpoint chưa có schema; bearer scheme cũng chưa gắn vào protected operations.

Phải làm OpenAPI đủ để Android map DTO mà không đọc source Backend:

- named request/response schemas;
- parameter types;
- bearer security cho protected operation;
- public metadata đúng cho health, public listings, Google auth;
- deterministic generate.

Thêm test `openapi-client-contract` để lỗi này không quay lại.

## Phạm vi không được làm

- không đổi Canonical để hợp client;
- không đưa Subscription/CSV import thành CURRENT;
- không invent password/signup/reset API;
- không quyết policy OPEN;
- không sửa `app/**` hoặc `web/**`.

## Verification bắt buộc trước khi báo done

Chạy trên exact SHA cuối:

```text
pnpm typecheck
pnpm lint
pnpm test:core-foundation
python -m unittest discover -s tests/database -p "test_*.py"
pnpm test:conformance:database-v1
PostgreSQL provision + db:migrate + db:seed
pnpm test:persistence:migration
pnpm openapi:generate
pnpm test
```

Generated OpenAPI phải sạch khi generate lần hai.

## Report cuối

Gửi:

```text
FINAL SHA
AUTH VERIFICATION RESULT
/session-context RESULT
OPENAPI CONTRACT RESULT
DB MIGRATION/PARITY RESULT
FULL TEST RESULT
KNOWN GAPS
READY_TO_MERGE: YES/NO
```

Không tự merge vào staging.