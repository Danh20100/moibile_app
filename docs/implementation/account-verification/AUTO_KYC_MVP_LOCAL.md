# TrọƠi — Local MVP automatic CCCD / selfie comparison

Implementation date: 2026-10-24. **Not government ID authentication, anti-spoofing or production eKYC certification.**

## Delivered

- Android account → personal information → identity verification: 3 bounded JPG inputs (CCCD front/back + selfie), explicit unchecked consent, optional camera preview selfie, asynchronous result and current-status read.
- NestJS authenticated endpoints `GET /api/v1/identity-verification/me`, `POST /api/v1/identity-verification/auto-check`; userId **only** from authenticated principal, not submitted by the client. No staff/review API.
- Server checks 3 JPEG envelopes, 1.5 MB/image, 6.4 MB JSON request cap, daily 5-attempt rate limit per user, explicit `kyc-auto-v1` consent.
- Existing CompreFace adapter compares front-card portrait and selfie. Normal threshold is 0.90. For the **private Compose MVP only**, optional `TROOI_LOCAL_KYC_FACE_THRESHOLD=0.38` changes the similarity-only result threshold to 0.38; successful attempts have reason code `FACE_SIMILARITY_MATCHED_LOCAL_MVP`. External/finance backends cannot use that override. Unavailable/malformed upstream still → 503 with **no auto approval**. A relaxed result is **not** document authenticity, liveness, a Vietnamese government identity verification, or production-grade KYC.
- PostgreSQL `000018_identity_auto_checks` adds minimal, user-scoped receipts without image bytes, ID number, full name, face embeddings or publicly accessible media.
- Private local CompreFace lab (its own database) was started, lab image persistence switched to `save_images_to_db=false`, connected over the isolated Docker network and tested with **public fixture**. The lab is optional; default settings still disallow cleartext to arbitrary hosts.
- Kept OAuth Android ID `com.trooi.app` and existing debug signing key; unrelated finance/Sổ untouched.

## Applied live on developer PC

- Verified pg_dump backup `D:\Projects\TroOi-Backups\database\tro-oi-before-auto-kyc-20261024-2026.dump`.
- Ran additive migration `000018_identity_auto_checks` on the **existing** `tro-oi` database, with existing accounts and sessions preserved; **no reset, no seed and no rollback**.
- `trooi-project-backend-1` and `trooi-project-postgres-1` healthy; unauthenticated new KYC endpoints return 401.
- NestJS adapter → CompreFace lab one-to-one public fixture: faceCount=1, matches=1, similarity=1.0; repeated **after** disabling lab image retention and passed.
- Android Debug APK builds and installs using existing package/SHA-1 and loopback backend at `127.0.0.1:3101`.
- No genuine CCCD or selfie was uploaded, and no verification result was forged for an actual user.

## Default Compose after integration (2026-10-25)

The separate `trooi-verify-lab` stack is retired. All five CompreFace services are in the primary `docker-compose.yml`. The default command is:

```powershell
cd D:\Projects\TroOi-Project
docker compose up -d
docker compose ps -a
```

The backend reaches `http://compreface-fe` through the same private Compose network. No manual network connect or extra startup script is required. The former `connect-local-kyc-lab.ps1` delegates to the root Compose for compatibility. The migrated local CompreFace database keeps the existing Verification Service API key in its separate volume. See [single Compose runtime](../../configuration/single-compose-runtime.md) for the backup, migration, privacy and fresh-install key provisioning details.
## Security limitations and next acceptance

- **AUTO_CHECK_PASSED ≠ VERIFIED identity**. The back CCCD image is received and size-checked but the document authenticity, MRZ/QR signature, identity number and liveness are NOT validated. A user may select a pre-existing selfie photo; no proof of live capture. The app explicitly labels this as face similarity only.
- Require a proper document authenticity/liveness/anti-spoof gate before allowing this receipt to grant irreversible account trust or regulatory KYC status. The manual workflow's VERIFIED state remains untouched.
- Explicit image-processing notice is on the form; server and CompreFace process bytes transiently. Continue privacy/security assessment of logs, backups and CompreFace internals before external production.
- A two-image match using a public fixture is not an authenticated end-to-end proof with actual CCCD from a real user; this final user acceptance is still outstanding. Do not insert synthetic pass records in `tro-oi`.
- Threshold 0.90 is MVP heuristic and not a measured FAR/FRR compliance threshold.
