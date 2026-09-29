# Database Documentation Versioning Design

## Status

Approved design baseline for the first documentation-sync slice on `integration/full-stack-sync`.

## Goal

Reorganize database documentation into explicit, immutable contract releases (`v1`, `v2`, ...) while separating official release history from obsolete/pre-versioned artifacts and separating current system context from database authority.

## Source baseline

The source material to migrate is the merged backend/database state at:

- branch: `integration/backend-database`
- merge SHA: `50465bf0ddafc1b7aec2b1e8dfafde35636ca4b9`
- database implementation SHA represented by that tree: `33975fb4c9300d444c3912fdc9bb7d04d030aab6`

The existing authoritative database chain is:

1. `docs/database/canonical-v3.7.md`
2. `docs/database/erd/trooi-erd-lv1-conceptual.json`
3. `docs/database/erd/trooi-erd-lv2-logical.json`
4. `docs/database/erd/trooi-erd-lv3-physical.json`
5. `docs/database/schema/trooi-schema-lv3.sql`

## Target structure

```text
docs/
├── archives/
│   ├── README.md
│   └── database/
│       └── pre-versioned/
│           └── canonical-v3.6.md
│
├── contexts/
│   └── ...
│
└── database/
    ├── README.md
    ├── v1/
    │   ├── README.md
    │   ├── canonical.md
    │   ├── implementation-history.md
    │   ├── erd/
    │   │   ├── README.md
    │   │   ├── conceptual.json
    │   │   ├── logical.json
    │   │   └── physical.json
    │   └── schema/
    │       └── trooi-schema-20260927T153946Z.sql
    └── v2/
        └── ...
```

`v2/` and later directories are created only when a new official database contract release exists; they are not scaffolded empty.

## Version semantics

A directory such as `docs/database/v1/` is an official database contract release. It is not an ERD abstraction level and is not an implementation sprint.

Within a release:

- `canonical.md` defines product/domain/database contract authority for that release.
- `erd/conceptual.json` is the conceptual model.
- `erd/logical.json` is the logical model.
- `erd/physical.json` is the physical model.
- `schema/trooi-schema-<timestamp>.sql` is the authoritative SQL snapshot for the release.
- `implementation-history.md` records how that release was implemented and verified.

Old official releases remain under `docs/database/vN/`; they are not moved to `docs/archives/` when a newer release appears.

## Current release mapping

The current pre-versioning authority is promoted to the first official release:

```text
docs/database/canonical-v3.7.md
→ docs/database/v1/canonical.md

docs/database/erd/trooi-erd-lv1-conceptual.json
→ docs/database/v1/erd/conceptual.json

docs/database/erd/trooi-erd-lv2-logical.json
→ docs/database/v1/erd/logical.json

docs/database/erd/trooi-erd-lv3-physical.json
→ docs/database/v1/erd/physical.json

docs/database/schema/trooi-schema-lv3.sql
→ docs/database/v1/schema/trooi-schema-20260927T153946Z.sql
```

The SQL timestamp is derived from commit `e092bafe1afdeb9df3beae78ed06e5cf974917e6` (`docs(database): clean frozen LV3 authority surfaces`), committed at `2026-09-27T15:39:46Z`. The rename must not use the migration date or current wall-clock time.

The previous canonical is not an official release under the new numbering scheme:

```text
docs/database/archive/canonical-v3.6.md
→ docs/archives/database/pre-versioned/canonical-v3.6.md
```

## Provenance preservation

Renaming `canonical-v3.7.md` to `v1/canonical.md` must not erase its original identity. `v1/README.md` must record:

- database contract version: `v1`
- source canonical version: `3.7`
- source branch/SHA
- authority chain for the release
- SQL snapshot filename and its freeze timestamp source

No business/domain content may be silently rewritten during the structural migration. Content corrections, if required, are separate reviewed changes.

## Database root README

`docs/database/README.md` becomes the router for database authority. It must state:

