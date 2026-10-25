# TrọƠi — Landlord and Tenant UX Rework

Status: DESIGN PROPOSAL — not implemented or usability validated
Date: 2026-10-23
Target: Android, Jetpack Compose, Material 3
Parent design authority: ../../DESIGN.md

## 1. Scope and evidence

This file continues the DESIGN.md distillation. It proposes the information architecture and screen flows of the **Landlord/Operator POV** and the **Tenant Sổ**. It does not change the business model, gateway payment behavior, theme, or backend.

**Inspected implementation**
- app/src/main/java/com/trooi/app/features/landlord/LandlordScreens.kt — organization dashboard with attention, room states, tenancy count, payment summary and incident activity.
- app/src/main/java/com/trooi/app/features/ledger/LedgerScreen.kt — contextual Sổ containing assets, rooms, people, receivables, payments, deposits, incidents and notices.
- app/src/main/java/com/trooi/app/features/tenant/TenantPovScreens.kt — rental identity, current finance context, incidents, notices and recent payment.
- app/src/main/java/com/trooi/app/ui/navigation/TroOiBottomNavigation.kt — Khám phá, Sổ, Tin nhắn, Hồ sơ.
- app/src/main/java/com/trooi/app/ui/theme — current Moss Green palette, Material3 bindings, typography and dimensions.

**Working UX hypotheses — not tested with participants**
- Landlord overview, source records, portfolio register, and action queue compete in lengthy vertical lists.
- Tenant Sổ exposes accounting-oriented sections where the user primarily wants current room, due period, proof of payment, and incident status.
- Full-width asset photography is better for spatial detail than dense day-to-day registers.
- Missing/unloaded financial data can be confused with true zero balance without stronger presentation state separation.

## 2. Fundamental POV questions

| POV | First question to answer | Primary outcome |
| --- | --- | --- |
| Landlord | Which action needs attention, and in which room or organization? | Open verified source detail and take an allowed action |
| Tenant | Which room am I renting, what must I pay for the current period, and what is pending? | Understand the source-backed obligation and rental status |

A user can have multiple relationships. POV is scoped by the active organization or tenancy, never a hardcoded global USER role.

## 3. Landlord: exactly three IA directions

### Option L-A: Action-first operations — SELECTED

Organization scope → attention queue → room-state overview → room register / finance / incidents → source-linked action.

**Benefit:** shortest navigation path from a problem to the relevant record.
**Trade-off:** the home screen is not the full financial/portfolio report.
**Reason selected:** landlords doing daily operations need to identify and resolve exceptions before browsing every record.

### Option L-B: Portfolio-first

Property register → room list → room detail → contextual finance and incidents.

**Benefit:** intuitive for one or two buildings.
**Trade-off:** urgent receivables and incidents risk being buried in inventory.

### Option L-C: Collections-first

Receivables → payments → rooms → incidents.

**Benefit:** focused on rent collection.
**Trade-off:** unbalanced for general property operations and room lifecycle.

### Selected Landlord navigation

~~~mermaid
flowchart LR
    A["Sổ / Organization"] --> B["Việc cần xử lý"]
    A --> C["Danh sách phòng"]
    A --> D["Tài chính"]
    B --> E["Bản ghi nguồn"]
    C --> F["Chi tiết phòng"]
    F --> E
    D --> E
    E --> G{"Action allowed?"}
    G -->|Yes| H["Validate and submit"]
    G -->|No / OPEN| I["Explain unavailable"]
    H --> J["Confirmed source result"]
~~~

### Landlord first viewport

1. Compact header showing "Sổ vận hành" and **current organization**.
2. Short, actually actionable priority queue — room/source/status explicitly labeled. No fake links from aggregate counts.
3. Compact room-state summary with immediate entry into the room register.
4. A context-appropriate primary action. Never default to an oversized Add Asset button if the current issue is an existing room.
5. Preview of recent verified events, not every record on the home screen.

**Room register:** group by property, show scannable room identity, status, tenant context when known, and one next action. Do not put a 176dp image into every row. Unsupported filters remain disabled or omitted.

**Room detail:** identity → current occupancy/lifecycle → Rental → Finance → Incidents → Listing if public → History. Keep source and room context stable through Back/navigation.

**Finance:** distinguish amount due, confirmed incoming payment and allocated amount. Display charge cycle, due date and source identity. No green "all paid" badge based only on the existence of a Payment.

## 4. Tenant Sổ: exactly three IA directions

### Option T-A: Current rental and obligation — SELECTED

Current room → current billing period → next allowed action → deposit/terms → issues → history.

