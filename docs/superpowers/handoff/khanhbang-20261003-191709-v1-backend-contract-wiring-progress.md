# Handoff — Khánh Băng — V1 backend-contract wiring + UX warning fixes

## Metadata

- Current branch: `frontend/v1-ux-warning-fixes`
- Current committed HEAD: `27084448f685bdf6175f176c7a1940a6157151e5`
- Latest staging base: `41ca82b922c99e3f0d9cdff4cf7f1c000aa4f49f`
- Staging commits incorporated before the Task 1–6 checkpoint:
  - `98bc82e test(e2e): isolate postgis fixture cleanup`
  - `bb44e00 docs(test): record full regression closure`
  - `41ca82b docs(design): add interactive product universe prototype`
- Preserved/pushed checkpoint: `frontend/v1-task6-runtime-e2e @ e8e4e68188699674e524576da8567d7a0e74e0fb`
- Current warning-fix working tree: intentionally uncommitted
- Push of current branch: NOT PERFORMED
- Merge: NOT PERFORMED
- PR: NOT OPENED
- Original branch `frontend/v1-backend-contract-wiring` remains preserved at `37e826cc50c04b7509958b822393b425aec6ae1c`.

## Task 1–6 checkpoint carried forward

The cherry-picked Task 1–6 checkpoint keeps the completed V1 backend-contract wiring for:

- public spatial Listing search;
- current Listing lookup by Room;
- direct Payment history by Tenancy;
- Incident event timeline;
- Notification list/detail/read/source navigation;
- Organization Dashboard;
- Deposit projection/events/settlement;
- Tenancy history;
- Room operational history;
- server-derived actor/provenance;
- former-tenant read-only behavior.

Backend remains the business authority; Android does not invent lifecycle, finance truth, actor identity, or OPEN semantics.

## Warning fixes implemented on current branch

### Discovery UX

Raw contract fields are no longer exposed as product inputs:

- removed direct latitude input;
- removed direct longitude input;
- removed raw radius-in-meters input.

Product UI now provides:

- **Dùng vị trí hiện tại** using coarse device location;
- radius choices **1 km / 3 km / 5 km**;
- min/max price fields;
- **Chọn trên bản đồ** affordance is visible but disabled until a map provider/picker is wired.

Coordinates remain an internal transport detail passed to the existing backend spatial-search contract.

The client still does **not** invent textual area/geocoder semantics such as “Thủ Đức”. Textual public area and independent Availability remain OPEN.

### 3 POV + Context Switcher

The UI now models a transient `AppContext`:

- DISCOVERY
- TENANT
- OPERATIONS

This is frontend navigation state only and is **not** persisted as `USER.role`.

A new **Context Switcher** uses only backend-derived relationships:

- `linkedTenancyIds`
- `operatedOrganizationIds`

The public shell no longer mixes “Tìm phòng / My Rental / Vận hành” as peer tabs.

### Session → capability → POV home

Authenticated landing is no longer hardcoded to Discovery.

After authentication the client resolves backend-derived capabilities:

- both Tenant + Operations → Context Switcher;
- Operations only → Landlord Dashboard;
- Tenant only → Tenant Home;
- no business relationship → Discovery.

### Tenant shell

Tenant POV now has dedicated navigation:

- Trang chủ
- Nhà tôi
- Thanh toán
- Sự cố
- Tài khoản

Tenant Home, Finance and Incident overview surfaces read backend-authoritative projections. Detailed rental writes and lifecycle operations continue through the existing server-backed Rental Workspace.

Tenant Incident projections are now loaded for Room IDs obtained from linked Tenancies; the client does not invent Room membership.

### Handoff metadata

This handoff now reflects the actual branch, staging base, checkpoint and verification status rather than the old `frontend/v1-backend-contract-wiring @ 37e826c` metadata.

## Verification — current branch

Backend default suite:

```text
tests       284
pass        284
fail        0
cancelled   0
skipped     0
```

The database-backed runtime HTTP audit passed, including:

- public health endpoint;
- unauthenticated private-resource rejection;
- arbitrary bearer-token rejection;
- unauthenticated public Listing discovery.

Android gates:

```text
:app:testDebugUnitTest       PASS
:app:assembleDebug           PASS
:app:assembleBackendDebug    PASS
:app:lintDebug               PASS
git diff --check             PASS
```

A new `UxWarningRegressionTest` guards:

- no raw latitude/longitude product fields;
- current-location + 1/3/5 km discovery UX;
- Context Switcher presence;
- Tenant-specific navigation;
- relationship-derived post-auth landing.

Only deprecation warnings remain for existing Android APIs such as `hiltViewModel`; they are not functional gate failures.

## Runtime status

Backend is currently listening on port 3000.

A physical Android device had previously been connected, `backendDebug` installed successfully, and ADB reverse to port 3000 was exercised. At the latest final environment check, `adb devices` returned no connected device, so no new physical-device run was captured after the UX-warning changes.

Fresh Google sign-in has not yet been captured as passing end-to-end evidence on this current branch.

No Google Client Secret is committed. OAuth IDs and runtime environment values remain per-machine configuration.

## OPEN / not invented

Still intentionally unresolved:

- textual public area / geocoder;
- independent Availability vocabulary;
- Room/Property type vocabulary;
- opaque nested Terms structures;
- nullable Dashboard finance aggregation policy;
- Deposit requirement changes after partial funding;
- Notification delivery channels.

The disabled map-picker affordance is not claimed as a completed map-provider integration.

## Remaining verification

1. Reconnect a physical Android device or emulator.
2. Build/install current `backendDebug` with the configured Web OAuth Client ID.
3. Capture a **fresh Google sign-in**:
   Google Credential Manager → ID token → `POST /identity-access/auth/google` → `GET /identity-access/me`.
4. Manually verify current-device POV journeys:
   - Guest: Home/Search → Listing → Inquiry;
   - Tenant: Trang chủ → Nhà tôi → Thanh toán → Sự cố → Tài khoản/Context Switcher;
   - Landlord: Dashboard → Room/Listing → Finance → Incident;
   - Notification detail → mark read → source navigation.
5. Wire a real map picker/provider only when that UI/provider decision is approved; do not replace it with raw coordinate inputs.

## Review status

`READY_TO_REVIEW: NO`

Reason: automated backend and Android regression gates are green, and the UX warnings above are fixed in source, but fresh Google authentication and final physical-device POV journeys have not yet been captured as passing evidence on this branch. The map-picker provider is also not wired and is explicitly not claimed complete.
