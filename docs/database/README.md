# Database Documentation

This directory contains the official, versioned database contract releases for Tr??i.

## Current authoritative release

**Current release: `v1`**

Read the current database authority in this order:

1. [`v1/canonical.md`](v1/canonical.md)
2. [`v1/erd/conceptual.json`](v1/erd/conceptual.json)
3. [`v1/erd/logical.json`](v1/erd/logical.json)
4. [`v1/erd/physical.json`](v1/erd/physical.json)
5. [`v1/schema/trooi-schema-20260927T153946Z.sql`](v1/schema/trooi-schema-20260927T153946Z.sql)

`v1/implementation-history.md` records how the release was implemented and verified. It is provenance, not a higher authority than the contract chain above.

## Release numbering

Directories `v1`, `v2`, ... are official database contract releases. They are **not** ERD abstraction levels and are **not** implementation sprints.

When a later release becomes current:

- update this README to point to the new release;
- keep earlier official releases in place;
- do not create a duplicate `current/` or `latest/` directory.

## Archive boundary

Repository-wide obsolete or pre-versioned documentation belongs under [`../archives/`](../archives/). Official historical database releases do not.

The previous Canonical v3.6 is therefore stored at `docs/archives/database/pre-versioned/canonical-v3.6.md` rather than inside the database release tree.

## Tech stack boundary

Technology-stack documentation is system context, not a database contract. The previous database-specific `tech-stack.md` will be rewritten later as `docs/contexts/tech-stack.md`, with explicit IMPLEMENTED / PLANNED / FUTURE status.
