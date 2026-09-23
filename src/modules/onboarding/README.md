# Onboarding Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Giảm friction khi đưa dữ liệu vận hành ban đầu vào TrọƠi.

## Sở hữu

- Bulk room creation.
- Template nhập liệu.
- Excel/CSV import flow.
- Parse → validate → preview → confirm.
- Mapping dữ liệu import sang các bounded context đích.

## Không thuộc module

- Business ownership của room/tenancy/billing sau khi dữ liệu được tạo.
- AI/OCR production flow trong MVP.
- Human data-entry như một chiến lược vận hành mặc định.

## Quan hệ chính

`property`, `room`, `tenancy`, `billing`, `audit-trust`.

Dữ liệu import chỉ trở thành dữ liệu chính thức sau bước preview và xác nhận của người dùng.
