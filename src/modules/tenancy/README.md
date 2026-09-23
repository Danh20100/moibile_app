# Tenancy Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Quản lý kỳ thuê và quan hệ giữa room với tenant trong một khoảng thời gian xác định.

## Sở hữu

- Tenancy lifecycle.
- Tenant assignment theo kỳ thuê.
- Ngày vào ở, dự kiến trả phòng và ngày kết thúc thực tế.
- Các điều khoản vận hành như giá thuê, cọc và phụ phí nền của kỳ thuê.

## Không thuộc module

- Chu kỳ thu tiền hằng tháng.
- Payment gateway.
- Hồ sơ room gốc.
- Ticket sự cố.

## Quan hệ chính

`room`, `identity-access`, `billing`, `receipt`, `audit-trust`.

Một room có thể có nhiều tenancy theo thời gian; tenancy không được đồng nhất với trạng thái room.
