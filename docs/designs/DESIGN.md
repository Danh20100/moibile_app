---
name: "TrọƠi — Product Design System"
description: "Unified Android design contract distilled from the current Compose app, OpenDesign, Taste Skill, and UI UX Pro Max"
platform: "Android / Jetpack Compose / Material 3"
status: "DESIGN CONTRACT — proposed UX redesign; not a claim of implementation or usability acceptance"
reviewed_on: "2026-10-23"
---

# DESIGN.md — TrọƠi

> **North Star: A calm home for every rental record.**
>
> TrọƠi is a long-term rental lifecycle product. It should feel residential, trustworthy, legible, and operational. It must help a landlord **act on the right room or obligation** and help a tenant **understand their own rental record without interpreting an accounting dashboard**.
>
> This contract distills usable design principles from the existing Android UI and three design-agent sources. It is **not** a copy of any reference theme, not a license to modify business rules, and not proof that the proposed redesign has passed usability testing.

## 0. Authority, applicability, and change boundary

Order of authority for implementing any screen:

1. **Product/domain semantics:** docs/database/v1/canonical.md and its frozen ERD, if present in the active checkout. Never silently reinterpret a FROZEN invariant.
2. **Actual API/state contracts:** current backend endpoints, authentication/capabilities, source DTOs, and accepted payment/provider contracts. An absent contract is not permission to mock success.
3. **Native visual implementation:** app/src/main/java/com/trooi/app/ui/theme/{Color,Theme,Type,Dimensions}.kt. These define currently implemented Android semantic tokens.
4. **Shared UI architecture:** app/src/main/java/com/trooi/app/ui/components/, app/src/main/java/com/trooi/app/ui/navigation/, and docs/designs/v1/android-frontend-architecture.md.
5. **This DESIGN.md:** target information architecture, visual hierarchy, composition, UX practices, and quality gates for upcoming screen work.
6. **Historical exploration:** docs/designs/v1/DESIGN.md and HTML atlas are provenance, not a palette authority for today's native Android app.

Canonical entity identity and ownership win over a visual proposal. A desired interaction that conflicts with a frozen rule must be blocked and explicitly escalated. Preserve unrelated local changes. Do not modify backend, database, payment semantics, or production screens merely by adopting this document.

**Implementation status:** this document proposes how screens should be redesigned; existing Compose code is implementation evidence, not acceptance evidence for the new UX. No screenshots, physical-device tests, or participant usability tests were run as part of this document.

## 1. Design provenance: what to take from each source

| Source | Adopt | Explicitly reject |
| --- | --- | --- |
| Current TrọƠi Android | Moss Green semantic roles, calm residential mood, Material 3, shared TroOi components, native Back/insets, 4 root destinations, room/rental context and source-linked actions | Duplicate summaries, long unprioritized lists, arbitrary large cards, historical terracotta/HTML palette as a new Android source |
| OpenDesign — https://github.com/nexu-io/open-design | A persistent DESIGN.md brief, explicit palette/type/layout/density decisions, cohesive screen set, design review and clickable prototype before implementation | Blind reuse of an external brand package; prototype treated as production proof |
| Taste Skill — https://github.com/Leonxlnx/taste-skill | Inventory the real user jobs and data; for app screens use quiet surfaces, meaningful density, restrained color on data, legible figures, honest empty states; screenshot → identify top defects → iterate | Applying marketing-page hero/editorial composition to a daily-use dashboard; decorative KPI tiles; fictional success or vanity numbers |
| UI UX Pro Max — https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | Product/stack-specific pattern retrieval, semantic UX checklists, typography and accessibility review, design-system persistence with justified page overrides | Randomly selecting a style, copying default hex colors, treating retrieval output as product or domain authority |

This is one **application design language**. Guest, Tenant, and Landlord/Operator vary by **task density and information architecture**, not by unrelated color systems.

## 2. Product mental models and navigation

**Roles are contextual relationships, not a global User.role.** One user may search, have a tenancy, and operate an organization. The active scope must be visible and switching scope must never silently switch a financial or room record.

### Current native root navigation — preserve until separately reviewed

**Khám phá | Sổ | Tin nhắn | Hồ sơ** is the current four-destination root navigation with a moving concave notch. Preserve its intent, measured geometry, readable labels, and accessibility. Do not insert a fifth competing root destination just to expose a redesigned screen.

