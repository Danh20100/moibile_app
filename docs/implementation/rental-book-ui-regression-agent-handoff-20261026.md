# TrọƠi — Sổ UI visual-regression audit & agent handoff

Date: 2026-10-26
Status: **USER REJECTED CURRENT VISUAL IMPLEMENTATION; APPROVED UI SPEC IS STILL THE TARGET.**
Scope: presentation-only rebuild of Android **Sổ** for both Landlord/Operator and Tenant. This document is a handoff and issue ledger, not a new domain/API specification.

## Immediate decision

- The user explicitly rejected the delivered look of the new Sổ, notwithstanding its matched Moss Green color palette.
- **Agent takes over to REBUILD THE UI according to the previously approved interactive prototype**. Do not treat current screenshots/source layout as design approval.
- This turn is **documentation only**. Do not edit UI, tests, backend, schema, theme, source navigation, or test data while recording this note.
- Agent implementation phase: focus on UI/UX only, reuse existing source-backed state, callbacks, navigation and business operations. **No test runs requested** for this UI handoff. Do not use “tests passed” or backend health as visual acceptance evidence.
- Do not commit until user reviews the rebuilt UI. Preserve current uncommitted source and prior backlog notes.
- New code must not contain explanatory source comments, and do not introduce new names containing `v1` or `v2`. Do not rename compatible pre-existing symbols/API routes merely because their legacy names include a version marker.

## Visual evidence supplied by user

Six Android emulator screenshots attached in conversation on 2026-10-26, including:
1. Owner **Sổ overview** at top and scrolled to complete six-tile management grid.
2. **Tài sản** list with capacity 1/1, empty-ish property/room list.
3. **Biên nhận** list with only a title plus a plaintext unavailable/empty sentence.
4. **Tiền thuê** list with a small summary card but nothing graphical or structured under “Các kỳ thu”.
5. **Sự cố** list with only title, zero count, plus icon and plaintext empty sentence.

The screenshots are the rejection evidence. The existing palette is not the problem; **the hierarchy, density, layout, affordances, empty states and fidelity to the approved prototype are**.

## Main visual defects (required fixes, priority P0)

