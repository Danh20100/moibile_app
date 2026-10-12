# SePay production contract pin (2026-10-09)

Pinned from the public SePay developer pages before migration `000007`. Sandbox hosts stay sandbox-only.

| Use | Value |
| --- | --- |
| Checkout form POST | `https://pay.sepay.vn/v1/checkout/init` |
| REST origin | `https://pgapi.sepay.vn` |
| Order list | `GET /v1/order` with `q` set to the exact local invoice |
| Order detail | `GET /v1/order/detail/{order_id}` where `order_id` is the remote id (example `SEPAY-68BA83CE637C1`) |
| Paid status | `CAPTURED` |
| Awaiting payment | `AUTHENTICATION_NOT_NEEDED` |
| Cancelled | `CANCELLED` |
| Bank method | `BANK_TRANSFER` on the transaction, not inferred from the order |
| Auth | `Authorization: Basic base64(merchant_id:secret_key)` |

Sources: `developer.sepay.vn` checkout form, quick start, list orders, and get order details, read 2026-10-09.

Settlement requires one list hit (`meta.total = 1`, `has_more = false`, `page_count = 1`, `current_page = 1`, `data.length = 1`, `order_invoice_number` equal to the stored invoice) and a detail document with the same remote `order_id`. The detail example does not echo the merchant. Merchant binding is the Basic Auth credential plus `production:<merchantId>`. A merchant field, when present, must equal that merchant. The invoice and the remote order id are never interchangeable. A 404 or an empty list is not proof that no order exists.

A paid detail is `order_status = CAPTURED`, currency `VND`, and exactly one transaction: `PAYMENT`, `APPROVED`, `BANK_TRANSFER`, `VND`, whole-VND amount equal to the order and the checkout. The transaction `id` is the settlement id. The detail example shows `CARD`; a card transaction does not settle.

Form signing stays the pinned SDK order (HMAC-SHA256, Base64, insertion order). `signature` is not part of the signed string. Browser return URLs are not payment evidence. SePay's published failure and retry matrix is still unresolved. The local IPN policy, chosen 2026-10-09, is not that matrix: `POST /api/v1/finance/checkouts/sepay/ipn` compares `X-Secret-Key` before lookup, then settles only from the existing REST bank-transfer read. A committed or duplicate Payment is acknowledged with raw `200 {"success":true}`. A bad secret is 401, a non-`ORDER_PAID` or unusable body is 400, an unknown, pending, or uncertain order is 503, and a settlement conflict is 409. Those responses do not acknowledge success and do not write money. `TRANSACTION_VOID` does not cancel a Payment.
