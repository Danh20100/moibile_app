# listing

> Authority: Canonical v3.7 / frozen Database v1 override this module and current code.

## Purpose

Listing is the public discovery projection of a Room. It is not the operational Room record and must not duplicate Property ownership as a second source of truth.

## Current Database v1 lifecycle

`DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED`

## Invariants

- publishing requires a `VACANT`, active Room under an active Property;
- a Room has at most one current/non-archived Listing;
- when Room leaves `VACANT`, the current Listing is synchronously unpublished;
- Room archive archives related Listings;
- status transitions append first-class ListingStatusEvent history;
- Property is derived through Room ownership rather than duplicated as independent Listing ownership.

## Known pre-database-v1 code drift

Current code uses `hidden` / `rented`, stores `propertyId` beside `roomId`, checks only record existence during publish, and has no ListingStatusEvent or synchronous vacancy-unpublish workflow.