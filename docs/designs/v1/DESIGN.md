---
name: "TrọƠi · Room Ledger"
description: "Warm residential Android screen atlas and room record component system"
colors:
  canvas: "#eeeae2"
  paper: "#fffdf8"
  surface: "#f4f1e9"
  ink: "#242d2a"
  muted: "#606b64"
  line: "#d8dcd3"
  primary: "#235a46"
  on-primary: "#fff"
  selected: "#dce9df"
  clay: "#a95034"
  clay-soft: "#f3e4d9"
  warning: "#7d5318"
  warning-soft: "#f8edd7"
  error: "#a23631"
  error-soft: "#fae7e2"
  success: "#286145"
  water: "#d4e5e6"
  media: "#e7d4bd"
  dark-canvas: "#171d1a"
  dark-paper: "#202823"
  dark-surface: "#2c352e"
  dark-ink: "#ecede5"
  dark-muted: "#bbc5bc"
  dark-line: "#4b594e"
  dark-primary: "#a9d0b4"
  dark-on-primary: "#163827"
  dark-selected: "#314c3a"
  dark-clay: "#efb18e"
  dark-clay-soft: "#503d31"
  dark-warning: "#f3cc85"
  dark-warning-soft: "#423822"
  dark-error: "#ffb6a8"
  dark-error-soft: "#4a302c"
  dark-success: "#b0d8b8"
  dark-water: "#344c4c"
  dark-media: "#594a3b"
typography:
  headline:
    fontFamily: 'Roboto, "Segoe UI", "Noto Sans", Arial, sans-serif'
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.13
    letterSpacing: "-.025em"
  app-title:
    fontFamily: 'Roboto, "Segoe UI", "Noto Sans", Arial, sans-serif'
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-.015em"
  section-title:
    fontFamily: 'Roboto, "Segoe UI", "Noto Sans", Arial, sans-serif'
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-.015em"
  body:
    fontFamily: 'Roboto, "Segoe UI", "Noto Sans", Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  body-copy:
    fontFamily: 'Roboto, "Segoe UI", "Noto Sans", Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: 'Roboto, "Segoe UI", "Noto Sans", Arial, sans-serif'
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "normal"
  room-number:
    fontFamily: 'Roboto, "Segoe UI", "Noto Sans", Arial, sans-serif'
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-.02em"
  billing-amount:
    fontFamily: 'Roboto, "Segoe UI", "Noto Sans", Arial, sans-serif'
    fontSize: "33px"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-.025em"
rounded:
  plate-top: "4px"
  field: "8px"
  button: "10px"
  surface: "12px"
  media: "14px"
  plate-bottom: "16px"
  sheet-top: "20px"
spacing:
  step-4: "4px"
  step-8: "8px"
  step-12: "12px"
  step-16: "16px"
  step-20: "20px"
  step-24: "24px"
  step-32: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.button}"
    padding: "12px 16px"
  button-secondary:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.primary}"
    rounded: "{rounded.button}"
    padding: "12px 16px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "13px 12px"
  state-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "15px"
  navigation:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted}"
    padding: "4px 8px"
---

# Design System: TrọƠi · Room Ledger

## Overview

**Creative North Star: "The Room Ledger"**

A living operational record for each rented room. Warm paper, bottle green and clay event marks connect discovery, daily rental obligations and work by room. The numbered apartment door plate and dated records form the reusable identity; amounts and provenance remain readable without a card around every item.

This authority captures the completed HTML visual rewrite. The old stylesheet and screen helpers were replaced by one new family. It documents an Android-oriented artifact, not an implemented Compose redesign. PRODUCT.md and canonical v3.7 constrain domain presentation; current OpenAPI constrains exposed transport.

**Key Characteristics:**

- Apartment-door identity and dated source records.
- One component family, three distinct POV hierarchies.
- Flat paper surfaces, dividers and tabular money.
- Labeled media placeholders and explicit policy boundaries.

## Colors

The palette combines residential paper warmth with bottle green actions and clay chronology. The frontmatter records the actual CSS custom-property values; `dark-*` entries map the same role to `[data-theme=dark]`, rather than defining a second visual identity.

### Primary

