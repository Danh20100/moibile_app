# listing Architecture

> Canonical v3.7 / frozen Database v1 is authoritative.

## Ownership

Listing owns public discovery content and publish lifecycle only.

## Lifecycle

`DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED`

## Required guards

- publish only when the referenced Room is active and `VACANT` and its Property is active;
- at most one current/non-archived Listing per Room;
- Room leaving `VACANT` synchronously unpublishes the current Listing;
- Room archive archives related Listings;
- transition history is append-only through ListingStatusEvent.

## Data boundary

Listing references Room. Property ownership is derived through Room; do not store a second authoritative Property relationship merely for convenience.

## Rebuild note

The current `hidden` / `rented` FSM, duplicated `propertyId`, existence-only publish check and missing event history are pre-database-v1 contracts and are expected Database v1 conformance failures.