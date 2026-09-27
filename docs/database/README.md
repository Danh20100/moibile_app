# Tr??i Database Foundation

`docs/database/` l? ngu?n t?i li?u ch?nh th?c cho database design c?a Tr??i.

M?i ERD, logical model, physical model v? schema reference trong khu v?c n?y ph?i tu?n theo c?ng m?t business truth: [`canonical.md`](./canonical.md).

## Authority chain

```text
Canonical v3.6 ? TRUSTED SOURCE
    ?
ERD LV1 ? Conceptual ? REVIEWED / FROZEN
    ?
ERD LV2 ? Logical ? REVIEWED / FROZEN
    ?
ERD LV3 ? Physical ? REVIEWED / FROZEN
    ?
Validated PostgreSQL/PostGIS reference DDL
    ?
Migration / backend implementation
```

Level th?p h?n kh?ng ???c t? thay ??i business meaning ?? `[FROZEN]` ? level cao h?n.

## Structure

```text
docs/database/
??? README.md
??? canonical.md
??? tech-stack.md
??? erd/
?   ??? README.md
?   ??? trooi-erd-lv1-conceptual.json
?   ??? trooi-erd-lv2-logical.json
?   ??? trooi-erd-lv3-physical.json
?   ??? tests/
?       ??? trooi-schema-lv3-smoke.sql
??? schema/
    ??? trooi-schema-lv3.sql
```

## Responsibilities

- `canonical.md`: Product & Domain Model authority; ownership, lifecycle, invariant v? `CURRENT / OPEN / FUTURE` boundary.
- `erd/trooi-erd-lv1-conceptual.json`: conceptual domain topology.
- `erd/trooi-erd-lv2-logical.json`: logical entities, relationships v? policy boundary.
- `erd/trooi-erd-lv3-physical.json`: physical database contract cho PostgreSQL/PostGIS.
- `schema/trooi-schema-lv3.sql`: executable reference DDL ???c render t? LV3; kh?ng ph?i migration baseline.
- `tech-stack.md`: vai tr? c?a PostgreSQL/PostGIS, Redis v? MinIO; kh?ng s? h?u business semantics.

Lucid ch? l? review/visual surface. Repository JSON l? versioned ERD artifact.

## Current state

```text
Canonical v3.6          FROZEN / TRUSTED
ERD LV1                 REVIEWED / FROZEN
ERD LV2                 REVIEWED / FROZEN
ERD LV3                 REVIEWED / FROZEN
PostgreSQL/PostGIS DDL  VALIDATED REFERENCE ? not a migration
ORM / migration tooling unselected
Migrations              not started
```

## Working rules

1. ?i t? Canonical ? LV1 ? LV2 ? LV3 ? schema/backend; kh?ng suy ng??c business truth t? SQL.
2. M?i level ch? th?m m?c chi ti?t thu?c tr?ch nhi?m c?a level ??.
3. `[OPEN]` policy kh?ng ???c t? ??ng ? t?ng database/code.
4. `[FUTURE]` capability kh?ng ???c xu?t hi?n trong current core model khi Canonical ch?a ??i tr?ng th?i.
5. Khi thay ??i invariant `[FROZEN]`, c?p nh?t authority cao h?n tr??c r?i propagate xu?ng to?n chain.
6. Schema reference ph?i ti?p t?c pass validator, smoke test v? PostgreSQL catalog parity tr??c khi d?ng l?m migration input.

Xem chi ti?t ERD t?i [`erd/README.md`](./erd/README.md).
