# Organization Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Biểu diễn chủ sở hữu/đơn vị vận hành và cấu trúc người vận hành tài sản.

## Sở hữu

- Organization/operator account ở mức nghiệp vụ.
- Quan hệ chủ sở hữu và người vận hành.
- Cấu trúc quản lý nhiều tài sản/khu trọ.
- Tham chiếu membership tới user identity.

## Không thuộc module

- Authentication implementation.
- Hồ sơ property/room.
- Billing của người thuê.

## Quan hệ chính

`identity-access`, `property`, `subscription`, `audit-trust`.

Module này chưa chốt entity chi tiết hay mô hình multi-tenant persistence.
