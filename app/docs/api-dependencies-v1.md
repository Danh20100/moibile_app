# Frontend backlog v1 reconciliation — API dependencies and release boundary

This tracks frontend projection dependencies only. Database Canonical/backlogs remain read-only authority; endpoint names, status mutation routes and JSON DTOs must come from Backend's published OpenAPI.

## Completed frontend boundaries
- USER.role is not an authority. Login has no role selector; session contains relationship-derived access for linked Tenancy IDs and operated Organization IDs. Client navigation checks capabilities; server remains the authorization source.
- Public discovery only renders Listing PUBLISHED records with public location. No exact operational address.
- Operator screens filter by owned Organization → Property → Room. Public Listing and private operational Listing use separate view models.
- Tenant Portal shows only linked Tenancy and explicitly scoped finance projections. Missing data is marked pending.
- Finance separates Charge, confirmed Payment, Allocation, Deposit and Receipt. No totals computed from Room asking rent or debt.
- Dashboard consumes only per-Organization read models. Incident renders server events and cannot mutate status locally.
- Web production entry is marketing-only; legacy product SPA files remain inactive for source migration.

## Backend contract dependencies — UNRESOLVED
1. Authentication/session response with operated Organization IDs and User-linked Tenancy IDs, refresh and revocation semantics.
2. Public Listing search/details/map projection with permitted public fields, published status, public location and optional filters.
3. Inquiry contact-intent command and acknowledgement scoped to published Listing; no booking or full chat contract.
4. Authorized Organization/Property/operational Room/operator Listing reads; lifecycle-specific commands and server action availability.
5. Authorized Tenant Portal per Tenancy (Terms/version acknowledgment, Deposit requirement vs actual, Billing, Payment Claim, Receipt, Incident, Notice, Move-out, History).
6. Organization-scoped dashboard and finance read models with traceable source data.
7. Incident detail, append-only event timeline and permissible state-specific commands; no generic status mutation.
8. Review eligibility and Trust Report projections; OPEN moderation/eligibility policy must not be decided by client.

Until these contracts are available, Release repository fails closed on login/signup/password-reset/inquiry. Debug fixtures are visibly labeled preview and do not pretend business commands succeeded.

## No workaround decisions
- Subscription, pricing, quota, booking/reservation and full realtime chat are outside CURRENT.
- No optimistic business writes, invented finance derivation, private location in discovery, invented lifecycle transition or OPEN policy.
- Android UI compilation alone is not production integration. After Backend lane is GREEN and merged to staging, Frontend must merge updated staging into this branch, adapt against OpenAPI and rerun all gates. No staging merge performed here.
