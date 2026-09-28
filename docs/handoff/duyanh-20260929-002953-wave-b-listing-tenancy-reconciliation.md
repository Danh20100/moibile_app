# HANDOFF — Wave B Listing + Tenancy Reconciliation

**Recipient:** `duyanh`
**Created:** `2026-09-29 00:29:53 +07:00`
**Repository:** `onsra520/TroOi-Project`
**Branch:** `backend/core-foundations`
**Runtime evidence SHA:** `7110f622fe1b678d2b10d1f0a75571d260c572fb`
**Status:** `WAVE_B_FROZEN`

## Delivered

- B5 adds `rental-lifecycle` as the sole cross-domain command boundary for Listing creation/publish, manual Room operational transitions, Tenancy creation/activation, and checkout.
- Published Listings are synchronously unpublished before a Room leaves VACANT or becomes OCCUPIED; checkout does not republish them.
- Cross-domain deterministic preconditions are validated before mutations. In-memory behavior does not claim transactional/concurrent persistence guarantees.
- The public `PATCH /rooms/:id/operational-state` route moved out of `RoomController`; the lifecycle controller owns it.
- `ListingService.archiveAllForRoom` archives only legal DRAFT/UNPUBLISHED Listings and rejects a PUBLISHED shortcut.

## Evidence

- Focused Wave B + predecessor/conformance + DTO gate: PASS, 146/146.
- Typecheck: PASS. Database validators: PASS, 45/45. Google identity verifier: PASS, 9/9.
- Full ERD3 conformance: 41/57 pass; 16 expected RED only in Wave C Finance (10) and Wave D Incident/Trust (6).
- Full repository test: 217/233 pass; the same 16 expected later-wave RED only.

See `docs/audits/2026-09-28-wave-b-completion.md` for exact commands, names, and classifications.

## Rulings

- Five B3/B4 Tenancy conformance assertions removed in uncommitted work were restored because earlier runtime evidence had them GREEN; removing frozen-contract coverage was not valid B5 progress.
- Final review fixes prevent a public DRAFT-to-ACTIVE resume bypass and reject Listing creation requests without a public location projection.
- No OPEN policy was selected. No PostgreSQL, Redis, Finance, Incident, or Trust scope was pulled into Wave B.

## Next boundary

Wave C Finance may now consume the reconciled Tenancy/Terms/occupancy contracts. Database application wiring remains deferred until all required backend reconciliation waves are complete.
