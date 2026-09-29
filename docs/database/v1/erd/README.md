# ERD ? Database Contract v1

The ERD is split by abstraction level inside the database release directory:

- [`conceptual.json`](conceptual.json) ? business concepts and high-level relationships;
- [`logical.json`](logical.json) ? normalized logical entities, attributes, cardinalities, and constraints;
- [`physical.json`](physical.json) ? PostgreSQL/PostGIS physical contract used to derive and validate SQL.

## Authority order

```text
../canonical.md
    ?
conceptual.json
    ?
logical.json
    ?
physical.json
    ?
../schema/trooi-schema-20260927T153946Z.sql
```

The `v1` directory is the database release version. `conceptual`, `logical`, and `physical` are ERD abstraction levels; they are not additional release numbers.