Bottle green (`primary`) carries primary actions, selected navigation and room plates. `on-primary` is the paired foreground; `selected` provides a quiet selection surface. Success has its own semantic role and a visible state label.

### Secondary

Clay (`clay`, `clay-soft`) distinguishes event markers and keyboard focus. Amber (`warning`, `warning-soft`) carries pending, due and unresolved-policy information; red (`error`, `error-soft`) identifies blocking and destructive feedback. Water and media colors belong to map/media illustrations, not business status.

### Neutral

`canvas` frames the atlas; `paper` is the screen and workbench surface; `surface` groups supporting content. `ink`, `muted` and `line` separate primary text, supporting text and boundaries. Dark mode remaps all semantic roles to green charcoal, pale text and softened containers. Media captions use their own readable paper/ink pairing; the illustration remains labeled in both themes.

**The State Label Rule.** A color mark always accompanies meaningful state text; color alone never confirms business truth.

## Typography

**Display and Body Font:** Roboto, with Segoe UI, Noto Sans, Arial and sans-serif fallback as implemented. The artifact does not bundle a font; its appearance depends on installed families. Native Android should use scalable sp roles and a Vietnamese-capable system fallback.

The family feels direct and operational. Headline size is reserved for a listing, task or first-view identity; ordinary records retain quieter type. Frontmatter roles mirror actual reused declarations, including the room plate and billing amount. App titles and section titles use slightly tight tracking. Supporting labels are 12px; root navigation is 11px in the artifact. Money, dated records and room numbers use tabular numerals where declared.

**The Amount Rule.** A large amount must retain its period, due state or confirmation context. Typography cannot collapse owed money and received money into the same fact.

## Layout

The compact device is 406 × 864px including an 8px shell around an approximately 390px content canvas. Screen bodies use 20px horizontal padding, with 18px in the narrow browser treatment. App bars have a 64px minimum height, status chrome is 28px, root navigation 76px minimum and gesture chrome 19px. Nested tasks carry a bottom action dock with 14px × 20px padding. Scrollable content is separated from root navigation and simulated system chrome.

The HTML workbench is a review tool. Its container is capped at 1480px; atlas cards use four columns, then three at 1200px, two at 900px and one at 600px. The full viewer places the device beside a documentation column; below 900px the documentation follows the device. At 600px the device width is constrained by the viewport. Miniatures are deliberately scaled, inert first-viewport samples, not interactive phone replicas. A mobile browser shows the documentation shell; it does not prove native window-size behavior.

The three first-view compositions belong to their POV surfaces:

- **Guest:** public location entry and residential illustration lead, then rent, public area and inquiry activity. Map/device location supplies the search center; no invented textual geocoder.
- **Tenant:** current room plate and active rental lead, followed by the amount and deadline, incident progress, notices and confirmed payment history.
- **Landlord:** three attention items lead, then a compact room register summary and recent source-linked events. Finance uses distinct owed, received and deposit lanes.

Shared screens inherit caller context where appropriate; Shared is a reused layer, never a fourth POV. Session and authentication are pre-shell. Root navigation has four Guest or five Tenant/Landlord labeled destinations; nested records do not acquire a global bottom bar.

For Android implementation, preserve system status/gesture/IME insets, system and predictive Back, 48dp touch targets and scalable text. Expanded native windows should adopt platform-appropriate rail/drawer layout. These are handoff requirements: real insets, IME interaction, font scaling, TalkBack, predictive Back and physical-device behavior were not changed or verified by this artifact rewrite.

## Elevation & Depth

Paper layers, fine dividers and tonal grouping provide depth. The implemented system has no box-shadow vocabulary. Viewer/documentation boundaries remain explicit; a sheet uses a translucent scrim and a rounded upper edge. Root content stays calm and flat. Snackbar contrast uses the ink/paper pair. The only general transition is the atlas border-color feedback (0.18s); no speculative animation scale is part of this authority. Reduced-motion media rules suppress animation, transition and smooth scrolling.

## Shapes

