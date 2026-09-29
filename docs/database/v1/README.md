# Database Contract v1

## Release metadata

- **Database contract version:** `v1`
- **Source canonical version:** Canonical Product & Domain Freeze `v3.7`
- **Source integration branch:** `integration/backend-database`
- **Source integration merge SHA:** `50465bf0ddafc1b7aec2b1e8dfafde35636ca4b9`
- **Database implementation baseline SHA:** `33975fb4c9300d444c3912fdc9bb7d04d030aab6`
- **Schema freeze source commit:** `e092bafe1afdeb9df3beae78ed06e5cf974917e6`
- **Schema freeze timestamp:** `2026-09-27T15:39:46Z`

This release promotes the previously frozen Canonical v3.7 / ERD / validated SQL authority into the first explicit database contract release without changing its business meaning.

## Authority chain

1. [`canonical.md`](canonical.md) ? product/domain/database rules and CURRENT / OPEN / FUTURE boundaries.
2. [`erd/conceptual.json`](erd/conceptual.json) ? conceptual data model.
3. [`erd/logical.json`](erd/logical.json) ? logical model and normalized relationships.
4. [`erd/physical.json`](erd/physical.json) ? PostgreSQL/PostGIS physical contract.
5. [`schema/trooi-schema-20260927T153946Z.sql`](schema/trooi-schema-20260927T153946Z.sql) ? validated executable SQL snapshot.

If a lower layer conflicts with a higher layer, fix the lower layer; do not weaken the higher authority to preserve implementation behavior.

## Provenance

The pre-versioning filenames were:

- `docs/database/canonical-v3.7.md`
- `docs/database/erd/trooi-erd-lv1-conceptual.json`
- `docs/database/erd/trooi-erd-lv2-logical.json`
- `docs/database/erd/trooi-erd-lv3-physical.json`
- `docs/database/schema/trooi-schema-lv3.sql`

The new filesystem version (`v1`) is deliberately separate from ERD abstraction level. ERD files therefore use the names `conceptual`, `logical`, and `physical` inside the release.

See [`implementation-history.md`](implementation-history.md) for implementation and verification provenance.
