# TrọƠi — Full default Docker Compose runtime (2026-10-25)

From `D:\Projects\TroOi-Project`, the default command is:

```powershell
docker compose up -d
docker compose ps -a
```

**No second Compose project, custom launcher, Docker network attachment or `--profile local-infra` is necessary.** `docker compose up` (foreground) works too, but prints all logs to the terminal.

## Default services

The single root `docker-compose.yml` starts:

- `postgres`: canonical TrọƠi PostgreSQL/PostGIS data, original volume untouched.
- `backend`: API, local loopback host port set by `BACKEND_PORT`.
- `redis`: local cache, Redis data not persisted intentionally.
- `minio` and `minio-init`: local object storage and one-off bucket setup. A completed `minio-init` container **exits 0**, which is normal.
- `compreface-postgres-db`, `compreface-core`, `compreface-api`, `compreface-admin`, `compreface-fe`: isolated CompreFace 1.2.0, reachable by the backend at `http://compreface-fe` on the same `trooi-network`. Only the frontend binds to localhost (default port 18180); the API/Core/DB have no host ports.

Only explicit test/finance profiles remain optional: `messaging-test`, `sepay-isolated`, `finance-production`. **Starting the default stack does not enable SePay merchant funds flow, external HTTPS or release signing.**

## Private configuration

Set real values in ignored root `.env`:

```dotenv
MINIO_ROOT_USER=trooi_local
MINIO_ROOT_PASSWORD=<unique-private-secret>
TROOI_COMPREFACE_DB_PASSWORD=<unique-private-secret>
COMPREFACE_ENABLED=true
COMPREFACE_ORIGIN=http://compreface-fe
TROOI_LOCAL_COMPREFACE_LAB=false
COMPREFACE_API_KEY=<verification-service-api-key-from-compreface-admin>
```

`COMPREFACE_API_KEY` is **not** the CompreFace PostgreSQL password. On a brand-new CompreFace installation, configure a Verification Service and its key using the locally bound CompreFace web UI before setting `COMPREFACE_ENABLED=true`. Do not invent keys or place them in git or logs.

The CompreFace API has `SAVE_IMAGES_TO_DB=false` fixed in Compose; facial comparison is still a **similarity-only MVP**, not document authenticity validation or liveness certification.

```powershell
node --env-file=.env scripts/config/check-local.cjs
docker compose config --quiet
docker compose up -d
docker compose ps -a
```

## Existing developer machine: migration completed 2026-10-25

- Former lab: `trooi-verify-lab` under `D:\Projects\.temp\TroOi-Account-Verification-Lab`; its Compose containers were stopped without deleting the old database volume.
- Independent CompreFace backup: `D:\Projects\TroOi-Backups\compreface\compreface-before-single-compose-20261025.dump`; `pg_restore --list` verified.
- Old volume `trooi-verify-lab_postgres-data` preserved. Copied from a **stopped** old database into `trooi-project_compreface_postgres_data` for the new Compose stack. Do not run the old lab Compose again.
- App PostgreSQL `trooi-project_postgres_persistence_data` untouched. Existing accounts, Organizations, auth sessions and payment data not migrated or reset.
- Stale Docker network `trooi-verify-lab_default` detached and removed. Backend accesses CompreFace only via `trooi-project_trooi-network`.
- The backward-compatible `scripts/dev/connect-local-kyc-lab.ps1` now delegates to the single root Compose. It does not recreate the old lab.
- During this one-time manual volume import Compose may warn that the volume was not originally Compose-created; it still mounts it and preserves the data. Fresh installations create the volume automatically.

## Troubleshooting

```powershell
docker compose ps -a
docker compose logs --tail=100 compreface-core compreface-api compreface-fe backend
docker compose exec backend node -e "fetch('http://compreface-fe/').then(r=>console.log(r.status))"
```

A `200` on the CompreFace frontend checks connectivity, not successful face matching. A real authenticated end-to-end KYC attempt still requires consent and suitable input images. Never bypass the backend's 503/error response or insert a synthetic `AUTO_CHECK_PASSED` record.
