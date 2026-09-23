# Incident Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Quản lý vòng đời ticket sự cố gắn với room và lịch sử xử lý.

## Sở hữu

- Incident/ticket.
- Category, mô tả và reporter.
- Attachment references.
- Trạng thái ticket và timeline xử lý.
- Thời điểm tạo, tiếp nhận, xử lý và đóng.

## Không thuộc module

- Marketplace đối tác dịch vụ.
- Bảo hành/sửa chữa thực tế.
- Trạng thái vận hành chính của room.

## Quan hệ chính

`room`, `identity-access`, `audit-trust`.

MVP chỉ ghi nhận, theo dõi và lưu lịch sử; TrọƠi không tự chịu trách nhiệm sửa chữa.
