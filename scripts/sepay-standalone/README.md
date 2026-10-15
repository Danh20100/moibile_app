# Standalone SePay lane (TrọƠi)

**Purpose:** isolate Android Checkout work from the integration agent. This lane is not a claim of a live provider payment.

- Backend: `http://127.0.0.1:3100/api/v1` (local-only bind)
- DB: local Docker PostgreSQL/PostGIS on `127.0.0.1:55459`, dedicated volume, database `trooi_sepay_isolated`
- Object storage: disabled for this focused payment smoke (not full rental E2E).
- SePay: OFF until valid production configuration, dedicated finance DB, Identity cutover approval and an explicitly authorized tiny live transaction.
- User's public ngrok hostname: `https://everly-zincic-corbin.ngrok-free.dev`, currently forwarded to port 3000. Must redirect it to **3100** before testing payment on this isolated Backend.

## Setup from this worktree root (PowerShell)

```powershell
pnpm install --frozen-lockfile
docker compose --env-file .env.sepay-standalone -f scripts/sepay-standalone/compose.yml up -d --wait
node --env-file=.env.sepay-standalone --import tsx scripts/database/migrate.ts up
pnpm build
# Start in the foreground:
node --env-file=.env.sepay-standalone build/main.js
# In a separate console:
curl.exe -i http://127.0.0.1:3100/api/v1/health
```

The ignored `.env.sepay-standalone` contains local-only DB credentials. Do not paste secrets, use `db:reset`, or remove Docker volumes. Do not point `DATABASE_URL` at another agent's DB. SePay Checkout must not return verified success based only on browser redirects or test data.

## Required manual gates before live money

1. Obtain actual merchant credentials, three separate signing/IPN secrets, a reviewed public HTTPS origin and an authorized finance database. Never commit keys.
2. Check that the Android client has a genuine approved live session and active Tenancy with matching permissions. The Identity cutover flag stays OFF until separately approved.
3. Reroute ngrok from port 3000 to **3100** without changing the fixed domain; verify public IPN rejects missing/wrong secret by HTTP status (not just an embedded JSON statusCode).
4. Rebuild Android using `-PtrooiApiBaseUrl=http://10.0.2.2:3100/api/v1` and `-PtrooiPaymentPublicOrigin=https://everly-zincic-corbin.ngrok-free.dev`.
5. Only after explicit user approval, make ONE small live transfer and verify provider REST order, checkout/payment IDs, exact amount, `GATEWAY`/`PROVIDER_VERIFIED`, duplicate-IPN idempotency.
6. Cherry-pick reviewed changes only after isolated smoke evidence. Do not switch/modify the main agent's worktree.

Android-only unblock commit: `b7cf988`, previously tested 11/11 and debug APK build PASS. It is not full-stack SePay acceptance.

## Integration payment smoke (local only; NOT a production deployment)

As of the integration branch merge `a122969`, the backend and Android change passed typecheck, build, eight SePay tests, and Android CheckoutIdentityTest. The following temporary demonstration runtime runs **integrated source code** with the separate finance fixture database `trooi_sepay_isolated`. It does not migrate or replace the integration agent's `trooi_dev` database or port 3000.

- Private demonstration API: `127.0.0.1:3101`. Only Android emulator/local testing may access `/api/v1/demo/login`; do not make this API publicly available.
- Route-restricted public proxy: `127.0.0.1:3102`. Only SePay IPN, signed handoff, and three return URLs are allowed. Do not tunnel port 3101, 3001, or 3000 for this fixture.
- Tunnel: `ngrok http 3102` with fixed public hostname `https://everly-zincic-corbin.ngrok-free.dev`. Stop old ngrok forwarding 3100 in its original terminal first; verify the new target using local ngrok API.
- IPN Dashboard remains OFF until the tunnel is verified, existing exposed keys have been rotated, and a small authorized provider test is ready.
- Android Debug APK: build from integration worktree with `-PtrooiDemoBackendEnabled=true -PtrooiApiBaseUrl=http://10.0.2.2:3101/api/v1 -PtrooiPaymentPublicOrigin=https://everly-zincic-corbin.ngrok-free.dev`. Release builds never allow the demo login.

PowerShell launch from integration root (the standalone env is **gitignored** and remains only in the SePay isolated worktree):

```powershell
$env:TROOI_DEMO_MVP_ENABLED = "true"
$env:TROOI_SEPAY_PAYMENT_FIXTURE = "true"
$env:TROOI_DEMO_MVP_PORT = "3101"
node --env-file="D:\Projects\.worktrees\TroOi-Project\sepay-checkout-mvp\.env.sepay-standalone" scripts/demo/serve-mvp.cjs
```

In a second terminal: `node scripts/sepay-standalone/public-sepay-proxy.cjs`.
From another local terminal: `node scripts/sepay-standalone/verify-test-checkout.cjs` (read-only); `node --test scripts/sepay-standalone/public-sepay-proxy.test.cjs`.
`create-test-checkout.cjs` creates exactly one **1,000 VND** `SEPAY` checkout intent on localhost, stores its signed pay URL in the user's local temporary directory, and does **not** transfer money. It requires `TROOI_SEPAY_PAYMENT_FIXTURE=true` and `SEPAY_ENABLED=true`; avoid repeatedly creating orders.

The intended account is `tenant@trooi.local` with the isolated development runner password (default `TroOiDemo2026!`); this login is **not** Google authentication. The signed handoff token expires after 30 minutes. If expired, refresh the checkout safely rather than claiming the original URL still works.

**Money gate:** Before authorizing a transfer, inspect SePay-hosted bank account name, destination, invoice/reference, and amount; require the user's explicit confirmation. A checkout `CREATED`, browser return, or screenshot alone cannot create `PROVIDER_VERIFIED`. Verify provider REST settlement, valid IPN, exact amount, correct tenancy, one Payment, and deduplication. Never copy .env secrets to source control.

## Verified 2,000 VND bank-transfer acceptance (2026-10-15)

- User confirmed the bank debit and the linked beneficiary bank credit.
- Checkout `4a732deb-5183-426f-a125-373af0ad6158`, `SEPAY`, `2000.00`.
- Production SePay authenticated REST list returned one invoice-matched order with status `CAPTURED`; its detail API returned `HTTP 404`. This is a provider-detail availability issue, not evidence that payment failed.
- Real SePay `ORDER_PAID` callbacks reached the ngrok IPN endpoint with matching `X-Secret-Key`, `BANK_TRANSFER` / `APPROVED`, invoice, remote-order ID and exact amount. The earlier runtime returned 503 because it required the unavailable detail endpoint.
- Fix: when and only when SePay REST detail returns HTTP 404, authenticate the IPN secret and cross-check its bank-transfer transaction against the *single* captured order returned by authenticated REST. HTTP 401/403/429, timeouts, ambiguous lists, wrong amounts, card payments and invalid IPNs remain fail-closed.
- A previously captured real provider callback was replayed locally after the fix (no new transfer). The IPN endpoint returned HTTP 200; the checkout became `SUCCEEDED`; PostgreSQL recorded Payment `00791baa-cf9a-4d17-ae10-678738bd13da` with source `GATEWAY` and verification `PROVIDER_VERIFIED`. Replaying the exact same authenticated callback again returned 200 and left **exactly one** 2,000 VND provider-verified Payment.
- Validation: existing SePay suite + fallback/negative-case tests, Backend typecheck/build/lint. This is acceptance of the isolated finance test runtime; it does not attest production release deployment or all app features.
