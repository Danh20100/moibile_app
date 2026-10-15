# TrọƠi Android — Discovery/Owner UI deferred backlog

Scope: `temp/discovery-ui-redesign-20261014`. This document records deferred work only; it does not authorize implementation.

## Deferred (not implemented)

### UI-04 — Amenity multi-select in the owner asset wizard
- Add an explicit multi-select amenity picker for creating/editing a `LocalRentalAsset` ("Phòng trọ" / "Căn hộ"), likely near photos and description in `AssetWizard.kt`.
- Retain an empty selection for drafts; do not make amenities mandatory for draft saving.
- Ensure edit mode preselects persisted amenities and removal updates only the user's own draft.
- Validate what is actually serialized and persisted before shipping. Do not imply publishing has succeeded if the backend has not accepted the change.

### UI-05 — Shared catalog and identity between owner and Discovery
- Define stable amenity IDs, Vietnamese labels and presentation icons, with a compatibility strategy for existing legacy string values and backend projections.
- Keep `LocalRentalAsset.amenities` / published `PublicListingCard.amenities` as user-/backend-supplied information. Display must not infer that a property has amenities that were never declared.
- Review room-specific semantics (e.g. private/shared facilities) separately from decorative icons.
- Until this is implemented, the detail screen uses **presentation-only label-to-icon mapping**; it does not define the canonical amenity catalog.

### UI-06 — Re-review owner account -> onboarding -> asset management
- Revisit `ProfileScreen` / `LandlordOnboardingScreen`, operator access, the ledger asset wizard, editing, publishing and post-publication Discovery detail.
- Review screenshots and navigation for both user profiles (tenant-only and authorized operator); honor backend permissions and trust/privacy boundaries.
- Treat onboarding and KYC as distinct from the owner asset creation form; do not bypass verification gates for UI convenience.

## Boundaries
- UI-01 through UI-03 are scoped to public listing **detail presentation** (icons, section cards, label–value costs).
- No changes to owner wizard, account profile/onboarding, database schema, operational records or public-amenity semantics are in scope.
- The existing unrelated database JSON line-ending noise must not be staged with this work.
