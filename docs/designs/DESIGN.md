# TrọƠi Android App Design Bible

## Design thesis

TrọƠi is one rental lifecycle app whose memory is a room ledger. The Guest view invites discovery, the Tenant view makes a current rental understandable, and the Landlord view supports quick operational decisions. A shared visual language connects those contexts without making Shared a fourth app mode.

The visual world takes cues from Vietnamese residential life and the paper records used to keep a household in order: warm porcelain surfaces, leaf green for action and confirmed progress, clear dates and amounts, and room imagery where discovery benefits from it. It avoids both a generic fintech dashboard and a marketing-site layout.

## Platform assumptions

- Android-first, compact width as the primary size class, with Material 3 structure and system behavior.
- Status bar, display cutout, navigation gesture, and IME areas are system insets. App content draws edge-to-edge only when the insets remain legible and usable.
- Compact layouts use 3–5 labeled bottom destinations. Expanded layouts should move to a navigation rail or drawer rather than stretch the phone bar.
- System Back and predictive Back unwind detail/context stacks. Authentication and session restoration are pre-shell and have no app bottom navigation.
- The HTML prototype illustrates Compose-ready structure. Its sample records are illustrative and never claim to be live backend data.

## Color roles

Use semantic roles in both light and dark schemes. Dynamic Color may tune the primary accent when supported; the static TrọƠi palette remains the fallback.

| Role | Light scheme | Use |
| --- | --- | --- |
| `primary` / `on-primary` | Leaf green `#176044` / white | Primary action, selected navigation, confirmed status |
| `primary-container` / `on-primary-container` | Pale leaf `#D8EDDF` / deep green `#153D2B` | Selected and supportive surfaces |
| `surface` | Warm porcelain `#FBFAF6` | Screen background |
| `surface-container` | `#F2F1EB` | Grouped rows and quiet blocks |
| `surface-container-high` / `surface-variant` | `#E9E9E1` | Raised tonal grouping and secondary controls |
| `on-surface` | `#1D2922` | Primary text |
| `on-surface-variant` | `#59665E` | Supporting text and icons |
| `outline` | `#79857D` | Input and control boundaries |
| `error` | `#B3261E` | Blocking and destructive feedback |
| `warning` | `#805900` | Due, pending, and attention states |
| `success` | `#176044` | Backend-confirmed completion |

Dark mode remaps these roles to a deep green-charcoal canvas, lighter text, and softened containers. Never invert the light palette mechanically. Use color with labels or icons so state is not color-only.

## Typography

Use the Android system sans family (Roboto with Noto Sans Vietnamese fallback) at scalable Material type roles. Keep one family across the product.

- **Display:** reserved for a rare first-run welcome moment.
- **Headline:** screen title and primary room/listing identity.
- **Title:** section names, charge labels, and list-row titles.
- **Body:** descriptions, terms, notices, and timeline details.
- **Label:** navigation labels, field labels, state names, and metadata.
- Use tabular numerals for VND values, periods, dates, and identifiers. Keep Vietnamese labels short and let text wrap instead of shrinking it.

## Spacing, shapes, and elevation

- Spacing scale: 4, 8, 12, 16, 20, 24, 32 dp. Screen edge padding is 16–20 dp on compact width.
- Small shape: 10–12 dp for fields, chips, and compact controls.
- Medium shape: 14–16 dp for grouped rows and contained surfaces.
- Large shape: 20–24 dp for a major discovery image or a screen-level container.
- Pill shapes are for status marks and compact controls only.
- Flat surfaces are the default. Separate content with spacing, dividers, and tonal surface roles. Use low elevation for transient sheets and modal elevation only for dialogs that require interruption.

## Iconography

Use one coherent Material-like outline set with consistent stroke weight. Keep icons secondary to short text labels. Avoid emoji, mixed families, and icon-only navigation. Decorative icons never carry business state by themselves.

## Shared application chrome

- **App bars:** one clear screen title, optional context/subtitle, and a 48 dp action target. Nested details expose Back through the Android system and a visible app-bar affordance where useful.
- **Navigation:** Guest has Trang chủ, Bản đồ, Hoạt động, Tài khoản. Tenant has Trang chủ, Nhà tôi, Thanh toán, Sự cố, Tài khoản. Landlord has Tổng quan, Phòng, Tài chính, Sự cố, Tài khoản. Every destination opens a real screen in the prototype.
- **Context switcher:** reached from account/avatar/workspace. It switches between Discovery, linked Tenancy, and operated Organization contexts without changing identity or assigning a permanent role.
- **Shared surfaces:** inherit their caller context or use a back-stack detail. They never introduce a Shared bottom bar.
- **Controls:** all interactive targets are at least 48 × 48 dp, with about 8 dp separation. Show focus, pressed, disabled, loading, and error states. No hover-only affordance.

