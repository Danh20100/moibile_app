# billing

> Authority: Canonical v3.7 / frozen Database v1 override this module and current code.

## Purpose

The pre-database-v1 `billing` module is being absorbed conceptually into the Database v1 finance bounded context. Receivable obligations and actual money inflow are separate.

## Current ownership

- `BILLING_CYCLE` identifies the receivable period and applicable Tenancy/Terms provenance.
- `CHARGE` is the receivable obligation.
- Current charge types are exactly `RENT | ELECTRICITY | WATER`.
- `UTILITY_CONNECTION` / `METER_READING` provide utility facts where applicable.
- `PAYMENT` is actual inflow and is **not** a BillingCycle field.
- `PAYMENT_ALLOCATION` applies Payment to Charge.

`paidAmount`, `outstandingBalance` and billing status may exist only as derived/read projections, not a second mutable source of truth.

## Known pre-database-v1 code drift

Current code owns mutable `paidAmount`, `outstandingBalance`, a cycle lifecycle such as `upcoming/due/partial/overdue/paid`, arbitrary string charge types, and `applyPaymentOutcome()`. Those semantics are superseded and scheduled to break.