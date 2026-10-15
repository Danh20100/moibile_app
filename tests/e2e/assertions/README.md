# E2E assertion layers

Each executable flow should assert as many of these layers as are relevant:

1. **UI** - the Android user sees the authoritative result.
2. **HTTP** - the expected endpoint/status/contract is observed.
3. **Database** - a write created or changed the expected source fact.
4. **Invariant** - forbidden side effects and cross-resource leaks did not occur.

Examples:

- Discovery: UI listing visible + GET public listings 200 + only PUBLISHED rows exposed.
- Inquiry: success UI + POST 201 + Inquiry row exists + no Tenancy/Room state mutation.
- Activation: UI active + command success + Tenancy ACTIVE + Room OCCUPIED + Listing not public.

Do not treat Snackbar text or a 2xx status alone as proof that a business flow is correct.
