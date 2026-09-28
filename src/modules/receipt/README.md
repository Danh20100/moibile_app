# receipt

> Authority: Canonical v3.7 / frozen ERD3 override this module and current code.

## Purpose

Receipt is evidence issued from an eligible confirmed Payment. Receipt is not the payment record and does not own settlement truth.

## Current ERD3 lifecycle

`ISSUED | VOIDED`

Historical receipts may be retained, with at most one current receipt for a Payment.

## Invariants

- Receipt belongs to Payment;
- Receipt is issued only from confirmed Payment;
- voiding Receipt does not rewrite the underlying Payment fact;
- confirmed Payment correction uses void/reverse + a new Payment rather than destructive edit.

## Known pre-ERD3 code drift

Current `ReceiptRecord` stores tenancy/billing/amount/payment method and uses `recorded → confirmed`, effectively acting as Payment truth. That ownership is superseded and scheduled to break.