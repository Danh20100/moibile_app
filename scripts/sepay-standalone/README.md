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
