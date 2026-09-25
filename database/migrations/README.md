# Database migrations

This directory is reserved for **future versioned PostgreSQL migrations**.

## Purpose

A migration records an intentional change from one approved database state to the next so every developer and environment can reproduce the same schema history.

Typical future responsibilities include:

- creating or altering tables;
- adding/removing approved constraints;
- creating indexes;
- evolving enums/reference structures;
- applying reviewed data-shape changes required by the domain model.

## Current status

**Skeleton only. No migration SQL has been added in this change.**

Do not create migrations until the relevant LV3 physical model and database invariants have been reviewed.

## Future rules

When migrations begin:

1. Keep them ordered and versioned.
2. Prefer one coherent schema intent per migration.
3. Treat applied migrations as history; do not silently rewrite an already-shared migration.
4. Document any migration that changes data semantics, not only table shape.
5. Keep PostgreSQL migration state aligned with the approved ERD and project scope.
6. Define rollback/forward-fix policy before production migrations are introduced.

The exact migration framework/naming convention is intentionally **not selected by this README**. That decision belongs to the backend/database implementation stage.
