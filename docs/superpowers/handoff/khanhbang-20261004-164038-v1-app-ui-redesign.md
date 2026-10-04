# Handoff — Khánh Băng — V1 native app UI redesign

## Metadata

- Branch: `frontend/v1-app-ui-redesign`
- Native implementation commit: `a2c799f feat(android): implement room ledger app redesign`
- Parent implementation checkpoint: `frontend/v1-ux-warning-fixes @ bbbc07b799ac7713be9354ea06480f3de05429f7`
- Design source: `design/app-ui-redesign @ 530a518b6652ea385001a5e976272c277ebbde9b`
- Design commits cherry-picked into this branch:
  - `4197017 design: redesign Android product universe atlas`
  - `f8aaa31 docs(design): consolidate app design artifacts`
  - `db67dda design: rebuild Android app atlas visual system`
- Native Compose redesign changes: committed in `a2c799f`
- Push of this branch: pending final metadata commit
- Merge: NOT PERFORMED
- PR: NOT OPENED

## Design authority

Native implementation follows `docs/designs/DESIGN.md`, `PRODUCT.md`, the interactive Product Universe artifact and the POV checklist.

Creative north star: **The Room Ledger**.

Implemented visual foundations include:

- warm canvas / paper / supporting surfaces;
- bottle-green primary actions;
- clay chronology;
- semantic light/dark mapping;
- flat bordered surfaces rather than shadow-heavy card vocabulary;
- 8dp fields, 10dp actions, 12dp surfaces, 20dp sheet-top shape;
- 48dp minimum shared action target;
- asymmetric Room plate;
- source-backed state labels, amounts and history rows.

## Native navigation and shell

The app now keeps the three POVs visually distinct.

Guest root:
- Trang chủ
- Bản đồ
- Hoạt động
- Tài khoản

Tenant root:
- Trang chủ
- Nhà tôi
- Thanh toán
- Sự cố
- Tài khoản

Landlord root:
- Tổng quan
- Phòng
- Tài chính
- Sự cố
- Tài khoản

Context switching still comes only from `linkedTenancyIds` and `operatedOrganizationIds`; no global business role was introduced.

Compact windows keep bottom navigation. Windows >=600dp use a native `NavigationRail`.

`MainActivity` already uses `enableEdgeToEdge()`; the Compose shell now explicitly uses safe-drawing insets and IME padding.

## Representative implementation

The mandatory representative surfaces from DESIGN.md have native coverage:

1. Session/auth pre-shell
   - Google-auth progress uses capability-resolution presentation.
   - It explicitly does not claim process-restart session restore.
2. Guest Home
   - Room Ledger discovery hierarchy, current-location spatial search and source-backed results.
3. Listing Detail
   - labeled media placeholder, public area, asking-price context, public-location privacy and Inquiry.
4. Tenant Home
   - room-first plate, current obligation, Incident, Notice and recent Payment.
5. Billing
   - Billing period, Terms provenance and individual Charges; no invented totals.
6. Incident Detail
   - authoritative state plus append-only IncidentEvent chronology.
7. Landlord Dashboard
   - attention-first composition using authoritative Dashboard / Incident facts.
8. Room Ledger
   - Room plate + six-part ledger navigation + source-first facts + existing command controls.
9. Landlord Finance
   - owed / received / deposit / receipt lanes remain distinct.
10. Context Switcher
   - account identity and relationship-backed workspaces.

Additional native coverage:
- Guest Map shell with public projection and explicit provider-not-wired state;
- Guest Activity shell without fake Inquiry-history reconstruction;
- Tenant Finance and Incident roots;
- Landlord room register and Incident board;
- Room operational-history chronology;
- semantic dark-mode cleanup across deep screens.

## Contract boundaries preserved

The redesign does not change backend business authority.

Preserved:
- no global USER.role Tenant/Landlord;
- no client-owned actor/provenance;
- Billing != Payment != Deposit != Receipt;
- Notification remains a projection and source router;
- operational address does not leak into public Listing surfaces;
- current Listing remains Room-scoped;
- Room OCCUPIED remains tenancy-owned;
- former-tenant write restrictions remain;
- OPEN stays OPEN and FUTURE stays excluded.

Map/geocoder textual area semantics are not invented.

## Regression tests

Added `RoomLedgerDesignRegressionTest` covering:
- exact design palette tokens;
- flat shared surfaces and shape hierarchy;
- Room Ledger component family;
- Guest/Tenant/Landlord root labels;
- representative-screen hierarchy;
- adaptive NavigationRail;
- safe-drawing and IME inset wiring.

Existing `UxWarningRegressionTest` was updated only for the new approved Context Switcher copy.

## Verification

Android final gate on current working tree:

```text
:app:testDebugUnitTest       PASS
:app:assembleDebug           PASS
:app:assembleBackendDebug    PASS
:app:lintDebug               PASS
git diff --check             PASS
```

Backend default suite was rerun after the redesign:

```text
tests       284
pass        284
fail        0
cancelled   0
skipped     0
```

Build warnings are deprecations only (for example legacy `hiltViewModel` package and mirrored icon guidance); no gate failed.

## Remaining Task 1–6 runtime evidence

The only remaining Task 1–6 gate is physical-device E2E after this redesign:

1. Fresh Google sign-in:
   Credential Manager → Google ID token → `POST /identity-access/auth/google` → `GET /identity-access/me`.
2. Guest:
   Discovery/Search → Listing → Inquiry.
3. Tenant:
   Trang chủ → Nhà tôi → Thanh toán → Sự cố, including former-tenant read-only behavior when applicable.
4. Landlord:
   Dashboard → Property/Room → Listing → Finance → Incident.
5. Notification:
   List → Detail → Mark read → source navigation.

At the latest runtime check, the backend is live on port 3000 with the configured Google Web Client ID, and the final `backendDebug` APK was rebuilt with the same Web Client ID. The physical Android device is currently not visible to ADB, so these journeys cannot be truthfully marked PASS yet.

### Non-blocking for Task 1–6 / defer to V2 or later quality work

- Native interactive map provider / map picker. Current-location + radius spatial search already satisfies the Task 1–6 contract; raw lat/lng is not exposed.
- Persistent process-restart session restore. Task 1–6 requires real Google authentication/session, not restart persistence.
- TalkBack traversal, large-font-scale validation and predictive-Back visual verification. These are redesign/accessibility quality follow-ups, not original Task 1–6 acceptance gates.

## Review status

`READY_TO_REVIEW: NO`

Reason: automated backend and Android gates are green, runtime OAuth configuration is ready, but the required physical-device Google/Guest/Tenant/Landlord/Notification E2E evidence cannot be captured while the phone is disconnected from ADB.
