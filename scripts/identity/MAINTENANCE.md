# TrọƠi — Identity maintenance (production-safe boundaries)

`maintain-verified-account.cjs` is an explicit administrative utility for the local PostgreSQL instance named `tro-oi`. It refuses remote databases and does **not** manufacture a verified identity.

## Usage (PowerShell, from repository root)

```powershell
cd D:\Projects\TroOi-Project
node --env-file=.env scripts/identity/maintain-verified-account.cjs audit --email=user@example.com
node --env-file=.env scripts/identity/maintain-verified-account.cjs provision --email=user@example.com
node --env-file=.env scripts/identity/maintain-verified-account.cjs provision --email=user@example.com --apply
node --env-file=.env scripts/identity/maintain-verified-account.cjs retire-local --email=user@example.com
```

- `audit`: read-only verification and legacy-reference counts.
- `provision`: dry-run unless `--apply`; only adds Argon2id password credential to an **existing** verified `user_emails` identity. The `google` source also requires an existing bound Google principal. Never overwrites existing credentials or attaches a password to a user still marked local-demo.
- `retire-local`: dry-run unless `--apply`; removes only the local-demo marker for a fully detached user. It refuses removal when an Organization, auth session, security event or other FK-linked data still references that user.
- All password prompts are interactive and hidden. Never pass a password in CLI arguments, environment variables, log lines or Git files.

## Current blocker (audit dated 2026-10-25)

`trtien520@gmail.com` currently exists in `local_dev_accounts`, but not in `user_emails`. Its demo User still owns one Organization and has two auth sessions and eighteen identity security events. **Neither provisioning nor deletion can be applied safely at this point.**

Do not delete `local_dev_accounts` or its marker before updating `GooglePrincipalResolver` and reconciling historical sessions. Removing the marker by itself could cause an old local-demo session to lose its classification boundary. Do not delete the legacy User, Organization, historical audit records, or attempt to fabricate `verification_source` / `verified_at` values.

## Safe cutover

1. Prove mailbox ownership using the real Google login or a working email-OTP flow; let that provider bind the identity.
2. Decide whether to transfer the legacy Organization to that verified User or retire the old Organization after reviewing all linked business data. **This utility intentionally does not perform ownership transfers.**
3. Provision a password only for the verified User, then test backend `POST /api/v1/identity-access/auth/password` and Android Release login.
4. Reconcile old sessions and historical trust records in a separately reviewed schema/code migration; only then retire the local-demo subsystem and remove the marker.

This tool cannot transform a simulated identity into a verified one by inserting rows directly.