| ID | Current defect / evidence | Required replacement / acceptance |
| --- | --- | --- |
| SOR-UI-01 | Generic mostly-text pages; large blank background after 1–3 lines; sections disappear when their backing lists are empty. Most visible in Biên nhận, Tiền thuê and Sự cố screenshots. | Every screen retains its planned sections and structural cards in empty state. Use an illustrated, useful empty panel with a heading, short supportive text and a valid contextual action where authorized. Never use one orphan text sentence directly on the page as the only content. |
| SOR-UI-02 | Matching app colors and font is mistaken for design completion. Approved prototype had proper financial/collection/task previews, filters, meaningful cards, details and actions, but implementation dropped them. | Restore approved screen-by-screen **information architecture + hierarchy**, then skin it with existing TrọƠi Material3/Moss design tokens. Compare against **approved prototype**, not the rejected implementation. |
| SOR-UI-03 | Plain text `DropdownMenu` and `TextButton` selectors look unfinished (“Tất cả tài sản” floating under a small “Tài sản” label; raw menu of technical values in details/forms). | Use a polished full-width or appropriately sized filter/select surface with leading filter/icon, selected label, trailing chevron, consistent border/radius, anchored styled popover, visible selected state, reset/all option and search/scroll when options warrant it. Use human-readable Vietnamese, not enums. |
| SOR-UI-04 | Structural sections are missing visual grouping in empty states; header has much content but no adjacent composed cards. | Deliberate card composition: section title + compact overview/summary + list region + illustrated empty state. Cards may be visible with zero records. Use spacing/typography from app tokens. |
| SOR-UI-05 | Screenshot owner overview uses oversized bare whitespace in “Cần thu tiền” and weak call-to-action as standalone text. | Show a compact **Cần thu tiền** section/card with up to three oldest actionable cycles; when none, show illustrated state and a sensible link to the full **Tiền thuê** screen; do not invent debt, counts or fake transactions. “Cần xử lý” is incident-only; its **section/card must remain visible with an illustrated empty state when no incidents exist**. Only rows are conditional. |
| SOR-UI-06 | Owner overview grid is usable but 6 giant outlined cards dominate vertical space and appear more like unstyled placeholders than polished entrypoints. | Keep **exact 2-column, 3-row order**: Tài sản / Người thuê; Tiền thuê / Sự cố; Tin đăng / Biên nhận. Refine tile height, icon size, label balance, padding, press affordance and spacing; remain consistent with existing app and responsive phone sizes. |
| SOR-UI-07 | Empty Biên nhận shows heading + one multiline sentence only, zero card, illustration, filters or detail affordance. | List screen always includes top context, functional search/status filters and a large illustration-backed empty panel. With data, each receipt has date/status/amount, tappable card leading to **Chi tiết biên nhận** then linked Payment, including VOIDED/replaced when available. No fake Download PDF. |
| SOR-UI-08 | Empty Tiền thuê shows one summary card, heading “Các kỳ thu”, then plain sentence. Financial “Chưa đối chiếu” is visually undifferentiated. | Financial summary has meaningful separation for receivables/status; cycles area has full list layout or illustration-backed empty/loading/unavailable cards. Preserve period/history, cycle → Charge → Payment → allocation → Receipt navigation. Unavailable financial data must never display 0đ / “đã thu đủ” unless verified. |
| SOR-UI-09 | Empty Sự cố shows “Đang mở: 0”, + icon and one orphan empty sentence. | Summary counts for Đang mở / Đã kết thúc, search/filter controls, incident-card region, illustrated empty state and authorized **Báo sự cố** action. Detail has room/category/current status, append-only timeline and operator-only actions. RESOLVED remains open. |
| SOR-UI-10 | Asset screenshot lists property “P.102” and room “S.102” as two nearly identical generic rows; hierarchy is weak. Capacity card is present but feels detached from the list. | Keep capacity **used / total / remaining** at the top of Tài sản; visually group by property with distinguishable asset card, nested room entries and relevant counts/status. 1/1 must visibly communicate exhausted slots and next valid action; don't claim extra free slots. Room detail sections should be grouped, not flattened to property-value text. |
| SOR-UI-11 | Header subtitles, status labels, dropdown choices, empty messages and CTA are inconsistent. Prior screenshot showed raw VACANT/ACTIVE and encoding garbage in fallback text. | All user-facing text is valid UTF-8 Vietnamese with human labels. Distinguish NO DATA / LOADING / LOAD FAILED / PERMISSION DENIED / NO MATCHES; no technical status string or mojibake leaks. |
| SOR-UI-12 | New Android Sổ uses a >1,000-line monolithic `RentalBookScreen.kt`, repeated simplistic Card/Row/Dropdown patterns and poor readability. | Split **presentation** into reusable design components and feature-level Compose screens; do not split or alter backend contracts. Build consistently across owner/tenant. Avoid an ad hoc local design system that diverges from TrọƠi. |
| SOR-UI-13 | Tap from list/detail has a history of wrong return destinations in previous builds. User specifically warned about tangled navigation. | Maintain selected IDs/scope and exact return-to-origin through all cross-feature jumps, system Back, toolbar Back and tab navigation. No generic redirect to Sổ root from an opened receipt/room/person. Preserve filter and scroll context where feasible. |

## Rebuild exactly the approved landlord information architecture

### Home — Sổ của tôi

- Header “Sổ của tôi” / “Tổng quan hoạt động cho thuê”, bell icon.
- **Tất cả tài sản** dropdown/filter: a real, polished control, not floating text.
- **Tổng quan tài chính**: always-visible rounded card with confirmed Đã thu; separately Chưa thu and Trong đó quá hạn. **Render 0đ for confirmed zero or a successfully loaded empty dataset**, not “Chưa đối chiếu”. Quá hạn is a subset of Chưa thu; distinguish genuine loading/error/incomplete data.
- **Cần thu tiền**: always-visible full-width rounded card with up to three actionable oldest cycles (including historical unpaid), tenant/room/period/balance and “Xem tất cả”. When none, retain the card and show a themed background illustration and concise empty state.
- **Cần xử lý**: always-visible full-width rounded card with 1–2 incident cards if actionable, or an illustrated no-incidents presentation if empty. Never duplicate rent collection.
- **Quản lý của tôi** exact six-tile layout above, no Quick Access, no extra menu blocks.

