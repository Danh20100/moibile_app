# TrọƠi

TrọƠi is a rental-lifecycle platform. This repository is a monorepo whose product surface is an
Android application, backed by a NestJS backend and a PostgreSQL/PostGIS database, with a web
project kept in a marketing/preview role.

| Area | Location | Role |
| --- | --- | --- |
| Android app | `app/` | Primary product client (Kotlin/Compose, Gradle) |
| Backend | `src/` | NestJS domain/application services and API |
| Database | `database/`, `docs/database/v1/` | PostgreSQL/PostGIS migrations, seeds and the frozen Database v1 contract |
| Web | `web/` | Marketing/preview surface, not a second business app |

The backend source of truth is the frozen Canonical v3.7 / Database v1 model. Product prose, module
documentation, DTOs, services and tests are implementation layers below that authority.

## Domain authority

Read in this order before changing backend domain behavior:

1. `docs/database/v1/canonical.md`
2. `docs/database/v1/erd/conceptual.json`
3. `docs/database/v1/erd/logical.json`
4. `docs/database/v1/erd/physical.json`
5. `docs/database/v1/schema/` executable SQL snapshot
6. `docs/contexts/` shared mental model and cross-layer contracts
7. target module `README.md` / `ARCHITECTURE.md`
8. implementation and tests

If a lower-level document or implementation conflicts with a frozen invariant, the lower-level
artifact is wrong and must change. Database v1 authority is not weakened to preserve pre-freeze
behavior.

## Current domain shape

The CURRENT backend model distinguishes identity, workspace, property/room state, discovery,
tenancy, financial obligations, actual money inflow, deposit handling, incidents and trust history.

Key ownership boundaries:

- `USER` is digital identity. There is no global landlord/tenant/operator role.
- `ORGANIZATION` is the rental operating workspace and has one primary owner reference in the MVP model.
- `PROPERTY` and `ROOM` own operational asset identity and lifecycle.
- `LISTING` is a discovery projection, not the operational room record.
- `TENANCY`, `TENANCY_PARTICIPANT` and versioned `TENANCY_TERMS` are distinct concepts.
- `BILLING_CYCLE` / `CHARGE` represent receivable obligations.
- `PAYMENT` represents actual money inflow. Payment is actual money inflow, not a receipt artifact.
- `RECEIPT` is evidence issued from an eligible confirmed Payment; Receipt is not the Payment record.
- `DEPOSIT` owns deposit fulfillment/holding/settlement facts.
- `INCIDENT` owns the problem lifecycle and `INCIDENT_EVENT` is append-only history.
- `TRUST_REPORT` targets Listing or Review and does not become a public rating mechanism.

## Scope discipline

Canonical items marked `[OPEN]` remain unresolved until the authority itself resolves them.
Implementation must not silently choose a policy through DTO defaults, guards, migrations or
convenience constants.

Canonical items marked `[FUTURE]` are not current-core requirements. In particular,
Subscription/Pricing/Quota and CSV/Excel import are FUTURE even if pre-ERD3 scaffolding still
exists in the repository.

## Backend and database runtime

The backend is contract-first and PostgreSQL/PostGIS-targeted. Runtime persistence and migrations
are implemented: current application services read and write through persistence repositories, the
Database v1 migrations create the frozen physical catalog and development seeds run on that schema.
Redis and MinIO are not part of the current runtime.

See `database/README.md` for the local database workflow and `docs/database/v1/implementation-history.md`
for evidence-based provenance of what has been implemented.
