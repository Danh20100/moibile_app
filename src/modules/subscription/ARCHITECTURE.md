# subscription Architecture

> Canonical v3.7 / frozen ERD3 is authoritative.

## Classification

This module is FUTURE scaffolding.

## Non-authority rules

- current-core modules must not depend on Subscription/Pricing/Quota to satisfy ERD3 invariants;
- existing `free | starter | pro` contracts are not frozen domain truth;
- entitlement decisions must not be used to preserve this module as current scope;
- no current schema/migration work should be derived from this module.

## Task 17 ruling

- Subscription is not a Task 17 persistence blocker.
- `SubscriptionModule` is isolated from `AppModule` and current-core modules.
- Its in-memory prototype state is FUTURE-only and is not current business authority.
- Do not create a Subscription repository, table, or migration under the frozen 29-table contract.
