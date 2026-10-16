# Object Storage & Cache Foundation — infrastructure skeleton

**Active branch:** `design/app-ui-redesign` (transferred from deprecated `infra/object-storage-cache-foundation` on 2026-10-12)  
**Origin:** selectively transferred scaffold only; no source-branch payment/migration changes were imported  
**Status:** SCAFFOLD ONLY — not a completed upload, media metadata, or Redis implementation. Validation on the new branch requires its own CI run.

## What this branch adds

- `ObjectStoragePort` for private bytes and an explicitly unavailable adapter.
- `CachePort` for reconstructable read data and a safe always-miss fallback.
- Strict, environment-driven MinIO/S3 and Redis config parsers (secrets never logged).
- An **opt-in** development Compose overlay with loopback-only MinIO and ephemeral Redis; no mutation of the existing PostgreSQL service or migrations.
- Tests verifying disabled defaults, fail-closed storage, cache fallback, and invalid configuration.

The new ports and parsers are **not wired into AppModule**. They are reserved for a follow-up infrastructure implementation. Setting `OBJECT_STORAGE_ENABLED=true` or `REDIS_URL` alone does NOT activate storage or caching. Do not use these env keys as a readiness signal until actual adapters are wired and tested.

## Local infrastructure only

Copy `.env.example` to an untracked `.env`, set a **local-only, strong**
`MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`, then run:

```sh
docker compose --env-file .env --profile local-infra up -d --no-deps minio redis
```

Ports bind to `127.0.0.1`. The storage engine uses pinned `docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z` (a maintained community fork of MinIO with S3-compatible API). The former `minio/minio` Docker image was removed from this compose overlay because its distribution/maintenance is no longer reliable. No Amazon AWS account/billing is required. This is local development only; do not expose the root credential, Console or ephemeral Redis to public networks or deploy this topology to production.

The Compose overlay does not automatically provision buckets and intentionally does not inject credentials into the backend. In the verified local instance, the private `trooi-media` bucket was created explicitly after startup. When the real S3-compatible adapter lands, use private buckets, least-privilege credentials, authenticated operations, explicit file limits and MIME validation, safe object keys, retention/audit policy, and backend authorization. Align media-reference ownership and deletion policy with Canonical/ERD **before** adding schema migrations or public API endpoints.

## Boundary and sequencing

1. Review media ownership (room/listing/incident attachments), object keys, allowed content types, maximum size, retention, authorization, and cleanup of orphaned objects.
2. Implement a real S3-compatible adapter and controlled upload/download workflows with integration tests against MinIO. Persist only references/metadata in PostgreSQL; retain existing `incident_events.attachment_reference` meaning until reviewed.
3. Implement optional Redis client behind `CachePort` with explicit cache tests and guardrails. PostgreSQL remains authoritative. TTL, invalidation-after-commit, connection outage behavior and complete flush recovery must be tested.

No change to money/SePay, tenant permissions, Canonical/ERD, Database v1 migrations, UI worktrees, or Android build is included here.

## Verification

```sh
pnpm exec tsx --test tests/integration/infrastructure/*.test.ts
pnpm typecheck
docker compose --env-file .env --profile local-infra config
```

These checks verify the scaffold only; they cannot claim provider connection, actual file roundtrips, Redis GET/SET, or live deployments.
