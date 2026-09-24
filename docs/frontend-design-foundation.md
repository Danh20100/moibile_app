# Frontend Design Foundation — TrọƠi

This document records the first Android UI foundation implemented on the frontend/app-foundations branch.

## Visual direction

The Android frontend reuses the established TrọƠi visual identity from the landing page without copying HTML/CSS:

- background: #EEF3E9
- primary ink: #243C2C
- lime highlight: #D4F884
- olive accent: #74963E
- muted text: #61715D
- generous rounded cards and controls
- low-elevation surfaces with subtle borders
- Vietnamese-first content hierarchy

The landing page uses Be Vietnam Pro. The Android project intentionally does not bundle a font file yet; the final font resource must be supplied through an approved design asset/source.

## Implemented review surfaces

The debug build contains a review-only switcher for:

1. Login
2. Tenant home
3. Landlord dashboard

The switcher exists only to review the design foundation and must not be used as authorization or role selection.

Release builds enter the authentication surface.

## Architecture boundary

This design phase does not invent backend endpoints, DTOs, tokens, roles, or business responses.

Business API integration remains blocked until a concrete OpenAPI contract is available.

No fake repository is introduced as the production data source.

## Next UI increments

After the foundation is approved, continue with:

- tenant discovery/search
- room list and room detail
- saved rooms
- booking and schedule
- messages/chat
- tenant profile
- landlord rooms
- maintenance
- finance
- subscription
- landlord profile

Each production screen must expose Loading, Success, Empty, Error and Retry states where applicable.