The signature plate is asymmetric: quiet upper corners with a broader lower-right corner. A room plate has 4px, 4px, 16px, 4px corners; the brand plate uses 4px, 4px, 12px, 4px. Fields and choices use 8px, buttons and notice panels 10px, grouped financial surfaces 12px, room media 14px and sheet upper corners 20px. The receipt intentionally uses a nearly square 2px corner and dashed boundary. Small state dots and timeline nodes carry chronology; they are paired with words.

## Components

### Actions, fields and states

Primary buttons use `primary`/`on-primary`, a 48px minimum height and 12px × 16px padding. Secondary buttons use `selected`/`primary`; outline and text variants remain quiet. Pressed feedback applies a brightness filter; disabled controls reduce opacity and omit action. Global keyboard focus uses a 3px clay outline with a 3px offset. Icon buttons have 48 × 48px targets and a quiet surface hover.

Fields retain labels outside their control, 52px minimum height, paper fill, line boundary and 8px corners. Textareas start at 110px. Invalid fields use error borders and helper text; disabled fields use supporting surface treatment. Choice controls use `aria-pressed`; state labels carry text with a dot. Loading, empty, recoverable error and forbidden previews are distinct: a 403 never masquerades as missing data. Inputs are retained across the artifact state previews.

### Navigation and transient surfaces

Root bars label every icon and mark the active destination with `aria-current` and a selected-symbol backing. Context rows name the tenancy or operated organization before routing. The artifact viewer supports Escape, tab containment and return focus; sheets focus their first control and contain keyboard traversal. These browser affordances require separate native accessibility implementation.

### Records, media and money

Unboxed attention rows use a leading icon, title, supporting context and optional aligned amount. Listing media leads only where spatial discovery helps. Room illustrations are authored inline SVG and explicitly labeled "Không gian minh họa · Chưa có ảnh phòng"; their accessible name says the plan is not factual. No generated raster, external property photo or approved image comp ships. Incident attachment space also remains a placeholder. The requested OpenDesign package was unavailable; persistent product/design documentation principles were applied without claiming that package ran.

BillingSummary and ChargeRow retain period, due date, Terms source, line amounts and total. PaymentStatus identifies confirmed receipt and allocation context; DepositSummary distinguishes required and held amounts. ReceiptSheet is documentary evidence issued from a confirmed Payment and preserves source identity. Finance lanes retain those separate semantic roles.

### Signature: Room Ledger

RoomHero anchors a room number, property/context and current state. RentalSummary names the current primary tenant and date range. A six-part ledger navigation links Overview, Listing, Rental, Finance, Incident and History to their own source surfaces; it does not merge aggregates. Dated HistoryEvent rows use a clay spine, Vietnamese domain source label and optional source-record action. Internal lifecycle enums remain in source inventory/documentation instead of visible event labels. History is chronological and read-only. Room identity and tenancy POV persist across routes: current Room 203 does not jump into Room 204 Listing or Room 105 checkout/settlement; unavailable same-room actions open explanatory sheets. The former Room 105 context opens its parameterized read-only history and retains identity through hash/history state. Landlord history links landlord source records. IncidentTimeline reuses the dated pattern for append-only operational events.

**The Source Record Rule.** Dashboard, History and Notification project source records; they never become the owner of a business mutation.

### Rendering and representative coverage

`renderApp` selects one explicit renderer for each V1/OPEN screen and the shared gated FutureScreen for roadmap screens. `Device` adds simulated Android chrome. `renderPreview` calls that same Device/renderApp path, so thumbnails contain the actual first viewport rather than separate placeholder drawings. Shared visual helpers include AppBar, Field, StatePanel, RoomHero, AttentionItem, BillingSummary, ChargeRow, PaymentStatus, DepositSummary, HistoryEvent and ReceiptSheet.

The mandatory representative ten are Session (`shared-session`), Guest Home (`guest-home`), Listing Detail (`guest-listing-detail`), Tenant Home (`tenant-home`), Billing (`tenant-billing`), Incident Detail (`tenant-incident-detail`), Landlord Dashboard (`landlord-dashboard`), Room Ledger (`landlord-room-detail`), Finance Hub (`landlord-finance-home`) and Context Switcher (`shared-context`). Payment, Deposit and Receipt were also included in the final light/dark visual capture set.