### Tài sản

- Top entitlement/capacity card: `used / capacity`, `remaining`, progress bar, legitimate purchase/upgrade affordance; still visible when no properties. Capacity can be genuinely exhausted.
- Hierarchical property cards → property detail → rooms → dedicated room detail, preserving the room context and Back stack.
- Room detail: main identity/status card, tenant linkage/tenancy section, compact related-management action group, room history entry.
- **QR/link icon in upper-right of Room detail**, not inside People list. Owner creates link to existing eligible PRIMARY tenancy; popup provides copy/share and QR derived from the same link. If ineligible, show an explanatory state, not a dead QR.
- Compact icon actions edit/QR/ellipsis. Do not scatter five oversized buttons down the detail.

### Người thuê

- Only the **PRIMARY person standing as tenant**; do not mix household OCCUPANT records.
- List/search/status filter → one person's detail → minimal authoritative related links (Room, Finance, Receipts, Incidents).
- Empty list gets illustrated card, not orphan text. Creation is a controlled rental draft flow only if already supported; do not synthesize account or contract.
- No duplicate feature-specific dashboards or cross-links without correct scoped IDs.

### Tiền thuê

- Overview/filters/period groups → cycle card → Cycle details and Charge details → confirmed Payment details → allocations and receipt linkage.
- Rent, Electricity, Water are the charge categories; don't invent fee types.
- Distinguish receivable and actual confirmed Payment. Do not fabricate paid states or zero from a failed/unverified read; **0đ is required when the backend confirms an actual zero or an empty complete result**.
- Both zero-data and unauthorized/unavailable must have proper card/illustration/feedback designs.

### Sự cố

- Counts/filter/search → incident cards → dedicated detail with append-only events and operator-only transition actions; create report via allowed Room/Category.
- Empty view keeps filter/summary sections plus illustrated panel and report CTA where permitted. Localize category/status.

### Tin đăng

- Listing cards with imagery placeholder or actual authorized cover, not a plain text row only. State labels + room + asking rent.
- Detail has title, price, public description, status, compact edit icon at top right, publish/hide icon and archive in overflow. User **removed** “Xem trước như người tìm phòng” and “Yêu cầu liên hệ”; do not resurrect those buttons.
- Ensure empty states and no-image states look intentional.

### Biên nhận

- List/search/status filter (issued/voided/all) → receipt card with meaningful hierarchy → full receipt details.
- Detail shows receipt status, issued/voided dates, Payment linked amount/source, person/room when authorized, replacement relationship and navigation to Payment.
- Empty list has an illustrated no-receipts panel inside the screen structure; never create a separate independent INVOICE entity or pretend a receipt equals all debt paid.

## Tenant Sổ must receive the same treatment

- Distinct renter POV, **same app-wide design system and visual polish**; simple *overview → room → finance/receipts/incidents/history*.
- Renter root should answer: “Phòng tôi đang thuê?”, “Kỳ này còn cần thanh toán gì?”, “Có sự cố nào cần theo dõi?”.
- When unlinked, use a **branded illustrated empty screen**, concise steps and prominent “Mở link / Quét QR / Nhập mã” affordance, not an anonymous blank page.
- Link flow: owner Room → create link → copy/share/QR; tenant opens app link/scans QR/pastes token → safe room preview → confirm → refreshed authorized Sổ. Same token backs link and QR. Preserve no automatic access without secure backend authorization.
- No owner controls shown to tenant. Never require tenants to navigate through all property/finance menus to find their own room.

