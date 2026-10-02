# E2E journeys

Journeys chain atomic flow IDs from `../flows/` into realistic user stories.
A journey must not invent a shortcut around authentication, authorization, or domain state.

Current chains:

- `J01`: first Google auth -> logout -> returning login -> discovery -> listing -> inquiry.
- `J02`: operator setup -> Property/Room -> Listing -> public discovery.
- `J03`: Inquiry/context -> Tenancy -> Participant -> Terms -> activation.
- `J04`: active rental -> Billing/Payment/Receipt -> Incident/Notice operations.
- `J05`: move-out -> checkout -> deposit closeout -> former-tenant history/review eligibility.

Journeys may remain `spec_only` until all atomic flows expose executable Android surfaces.
