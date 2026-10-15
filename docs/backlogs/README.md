# Backlogs

Thư mục này chứa các backlog được version hóa và vẫn đang hoạt động hoặc tiếp tục được phát triển.

Backlog hiện hành: [`v1/`](./v1/).

## Quy tắc

- `vN/` nhóm backlog theo development baseline tương ứng.
- Backlog mô tả **phạm vi công việc cần đạt được xuyên Frontend → Backend → Database**, không override canonical/domain authority.
- Mục Canonical đang `OPEN` hoặc `FUTURE` không tự động trở thành backlog hiện tại nếu chưa được scope rõ ràng.
- Một item đã được implement một phần vẫn có thể nằm trong `vN/` khi version backlog đó còn đang phát triển.
- Việc đóng hoặc archive một backlog version là quyết định riêng, không được suy ra chỉ từ commit history.

## Cách đọc

Bắt đầu từ [`v1/README.md`](./v1/README.md) để hiểu format vertical slice, sau đó mở feature tương ứng. Mỗi feature phải giúp cả Frontend, Backend và Database hiểu cùng một user flow, business rule và tiêu chí hoàn thành.

Context chung nằm tại [`../contexts/`](../contexts/) và database authority hiện tại nằm tại [`../database/v1/`](../database/v1/).