The stable inventory is 85 screens: 63 V1, 5 OPEN and 17 FUTURE after the approved optional MoMo promotion on 2026-10-05. Metadata, descriptions, flows and relations remain in the HTML inventory; this table is an ID/classification reference.

| ID | POV | Scope |
| --- | --- | --- |
| `shared-session` | Shared | V1 |
| `shared-auth` | Shared | V1 |
| `shared-context` | Shared | V1 |
| `shared-notifications` | Shared | V1 |
| `shared-account` | Shared | V1 |
| `shared-settings` | Shared | V1 |
| `shared-help` | Shared | V1 |
| `shared-trust-report` | Shared | V1 |
| `guest-home` | Guest | V1 |
| `guest-search` | Guest | V1 |
| `guest-map` | Guest | V1 |
| `guest-results` | Guest | V1 |
| `guest-listing-detail` | Guest | V1 |
| `guest-inquiry-compose` | Guest | V1 |
| `guest-inquiry-activity` | Guest | V1 |
| `guest-area-label` | Guest | OPEN |
| `guest-availability` | Guest | OPEN |
| `guest-type-filter` | Guest | OPEN |
| `tenant-home` | Tenant | V1 |
| `tenant-rental` | Tenant | V1 |
| `tenant-participants` | Tenant | V1 |
| `tenant-terms` | Tenant | V1 |
| `tenant-terms-ack` | Tenant | V1 |
| `tenant-deposit` | Tenant | V1 |
| `tenant-billing` | Tenant | V1 |
| `tenant-charge` | Tenant | V1 |
| `tenant-payment` | Tenant | V1 |
| `tenant-payment-claim` | Tenant | V1 |
| `tenant-receipt` | Tenant | V1 |
| `tenant-incidents` | Tenant | V1 |
| `tenant-incident-create` | Tenant | V1 |
| `tenant-incident-detail` | Tenant | V1 |
| `tenant-notices` | Tenant | V1 |
| `tenant-moveout` | Tenant | V1 |
| `tenant-history` | Tenant | V1 |
| `tenant-review` | Tenant | V1 |
| `tenant-terms-schema` | Tenant | OPEN |
| `tenant-momo` | Tenant | V1 |
| `landlord-dashboard` | Landlord | V1 |
| `landlord-organizations` | Landlord | V1 |
| `landlord-property-create` | Landlord | V1 |
| `landlord-properties` | Landlord | V1 |
| `landlord-property-detail` | Landlord | V1 |
| `landlord-rooms` | Landlord | V1 |
| `landlord-room-detail` | Landlord | V1 |
| `landlord-room-state` | Landlord | V1 |
| `landlord-listing-editor` | Landlord | V1 |
| `landlord-listing-preview` | Landlord | V1 |
| `landlord-listing-status` | Landlord | V1 |
| `landlord-inquiries` | Landlord | V1 |
| `landlord-inquiry-detail` | Landlord | V1 |
| `landlord-tenancy-create` | Landlord | V1 |
| `landlord-tenancy-overview` | Landlord | V1 |
| `landlord-participants` | Landlord | V1 |
| `landlord-terms-editor` | Landlord | V1 |
| `landlord-finance-home` | Landlord | V1 |
| `landlord-billing` | Landlord | V1 |
| `landlord-payments` | Landlord | V1 |
| `landlord-payment-claims` | Landlord | V1 |
| `landlord-receipts` | Landlord | V1 |
| `landlord-deposits` | Landlord | V1 |
| `landlord-incidents` | Landlord | V1 |
| `landlord-incident-detail` | Landlord | V1 |
| `landlord-notices` | Landlord | V1 |
| `landlord-checkout` | Landlord | V1 |
| `landlord-room-history` | Landlord | V1 |
| `landlord-review-response` | Landlord | V1 |
| `landlord-dashboard-finance` | Landlord | OPEN |
| `future-subscription` | Future | FUTURE |
| `future-import` | Future | FUTURE |
| `future-team` | Future | FUTURE |
| `future-assets` | Future | FUTURE |
| `future-extra-charges` | Future | FUTURE |
| `future-marketplace` | Future | FUTURE |
| `future-dispatch` | Future | FUTURE |
| `future-ocr` | Future | FUTURE |
| `future-ai-insights` | Future | FUTURE |
| `future-chat` | Future | FUTURE |
| `future-saved-search` | Future | FUTURE |
| `future-ai-matching` | Future | FUTURE |
| `future-payment-gateway` | Future | FUTURE |
| `future-ota` | Future | FUTURE |
| `future-nightly` | Future | FUTURE |
| `future-proration` | Future | FUTURE |
| `future-public-ratings` | Future | FUTURE |

