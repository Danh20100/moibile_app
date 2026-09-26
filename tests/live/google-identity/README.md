# Google Identity Live Test

This directory contains manual tests against the real Google Identity service.

These tests are intentionally excluded from the normal `pnpm test` suite because they require:

- a real Google OAuth client
- network access
- a short-lived Google ID token

## Required configuration

The application `.env` file provides:

```dotenv
GOOGLE_CLIENT_ID=
```

The ID token is temporary test input and should be supplied through the current shell:

```powershell
$env:GOOGLE_ID_TOKEN="<real-google-id-token>"
```

Do not commit real Google ID tokens or OAuth client secrets.

## Run

```powershell
pnpm test:google:live
```