## Empty-state contract (mandatory for ALL six tabs plus tenant Sổ)

- **No empty screen may consist solely of a sentence on the page.**
- Show: stable section container + appropriate illustrated/quiet background (matching Moss Green), clear state title, one short explanation, and **only a real permitted CTA**. No useless disabled call-to-action pretending to work.
- Differentiate: never created / no results from filter / fetching / retryable error / forbidden / verified zero. Keep other sections visible when one section lacks data.
- Reuse `app/src/main/java/com/trooi/app/ui/components/IllustratedEmptyState.kt` and `EmptyStateScene.RENTAL_NOTEBOOK` as a starting point. Extend with **feature-appropriate scenes** (rent, receipt, incident, property, listing, primary renter) only in UI presentation code. Existing scene is generic; one copy-pasted image on every tab is not acceptable.
- Illustrations can be built with Compose Canvas/assets: no stock/watermarked image, no artificial records. Keep sufficient negative space but not a whole blank viewport.

## Style authority and source pointers

- App theme: `app/src/main/java/com/trooi/app/ui/theme/Color.kt`, `Theme.kt`, `Type.kt`, `Dimensions.kt`.
- Components: `app/src/main/java/com/trooi/app/ui/components/TroOiPrimitives.kt` (button, inline action, row, info row, page header), `TroOiFormField.kt`, `TroOiPage.kt`, `TroOiActionDialog.kt`, `IllustratedEmptyState.kt`.
- Reference shell/navigation: `app/src/main/java/com/trooi/app/ui/TroOiApp.kt`, `ui/navigation/TroOiBottomNavigation.kt`.
- Rejected new Compose surface: `app/src/main/java/com/trooi/app/features/ledger/RentalBookScreen.kt`; link/QR `RentalJoinUi.kt`; common actions `RentalBookActions.kt`.
- Current read/write plumbing to **preserve**: `RentalBookGateway.kt`, `RentalBookViewModel.kt`, authorized snapshot/projection; backend join module and migration. Do not refactor endpoints for a UI issue.
- Older design context: `docs/designs/landlord-tenant-ux-rework.md`; domain constraints: existing canonical docs; prior notes `docs/backlogs/v1/incident-ui-first-audit-notes-20261026.md`, `docs/backlogs/v1/tenant-primary-navigation-and-offline-link-deferred-20261026.md`.
- App must inherit theme naturally (system/app selection). **Never force `TroOiTheme(darkTheme = true)`** inside Sổ. Consistent palette alone is not visual acceptance.

## Agent execution brief

1. First reconstruct the visual specification across **owner root + six tabs + tenant root** from the frozen chat prototype and this handoff. Do not “fix” it by merely repainting current bare lists.
2. Rebuild the Compose presentation in coherent independent screens/components, using existing actual backend values and actions. Preserve feature ids and source-authorization boundaries.
3. Visually complete important empty/loading/error states and filters, **even when all backend lists are empty**. Empty UI is a first-class screen, not a fallback message.
4. Restore full details, icons, context menus, filter/sort/search, cross-feature paths with stable IDs and visual hierarchy.
5. Avoid adding unsupported backend semantics or fake records. If backend cannot supply something, present a structured and explicit unavailable state; log a deferred requirement separately.
6. Do **not** run tests or touch database/migrations/backend while executing this UI-only rebuild, per user instruction. Do not state UI is approved until the user actually reviews and approves the result.
7. Do not commit or delete existing uncommitted backend/link work; leave changes inspectable.

## Rejection/acceptance gate

**Current Sổ screenshots are rejected.** Compiling an APK and having all green builds does **not** mean the UI is accepted.

Visual review passes only when:
- Owner dashboard has exactly the approved composition, functional polished property filter and well-designed zero-data sections.
- Each of six tabs has cohesive composed layout **with and without data**; no lone text placeholders.
- Entry → detail → cross-feature → Back behavior is coherent and does not lose context.
- Tenant Sổ is equally finished with proper no-room illustration and join flow.
- Visual language is recognizably the existing TrọƠi app (Moss Green, card hierarchy, typography, bottom nav), not a Material3 demo with only recolored surfaces.
- User explicitly confirms the new UI after seeing it.


