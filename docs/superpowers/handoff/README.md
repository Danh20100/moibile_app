# Handoff

`docs/superpowers/handoff/` là vị trí chuẩn để lưu tài liệu bàn giao giữa agent/dev/session và các review response liên quan.

Handoff phải đủ độc lập để người nhận có thể tiếp tục công việc mà không cần dựa vào lịch sử chat.

## Quy tắc đặt tên

```text
<recipient>-<YYYYMMDD-HHmmss>-<short-description>.md
```

Quy ước:

- `recipient`: handle người/agent nhận, viết thường, ví dụ `duyanh`;
- timestamp: giờ local project (`Asia/Ho_Chi_Minh`, UTC+07:00);
- `short-description`: scope ngắn gọn dạng kebab-case;
- một lần bàn giao = một file Markdown có timestamp riêng, không overwrite handoff cũ.

Không tạo `HANDOFF.md` chung ở root repository.

## Nội dung tối thiểu của một handoff

Handoff nên xác định rõ:

- repository/branch/SHA baseline;
- scope đã hoàn thành;
- phần chưa hoàn thành;
- quyết định hoặc constraint quan trọng;
- verification/evidence đã chạy;
- limitation hoặc non-claim;
- bước tiếp theo mà người nhận cần thực hiện.
## Review response

Review của handoff nằm tại:

```text
docs/superpowers/handoff/reviews/
```

Tên file review:

```text
<reviewer>-<YYYYMMDD-HHmmss>-<handoff-short>-review.md
```

Mỗi review phải link tới đúng handoff được review và ghi chính xác Git SHA đã kiểm tra.

Finding sử dụng một trong các classification token sau:

```text
CONFIRMED_DEFECT
INTENTIONAL_DEVIATION
CONTEXT_MISSING
PROPOSED_IMPROVEMENT
NEEDS_OWNER_DECISION
```

Không suy đoán động cơ. Phải tách riêng observed fact, inferred intent, verified intent, evidence, recommendation và owner decision. Nếu rationale chỉ hợp lý nhưng chưa được chứng minh, ghi `Possible rationale - unverified`.

Review không tự động cho phép sửa code. Những finding thay đổi architecture/product/scope/authority hoặc thiếu evidence phải được escalate thay vì tự quyết.

Đọc [`reviews/README.md`](reviews/README.md) để xem protocol đầy đủ và dùng [`reviews/TEMPLATE.md`](reviews/TEMPLATE.md) khi tạo review mới.