- **Khám phá:** guest/public listing discovery and inquiries.
- **Sổ:** contextual working area; shows a Landlord workspace for an operated organization or a Tenant rental notebook for a linked tenancy.
- **Tin nhắn:** communication surface as supported by current contracts; do not fabricate a chat engine.
- **Hồ sơ:** account, preferences, and explicit context selection.
- **Nested flows:** use top app bar/Back and contextual actions. Do not repeat the global navigation bar inside modal tasks.
- **Switch context:** name the destination and scope. Never present a global permanent “Landlord versus Tenant” identity toggle.

### Information architecture: Landlord / Operator

**Sổ → Workspace overview → Rooms & properties / Receivables & payments / Incidents → Source record → Allowed action → Recorded outcome.**

The owner should see:
1. **What needs action now?** Unresolved incident, unpaid charge, missing information, or other actionable queue item **only when the underlying source is available**.
2. **Which room/property?** Always identify the operated organization and room.
3. **What action can I take?** One meaningful primary action per local decision context, never a wall of equally weighted buttons.
4. **What happened?** A dated source-linked record and explicit status after confirmed backend response.

Separate the room register from an executive dashboard. Finance records should not be duplicated in full on every screen.

### Information architecture: Tenant

**Sổ → My current rental → This period's obligation / Deposit / Incidents / Rental terms → Source detail → Receipt or progress history.**

The tenant should see:
1. **Where am I renting?** Room/property identity and linked tenancy state.
2. **What is my financial position for this period?** Amount due, due date, payment confirmation and missing data distinguished.
3. **What is awaiting me?** An actionable request, unacknowledged notice, or active incident (if supported).
4. **What can I verify later?** Receipts, agreed terms version, payment and incident history, move-out records.

The notebook is **my rental record**, not the landlord's property administration dashboard reduced to mobile size.

## 3. Native visual DNA — preserve and refine, do not rebrand

### 3.1 Existing Light tokens (CURRENT, from Color.kt)

| Semantic role | Value | Use |
| --- | --- | --- |
| canvas / background | #EAF0E3 | Overall app canvas |
| paper / surface | #FFFFFF | Work areas and forms |
| supporting surface | #DCE6D4 | Grouping and secondary content |
| selected / primaryContainer | #D4E8D6 | Selected context and quiet emphasis |
| primary | #235A46 | Primary actions and active intent |
| onPrimary | #FFFFFF | Text/icons on primary |
| ink | #202D25 | Main content |
| muted | #52634F | Secondary content |
| outline | #94A58D | Dividers and boundaries |
| secondary | #4F6744 | Supporting accent, not success |
| secondaryContainer | #DFEBD7 | Subtle supporting action |
| warning | #7D5318 | Needs attention, only with a label |
| warningContainer | #F8EDD7 | Gentle warning surface |
| error | #A23631 | Blocking/destructive/error |
| errorContainer | #FAE7E2 | Error backing |
| success | #286145 | Confirmed positive state, with text |

