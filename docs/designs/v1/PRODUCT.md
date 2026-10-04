# TrọƠi product context
<!-- impeccable:product-schema 1 -->

## Platform
android

## Users
Guest seeks a long-term room. Tenant manages a current or former linked Tenancy. Landlord operates rooms through an Organization context. These are relationship-derived POVs, never global USER roles.

## Product Purpose
A living operational record for every rented room, connecting Find → Contact → Rent → Operate → Pay → Repair → Leave → Review → Find again.

## Capabilities and Constraints
Canonical v3.7 owns domain truth. OpenAPI owns exposed transport. Room differs from Listing; Inquiry does not reserve. Checkout alone ends an ENDING Tenancy and returns Room to VACANT. Charge, Payment, Claim, Deposit and Receipt remain separate. History, Dashboard and Notification are projections. Public location excludes exact operational address. OPEN policies remain unresolved; FUTURE capabilities stay outside current navigation.

Approved V1 scope (2026-10-05): optional MoMo checkout, session reacquisition after process restart, native public map/picker and authenticated safe Listing-only Trust submission are current V1 requirements. MoMo is not an MVP dependency: manual finance and discovery remain usable without provider configuration. General provider/platform expansion remains FUTURE. Billing/Charge, Payment, Payment Claim, Deposit, Receipt and GatewayCheckout are distinct. Only a fully verified payment-success IPN creates GATEWAY / PROVIDER_VERIFIED Payment; signed create-response handoff or redirect never confirms money, allocates charges, funds Deposit or issues Receipt.

Google ID tokens stay in memory. Reacquire credential → verify /me → recover non-secret backend-user-scoped context hints → validate capabilities → route. Maps use public projections only, never an exact operational-pin fallback or raw-coordinate UX; textual geocoder/type/availability remain OPEN. Trust reporter identity is server-derived; Review submission, report listing/moderation, Claim and Inquiry Activity remain explicitly gated by contract/policy. Notice and acknowledgement belong to a Tenancy, not a Property broadcast. These are acceptance requirements, not delivery claims; runtime evidence and DoD remain independent.

## Brand Commitments
Warm, residential, Vietnamese, trustworthy, operational and calm. Room Ledger is the signature conceptual surface. The user explicitly requested a complete replacement visual world with Android usability and domain truth above decorative style.

## Evidence on Hand
Sources: ../../contexts/, ../../database/v1/canonical.md, ../../database/v1/erd/, ../../api/openapi.json, ../../backlogs/v1/, app-pov-checklist.md. Existing Android Compose is implementation evidence only. The HTML artifact contains illustrative records, not live backend data. No verified property-photo collection was found in the repository.

## Accessibility & Inclusion
Vietnamese copy, readable scalable type, 48dp interaction targets, labeled states, visible keyboard focus in the artifact, light/dark contrast, reduced motion and system Back/inset expectations.
