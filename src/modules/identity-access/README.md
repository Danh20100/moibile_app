# Identity & Access Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Quản lý danh tính người dùng và quyền truy cập vào TrọƠi.

## Sở hữu

- User identity/reference.
- Role và permission assignment.
- Invitation flow cho operator/tenant.
- Access checks ở mức application boundary.

## Không thuộc module

- Hồ sơ organization/property/room.
- Quan hệ thuê và dữ liệu tenant nghiệp vụ.
- Lựa chọn auth provider, OAuth hay cơ chế token cụ thể ở giai đoạn này.

## Quan hệ chính

`organization`, `tenancy`, `audit-trust`.

Module này chỉ khóa boundary. Entity, API, persistence và auth implementation sẽ được thiết kế sau.
