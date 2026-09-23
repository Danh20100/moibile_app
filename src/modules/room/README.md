# Room Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Quản lý hồ sơ vận hành cốt lõi của từng phòng/tài sản cho thuê.

## Sở hữu

- Room profile.
- Room code/name và metadata cơ bản.
- Trạng thái vận hành chính của room.
- Liên kết room với property.
- Điểm neo để các workflow khác tham chiếu.

## Không thuộc module

- Kỳ thuê.
- Billing/công nợ.
- Ticket sự cố.
- Listing public.

## Quan hệ chính

`property`, `tenancy`, `billing`, `incident`, `listing`.

Room là object trung tâm của product nhưng không gom mọi workflow vào một state machine duy nhất.
