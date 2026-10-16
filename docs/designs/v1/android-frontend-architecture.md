# Android frontend architecture and migration record

Current implementation on `design/app-ui-redesign`, HEAD `f53f6d8`, 2026-10-11. This is the settled frontend architecture record; the original draft remains historical provenance. Canonical domain, API contracts and server authorization remain authoritative for business meaning.

| Gate | Status | Evidence |
| --- | --- | --- |
| Round 4 — typed Debug catalog | Implemented / PASS | Round 4 |
| Round 5 — six sequential UI slices | Implemented / PASS | Round 5 |
| Round 6 — removal, guardrails, documentation | Implemented / PASS | Round 6 |
| Round 7 — final regression and two review axes | Implemented / PASS | Round 7 |

## Component ownership

`app/src/main/java/com/trooi/app/ui/theme/` owns the native design tokens: Color.kt defines semantic palettes, Theme.kt binds Light/Dark roles and Material shapes, Type.kt owns typography, Dimensions.kt owns generic spacing and target sizes. Moss Green is the approved native identity; the historical HTML atlas palette does not override it.

`ui/components/` owns generic UI. Feature code supplies state, callbacks, validation, copy, tags and domain content; shared components do not submit commands or manufacture success.

| Component | Owner file | Use and boundary |
| --- | --- | --- |
| TroOiPage / TroOiScreenScaffold / TroOiPageTopAppBar | TroOiPage.kt | Canvas, shell and top bar. Nested shell defaults to zero system insets; standalone windows explicitly opt into safeDrawing. The outer shell owns IME once, body consumes supplied insets. Dialog canvas sets system glyph contrast. |
| TroOiPageHeader | TroOiPrimitives.kt | In-content heading and optional Back/action slots; adds no system insets. |
| TroOiCard | TroOiPrimitives.kt | Generic grouped content using theme surface/shape. |
| TroOiListRow | TroOiPrimitives.kt | Generic navigation/action row; tagged Surface owns Button action and selected semantics. Optional leading slot supports feature icon/monogram. |
| TroOiInformationRow | TroOiPrimitives.kt | Label/value/status/action, stacked at compact width or font scale above 1.2. |
| TroOiButton | TroOiPrimitives.kt | PRIMARY, SECONDARY, TERTIARY, DESTRUCTIVE; minimum 48dp, caller-owned busy state disables repeat activation. |
| TroOiFeedback / TroOiStateMessage | TroOiPrimitives.kt / TroOiStateMessage.kt | Informational text and loading/empty/error/unavailable with caller-owned retry action. Never persistence/payment proof. |
| TroOiFormField | TroOiFormField.kt | Material field shape/colors/minimum size. Callers retain filtering, limits, keyboard, focus, secret transformation and errors. |
| TroOiConfirmDialog / TroOiActionDialog | TroOiActionDialog.kt | Ordinary confirmations and the same underlying scrollable slot dialog for security/async errors. Busy dismissal remains caller-controlled for custom slots. |

New generic components use the `TroOi` prefix in this directory. Extend an existing primitive only for an actual caller; do not add a second button/card/field implementation in a feature. Prefer MaterialTheme roles and TroOiDimens to generic hardcoded palette/radii. Domain photography, map geometry, ledger record shapes and root navigation geometry remain feature-owned.

Retired with zero Kotlin callers: V1Panel, V1Action, V1SecondaryAction, V1PageTitle, V1Metric, V1Pending and TroOiPrimaryButton. The profile InformationRow forwarding helper is removed with its exact action descriptions/tags inlined. `V1Components.kt` now contains only `V1PreviewNotice`, a purposeful Debug-preview disclaimer consumed under existing demo guards. V1ContractGateway, V1RentalGateway, V1PaymentGateway, V1TrustGateway and V1RequestException remain versioned API adapters, not generic UI legacy. Existing V1 feature names are not blindly renamed.

Intentional local compositions: profile menu icon/divider and shortcut cards, notification read/source records, listing photo/taxonomy cards, ledger state/history/money/media, context monograms, grouped rental/report/furnishing choices, filtered wizard/onboarding/auth/security fields and reauthentication content. These use shared atoms and retain domain policies. GoogleAuthButton preserves branded Google styling. StreetMapPicker's TextButton is provider attribution. AssetWizard's OutlinedCard is the selected asset-type control; it is not a generic panel.

