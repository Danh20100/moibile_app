# subscription

> Authority: Canonical v3.7 / frozen Database v1 override this module and current code.

## Scope classification

Subscription / Pricing / Quota is **FUTURE**, not CURRENT core authority.

The existing Nest module is pre-database-v1 scaffolding. Its presence in the repository must not be interpreted as a frozen current requirement or as justification to gate current domain behavior behind plan entitlements.

## Current rule

No Database v1 CURRENT invariant depends on subscription state. Do not add schema, migrations, guards or domain defaults that promote this module into current core without an authority update.

## Rebuild note

During reconciliation this module may be removed from the active AppModule surface or isolated as future scaffolding. Backward compatibility for its unpublished pre-database-v1 API is not required.