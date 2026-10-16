# Identity Foundation — database addendum

Version: `vnext.identity-foundation.1` (**REVIEWED_FROZEN**). Đây là hợp đồng schema của Identity Foundation, không phải báo cáo chấp nhận runtime hoặc hướng dẫn handoff.

Các artifact có thể kiểm chứng:

| File | Vai trò |
| --- | --- |
| [freeze-manifest.json](freeze-manifest.json) | Version và fingerprints của artifact đã đóng băng |
| [logical.json](logical.json) | Quan hệ logic và field contract |
| [physical.json](physical.json) | Kiểu dữ liệu, index và constraints |
| [transaction-contract.md](transaction-contract.md) | Transaction boundaries / consistency rules |

## Ràng buộc kỹ thuật

- `USER` là root identity bất biến; không thêm global owner/tenant role.
- Identity/Profile/credential chỉ được tạo hoặc cập nhật theo transaction và compare-and-swap phù hợp.
- Google verification, email verification, password hashing và các chính sách session không được suy luận là an toàn chỉ vì database có constraint.
- Schema v1 đã có hiệu lực vẫn phải được giữ tương thích; migration mới là additive, không tự thay đổi các artifact frozen.

## Kiểm tra

Xem migrations trong [database/migrations](../../../../database/migrations/) và repository trong [src](../../../../src/). Chạy unit, integration và migration parity trên database test riêng; không dùng database có tiền thật. Giữ nguyên bytes các file frozen và xác nhận `freeze-manifest.json` trước mọi thay đổi.

Không sử dụng các báo cáo/phê duyệt lịch sử đã xóa khỏi working tree như bằng chứng tính năng đang hoạt động.
