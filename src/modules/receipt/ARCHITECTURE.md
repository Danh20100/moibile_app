# receipt Architecture

> Canonical v3.7 / frozen Database v1 is authoritative.

## Ownership

Receipt owns evidence derived from confirmed Payment. It does not own actual money inflow or receivable settlement.

## Lifecycle

`ISSUED | VOIDED`

## Invariants

- exactly one Payment reference per Receipt;
- Receipt may be issued only for confirmed Payment;
- zero or more historical receipts may exist, with at most one current receipt;
- Receipt voiding preserves history;
- Payment correction happens in Payment workflow, not by rewriting Receipt into another payment fact.

## Rebuild note

The current `recorded | confirmed` Receipt lifecycle and Receipt-as-payment contract are intentionally incompatible with Database v1 and should fail conformance until replaced.