- current authoritative release: `v1`
- how database release numbering works
- authority order within the current release
- that earlier official releases stay versioned in place
- that `docs/archives/` contains pre-versioned/superseded artifacts, not official historical releases

No `current/` or `latest/` duplicate directory is introduced.

## Tech stack document

The existing `docs/database/tech-stack.md` is not part of a database contract release.

It will not be migrated into `v1/`. Its useful content will later be rewritten as whole-system current context at:

```text
docs/contexts/tech-stack.md
```

That later rewrite must distinguish at minimum `IMPLEMENTED`, `PLANNED`, and `FUTURE` instead of presenting planned infrastructure as already implemented.

The tech-stack rewrite is outside this first database-versioning slice.

## Implementation history

The existing `docs/implementation/postgres-persistence-progress.md` is only a partial progress log (Tasks 1–5) and must not be copied unchanged into `v1`.

`docs/database/v1/implementation-history.md` must be reconstructed from repository evidence through the completed database implementation baseline, including Tasks 1–17 where evidence exists.

Each reconstructed task entry must contain only evidence supported by commits/docs/tests and should include:

- task number and purpose;
- exact commit SHA(s);
- implementation summary;
- verification evidence explicitly recorded for that task;
- relevant decisions/constraints;
- unresolved items when applicable.

The history must end with a v1 freeze summary containing the final implementation baseline SHA and the observed implementation state. It must not invent missing verification, retroactively claim CI that did not run, or silently close canonical OPEN/FUTURE policy.

The old partial progress file is superseded by the reconstructed release history and does not remain as a second live source of truth.

## Archives semantics

`docs/archives/` is repository-wide archival storage.

It is for artifacts that are:

- pre-versioned;
- superseded before becoming an official release;
- obsolete and retained only for provenance.

It is not where official `database/v1`, `database/v2`, ... releases go.

## Reference migration

Moving authority files changes repository paths. All live references that are intended to resolve against current authority must be updated in the same migration slice or explicitly identified as historical references that should remain unchanged.

Historical immutable artifacts under Superpowers/handoff/audit history must not be rewritten merely to cosmetically replace old paths unless a separate policy explicitly authorizes historical-record migration.

Tests/scripts that resolve authority files at runtime are live references and must be updated to the new v1 paths.

## Invariants

The migration must preserve these invariants:

1. Database/domain content remains semantically unchanged unless separately reviewed.
2. Exactly one current database release is identified by `docs/database/README.md`.
3. `v1` is self-contained enough to reconstruct its authority chain without consulting `docs/archives/`.
4. ERD release version (`v1`) and ERD abstraction level (`conceptual/logical/physical`) are not conflated in filenames.
5. The authoritative SQL snapshot filename uses UTC `YYYYMMDDTHHMMSSZ` without Windows-invalid characters.
6. Official releases are immutable historical releases once superseded.
7. OPEN and FUTURE canonical policy remains OPEN/FUTURE unless the authority itself changes.
8. Database implementation history is evidence-based and traceable to exact commits.

## Out of scope

This slice does not:

- redesign the database schema;
- alter migrations or runtime persistence behavior;
- resolve the known single-step rollback concern;
- implement Redis or MinIO;
- rewrite the whole-system tech-stack context;
- restructure backend/frontend documentation outside references required to keep database authority resolvable;
- create `v2` before there is a real v2 contract.

## Success criteria

The slice is complete when:

- the database authority is reachable through `docs/database/v1/`;
- `docs/database/README.md` routes readers to v1 unambiguously;
- canonical/ERD/schema content is byte-equivalent apart from intentional path/name metadata changes where required;
- the SQL snapshot has the evidence-derived timestamped name;
- pre-versioned canonical v3.6 lives under `docs/archives/database/pre-versioned/`;
- `implementation-history.md` covers the full evidenced implementation history through the v1 baseline rather than stopping at Task 5;
- all live repository references/tests resolve the new paths;
- no database runtime behavior changes as a side effect of this documentation migration.