The source also defines water/media colors (#D4E5E6 / #E7D4BD). These are **illustration/media** roles, not financial status signals. Google sign-in red (#B3261E) is an existing brand exception.

### 3.2 Existing Dark roles (CURRENT)

Canvas #171D1A; paper #202823; supporting surface #2C352E; ink #ECEDE5; muted #BBC5BC; outline #4B594E; primary #A9D0B4; onPrimary #163827; selected #314C3A; warning #F3CC85 and its soft backing #423822; error #FFB6A8 and its soft backing #4A302C; success #B0D8B8. Read the complete definitions and actual MaterialTheme bindings from Color.kt/Theme.kt; do not invent a parallel dark palette.

**Color law:**
- Green identifies action, selection, and meaningful confirmed success only through its correct semantic role; it must not imply a payment was confirmed.
- Amber signals an unresolved or due condition; red means destructive/blocking/error; neutrals carry ordinary information.
- Meaningful states always include words and, where useful, icons. **Never rely on color alone.**
- Keep broad areas calm. Prefer emphasis on obligations, actions, and figures instead of colored navigation chrome or a brightly tinted card for every object.
- No gradients, glassmorphism, decorative glows, fake glass sheets, or arbitrary shadows. A specifically justified navigation elevation is allowed.
- No new hex value in feature Compose code without a named semantic token and design review.

### 3.3 Current type scale (CURRENT, from Type.kt)

System SansSerif with Vietnamese-capable font fallback; never depend on a remote font.

| Role | Size / line | Weight | Intended use |
| --- | --- | --- | --- |
| headlineLarge | 28sp / 32sp | Bold | Important screen identity; use sparingly |
| headlineMedium | 19sp / 23sp | Bold | Page heading |
| titleLarge | 17sp / 25sp | Bold | Section heading |
| titleMedium | 15sp / 22sp | Bold | Object or subsection |
| titleSmall | 14sp / 20sp | SemiBold | Short supporting title |
| bodyLarge | 14sp / 23sp | Regular | Explanatory content |
| bodyMedium | 14sp / 20sp | Regular | Rows and normal detail |
| bodySmall | 12sp / 18sp | Regular | Contextual metadata |
| labelLarge | 12sp / 18sp | SemiBold | Strong label |
| labelMedium | 12sp / 17sp | SemiBold | Form and state label |
| labelSmall | 11sp / 16sp | Medium | Rare compact metadata |

**Typesetting:**
- Monetary figures use aligned, tabular digits if technically feasible, with VND/period labels readable and attached.
- A large amount must not stand alone: show **what it is, for which cycle, its due/confirmed state, and a link to source detail**.
- Real hierarchy comes from size, weight, contrast and spacing; not from making every item bold.
- Preserve dynamic font scaling and Vietnamese diacritics. Small labels must not contain the only information required to act.

### 3.4 Layout / shape tokens (CURRENT)

From Dimensions.kt: action target minimum 48dp; form field minimum 52dp; standard row minimum 64dp; page horizontal padding 20dp; panel padding 16dp; content gap 12dp; label gap 6dp; compact row breakpoint 360dp.

From Theme.kt: extraSmall 8dp, small 8dp, medium 10dp, large 12dp, extraLarge 20dp. Existing photo assets and root navigation may own specialized geometry, but they must not create a second generic button/card scale.

**Density rule:** daily-use workspace is compact but not cramped. Information panels need clear headings, coherent alignment and enough first-screen content to act without excessive scrolling. Use consistent vertical rhythm, not repeated 24dp spacers between every trivial row.

## 4. Shared component grammar

**Existing generic owners:** TroOiPage, TroOiScreenScaffold, TroOiPageTopAppBar, TroOiPageHeader, TroOiCard, TroOiListRow, TroOiInformationRow, TroOiButton, TroOiFormField, TroOiFeedback, TroOiStateMessage, TroOiConfirmDialog and TroOiActionDialog.

Read docs/designs/v1/android-frontend-architecture.md before introducing a component. Reuse shared primitives; put record-specific compositions in their feature. Never reintroduce retired V1 generic atoms or raw generic Material button/card/field patterns in feature code.

| Pattern | Contract |
| --- | --- |
| Page header | Name current task and scope; secondary description only if useful |
| Context strip | Show organization/property/room or tenancy when financial data could otherwise be ambiguous |
| Attention queue | A short, sorted list of actually actionable source-linked items with direct next actions |
| Overview number | Show an exact supported source aggregation and period; avoid invented deltas/sparklines |
| Room row | Identity first, operational status, primary tenant/context if valid, one next action |
| Financial row | Label, cycle, amount, due/confirmation state, source-detail affordance |
| Status chip | Semantic label + tonal backing; no color-only meaning or raw enum string |
| Activity event | Timestamp, object/source type, what changed, and source reference where supported |
| Form | Persistent labels, keyboard appropriate to input, inline validation, busy/submit protection |
| Empty state | Why empty, what user can do, or what permission/data is missing; never fake data |
| Failure state | Explain failed operation and safe retry; preserve user input |
| Unavailable action | Show reason and gate; a preview must not masquerade as completion |

**One primary action per decision cluster.** Use text/secondary actions for navigation and reversibles. Destructive actions need explicit confirmation and a consequence statement. Modal/sheet is for a bounded decision or concise preview; a multi-stage data entry flow requires a proper screen/wizard with progress and Back behavior.

## 5. Landlord / Operator POV — target redesign (PROPOSED)

### 5.1 Home: a working dashboard, not an exhaustive report

Above the first scroll break on a normal phone, prioritize:

1. **Workspace identity:** operating organization, selected scope, compact switch.
2. **Action center:** top actionable issue(s), with source links and meaningful urgency; never convert an unlinked aggregate into a clickable fake item.
3. **Rental operation snapshot:** occupied/vacant/maintenance/inactive rooms in a compact status layout and an obvious route to the room register.
4. **Primary job entry:** the most relevant allowed action, such as opening room register or adding a room. Do not force all users into “add asset” as the only prominent action.
5. **Recent verified activity:** a few real dated records, with a route to full history.

Do **not** repeat the room register, list of tenants, complete receivables, every payment and every incident as five endless dashboard sections. The dashboard **routes to authoritative detail**, it does not replace detail screens.

### 5.2 Rooms / properties register

- Display organization and property grouping clearly.
- Quick search/filter by supported attributes and real operational state; unsupported filter semantics remain gated.
- Compact rows take priority over tall repeated photo cards. Photos can identify a property on detail, but should not consume the entire register viewport.
- Every row must make Room identity, status and contextual next action scannable.
- A property is not a room; a Listing is public projection, not a duplicate operational Room.
- Status transitions must obey lifecycle guards; never offer direct OCCUPIED → MAINTENANCE or OCCUPIED → INACTIVE.
- Archive action is disabled/explained until all backend invariants permit it.

### 5.3 Room detail: signature operational record

A single room detail should express **identity → present situation → next action → record history**.

Recommended in-page sections: Overview, Rental, Charges & payments, Incidents, History, with Listing context where legitimately available. Tabs/anchors should not fabricate independent data owners. Keep exact room identity and selected organization throughout all nested routes.

### 5.4 Finance & incidents

- Separate **Receivable / Charge**, **Payment**, **Deposit**, **Receipt**, and **Payment Claim** visually and verbally.
- A received transfer is not proof of charge allocation. A submitted claim is not actual money inflow. A receipt is only associated with a confirmed Payment as permitted by the backend.
- Show operational amount, source, period and confirmation independently.
- The incident list is a **work queue** with category, room, last update, owner/allowed action and true lifecycle status. A reported incident is not magically resolved when viewed.
- Bulk actions must have verified permission and clear selection confirmation; do not invent capabilities for visual convenience.

## 6. Tenant notebook — target redesign (PROPOSED)

### 6.1 Identity and structure

This is a **personal rental notebook** (“Sổ thuê của tôi”), not a clone of the landlord workspace. Put the current rental identity first and surface exactly the decision the tenant needs now.

Proposed top-to-bottom content:
1. **My room:** room/property label, current tenancy state, relevant dates and access to rental details.
2. **This rental period:** what is due, what was confirmed as received, what remains unknown; cycle and due date must be visible.
3. **Next action:** pay through an actually available provider, review an upcoming obligation, or submit/view an incident. If no authorized action is possible, offer source details, not a fake CTA.
4. **Deposit & agreement:** deposit requirement versus actual held/settlement status, plus currently applicable Terms version.
5. **Open issues & notices:** progress, acknowledgement if supported, with explicit state words.
6. **My timeline:** confirmed payments/receipts, incident events and tenancy notices, each source-linked and dated.

### 6.2 Information hierarchy

- Do not display a raw stack of every Charge, Payment, Deposit, Incident and Notice on first view.
- One concise financial summary should answer **“Tôi còn cần trả bao nhiêu, của kỳ nào, trước ngày nào?”**; if backend lacks enough data, say **“Chưa đủ dữ liệu để xác định khoản còn phải trả”** rather than guessing.
- From the summary, drill into **one** period, then individual source Charge/Payment/Receipt.
- Keep current and former Tenancy distinct. Former rental is read-only where the domain policy requires it.
- If multiple tenancies are linked, show an explicit context selector; never quietly choose another Room's finance.
- Render status, dates, period and provenance from source models, not visual-state guesses.

### 6.3 Tenant notebook interactions

- Acknowledge Terms **for the specific version**, never a vague tenancy-level checked boolean.
- Payment success must come from confirmed backend/provider evidence, not a redirect or screenshot.
- Permit payment histories without claiming partial allocation is complete.
- Deposit settlement can remain pending even if tenancy is ENDED; show that distinction.
- Incident timeline is a followable progress record; reported, acknowledged, in progress, resolved and closed mean different things.
- Document all empty cases: no linked tenancy, linked but no finance, temporary partial finance failure, no receipt, no incident, former tenancy, and access forbidden.
- Show dates as localized Vietnamese date text; amounts with explicit VND units and correctly scoped cycle.

## 7. Trust, business semantics and privacy — non-negotiable

- **Single source of truth:** Dashboard, History, Notifications and other read models are projections, never owners of business state.
- **Room ≠ Listing. Inquiry ≠ booking.** Discovery reads published listings; no hidden reservation semantics.
- **Tenant participant ≠ User.** A landlord can create a legitimate tenancy even before tenant account linking; the UI cannot require app activation when the canonical model does not.
- **Charge ≠ Payment ≠ Payment Claim ≠ Deposit ≠ Receipt.** Do not merge them for convenience or show a single ambiguous green “paid” badge.
- **Checkout matters:** Tenancy ENDING does not mean Room VACANT; only confirmed checkout completes that transition.
- **Public map:** exact operational address is not public by default.
- **Legal boundary:** use “ghi nhận”, “xác nhận”, “biên nhận”, “lịch sử”, “dữ liệu đối chiếu”; do not claim the platform adjudicates disputes or guarantees deposit refunds.
- **OPEN remains OPEN; FUTURE remains FUTURE.** A proposed design is not permission to implement an unapproved policy or undisclosed endpoint.

## 8. Copy, language and content

Product-facing labels and accessibility strings are **Vietnamese-first**. Preserve domain meaning; no untranslated enum codes or developer terminology in user-visible status.

| Do | Avoid |
| --- | --- |
| “Khoản cần thanh toán · kỳ 10/2026” | “Balance” without cycle/source |
| “Đã ghi nhận thanh toán” | “Đã thanh toán hết” without allocation evidence |
| “Tiền cọc đang chờ đối chiếu” | “Cọc an toàn tuyệt đối” |
| “Đang xử lý sự cố” | “Done” on an incident that is not closed |
| “Chưa có biên nhận được phát hành” | Creating a fake receipt row |
| “Không thể tải dữ liệu. Thử lại” | Empty state that hides a 403/500 |

Use actual product examples for design mockups only when **clearly marked sample data**. Do not use synthetic financial totals as real dashboards. Prefer centralized Android string resources for new copy; do not scatter new UI literal strings or arbitrary colors across features.

## 9. Adaptive layout, motion, accessibility

- Native Android first. Use the app's outer shell for system bars, IME and inset ownership once. Nested flows must not double-apply safe area.
- Primary actions and interactive rows have a minimum 48dp tap area; text fields at least 52dp as existing tokens prescribe.
- Verify at **320dp, compact ≤360dp, ordinary phone width, font scale 1.3**, and expanded width when the surface supports it.
- At narrow widths, money/status rows stack deliberately rather than clipping or squeezing figures into unreadable columns.
- Preserve system/predictive Back, focus restoration, enabled/disabled semantics and screen-reader labels.
- Use WCAG AA contrast checks as a **verification requirement**, not an unverified assertion that all current token combinations pass. Essential normal text target 4.5:1; large text and non-text UI indicators target 3:1 where applicable.
- Prefer quiet transitions that explain navigation/state; no mandatory motion for comprehension. Respect reduced-motion settings.
- Root concave navigation is a recognized brand element, **not a reason to hide content or reduce label/tap accessibility**.
- Avoid nested scroll traps, accidental repeated submits, surprise mode switches and destructive swipe gestures without confirmation.

## 10. Workflow: UX-first, visual-second, code-third

### Stage A — Audit before proposing screens

Inventory actual users, source models, screens, first-viewport content, jobs and current navigation. For each target flow document:
- actor + workspace/tenancy scope;
- the user question to answer;
- primary job and authorized action;
- required source data and missing/OPEN states;
- errors, permissions, cancellation and return path.

Map navigation and information architecture **before** changing colors or building new cards. Identify actual friction separately from assumptions based on source code.

### Stage B — Three divergent compositions, one selected direction

For each major POV redesign produce **three genuinely different structural options** based on the same Moss Green tokens. Compare hierarchy, taps, scannability and accessibility. Do not replace the palette and do not equate three color variants with three UX options. Select one after a documented decision/review.

### Stage C — Screen family and prototype

Create an interactive prototype showing the complete **landlord** and **tenant** task loops, including normal/empty/loading/error/forbidden/partial-data states. Test context preservation and domain boundaries with realistic, internally consistent demo data. A clickable prototype proves navigation only; it is not proof of backend success.

### Stage D — Taste / consistency review

Compare screenshots at ordinary and compact widths. Find the **three most consequential visual or interaction defects**, fix, and capture again. Inspect typography, rhythm, data emphasis, alignment, dense lists, bottom navigation, actionable affordances and state labels. Reject generic AI dashboards: rainbow KPIs, gratuitous icon circles, decorative charts, fabricated trend percentages, large blank hero space, and card-on-card layout.

### Stage E — Implementation and acceptance

Implement **one vertical flow at a time**, reusing theme and TroOi primitives. Preserve stable testTags, callbacks, scope and validation. Before accepting, run the project's frontend-architecture guard, targeted unit/UI tests, build checks, and true device/screenshot checks. Record exactly which checks were executed and which remain unverified.

## 11. Measurable prototype acceptance gates (targets, not completed results)

**Landlord scenario:** from Sổ, identify an organization and room, find a real outstanding charge/incident, enter the source detail and complete or safely stop the allowed next action. Candidate navigation target: reach the relevant source from an actionable home item in **at most two taps**, excluding initial scope selection.

**Tenant scenario:** from Sổ, name the active room and rental period, distinguish charge due from confirmed payment, locate the receipt if one exists, inspect a deposit state, and follow an incident. Candidate navigation target: current obligation and its due/confirmation context readable **without opening a second screen** when available.

**Both:** test a missing source, null amount, partial finance load, multiple tenancy contexts, forbidden action, lifecycle transition, async retry and disabled submission. No invented financial success, no source mixing, no inaccessible action, no layout overflow.

Target at least **five representative task participants per priority POV** for an initial formative usability pass, if available. Record task success, wrong turns, observed hesitations, and user quotes. These are proposed research targets, not evidence of completed validation.

## 12. Deliverables required from an implementing agent

For any design or implementation PR, include:
1. Problem statement, target user/job and current-state evidence.
2. Proposed user flow and screen-state inventory.
3. Explicit token/component reuse table and any justified exceptions.
4. Visual prototype or before/after screenshots in Light/Dark and compact/normal widths.
5. Source-data/permission mapping for every consequential action.
6. Accessibility and test report with actual PASS/FAIL/NOT RUN labels.
7. Remaining UX risks and unresolved policy gates.

**Never** auto-implement a broad refactor from this file alone. Review one selected screen direction and its interaction flow before modifying working product UI. Never push, merge, or change frozen domain contracts unless separately requested.

## 13. Source map

**Local current implementation**
- app/src/main/java/com/trooi/app/ui/theme/Color.kt
- app/src/main/java/com/trooi/app/ui/theme/Theme.kt
- app/src/main/java/com/trooi/app/ui/theme/Type.kt
- app/src/main/java/com/trooi/app/ui/theme/Dimensions.kt
- app/src/main/java/com/trooi/app/ui/components/
- app/src/main/java/com/trooi/app/ui/navigation/TroOiBottomNavigation.kt
- app/src/main/java/com/trooi/app/features/landlord/LandlordScreens.kt
- app/src/main/java/com/trooi/app/features/ledger/LedgerScreen.kt
- app/src/main/java/com/trooi/app/features/tenant/TenantPovScreens.kt
- docs/designs/v1/PRODUCT.md
- docs/designs/v1/android-frontend-architecture.md
- docs/designs/v1/DESIGN.md (historical, mixed HTML/Android chronology)
- docs/database/v1/canonical.md (verify repository authority before implementation)

**External design-method references**
- OpenDesign: https://github.com/nexu-io/open-design — design brief, semantic system, prototype, design review.
- Taste Skill: https://github.com/Leonxlnx/taste-skill — app screen methodology and screenshot-based inspection.
- UI UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill — retrieval of product-specific UX, accessible components, typography and stack guidance.

**Interpretation principle:** external libraries inform how to design and review; they do not decide what TrọƠi's user, Room, Payment or Tenancy means.
