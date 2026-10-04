# Handoff — Khánh Băng — V1 native app UI redesign

## Metadata

- Branch: `frontend/v1-app-ui-redesign`
- Native implementation commit: `a2c799f feat(android): implement room ledger app redesign`
- Parent implementation checkpoint: `frontend/v1-ux-warning-fixes @ bbbc07b799ac7713be9354ea06480f3de05429f7`
- Latest design authority reviewed: `design/app-ui-redesign @ e9d3883` (`docs/designs/v1/`)
- Design commits cherry-picked into this branch:
  - `4197017 design: redesign Android product universe atlas`
  - `f8aaa31 docs(design): consolidate app design artifacts`
  - `db67dda design: rebuild Android app atlas visual system`
- Native Compose redesign changes: committed in `a2c799f`
- Push of this branch: PERFORMED to `origin/frontend/v1-app-ui-redesign`
- Merge: NOT PERFORMED
- PR: NOT OPENED

## Design authority

Native implementation was re-audited against the latest versioned V1 authority on `design/app-ui-redesign`: `docs/designs/v1/DESIGN.md`, `PRODUCT.md`, the interactive Product Universe artifact and `app-pov-checklist.md`. The newer design commits version/repoint the V1 artifacts; no conflicting V1 visual or interaction contract was found.

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

## Physical-device Task 1–6 E2E — PASS

Device runtime used the installed `backendDebug` APK `versionName=1.0.1` with ADB reverse `tcp:3000 -> tcp:3000` and the real Google Web Client ID.

1. **Fresh Google authentication — PASS**
   - Logged out to Guest first.
   - Credential Manager account chooser completed successfully.
   - Backend-authenticated session resolved to Context Switcher.
   - `/me` capability result was reflected by 2 linked Tenancies and 2 operated Organizations; no global business role was used.

2. **Guest — PASS**
   - Public Listing rendered from backend spatial/public projection.
   - Listing detail showed public area and price while operational address stayed private.
   - Unauthenticated Inquiry required Google login.
   - Authenticated Inquiry submitted through the UI and persisted as `NEW` with the server-derived sender user.
   - Backend automatically created the corresponding `NEW_INQUIRY` Notification.

3. **Tenant — PASS**
   - Tenant Home rendered the active Room, current Charge, Incident and Notice.
   - `Nhà tôi` listed both active and ended Tenancies.
   - Finance rendered Billing/Charge, confirmed Payment, Deposit and Receipt as distinct source records.
   - Incident screen rendered backend IncidentEvent chronology.
   - Former Tenancy `ENDED` opened read-only history; Terms explicitly stated that ended-tenancy terms can only be reviewed and no acknowledgement/write action was presented.

4. **Landlord/operator — PASS**
   - Dashboard rendered authoritative room-state counts, active-tenancy count and open Incident attention.
   - Room/property workspace loaded the E2E organization and room hierarchy; Room detail/current Listing was exercised during the same installed APK session.
   - Finance rendered receivable, received Payment, Deposit and Receipt lanes separately.
   - Incident board rendered the open backend Incident and history.
   - No crash/ANR was recorded while traversing these flows.

5. **Notification — PASS**
   - Notification list rendered Incident, Payment and the newly generated Inquiry notification.
   - Detail rendered category, source reference and delivery/read facts.
   - Mark-read updated the authoritative notification record with `DELIVERED` and non-null `read_at`.
   - `PAYMENT_CONFIRMED` source navigation routed to Tenant Finance using `sourceType/sourceId`.
   - Unsupported Inquiry source navigation stayed safely on detail rather than inventing a destination.

## Final automated verification

```text
Android unit tests          52 / 52 PASS
:app:assembleDebug          PASS
:app:assembleBackendDebug   PASS
:app:lintDebug              PASS
git diff --check            PASS

Backend tests               284 / 284 PASS
backend typecheck           PASS
backend lint                PASS
backend build               PASS
DB conformance              57 / 57 PASS
E2E coverage                83 atomic flows / 198 cases PASS
```

Two compile regressions discovered during the final audit (`tenancyStatusLabel` and `roomStateLabel`) were fixed before the final Android gates and physical-device E2E.

### Non-blocking for Task 1–6 / defer to V2 or later quality work

- Native interactive map provider / map picker.
- Persistent process-restart session restore.
- TalkBack traversal, large-font-scale validation and predictive-Back visual verification.
- Further V2 visual redesign work.

## Review status

`READY_TO_REVIEW: YES`

Reason: Task 1–6 backend contracts, Android automated gates, fresh real Google authentication, Guest/Tenant/former-tenant/Landlord/Notification physical-device journeys and final crash checks all have passing evidence. No merge to staging has been performed.
