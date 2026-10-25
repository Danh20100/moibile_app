# TrọƠi — Release alignment (2026-10-25)

## Decisions and implementation scope

This change follows checkpoint commit `c65a8d3`. Subsequent verified changes are integrated into `main`; never force-push.

- **Pricing:** One additional management slot costs **259,000 VND for one year**. `SlotCheckoutService` and database constraints are authoritative. No 249,000 VND / 3-month offer.
- **Capacity:** A primary owner can manage 1 room without an entitlement. Each `PROVIDER_VERIFIED` and unexpired PostgreSQL entitlement grants one additional active room. A transaction-scoped owner lock covers all their Organizations, preventing concurrent creates from evading the slot limit. This check runs on server-side Room creation, not only the Android UI.
- **Payment:** Entry to buy a slot stays visible, routes to the existing backend SePay checkout, and displays honest errors when unavailable. **Never synthesize a payment or entitlement.** Real provider settlement is required to unlock a slot. DemoPay remains a distinct simulated-payment provider, restricted to its isolated sandbox/non-production configuration; it must never be relabeled as a real bank transfer.
- **Email registration and OTP:** Deferred. Existing Duy Anh branch `backend/registerOTP` is not merged; its migration numbers overlap the current KYC migration, and must be reconciled before integration. **Password login is independent:** `POST /identity-access/auth/password` accepts existing, email-verified Argon2id credentials from `password_credentials`; it never accepts a local-demo password or provisions new credentials. Android keeps the email/password login form, but does not pretend pending registration/password reset OTP already works.
- **KYC:** Keep the current MVP of selfie-to-document-face similarity, without claiming authenticity verification of the identity document.
- **Favorites:** Backlog. No mock Favorites records or fabricated persistence.
- **Guest Activity:** Remove this redundant static page and routes. Public Discovery, guest map, and unauthenticated listing reads must stay available.
- **Discovery:** On backend-backed builds, public listings come from `GET /api/v1/listings/public` and PostgreSQL, not fixture fallback.
- **Legacy Subscription module:** Remove the unused in-memory/free-10-room module and its obsolete tests; retain the live owner-slot checkout and entitlement storage.
- **Android:** Debug and Release should default to the real backend. Retain Debug fixtures only in explicit instrumentation/isolated tests; preserve Debug build variant, OAuth signing and CI testing.

## Important verification boundaries

The local Compose backend has not been switched to another payment environment in this change. Its SePay provider requires valid production merchant configuration; DemoPay is intentionally unavailable under `NODE_ENV=production`. “Always available” means the app's payment entry point remains accessible, **not** that an unavailable payment provider can truthfully confirm funds. A permanently functioning production payment path requires configuring and testing a real provider.

Source rejects local-demo login/session issuance in `NODE_ENV=production`, and refuses to reinterpret an existing local-demo token as a Google identity. On 2026-10-25, local Compose backend was safely rebuilt and restarted without recreating PostgreSQL; password-login requests with invalid credentials return HTTP 401. At verification time PostgreSQL had **zero** `password_credentials` rows, so no preexisting account can authenticate by password until a legitimate, verified password credential exists. Google sign-in remains separate. Password registration/change/reset OTP is still deferred, and future merge of Duy Anh's branch must reconcile the existing `/auth/password` endpoint and DTO instead of duplicating them.

The locally configured `local_demo` identity and other demonstration records are not production-verified identities. Do not replace or erase user records as part of UI/slot cleanup. PostgreSQL schema/data remains unchanged by this source-only implementation.

## Required final verification

1. Backend typecheck and slot policy tests.
2. Android Compose build and owner-ledger navigation tests.
3. API authorization, checkout and idempotency regression.
4. E2E over a separate test database for racing owner room creation, payment callback settlement, and entitlement expiry before production deployment.
5. Confirm runtime gateway configuration without printing secrets.

The favorites feature and Email OTP are explicitly deferred.