**Benefit:** answers daily rental questions without accounting training.
**Trade-off:** historical rentals need explicit access in a secondary section.
**Reason selected:** a Sổ thuê first viewport should answer the present obligation before listing old records.

### Option T-B: Chronological notebook

Room → events timeline → dated source details.

**Benefit:** strong for audit/dispute history.
**Trade-off:** a payment deadline is hard to locate in event chronology.

### Option T-C: Category directory

Room → Finance / Deposit / Terms / Incidents / Notices.

**Benefit:** comprehensive and predictable categories.
**Trade-off:** increases taps for common tasks.

### Selected Tenant navigation

~~~mermaid
flowchart LR
    A["Sổ thuê / Tenancy"] --> B["Kỳ hiện tại"]
    A --> C["Tiền cọc & điều khoản"]
    A --> D["Sự cố & thông báo"]
    A --> E["Lịch sử thuê"]
    B --> F["Charge và Payment"]
    F --> G["Receipt khi đã phát hành"]
    D --> H["Source timeline"]
    E --> I["Former Tenancy read-only"]
~~~

### Tenant first viewport

1. Heading "Sổ thuê của tôi"; current room/property identity and Tenancy lifecycle.
2. Current period block: cycle, Charge due, due date and confirmed Payment, **only if data is available**. Else explain that obligation is not yet determinable.
3. One primary next action with verified capability; if disabled, show why.
4. Compact links to Tiền cọc, Điều khoản, Sự cố and Biên nhận.
5. Source-backed timeline below the main task area.

**Never** choose a second linked tenancy invisibly. Former rentals show read-only history, not a payment CTA detached from domain rules. Tenant has a source-backed timeline, not a miniature landlord collection screen.

## 5. Required screen state matrix

| State | Landlord | Tenant |
| --- | --- | --- |
| Loading | Stable organization context and skeleton | Stable room context and clear loading |
| Empty | No organization vs no rooms separated | No linked tenancy vs no charges separated |
| Partial failure | Known records remain; failed fields explicitly marked | No inference that outstanding amount is zero |
| Forbidden | No unauthorized source/data shown | No unrelated tenancy records |
| Confirmed Payment | Incoming amount separate from charge allocation | Payment proof separate from balance-due status |
| Unconfirmed claim/redirect | No paid/receipt success | Await trusted source verification |
| Incident open | Actionable issue scoped to room | Progress and last dated source event |
| Former rental | Archive/checkout history where allowed | Read-only history, deposit settlement distinct |

## 6. Visual and interaction constraints

- Preserve root DESIGN.md Moss Green, Material3 and TroOi component grammar, including the four existing root tabs.
- Do not import an unrelated external brand palette or decorative dashboard template.
- Prioritize semantic text, compact information rows and 48dp tap targets over card-on-card compositions.
- Money must show currency, period and provenance; never use raw enum names as UI copy.
- Use native insets/IME/Back, test 320dp and 1.3× font scale, Light/Dark, loading/empty/error states.
- Do not create a working payment action without the supported backend contract. Canonical v3.7 FROZEN / OPEN / FUTURE classifications still apply.
- UI work remains separate from the expedited SePay/Android merge tracked in GitHub Issue #13.

## 7. Prototype test tasks and acceptance gates

**Landlord**
- L1: From Sổ identify organization and reach the source record of one actionable incident.
- L2: Find a room with an outstanding Charge; distinguish Charge, Payment and allocation.
- L3: Open room detail and return without losing the correct Room/Organization scope.

**Tenant**
- T1: Identify current room, present billing period and due amount or why it cannot be determined.
- T2: Locate confirmed Payment and Receipt if actually issued.
- T3: Follow an open incident to its source-backed timeline.

**Provisional prototype targets, not measured:** action queue → source in at most two taps after the scope is selected; current due context visible on the Tenant first screen; zero invented success states; no cross-tenancy source mix; no clipping at 320dp.

## 8. Sequenced implementation

1. Capture baseline native screenshot states; audit density, interaction and current source routes.
2. Build **clickable low-fidelity prototype** of L-A and T-A using the existing design tokens, including partial/empty/error/forbidden variants.
3. Review with owner/mentor and revise the structure before shipping code.
4. Migrate the landlord Dashboard/Room register first; then Tenant Sổ/current-cycle detail. Keep callback permissions and current testTags.
5. Validate accessibility, regressions, Compose build, screenshot contrast and user task completion; label unrun tests NOT RUN, not PASS.

**Current status: written UX architecture and directions only. No prototype, Compose redesign, or usability acceptance claimed.**
