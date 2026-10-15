# billing Architecture

> Canonical v3.7 / frozen Database v1 is authoritative.

## Ownership model

The Database v1 finance model separates obligation from settlement:

```text
BillingCycle → Charge
Payment → PaymentAllocation → Charge
Payment → DepositPaymentApplication → Deposit
Payment → Receipt
```

BillingCycle/Charge own what is owed. Payment owns actual money inflow. Receipt owns evidence of eligible confirmed Payment.

## Invariants

- current Charge types: `RENT | ELECTRICITY | WATER` only;
- BillingCycle records applicable Tenancy and TenancyTerms provenance;
- PaymentAllocation may not cross Tenancy;
- allocation plus deposit application total may not exceed Payment amount;
- mutable cycle `paidAmount` / `outstandingBalance` / payment-outcome state is not authoritative source data.

## Rebuild note

`applyPaymentOutcome()` and the current mutable BillingCycle settlement model are pre-database-v1 abstractions. They must be removed rather than preserved through an adapter.