## Fixture and runtime ownership

The only immutable Mock scenario source is `app/src/debug/assets/fixtures/v1/`, with seven files: manifest, accounts, references, rentals, operations, finance and conversations. [Catalog/schema and scenario guide](android-fixture-catalog.md) documents strict typed validation, IDs/relationships/order, symbolic resources and parity. Validated runtime architecture viewer maps source sets and repository consumers.

DemoData, DemoRentalGraph, ListingFixtures, profile Mock adapters and FixtureTroOiRepository consume that catalog; they do not author competing seed objects. Debug security test hooks and local mutable portfolio/message previews remain separate. Finance seed is HISTORICAL_DEMO, not an issued receipt or confirmation. USER capabilities derive from canonical relationships, not global tenant/landlord roles.

Debug retains Mock ↔ Backend runtime switching without fallback from Backend errors. Release binds Backend only and packages no catalog/mock credentials. Preserve Edit → Reauthentication → Form → Submit. Missing Backend proof remains fail-closed; source migration never supplies OTP/PIN/eKYC/payment/persistence proof.

## Guardrails and verification checklist

Run `python app/scripts/verify_frontend_architecture.py`. Its assert-based self-check exercises retired names, raw generic Material calls, duplicate brand exceptions, Debug dependencies/literals, theme bypass and relationship-ID extraction. The existing frontend CI architecture step invokes it.

The guard is deliberately bounded: Kotlin retired names; raw Material button/card/field/scaffold/dialog call sites outside three shared owners; exactly bounded brand/attribution/asset-choice exceptions; generic components bypassing theme color/radius tokens (domain RoomLedgerComponents excluded); known catalog entity/account literals and Debug catalog dependencies in main/release; catalog manifests outside Debug. This textual guard is not a Kotlin parser or exhaustive arbitrary-data detector. Domain media geometry, UI taxonomy, arbitrary new literal values and business meaning still require review. Do not add broad color/number lint that flags legitimate domain presentation.

For a change:

1. Identify every caller/test/fixture and preserve validation, busy/Back/focus, tags and callback arguments. Add no speculative abstraction.
2. Reuse the shared atom; keep legitimate domain composition and document any new exception with a real caller.
3. Run the architecture guard, Debug/Release build, Debug units, AndroidTest compile and APK asset/DEX isolation verifier. Typed schema/referential/parity tests must use runtime JSON.
4. Exercise affected actual MainActivity windows and native feature states in Light/Dark at standard and 320dp/font1.3; check long copy, IME/system insets, first Back, dismissal, focus, empty/error/loading and accessibility semantics. Compare valid before/after captures.
5. Keep failed logs as provenance; distinguish direct test-host projections from live authorized server responses. Review correctness/security and UI/architecture independently. Report actual limits; do not label unrun hardware/TalkBack or live financial success PASS.

## Migration changelog

- Round 4: completed versioned domain JSON; strict parser/integrity/parity and real Debug/Release isolation; retained security hooks and mutable preview boundaries.
- Round 5: migrated Profile/Settings/Legal/Auth, Notifications/Messages, Discovery/Listing, Tenant/My Rental, Owner/Operator/Ledger, then Wizard/Dialog/nested/root. Each had an independent gate. Fixed compact search/price wrapping, selected-row semantics and inherited double-IME blank wizard body while retaining callbacks/proofs.
- Round 6: removed caller-zero generic compatibility wrappers and account forwarding helper, migrated primitive test callers, added bounded architecture guard/CI invocation and current docs ownership/checklist. Gate PASS: 192 units, 7 native, 76 Main assertions/24 image pairs, APK isolation and independent reviews. Obsolete CI variants and grep error masking corrected.
- Round 7: final gate PASS (2026-10-12): Debug/Release/AndroidTest build and lint,192 units,27 native,513 Main assertions plus76 auth/32 remaining rerun assertions, actual APK isolation, accepted visual matrix and two independent final reviews. Current-state completion audit and classified environment limits are in the Round7 report. No commit/push/merge or backend/database/API change is part of this refactor.
