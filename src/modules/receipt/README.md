# Receipt Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Quản lý bản ghi thanh toán/biên nhận và lịch sử xác nhận phục vụ đối chiếu vận hành.

## Sở hữu

- Payment record ở mức vận hành.
- Receipt/acknowledgement record.
- Tham chiếu tới khoản phải thu liên quan.
- Trạng thái xác nhận của các bên khi cần.

## Không thuộc module

- Payment gateway hoặc settlement ngân hàng.
- Tính toán công nợ tổng thể.
- Cam kết pháp lý hay chứng từ pháp lý thay cho các bên.

## Quan hệ chính

`billing`, `tenancy`, `identity-access`, `audit-trust`.

Biên nhận trong MVP là dữ liệu vận hành để theo dõi và đối chiếu, không phải dịch vụ pháp lý.