### Domain and policy boundaries

Canonical v3.7 remains authoritative: Room differs from public Listing, Inquiry never reserves, ENDING still occupies a room, and confirmed checkout alone ends the Tenancy and returns Room to VACANT. Charge, Payment, Claim, Deposit and Receipt stay separate; deposit settlements are neither inbound Payments nor legal findings. Trust Report targets Listing or Review and does not automatically remove content. Public discovery excludes exact operational address.

Current public search supports location, radius and price; textual geocoding, type vocabulary and availability semantics are unresolved. Payment Claim is an inventory capability with absent API and unresolved evidence/approval policy; submission and confirmation remain gated. Optional MoMo checkout is current V1; general provider/platform expansion stays FUTURE and gateway-as-MVP-dependency remains FUTURE. Only fully verified payment-success IPN creates GATEWAY / PROVIDER_VERIFIED Payment. Signed create response opens handoff only; redirect is untrusted. No automatic allocation, Deposit funding or Receipt issuance. Review eligibility/publication/moderation remain unresolved. Authenticated Listing-only Trust submission is current V1 with server-derived reporter identity; Review entry, report listing and moderation stay gated. Session reacquires Google credentials, verifies /me and validates backend-user-scoped non-secret context hints before routing; ID tokens remain in memory. Native map/picker is V1 acceptance, uses public projections without exact operational-pin fallback, and does not settle geocoder/type/availability policy. Notice and acknowledgement stay Tenancy-scoped. Claim and Inquiry Activity still require explicit contract/policy gates. A V1 classification does not by itself promise a working endpoint or settled policy. OPEN surfaces explain the missing policy and disable unavailable decisions; FUTURE stays outside current app navigation.

### Reproducible validation and limits

Open `TroOi_Product_Universe_Interactive.html` in a browser and run `window.TroOiAtlas.verify()`. The expected result is `{screens: 85, errors: []}`. This renders every inventory entry, checks duplicate IDs, related targets, renderer routes and root-navigation target resolution. It does not prove backend behavior, visual contrast, metadata preservation or native usability on its own.

For visual review, use Master Map and Screen Atlas, open each representative hash ID, toggle light/dark, and exercise the content/loading/empty/error/forbidden tabs. Compare miniatures with the normal first viewport and inspect horizontal clipping at desktop and narrow browser widths. The rewrite session supplied fresh browser evidence for all 85 renders, unchanged metadata, relation/navigation resolution, matching previews and no overflow, plus an initial 11-screen and final 13-screen light/dark capture set. Independent finish review confirmed the structural rewrite, then requested record/POV continuity and app-facing enum-label fixes. The correction verdict scored both fixes resolved and returned `ship` for the HTML artifact. This is not Android runtime approval.

This is a static illustrated artifact: it calls no API and changes no business state. Submission feedback explicitly stops at preview. Existing checklist runtime implementation statuses remain independent. Android app runtime and physical-device behavior were neither changed nor verified here.

## Do's and Don'ts

### Do:

- **Do** preserve stable inventory IDs and metadata; scope classifications change only with explicit approval.
- **Do** identify the room, current context and source before presenting the next allowed action.
- **Do** use labeled states alongside color, persistent field labels and visible focus.
- **Do** keep Charge, Payment, Claim, Deposit and Receipt visually and semantically distinct.
- **Do** validate the artifact in both themes and report native device work separately.

### Don't:

- **Don't** turn every record or metric into an identical card.
- **Don't** treat a submitted Claim or provider handoff as confirmed Payment.
- **Don't** expose exact operational addresses through public discovery.
- **Don't** move FUTURE surfaces into current app navigation or activate unresolved OPEN controls.
- **Don't** present authored SVG placeholders or sample records as factual property evidence.
