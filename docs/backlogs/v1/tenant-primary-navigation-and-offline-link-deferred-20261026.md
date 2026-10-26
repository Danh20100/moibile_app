# TrọƠi — Người thuê PRIMARY: UI freeze, navigation safeguards & deferred offline linking
Date: 2026-10-26
Status: UI DESIGN FROZEN (owner People tab) + DEFERRED feature backlog. Documentation only; do not implement or change frozen domain rules yet.

## Decisions approved in chat
- Landlord's **Người thuê** management view is deliberately simple: **the person standing as PRIMARY on a rental**, not a full list of OCCUPANT/household members and not an inventory of TrọƠi app accounts.
- Frozen UI surfaces: **Danh sách người thuê → Chi tiết người thuê → Thêm người thuê**.
- List focuses on primary signatories and their room/property/current tenancy or historical tenancy; detail shows basic identity, room, dates/status and links to authoritative related features.
- Avoid repeating Billing, Payment, Receipt, Incident, Terms or Room source-of-truth inside People. Links must pass correct tenancy/room scopes.
- Other occupants remain in the tenancy-participant domain; do not make the UI complicated with them by default.
- Approval is UI-only; Android/frontend source not yet implemented from this prototype.

## Navigation regression guard — MUST VERIFY at implementation
A known old UX issue was confusing Back / route jumps across Room, Tenancy, Finance, Receipts, Incidents and asset management.
- Entrypoint: **Sổ → Người thuê → Chi tiết người thuê**. This is a predictable short route; do not force Property → Building → Room → Tenancy for a simple single-room landlord.
- On any cross-feature link, preserve an explicit **origin destination and scoped IDs** (organizationId, propertyId if needed, roomId, tenancyId, payment/receipt/incident IDs when applicable) rather than a generic fallback to the owner root.
- Pressing system Back or header Back from a linked feature **returns to the originating person's detail**, then to the People list. Preserve previous list filters, search, and scroll/selected context when possible.
- A screen opened from a room detail must return to that room detail, not silently redirect to People; respect the actual origin.
- Do not resolve person/room by display name, index or global current selection. Resolve by stable source IDs, validate current authorization, and show unavailable/permission feedback for lost access.
- Avoid stacking duplicate routes and global context switching. No circular redirect; use a bounded navigation stack/source-navigation handle.
- Test deep links, app back, tab switch, multiple properties/tenancies, former tenant read-only, empty/error/forbidden states and direct source links.
- Cross-feature navigation targets must use authoritative scopes: Finance and receipts by **Tenancy/Payment**; Incidents by **Room** with occupancy-window provenance when displayed as related to a Tenancy; Room detail by **Room**; Terms by **Tenancy + version**. Never mix another tenant's data.

## DEFERRED: Import an already-existing offline rental / link renter via room code or QR
User scenario: landlord has ALREADY rented a physical room outside TrọƠi and now wants to record it in the app; the renter may later connect to that existing rental via **entering a room code or scanning a QR**. Current UX is missing this end-to-end onboarding pathway. **Do not implement in the UI-first design phase.**

### Proposed conceptual flows (not approved backend policy)
1. Landlord: choose existing Room (or create its source record) → **Add existing/offline rental** → enter the PRIMARY renter and historical start date/terms as agreed → save/activate through a controlled backend workflow consistent with lifecycle rules.
2. Landlord: entrypoint must be **Sổ → Tài sản → Chi tiết phòng → QR icon in the room header** (or a compact room actions menu). Show a room-specific **Liên kết người thuê** QR modal with room label/property and an optional short join code + copy/share/regenerate affordance. It must resolve to an authorized active/pending rental's PRIMARY participant, not blindly attach User to Room. When no eligible Tenancy/PRIMARY exists, explain that the landlord must first create/import the tenancy; do not expose a misleading active QR.
3. Tenant: enter via **Sổ thuê → Quét QR / Nhập mã phòng** (also useful in empty state when there is no linked rental) → scan or type code → preview safe room/property identifiers → **Xác nhận liên kết** (or submit request for owner approval) → backend validates authorization, uniqueness and link to the right TENANCY_PARTICIPANT; show pending/accepted/rejected outcomes. Keep UI short: scan → confirm → linked/pending; never show renter financial data prior to authorization.
4. User clarified placement: **QR belongs on the particular Room detail within Tài sản, not on the Người thuê list or global Sổ screen**. The tenant scans that Room invitation and subsequently sees the matched authorized rental in Sổ thuê. The exact grant policy (single-use authenticated token vs landlord approval) remains OPEN pending security/product decision.
5. Both sides: once confirmed, the tenant sees their authorized Tenancy in their portal; the landlord sees linkage status without creating a second Tenancy.

### Security and domain concerns to resolve later
- **Room identifier is not sufficient authorization.** A static public room number/QR must not automatically give access to rental financial or personal information. Define short-lived/revocable or otherwise protected invite grants, tenant identity validation/landlord approval, replay/rate limit protection, and explicit scopes. Product/security policy TBD.
- Keep **USER != TENANCY_PARTICIPANT**. PRIMARY participant can exist before any User account; linking User must not recreate or replace their rental record or erase history.
- Room supports at most one nonterminal Tenancy; respect DRAFT/ACTIVE/ENDING/ENDED/CANCELLED state machine. Already-occupied real-world rooms require controlled onboarding policy, not arbitrary manual setting to VACANT or free-form mutation.
- If operator records historical amounts/terms/payments, do **not** infer all historic debt as outstanding, auto-create confirmed Payments/Receipts, fabricate allocations, or retroactively mark receipts paid. Historic financial import semantics and reconciliation must be explicitly approved before implementation.
- Existing published Listing must reconcile with room occupancy upon activation; do not show an occupied Room as publicly available.
- Define owner/operator roles, renter account linking, expiry, revocation, identity conflicts, existing tenancy conflicts and clear user-facing errors before designing API/database changes.

## Evidence checked (2026-10-26)
- Canonical frozen domain: docs/database/v1/canonical.md — USER ≠ TENANCY_PARTICIPANT; PRIMARY/ OCCUPANT; Tenancy lifecycle; one nonterminal tenancy per room; billing provenance.
- Backend: src/modules/tenancy/contracts/index.ts; controllers/tenancy-support.controller.ts; services/tenancy-participant.service.ts; src/modules/rental-lifecycle/services/rental-lifecycle.coordinator.ts.
- Android: app/src/main/java/com/trooi/app/core/model/SourceNavigation.kt, app/.../features/shared/V1RentalGateway.kt.
- Checked code supports participant linking by a **userId**, but found no demonstrated room-code or QR-based tenant join workflow in the inspected source paths. Not proof of the absence of every future/hidden implementation.
- Existing design note docs/designs/landlord-tenant-ux-rework.md already flags preserving origin/context on Back; this note is the explicit People-tab acceptance constraint.

## Implementation gate
- **Do not alter canonical, DB, existing app workflows, or source for this note.**
- First complete remaining UI designs and freeze.
- Implement navigation with explicit return-to-origin regression tests.
- Treat manual offline rental import and tenant QR/code pairing as **separate deferred enhancements**, requiring policy/API/authorization design before coding.
