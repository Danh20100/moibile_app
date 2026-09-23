# Subscription Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Quản lý subscription SaaS của TrọƠi và quyền tính năng theo gói.

## Sở hữu

- Plan reference.
- Subscription lifecycle ở mức sản phẩm.
- Feature entitlements.
- Usage/limit metadata khi cần.

## Không thuộc module

- Thu tiền thuê giữa landlord và tenant.
- Payment gateway implementation.
- Billing cycle của phòng.

## Quan hệ chính

`organization`, `identity-access` và các module cần kiểm tra entitlement.

Business logic nên kiểm tra entitlement tập trung thay vì rải điều kiện theo tên gói trong toàn codebase.
