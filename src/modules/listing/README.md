# Listing Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Quản lý thông tin phòng/tài sản khi được đưa ra thị trường như một entry point tìm phòng.

## Sở hữu

- Listing lifecycle: nháp, đang đăng, tạm ẩn, đã có người thuê.
- Nội dung public của tin đăng.
- Giá/phụ phí/cọc được publish.
- Location/map data phục vụ discovery.
- Media references của listing.

## Không thuộc module

- Hồ sơ vận hành nội bộ của room.
- Kỳ thuê đang active.
- Marketplace dịch vụ.

## Quan hệ chính

`room`, `property`.

Listing là entry point hỗ trợ discovery; core value của TrọƠi vẫn là vận hành sau thuê.
