# Property Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Quản lý tài sản/khu trọ và thông tin vị trí dùng để nhóm các phòng.

## Sở hữu

- Property profile.
- Tên, địa chỉ và metadata vận hành ở cấp tài sản.
- Quan hệ property → rooms.
- Thông tin vị trí nền cho các module cần tham chiếu.

## Không thuộc module

- Trạng thái vận hành chi tiết của từng room.
- Listing public.
- Kỳ thuê, công nợ hoặc ticket sự cố.

## Quan hệ chính

`organization`, `room`, `listing`.

Module này chưa chốt schema địa chỉ, geocoding hay map provider.
