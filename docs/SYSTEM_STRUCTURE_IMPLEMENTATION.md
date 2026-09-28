# Historical Backend Structure Implementation Report

> **HISTORICAL / SUPERSEDED DOMAIN SEMANTICS**
>
> This document records the pre-ERD3 backend scaffold and is **not current domain authority**. Its old lifecycle descriptions, ownership boundaries and module-scope assumptions are superseded by `docs/database/canonical-v3.7.md`, the frozen ERD LV1/LV2/LV3 artifacts and `docs/superpowers/specs/2026-09-28-erd3-backend-reconciliation-design.md`.
>
> Where this historical implementation conflicts with frozen ERD3 invariants, the implementation must change. Do not use this report to preserve old behavior.

## Historical purpose

The report originally documented the first modular NestJS/TypeScript backend foundation: common HTTP infrastructure, Swagger, twelve scaffolded modules and in-memory services designed before the database/domain freeze.

The engineering choices that remain useful as historical context include:

- NestJS modular-monolith direction;
- contract-first intent;
- global validation/error/response infrastructure;
- Google identity integration boundary;
- reference/decision/event collaboration idea;
- early audit tests and test-discovery work.

## Superseded domain assumptions

The following pre-ERD3 behaviors recorded by the old implementation are explicitly superseded and must not be treated as current requirements:

- Organization `active | inactive | archived` generic lifecycle as frozen truth;
- Room `draft → vacant ↔ occupied ↔ maintenance → archived` single-state lifecycle;
- direct `OCCUPIED → MAINTENANCE` Room transition;
- Room-owned `basePrice` as authoritative rent;
- Tenancy with direct `tenantId` and embedded mutable terms;
- Tenancy `active → ended` direct transition;
- Billing mutable `upcoming | due | partial | overdue | paid` source-of-truth lifecycle;
- `applyPaymentOutcome()` / cycle `paidAmount` / `outstandingBalance` as authoritative financial facts;
- Receipt `recorded → confirmed` acting as the payment record;
- Incident `processing` / `need_more_information` lifecycle;
- Listing `hidden` / `rented` states and Room-independent publish state;
- Subscription/Pricing/Quota as current core;
- CSV/Excel bulk import as current core;
- global User business roles such as owner/operator/tenant.

## Current authority replacement

Current domain ownership is defined by Canonical v3.7 and frozen ERD3, including:

- USER identity without global business role;
- ORGANIZATION with primary owner reference;
- PROPERTY `ACTIVE | ARCHIVED`;
- ROOM with separate `operational_state` (`VACANT | OCCUPIED | MAINTENANCE | INACTIVE`) and `record_lifecycle` (`ACTIVE | ARCHIVED`);
- LISTING `DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED` plus status history and vacancy coupling;
- TENANCY `DRAFT | ACTIVE | ENDING | ENDED | CANCELLED`, separate participant and versioned terms concepts;
- receivable obligations separated from actual Payment inflow;
- Payment allocation/deposit application as explicit first-class facts;
- Receipt as evidence from confirmed Payment (`ISSUED | VOIDED`);
- Incident current categories/lifecycle with append-only IncidentEvent history;
- Review/TrustReport separated from Incident;
- CURRENT/OPEN/FUTURE scope classification controlled only by Canonical authority.

## Verification history

Pass counts in the original report were evidence that the **pre-ERD3 implementation** was internally consistent at that point in time. They are not evidence of ERD3 conformance.

Post-ERD3 reconciliation intentionally introduces a new conformance suite that is expected to be RED against the old contracts until the domain core is rebuilt.

## Reading order

For current work, read:

1. `docs/database/canonical-v3.7.md`
2. `docs/database/erd/README.md`
3. frozen ERD LV1/LV2/LV3 artifacts
4. `docs/database/schema/trooi-schema-lv3.sql`
5. `docs/PROJECT_CONTEXT.md`
6. `docs/USE_CASES.md`
7. `docs/SYSTEM_CONTEXT.md`
8. target module docs
9. implementation/tests

This file is historical evidence only.