---

## Approved owner-home wireframe addendum — user sketch (2026-10-26, later decision overrides)

**Authority:** the user's green hand-drawn mobile layout shared on 2026-10-26 at approximately 04:50. This specification OVERRIDES any earlier note proposing to hide “Cần xử lý” when there are zero incidents, or to show “Chưa đối chiếu” simply because the successful source contains zero transactions.

### Nonnegotiable vertical order

```text
┌──────────────────────────────────────┐
│ [Sổ icon]  SỔ CỦA TÔI       [Bell]   │  header aligned, readable
│           Overview subtitle          │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ [Building] Tất cả tài sản    ▾   │ │  full-width selector
│ └──────────────────────────────────┘ │
│                                      │
│ ╭──────────────────────────────────╮ │
│ │ [Chart] TỔNG QUAN TÀI CHÍNH      │ │  card 1: always present
│ │                                  │ │
│ │   Đã thu    0đ                  │ │  0đ if successfully fetched/verified zero
│ │   Chưa thu  0đ | Quá hạn  0đ    │ │
│ ╰──────────────────────────────────╯ │
│                                      │
│ ╭──────────────────────────────────╮ │
│ │ [Wallet] CẦN THU TIỀN           │ │  card 2: always present
│ │ Items OR subtle illustration     │ │
│ │ [Relevant secondary action]      │ │
│ ╰──────────────────────────────────╯ │
│                                      │
│ ╭──────────────────────────────────╮ │
│ │ [Wrench] CẦN XỬ LÝ              │ │  card 3: always present
│ │ Incidents OR subtle illustration │ │
│ │ [Relevant secondary action]      │ │
│ ╰──────────────────────────────────╯ │
│                                      │
│ [Grid icon] QUẢN LÝ CỦA TÔI          │
│ ╭────────────────╮ ╭───────────────╮ │
│ │ icon Tài sản   │ │ icon Người thuê│ │
│ ╰────────────────╯ ╰───────────────╯ │
│ ╭────────────────╮ ╭───────────────╮ │
│ │ icon Tiền thuê │ │ icon Sự cố    │ │
│ ╰────────────────╯ ╰───────────────╯ │
│ ╭────────────────╮ ╭───────────────╮ │
│ │ icon Tin đăng  │ │ icon Biên nhận│ │
│ ╰────────────────╯ ╰───────────────╯ │
│                                      │
│ [Khám phá] [Sổ] [Tin nhắn] [Hồ sơ]  │  existing bottom navigation
└──────────────────────────────────────┘
```

### Six updated, explicit UI rules

