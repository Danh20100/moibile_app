# TrọƠi Design Versions

`docs/designs/` stores versioned UX/UI design authorities for the Android app.

## Current implementation target

- Design version: **V1**
- Path: `docs/designs/v1/`
- Status: **CURRENT / ACTIVE**
- Meaning: this is the design authority for the app being implemented and completed now.

The V1 folder contains the product/design context, design system, interactive screen atlas, implementation checklist, and generated Impeccable design metadata for the current app.

## Versioning rule

Design versions and product-scope classifications are separate axes:

- `designs/v1`, `designs/v2`, `designs/v3`, ... = successive UX/UI iterations of the app.
- `V1`, `OPEN`, `FUTURE` inside a design artifact = capability/product-scope classification.

Therefore, a screen marked `FUTURE` inside `designs/v1` does **not** mean it belongs to design V2. It only means that capability is outside the current executable product scope.

## Next versions

Do not create `docs/designs/v2/` until the next design iteration actually starts. When V2 begins, create it as a new versioned authority derived from V1 instead of mutating the historical V1 snapshot in place.

## V1 contents

- `v1/PRODUCT.md` — product/design context and constraints.
- `v1/DESIGN.md` — current visual system and screen inventory authority.
- `v1/app-pov-checklist.md` — V1 product-app completion checklist.
- `v1/TroOi_Product_Universe_Interactive.html` — interactive design atlas/review artifact.
- `v1/.impeccable/design.json` — generated design-system metadata for V1.
