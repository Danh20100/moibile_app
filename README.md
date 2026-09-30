# TrọƠi

TrọƠi is a rental-lifecycle platform whose backend source of truth is the frozen Canonical v3.7 / ERD3 model. Product prose, module documentation, DTOs, services and tests are implementation layers below that authority.

## Domain authority

Read in this order before changing backend domain behavior:

1. `docs/database/canonical-v3.7.md`
2. `docs/database/erd/README.md`
3. `docs/database/erd/trooi-erd-lv1-conceptual.json`
4. `docs/database/erd/trooi-erd-lv2-logical.json`
5. `docs/database/erd/trooi-erd-lv3-physical.json`
6. `docs/database/schema/trooi-schema-lv3.sql`
7. `docs/PROJECT_CONTEXT.md`
8. `docs/USE_CASES.md`
9. `docs/SYSTEM_CONTEXT.md`
10. target module `README.md` / `ARCHITECTURE.md`
11. implementation and tests

If a lower-level document or implementation conflicts with a frozen invariant, the lower-level artifact is wrong and must change. ERD3 is not weakened to preserve pre-freeze behavior.

## Current domain shape

The CURRENT backend model distinguishes identity, workspace, property/room state, discovery, tenancy, financial obligations, actual money inflow, deposit handling, incidents and trust history.

Key ownership boundaries:

- `USER` is digital identity. There is no global landlord/tenant/operator role.
- `ORGANIZATION` is the rental operating workspace and has one primary owner reference in the MVP model.
- `PROPERTY` and `ROOM` own operational asset identity and lifecycle.
- `LISTING` is a discovery projection, not the operational room record.
- `TENANCY`, `TENANCY_PARTICIPANT` and versioned `TENANCY_TERMS` are distinct concepts.
- `BILLING_CYCLE` / `CHARGE` represent receivable obligations.
- `PAYMENT` represents actual money inflow.
- `RECEIPT` is evidence issued from an eligible confirmed Payment; it is not the Payment record.
- `DEPOSIT` owns deposit fulfillment/holding/settlement facts.
- `INCIDENT` owns the problem lifecycle and `INCIDENT_EVENT` is append-only history.
- `TRUST_REPORT` targets Listing or Review and does not become a public rating mechanism.

## Scope discipline

Canonical items marked `[OPEN]` remain unresolved until the authority itself resolves them. Implementation must not silently choose a policy through DTO defaults, guards, migrations or convenience constants.

Canonical items marked `[FUTURE]` are not current-core requirements. In particular, Subscription/Pricing/Quota and CSV/Excel import are FUTURE even if pre-ERD3 scaffolding still exists in the repository.

## Backend direction

The rework is contract-first and PostgreSQL/PostGIS-targeted. Runtime persistence and migrations are intentionally deferred until domain contracts converge with the frozen physical model. The current post-ERD3 reconciliation design is documented at `docs/superpowers/specs/2026-09-28-erd3-backend-reconciliation-design.md`.