## Reusable component rules

- **Buttons:** filled for the single primary action; outlined or text for secondary navigation; tonal controls for quiet contextual tasks. Destructive decisions require a clear consequence and server result.
- **Fields:** persistent labels, clear input boundaries, readable helper and validation text. Keep forms short and show only relevant fields.
- **Chips:** use for a small set of filters or a concise state. Avoid stacks of decorative tags.
- **List rows:** title first, explanatory line second, trailing amount/state/action aligned consistently. Prefer dividers and grouped rows over a card for every item.
- **Cards/surfaces:** reserve for one coherent record or task. Do not nest cards or turn each metric into a dashboard tile.
- **Banners/callouts:** inline, labeled, and limited to a real warning, permission, or policy explanation.
- **Tabs:** represent parallel views of the same record, such as Room overview, finance, and history. Do not use tabs to simulate global roles.
- **Sheets and dialogs:** bottom sheets hold secondary choices. Dialogs interrupt only for consequential confirmation or permission. Use snackbars for transient success/error feedback.
- **Loading:** use content-shaped skeletons for lists and projections. Session restoration may show a short, calm progress state; never show a business state before the server confirms it.
- **Empty/error/forbidden:** explain what is missing, why it cannot be shown, and a safe next step or retry. A 403 is not an empty record. Preserve entered form content after recoverable errors.

## Domain presentation

### Room, Listing, rental, and history

- Treat Room as the operational record and Listing as its public discovery projection.
- Listing states remain `DRAFT`, `PUBLISHED`, `UNPUBLISHED`, `ARCHIVED`. Never invent `RENTED`.
- Room operational states remain `VACANT`, `OCCUPIED`, `MAINTENANCE`, `INACTIVE`. OCCUPIED is derived from an active Tenancy.
- Tenancy states remain `DRAFT`, `ACTIVE`, `ENDING`, `ENDED`, `CANCELLED`. ENDING still represents an occupied Room; only confirmed checkout ends it and makes the Room vacant.
- Operational history is chronological and read-only. Room Ledger links Overview, Listing, Rental, Finance, Incident, and History without merging their sources.

### Money and trust

- **Charge/Billing:** an amount owed, with cycle, Terms provenance, due state, and line items.
- **Payment:** confirmed money received. Show verification and allocation separately.
- **Payment Claim:** evidence submitted for review, never confirmed inflow by itself. If its API or approval policy is absent, show a blocked/read-only explanation and no confirmation control.
- **Deposit:** Terms requirement, funded/held amount, and settlement history are distinct. Refund and retain are settlement outcomes, not inbound Payments or legal findings.
- **Receipt:** evidence issued only from a confirmed Payment; void/reissue history remains visible.
- **Incident:** operational issue with server-backed lifecycle and append-only event timeline. It is not a Trust Report.
- **Trust Report:** concerns a public Listing or Review. Reporting does not automatically remove content.
- **Dashboard and Notification:** projections/delivery surfaces that link to source records; neither mutates business truth.

## Scope states

- **V1:** use the semantic system above and show the available state and action boundary.
- **OPEN:** use a quiet amber/outline callout labeled OPEN. Explain which policy or contract is missing, and omit controls that would imply a decision.
- **FUTURE:** use a neutral roadmap treatment, label FUTURE, and disable every future action. Do not place it in current POV navigation.

## Media and density by POV

- **Guest:** medium density, image-led listing cards, prominent public search/map, clear rent and public-location facts. Use only public location. Inquiry is labeled “Tôi quan tâm” or “Liên hệ”, never “Đặt phòng”.
- **Tenant:** calm, task-first hierarchy. The current rental, amount owed, payment status, notices, and incidents are easy to distinguish. This is a rental portal, not a fintech dashboard.
- **Landlord:** medium/high density for scan → decide → act. Put the action queue first, followed by room identity, lifecycle, amount, due date, and incident context. Avoid a wall of identical KPI cards.
- Media frames are consistent in crop and shape. If no suitable local room photo exists, use a quiet neutral media placeholder; do not hotlink or invent factual property imagery.

## Motion and accessibility

- Use 150–250 ms motion for navigation feedback, selection, and sheet transitions. Motion confirms state; it does not choreograph scrolling.
- Honor reduced-motion preferences with a crossfade or immediate state change.
- Preserve readable contrast in both themes, scalable type, visible focus, keyboard operation in the artifact, screen-reader labels for controls, and state text that does not depend on color.
- Keep Android Back, status/navigation insets, keyboard/IME space, and thumb-reachable primary actions in the implementation contract.
