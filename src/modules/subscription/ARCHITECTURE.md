# subscription Architecture

> Canonical v3.7 / frozen ERD3 is authoritative.

## Classification

This module is FUTURE scaffolding.

## Non-authority rules

- current-core modules must not depend on Subscription/Pricing/Quota to satisfy ERD3 invariants;
- existing `free | starter | pro` contracts are not frozen domain truth;
- entitlement decisions must not be used to preserve this module as current scope;
- no current schema/migration work should be derived from this module.

## Reconciliation note

The active import of SubscriptionModule in `AppModule` is intentional RED evidence for the ERD3 scope-conformance suite. A later core-rebuild task decides how future scaffolding is isolated or removed.