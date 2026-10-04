# Handoff — Khánh Băng — V1 backend-contract wiring progress

## Metadata

- Branch: `frontend/v1-backend-contract-wiring`
- Current HEAD: `37e826cc50c04b7509958b822393b425aec6ae1c`
- Staging base: `37e826cc50c04b7509958b822393b425aec6ae1c`
- Working tree: intentionally uncommitted
- Push: NOT PERFORMED
- Merge: NOT PERFORMED
- PR: NOT OPENED
- Source handoff: `docs/superpowers/handoff/khanhbang-20261003-112824-v1-backend-contract-wiring.md`

## Scope completed in working tree

Android transport is aligned to the generated V1 backend contract for:
- public spatial Listing search;
- current Listing lookup by Room;
- direct Payment history by Tenancy;
- Incident event timeline;
- Notification list/detail/read;
- Organization Dashboard;
- Deposit projection/events/settlement;
- Tenancy history;
- Room operational history.

Server-owned actor/provenance fields are not sent by the simplified Android commands.
## Authoritative read wiring

`BackendTroOiRepository` now uses backend read authority instead of the previous placeholders/reconstruction for:
- operator current Listings;
- direct Payments;
- Incident events;
- Dashboard projections;
- Deposits;
- Notifications;
- authorized finance projections.

Sanity search no longer finds these forbidden backend-path placeholders:
- `operatorListings = emptyList()`
- `dashboardByOrganization = emptyMap()`
- `timeline = emptyList()`

Generic public-area copy remains intentionally generic because textual geocoder semantics are OPEN.

## UI surfaces added/completed

Operator UI now exposes:
- server-backed Dashboard;
- current Listing discovery from Room;
- Room operational history;
- nullable Dashboard finance aggregates without client-side replacement calculations.

Notification Center now exposes:
- list;
- detail;
- mark-as-read;
- defensive source navigation using only `sourceType` / `sourceId`;
- safe fallback for unknown source types.

Tenant/former-tenant flow now:
- exposes backend History and Deposit reads;
- keeps ENDED/CANCELLED tenancy operationally read-only;
- hides Terms acknowledgement, Notice acknowledgement and new Incident creation for former tenancy.
## Android verification

Current working tree passed:

```text
:app:testDebugUnitTest       BUILD SUCCESSFUL
:app:assembleDebug           BUILD SUCCESSFUL
:app:assembleBackendDebug    BUILD SUCCESSFUL
:app:lintDebug               BUILD SUCCESSFUL
git diff --check             PASS
```

BackendDebug was built with:
`-PtrooiApiBaseUrl=http://10.0.2.2:3000/`

Generated APKs:
- `app/build/outputs/apk/debug/app-debug.apk`
- `app/build/outputs/apk/backendDebug/app-backendDebug.apk`

Additional contract tests cover:
- unauthenticated public spatial search;
- bearer-protected read routes;
- nullable Dashboard/Deposit fields;
- explicit unknown-enum rejection;
- command-body provenance exclusion;
- Notification detail/read and source fields.
## Backend verification

Dependencies installed with the repository lockfile using Corepack pnpm.

Passed:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm e2e:coverage`
  - 83 atomic flows
  - 198 cases
  - 24 backlog files
  - 8 frozen notification use cases
- `pnpm test:conformance:database-v1`
  - 57 passed / 57
- `pnpm build`
- `pnpm openapi:generate`
- generated `docs/api/openapi.json` has no diff
- `git diff --check`

Full `pnpm test` did NOT fully pass:
- 280 tests passed;
- 4 runtime HTTP access tests were cancelled;
- root cause: `DATABASE_URL is required for runtime HTTP access audit`.
This is an environment/runtime gate, not an assertion failure in the four cases.
## Runtime blockers

### PostgreSQL runtime audit

Repository-provided configuration exists:
`DATABASE_URL=postgresql://trooi:trooi_local@localhost:5432/trooi_dev`

However Docker Desktop Linux engine did not become available:
`//./pipe/dockerDesktopLinuxEngine` was missing.

Therefore PostgreSQL container could not be started and the runtime HTTP access audit cannot yet be claimed green.

### Android real-backend E2E

`adb` is installed, but `adb devices` returned no connected device.

The Android SDK emulator binary is not installed at the configured SDK path, so no AVD journey was executed.

Therefore these are NOT yet proven:
- Guest real HTTP Search -> Listing -> Inquiry journey;
- authenticated Landlord/Tenant backendDebug journeys;
- real Google ID-token authentication on emulator/device.

No auth bypass, arbitrary bearer token, fake Google credential, or production test hook was introduced.
## OPEN/FUTURE boundaries preserved

No local semantics were invented for:
- textual public area/geocoder;
- independent Availability vocabulary/calendar;
- Room/Property type;
- nested Terms opaque objects;
- nullable Dashboard financial totals;
- Deposit requirement changes after partial funding;
- Notification delivery channels.

FUTURE features remain excluded.

## Remaining required work

1. Restore/start a usable PostgreSQL runtime and rerun full `pnpm test`.
2. Install/start Android emulator or connect a real test device.
3. Start backend on port 3000 with the repository-defined environment.
4. Execute backendDebug Guest and authenticated journeys.
5. Verify real Google auth where credentials/session permit.
6. Only after runtime gates pass, prepare the final completion handoff.

## Review status

`READY_TO_REVIEW: NO`

Reason: static/contract/build gates are green, but required database-backed runtime audit and real Android/Google E2E are not yet complete.

## Additional environment verification

Docker Desktop is installed, but:
- `com.docker.service` is `Stopped`;
- the current remote session cannot start/open that Windows service;
- `dockerDesktopLinuxEngine` pipe remains unavailable.

Android SDK is present for build/install tooling, but currently has no:
- `sdkmanager.bat`;
- `avdmanager.bat`;
- `emulator.exe`.

`adb` is available, but no device is connected.

These conditions confirm the remaining runtime gates require environment setup outside the current non-elevated session; they are not being marked passed.