1. **Width/alignment everywhere.** In the same vertical content column, dropdown and all three major cards occupy the **same available width** and have the **same left and right edges** (`fillMaxWidth()` of the common screen container). Never use a bare, intrinsic-width dropdown TextButton. All section cards share horizontal margins/standard paddings. Inner buttons/rows align to card edges. For the six management tiles: use equal-weight **two-column grid**, same widths/heights per row, symmetric horizontal gutter; no individual tile wider/taller due to longer labels. Avoid fixed widths which break small phones. Use intrinsic heights for large data cards, not fragile fixed heights.
2. **All card corners rounded, always visible.** Use the app's rounded corner style on **every summary, action, empty, and management card**. The three large top-level cards exist independently of whether the backend returns records. If there are zero items, keep the full card shell; place an elegant **background illustration/quiet illustration-backed empty region** inside, plus a concise explanation. Each section should feel designed, not an orphan line on a blank page. Never remove/hide the whole section for empty data.
3. **Icons are mandatory functional cues.** Use distinct theme-appropriate icons in the header, full-width property selector, three card headings, list rows, empty states and all six tiles. Keep icon geometry consistent, readable, nondecorative excess, and distinguish the tile names at a glance. Minimize text-heavy strips and raw dropdown menus.
4. **Property selector exactly matches card width.** A fully clickable rounded selection card/button with a building/filter icon at left, “Tất cả tài sản” or selected property label in the center and a chevron at right; equal left/right alignment to financial, due and issue cards. The expanded menu should be clearly anchored and styled and the selected property visibly indicated.
5. **True-zero finance renders `0đ`.** For **successfully loaded/authorized/complete** source data with **no transactions or no receivables**, render explicit **`0đ`** for Đã thu, Chưa thu and Quá hạn, not “Chưa đối chiếu”. `0đ` should visually match normal money typography. **Do not turn genuine loading, backend error, missing authorization, or incomplete reconciliation into false zero.** Show a designed loading/sync/error presentation separately in those cases, and keep the card shell present. Quá hạn is a subset of Chưa thu and never added twice. The source must confirm a legitimate zero or an empty, successfully loaded result.
6. **Typography and whole-screen treatment.** Sổ main title should be prominent. Section/card headings “Tổng quan tài chính”, “Cần thu tiền”, “Cần xử lý”, “Quản lý của tôi” must be **large, clear and visually weighted**, rather than tiny table labels; secondary text remains clearly legible. Keep sensible vertical rhythm without oversized empty whitespace. Tappable feature tiles open their **already approved full list/detail UIs**, not generic text screens. This fixed home skeleton remains stable across property filters and list/loading states.

### Empty card composition details

- **Tổng quan tài chính:** always a financial summary card with distinct amount hierarchy. Zero is numeric; illustration can be subtle decorative background only and must not make 0đ hard to read.
- **Cần thu tiền:** always one rounded full-width card, including its icon/title. If none: low-contrast illustration showing a settled payment/notebook or wallet, “Chưa có khoản cần thu”, one brief explanation; optionally a **working** “Xem tiền thuê” action. With items: 1–3 actionable cycles with person/room/period/remaining amount.
- **Cần xử lý:** always one rounded full-width card, including its icon/title. If none: different low-contrast incident/maintenance illustration, “Không có sự cố cần xử lý” and a one-line explanation; optional working “Xem sự cố”. If items: 1–2 incident cards. Do not mix unpaid rent into incidents.
- **Feature grid:** always all six tiles, regardless of whether that feature has any content. Tile tap enters a well-designed full list screen including styled empty/illustrated states when needed.

### Style/interaction requirements for all destination screens

- Apply the same maximum usable width, aligned headers, card edges, consistent radii, icon system and title hierarchy on all six subfeatures and Tenant Sổ.
- Each functional list has a coherent **header + contextual filters/actions + list container + card/illustrated empty content**. Keep the structures when list size equals zero.
- Detail screens require clear dedicated information cards, not key-value text spilled onto the page. Compact icon operations live in headers or contextual menus. Preserve every previously approved detail flow (Room with QR/link, Tenancy PRIMARY, rent cycle/charge/payment, incident event history, listing edit/publish/hide/archive, receipt and linked Payment).
- Form dropdown controls should match width and card visual language; the menu itself must be substantial enough to look intentional, not a raw few lines of technical codes.
- Every button/card has a predictable real affordance; no decorative inert buttons. Preserve scope and return-to-origin behavior.

### Conflict resolution and acceptance

- The old line “Cần xử lý only if incident items need attention” is now **REVOKED for the home screen**: **card visible unconditionally**; only *incident rows* are conditional.
- The old line “no fake 0” is **clarified**: it prevents false zero from missing/error/unverified finance data; it **must not** hide legitimate zero totals. Successfully fetched empty datasets are **0đ**.
- The hand-drawn sketch controls the **owner HOME section geometry/order**. Previously frozen *detail* flows remain in force for the six features and Tenant Sổ.
- Before declaring visually done, compare the owner home with the sketch at small Android phone width, including **everything zero/empty and everything populated**, and confirm full-width symmetry, persistent rounded cards, icons and strong titles.
- **UI-only build; no backend/schema or test work** is authorized by this addendum. Agent may document unmet backend information as deferred, not fabricate data.
