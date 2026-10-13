# TrọƠi

TrọƠi is a rental-lifecycle platform. This repository is a monorepo whose product surface is an
Android application, backed by a NestJS backend and a PostgreSQL/PostGIS database, with a separate public landing page maintained in its own repository.

| Area | Location | Role |
| --- | --- | --- |
| Android app | `app/` | Primary product client (Kotlin/Compose, Gradle) |
| Backend | `src/` | NestJS domain/application services and API |
| Database | `database/`, `docs/database/v1/` | PostgreSQL/PostGIS migrations, seeds and the frozen Database v1 contract |

The backend source of truth is the frozen Canonical v3.7 / Database v1 model. Product prose, module
documentation, DTOs, services and tests are implementation layers below that authority.

The marketing landing page lives independently in [TroOi-Landing-Page](https://github.com/onsra520/TroOi-Landing-Page). It is not an Android/backend build dependency.

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
Subscription/Pricing/Quota and CSV/Excel import are FUTURE even if legacy scaffolding still
exists in the repository.

## Backend and database runtime

The backend is contract-first and PostgreSQL/PostGIS-targeted. Runtime persistence and migrations
are implemented: current application services read and write through persistence repositories, the
Database v1 migrations create the frozen physical catalog and development seeds run on that schema.
Redis and MinIO are not part of the current runtime.

See `database/README.md` for the local database workflow and `docs/database/v1/implementation-history.md`
for evidence-based provenance of what has been implemented.

## Android test layout (root tests/)

Android Kotlin tests now live under [tests/android/](tests/android/README.md), alongside but separate from the NestJS TypeScript tests already in tests/. Android Gradle Plugin 9.2.1 discovers them via the explicit Kotlin source directories in app/build.gradle.kts. Run `python scripts/verify_android_test_layout.py`, `.\gradlew.bat :app:testDebugUnitTest :app:assembleDebugAndroidTest`, and `python scripts/verify_android_test_results.py` to ensure at least 192 JVM cases actually run.

Historical HTML/PNG demo previews were archived outside the working tree, not merged with the active Backend. See [legacy demo retention](docs/testing/LEGACY_DEMO_ARCHIVE.md) and [UI QA artifact retention](docs/testing/EVIDENCE_ARCHIVE.md). These archives remain local until uploaded to a shared durable store.
