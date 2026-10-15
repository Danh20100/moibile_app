# DemoPay Test Console

Test-only browser console for the TrọƠi DEMO payment flow.

## Location

`tests/demo-payment-web`

This is intentionally outside production frontend code. It is a local verification surface for backend payment work.

## What it does

1. Creates a checkout through `POST /api/v1/finance/checkouts` with `provider=DEMO`.
2. Displays checkout amount, reference, ID and status.
3. Opens the backend-provided `payUrl` in a separate browser tab.
4. Lets the tester refresh `GET /api/v1/finance/checkouts/:id` after the browser confirmation flow.

The console does **not** mark a checkout paid by itself. Settlement must still come from the DEMO provider verification path.

## Run

From the repository root:

```powershell
node tests/demo-payment-web/server.mjs
```

Then open:

```text
http://127.0.0.1:4177
```

Default backend target:

```text
http://127.0.0.1:3000
```

Override it only with another loopback target:

```powershell
$env:DEMO_TEST_BACKEND_URL = "http://127.0.0.1:3001"
node tests/demo-payment-web/server.mjs
```

Optional test-console port:

```powershell
$env:DEMO_TEST_PORT = "4178"
node tests/demo-payment-web/server.mjs
```

## Required backend conditions

The backend still owns all security and settlement semantics.

For checkout creation, the tester needs:
- an authenticated bearer token,
- an accessible tenancy ID,
- DEMO payment config enabled,
- a valid `DEMO_PAYMENT_PUBLIC_BASE_URL`,
- a valid DEMO signing key.

The full click-through experience also requires the D2 DemoPay browser routes to exist:

```text
GET  /api/v1/finance/checkouts/demo/pay/:token
POST /api/v1/finance/checkouts/demo/pay/:token/success
```

Until those routes exist, checkout creation can return a signed `payUrl`, but opening that URL will not complete the browser confirmation flow.

## Security properties of this test console

- binds to `127.0.0.1` by default,
- backend proxy is restricted to loopback hosts,
- bearer token is kept only in the current browser page memory,
- no `localStorage` or `sessionStorage`,
- no credential logging,
- signed capability is redacted from the JSON display,
- no external scripts, fonts, analytics or images,
- static responses use no-store, no-referrer, nosniff and restrictive CSP headers.

## Payment semantics

A CREATED checkout is **not** a Payment.

A successful DEMO confirmation may create exactly one verified gateway Payment through the shared settlement service. This console must not imply that a Charge is settled unless allocations actually settle it, and it does not create Receipt, PaymentAllocation or DepositPaymentApplication records.
