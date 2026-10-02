# Full-stack E2E

This directory owns deterministic data and cross-process E2E flows.

## Layout

- `fixtures/`: stable IDs and scenario data.
- `seed/`: local-only seed/reset utilities.
- `flows/`: atomic feature flow specifications.
- `cases/`: happy, negative, authorization, privacy, invariant, and cross-actor cases for V1.
- `journeys/`: end-to-end chains made from atomic flow IDs, including cross-actor journeys.
- `assertions/`: UI/API/DB/invariant assertion conventions.
- `maestro/`: executable Android cross-screen flows.
- `flow-catalog.yaml`: index and execution status for the V1 flow set.

Android Compose instrumentation remains under `app/src/androidTest/`.

## Current scenario

The first fixture covers public discovery:

`PostgreSQL -> NestJS GET /api/v1/listings/public -> backendDebug Android UI`

It creates one synthetic Organization, Property, VACANT Room, and PUBLISHED Listing
with stable UUIDs. Re-running the seed is idempotent for those fixture IDs.

## Run locally

Start the Docker stack and Pixel emulator first. The preferred entry point is:

```powershell
pnpm e2e:flow DISC-01
pnpm e2e:flow DISC-02
```

Each executable flow resets and seeds deterministic data, runs Maestro on Android, then verifies the public API, PostgreSQL facts, and relevant invariants.

The lower-level seed commands remain available when debugging:

```powershell
pnpm e2e:reset
pnpm e2e:seed
```

The seed/reset scripts refuse to mutate any database except local `trooi_dev` or
`trooi_test`, based on `DATABASE_URL` from `.env`.

With `backendDebug` installed against `http://10.0.2.2:3000/`, run the discovery
Maestro flow from `tests/e2e/maestro/discovery.yaml`.

## Inquiry boundary

`POST /api/v1/inquiries` is currently protected by the global Bearer-token
AuthGuard. Therefore the Inquiry write flow is not treated as auth-free E2E.
Do not bypass or weaken authentication for tests.

After a real Google Web Client ID and authenticated emulator session are available,
extend this suite with:

`Discovery -> Listing -> authenticated Inquiry -> PostgreSQL assertion`.
