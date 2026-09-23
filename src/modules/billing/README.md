# Billing Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Quản lý chu kỳ thu tiền, khoản phải thu và công nợ trong quá trình thuê.

## Sở hữu

- Billing period/cycle.
- Charges: tiền thuê, điện, nước, wifi, giữ xe và phụ phí khác.
- Receivable và outstanding balance.
- Trạng thái kỳ thu: sắp đến hạn, đến hạn, đã thu, còn nợ, quá hạn.

## Không thuộc module

- Bản ghi biên nhận/xác nhận thanh toán.
- Payment gateway.
- Subscription SaaS của TrọƠi.

## Quan hệ chính

`tenancy`, `room`, `receipt`, `audit-trust`.

Billing là workflow riêng, không được biểu diễn bằng một cờ `paid` trên room.
