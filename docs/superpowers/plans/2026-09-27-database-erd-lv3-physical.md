# TrọƠi ERD LV3 Physical Candidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a reviewable, executable PostgreSQL/PostGIS physical database candidate for TrọƠi, with deterministic JSON → SQL/Lucid derivation and parity checks across all three artifacts.

**Architecture:** `trooi-erd-lv3-physical.json` is the versioned physical contract derived only from Canonical v3.6 + frozen LV1/LV2 + the approved LV3 spec. Standard-library Python tooling validates that contract and deterministically renders the PostgreSQL DDL and Lucid ERD payload so schema/export artifacts cannot silently drift apart. The SQL candidate is then applied to a clean PostGIS database and the Lucid master is created as a full data-backed ERD with every physical FK visible.

**Tech Stack:** PostgreSQL, PostGIS, SQL, Python 3 standard library, Docker for isolated schema validation, Lucid data-backed ERD, existing NestJS/TypeScript tests for repository regression checks.

**Spec:** `docs/superpowers/specs/2026-09-27-database-erd-lv3-physical-design.md`

## Global Constraints

- `docs/database/canonical.md` remains Canonical v3.6 and must not be edited during LV3 implementation.
- `trooi-erd-lv1-conceptual.json` and `trooi-erd-lv2-logical.json` must both remain `REVIEWED_FROZEN` and semantically unchanged.
- Physical target is PostgreSQL + PostGIS; the design remains ORM-agnostic and must not introduce Prisma/TypeORM/Drizzle decisions.
- Physical entity inventory remains exactly the 29 LV2 entities; no `[FUTURE]` entity/table may be added.
- PK/FK type is `uuid`; money is `numeric(18,2)`; meter values are `numeric(18,6)`; action/event time is `timestamptz`; business day boundaries use `date`.
- Frozen vocabularies use `text` plus `CHECK`; do not introduce PostgreSQL native enums.
- Flexible structured values use `jsonb` only where the approved spec explicitly permits them.
- Search/Map location uses PostGIS `geography(Point,4326)` with the approved spatial indexes.
- `[OPEN]` policies stay open; no unresolved policy may be silently frozen at LV3.
- Carry forward exactly 5 `>> UPSTREAM-RECONCILE` and 1 `>> DOC-RECONCILE` items; Charge over-allocation and Review multiplicity remain OPEN and must not become accidental constraints.
- Cross-table invariants remain transaction/application guards unless PostgreSQL can enforce them honestly at row/index level.
- Lucid master must be a real data-backed ERD with exact datatypes, PK/FK markers, Crow's Foot relations, and every physical FK relationship present.
- `trooi-schema-lv3.sql` is a candidate, not a migration or production init script.
- Validation environment uses the existing Docker 29.7.2 installation because host psql is not installed; do not add repo Docker Compose solely for LV3 validation.
## File Structure

- Create `docs/database/erd/trooi-erd-lv3-physical.json` — authoritative versioned LV3 physical contract.
- Create `docs/database/schema/trooi-schema-lv3.sql` — deterministic PostgreSQL/PostGIS DDL rendered from the physical contract.
- Create `docs/database/erd/tests/trooi-schema-lv3-smoke.sql` — executable constraint/index smoke checks against a clean PostGIS database.
- Create `scripts/database/lv3_validate.py` — validator for LV2→LV3 coverage, physical integrity, debt markers, and parity metadata.
- Create `scripts/database/lv3_render_sql.py` — deterministic JSON→SQL renderer.
- Create `scripts/database/lv3_render_lucid.py` — deterministic JSON→Lucid ERD payload renderer.
- Create `scripts/database/lv3_verify_catalog.py` — compares the applied PostgreSQL catalog against named objects in the physical contract.
- Create `scripts/database/lv3_catalog.sql` — emits a normalized PostgreSQL catalog JSON snapshot for parity verification.
- Create `scripts/database/tests/test_lv3_validate.py`.
- Create `scripts/database/tests/test_lv3_verify_catalog.py`.
- Create `scripts/database/tests/test_lv3_render_sql.py`.
- Create `scripts/database/tests/test_lv3_render_lucid.py`.
- Modify `docs/database/README.md` and `docs/database/erd/README.md` only after executable validation; LV3 remains `DRAFT_REVIEW` until user approval.

## Review Focus

1. A clean PostGIS database must accept generated DDL without manual edits.
2. Validator must reject non-frozen upstream sources, malformed physical columns, dangling FK references, and disallowed PostgreSQL type families.
3. Every CHECK/UNIQUE/index declared by the physical contract must appear exactly in rendered SQL, and the applied PostgreSQL catalog must match the declared object-name sets.
4. High-risk runtime rules must reject invalid Payment/Receipt replacement, utility Charge coherence, paired-null acknowledgement/review fields, Trust Report XOR, Deposit provenance, and conditional uniqueness cases while valid alternatives succeed.
5. Lucid master must contain all 29 tables, every physical FK column and every physical FK relation with exact datatypes.

---

### Task 1: Build the LV3 contract validator

**Files:**
- Create: `scripts/database/lv3_validate.py`
- Create: `scripts/database/tests/test_lv3_validate.py`

**Interfaces:**
- Consumes: frozen `docs/database/erd/trooi-erd-lv2-logical.json` and a candidate LV3 contract dictionary.
- Produces: `validate_contract(lv2: dict, lv3: dict, sql_text: str | None = None) -> list[str]`; empty list means valid.

- [ ] **Step 1: Write failing validator tests**

Cover: `test_accepts_complete_contract`, `test_rejects_missing_lv2_entity`, `test_rejects_missing_lv2_attribute`, `test_rejects_future_table`, `test_requires_exact_reconciliation_markers`, `test_rejects_open_policy_vocabulary_freeze`, `test_rejects_transaction_guard_emitted_as_check`, `test_rejects_non_frozen_lv1_or_lv2`, `test_rejects_malformed_column_shape`, `test_rejects_dangling_fk_reference`, `test_rejects_disallowed_type_family`.

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest scripts.database.tests.test_lv3_validate -v`
Expected: FAIL because validator module does not exist.

- [ ] **Step 3: Implement `validate_contract(...)`**

Use only Python stdlib. Validate source statuses, exact 29-table coverage, attribute coverage, physical column shape, PK/FK references, allowed type families, frozen vocabulary coverage, excluded-future names, OPEN-policy non-freeze rules, enforcement classification, and reconciliation markers `5 upstream + 1 doc`.

- [ ] **Step 4: Run tests and repository regression**

Run: `python -m unittest scripts.database.tests.test_lv3_validate -v`
Run: `npm test`
Expected: validator PASS; repository tests remain 9/9 PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add scripts/database/lv3_validate.py scripts/database/tests/test_lv3_validate.py
git commit -m "test(database): add LV3 physical contract validator"
```
### Task 2: Create the LV3 physical JSON contract

**Files:**
- Create: `docs/database/erd/trooi-erd-lv3-physical.json`
- Modify: `scripts/database/tests/test_lv3_validate.py`

**Interfaces:**
- Consumes: approved LV3 spec plus frozen LV2 JSON.
- Produces: one deterministic `LV3_PHYSICAL` contract containing 29 tables, columns, PKs, FKs, row-local checks, unique constraints, indexes, transaction guards, PostGIS extension requirement, OPEN/FUTURE boundaries, and reconciliation markers.

- [ ] **Step 1: Add a failing repository-contract test**

Add `test_repository_lv3_contract_matches_frozen_lv2`; load the real LV2/LV3 paths and assert zero errors, 29 tables, LV2 status `REVIEWED_FROZEN`, and markers `upstream=5`, `doc=1`.

- [ ] **Step 2: Run the new test and verify RED**

Run: `python -m unittest scripts.database.tests.test_lv3_validate.LV3RepositoryContractTests -v`
Expected: FAIL because `trooi-erd-lv3-physical.json` does not exist.

- [ ] **Step 3: Author the physical contract from the approved spec**

Use snake_case plural table names and exact columns/types/nullability from the spec. Every FK includes referenced table/column and explicit `onDelete: NO ACTION`. Represent `CHECK`, ordinary `UNIQUE`, partial/regular/GiST indexes, and transaction guards as separate machine-readable collections. Carry Charge over-allocation and Review multiplicity as OPEN/reconciliation metadata only: do not add a Charge-side allocation cap and do not add `UNIQUE (tenancy_id, author_participant_id)` on reviews.

Carry `deposit_settlement_amount_cap` as a required transaction guard: cumulative `refunded_amount + retained_amount` for one Deposit must not exceed cumulative `deposit_payment_applications.applied_amount` for that Deposit. Do not encode it as a row-local CHECK or trigger in the LV3 baseline.

- [ ] **Step 4: Verify the real contract**

Run: `python scripts/database/lv3_validate.py docs/database/erd/trooi-erd-lv2-logical.json docs/database/erd/trooi-erd-lv3-physical.json`
Expected: `LV3 physical contract validation: PASS`, `tables=29`, `upstream=5`, `doc=1`.

Run: `git diff --check`
Expected: exit 0.

- [ ] **Step 5: Commit Task 2**

```bash
git add docs/database/erd/trooi-erd-lv3-physical.json scripts/database/tests/test_lv3_validate.py
git commit -m "docs(database): add LV3 physical contract draft"
```

### Task 3: Render deterministic PostgreSQL/PostGIS DDL

**Files:**
- Create: `scripts/database/lv3_render_sql.py`
- Create: `scripts/database/tests/test_lv3_render_sql.py`
- Create: `docs/database/schema/trooi-schema-lv3.sql`

**Interfaces:**
- Consumes: validated LV3 physical JSON.
- Produces: `render_sql(contract: dict) -> str`, stable UTF-8 SQL with PostGIS, tables, PK/FK constraints, row-local CHECKs, ordinary/partial unique indexes, supporting indexes, and comments for transaction guards/debt markers.

- [ ] **Step 1: Write failing SQL renderer tests**

Cover: `test_emits_postgis_extension`, `test_emits_uuid_and_numeric_types`, `test_emits_partial_current_listing_index`, `test_emits_nonterminal_tenancy_index`, `test_emits_active_primary_index`, `test_emits_current_receipt_index`, `test_emits_trust_report_xor_check`, `test_emits_deposit_provenance_check`, `test_does_not_emit_transaction_guard_as_check`, `test_every_declared_constraint_appears_in_rendered_sql`. The generic parity test must compare the complete named CHECK/UNIQUE/index declaration sets from the physical contract against the rendered SQL, not merely search a sample substring.

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest scripts.database.tests.test_lv3_render_sql -v`
Expected: FAIL because renderer does not exist.
- [ ] **Step 3: Implement `render_sql(contract)`**

Render in deterministic dependency order. Start with `CREATE EXTENSION IF NOT EXISTS postgis;`; create tables before cyclic/self FKs where needed, then add deferred FK constraints with `ALTER TABLE`. End with indexes and structured comments for transaction guards and reconciliation debt. Preserve deterministic names for every declared CHECK/UNIQUE/index so tests can compare declared object-name sets against rendered SQL exactly. Do not emit triggers in LV3.

- [ ] **Step 4: Generate SQL and prove byte stability**

Run: `python scripts/database/lv3_render_sql.py docs/database/erd/trooi-erd-lv3-physical.json docs/database/schema/trooi-schema-lv3.sql`
Run the same command again and compare SHA-256 before/after.
Expected: identical hash.

- [ ] **Step 5: Run validator + renderer tests**

Run: `python -m unittest scripts.database.tests.test_lv3_validate scripts.database.tests.test_lv3_render_sql -v`
Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add scripts/database/lv3_render_sql.py scripts/database/tests/test_lv3_render_sql.py docs/database/schema/trooi-schema-lv3.sql
git commit -m "feat(database): render LV3 PostgreSQL schema candidate"
```

### Task 4: Apply schema to a clean PostGIS database and prove runtime/catalog parity

**Files:**
- Create: `docs/database/erd/tests/trooi-schema-lv3-smoke.sql`
- Create: `scripts/database/lv3_verify_catalog.py`
- Create: `scripts/database/lv3_catalog.sql`
- Create: `scripts/database/tests/test_lv3_verify_catalog.py`

**Interfaces:**
- Consumes: generated `trooi-schema-lv3.sql` plus validated LV3 physical JSON.
- Produces: executable evidence that PostgreSQL/PostGIS accepts the DDL, high-risk constraints behave as specified, and the applied catalog contains the exact declared CHECK/UNIQUE/index/FK object-name sets.

- [ ] **Step 1: Write failing catalog-parity tests**

Cover: `test_accepts_matching_catalog`, `test_rejects_missing_declared_check`, `test_rejects_missing_declared_unique_or_index`, `test_rejects_unexpected_schema_constraint`, `test_rejects_fk_set_mismatch`.

- [ ] **Step 2: Run catalog tests and verify RED**

Run: `python -m unittest scripts.database.tests.test_lv3_verify_catalog -v`
Expected: FAIL because `lv3_verify_catalog.py` does not exist.

- [ ] **Step 3: Implement catalog parity verifier**

Implement `verify_catalog(contract: dict, catalog: dict) -> list[str]`. Compare physical table names and named FK/CHECK/UNIQUE/index sets declared by the contract against a normalized PostgreSQL catalog dump; ignore PostgreSQL/PostGIS internal objects and system schemas.

- [ ] **Step 4: Run catalog tests and verify GREEN**

Run: `python -m unittest scripts.database.tests.test_lv3_verify_catalog -v`
Expected: PASS.

- [ ] **Step 5: Write the smoke SQL with positive and negative cases**

Assert PostGIS exists and all 29 tables exist. Cover second current Listing, second non-terminal Tenancy, second active PRIMARY and second ISSUED Receipt; invalid Trust Report target combinations; invalid Deposit Event provenance; Payment replacement self-reference/predecessor/unique-predecessor rules; Receipt replacement self-reference/predecessor rules; RENT Charge carrying utility fields; meter-reading fields without a Utility Connection; Tenancy Notice acknowledgement actor/time mismatch; Payment Claim reviewer/time mismatch. Valid alternatives must succeed. Do not test a Charge-side over-allocation cap or Review multiplicity UNIQUE because both remain OPEN. The Deposit settlement cumulative cap is a transaction-service guard, so schema-only smoke must not claim database enforcement; validator/contract tests must require the guard declaration, and backend persistence work must implement a locked aggregate check before settlement writes. Use savepoints/exception blocks so expected failures do not abort the full run.

- [ ] **Step 6: Start a disposable PostGIS validation container**

```powershell
docker rm -f trooi-lv3-pg 2>$null
docker run --name trooi-lv3-pg -e POSTGRES_PASSWORD=trooi -e POSTGRES_DB=trooi_lv3 -d postgis/postgis:16-3.4
```

Wait until `docker exec trooi-lv3-pg pg_isready -U postgres -d trooi_lv3` reports accepting connections. This image is validation infrastructure only, not a production version pin.

- [ ] **Step 7: Apply generated schema without manual edits**

```powershell
Get-Content -Raw docs/database/schema/trooi-schema-lv3.sql | docker exec -i trooi-lv3-pg psql -v ON_ERROR_STOP=1 -U postgres -d trooi_lv3
```

Expected: exit 0.

- [ ] **Step 8: Run smoke constraints**

```powershell
Get-Content -Raw docs/database/erd/tests/trooi-schema-lv3-smoke.sql | docker exec -i trooi-lv3-pg psql -v ON_ERROR_STOP=1 -U postgres -d trooi_lv3
```

Expected final marker: `LV3_SCHEMA_SMOKE_PASS`.

- [ ] **Step 9: Dump PostgreSQL catalog and prove exact parity**

Create `scripts/database/lv3_catalog.sql` to query `pg_catalog`/`pg_indexes` and emit one normalized JSON document containing TrọƠi table names plus named PK/FK/CHECK/UNIQUE/index objects. Store the runtime dump only in the local SDD ledger directory.

```powershell
New-Item -ItemType Directory -Force .superpowers/sdd/2026-09-27-database-erd-lv3-physical | Out-Null
Get-Content -Raw scripts/database/lv3_catalog.sql | docker exec -i trooi-lv3-pg psql -At -v ON_ERROR_STOP=1 -U postgres -d trooi_lv3 | Set-Content -Encoding utf8 .superpowers/sdd/2026-09-27-database-erd-lv3-physical/postgres-catalog.json
python scripts/database/lv3_verify_catalog.py docs/database/erd/trooi-erd-lv3-physical.json .superpowers/sdd/2026-09-27-database-erd-lv3-physical/postgres-catalog.json
```

Expected: `LV3 PostgreSQL catalog parity: PASS`, `tables=29`, with no missing/unexpected declared schema objects. Record aggregate FK/CHECK/index/GiST counts in the local SDD ledger as supporting evidence, not as the parity oracle.

- [ ] **Step 10: Stop/remove container and commit Task 4**

```powershell
docker rm -f trooi-lv3-pg
```

```bash
git add docs/database/erd/tests/trooi-schema-lv3-smoke.sql scripts/database/lv3_verify_catalog.py scripts/database/lv3_catalog.sql scripts/database/tests/test_lv3_verify_catalog.py
git commit -m "test(database): prove LV3 PostGIS schema parity"
```

### Task 5: Generate the Lucid data-backed master ERD

**Files:**
- Create: `scripts/database/lv3_render_lucid.py`
- Create: `scripts/database/tests/test_lv3_render_lucid.py`
- Modify after Lucid creation: `docs/database/erd/trooi-erd-lv3-physical.json` only for non-authoritative `visualReview` metadata.

**Interfaces:**
- Consumes: validated LV3 physical JSON.
- Produces: `build_lucid_payload(contract: dict) -> dict` containing `entities` and `relationships` accepted by Lucid's real ERD creator; exactly one entity per physical table and one relationship per physical FK.

- [ ] **Step 1: Write failing Lucid payload tests**

Cover: `test_payload_has_all_29_tables`, `test_every_column_keeps_exact_physical_type`, `test_pk_fk_markers_match_contract`, `test_every_physical_fk_becomes_relationship`, `test_no_visual_only_entity_is_added`, `test_payload_is_deterministic`.

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest scripts.database.tests.test_lv3_render_lucid -v`
Expected: FAIL because renderer does not exist.

- [ ] **Step 3: Implement `build_lucid_payload(contract)`**

Map table names directly to Lucid entity names; preserve exact PostgreSQL type strings; mark PK/FK fields; create every FK relationship including actor/account/delivery/self references. Do not add domain containers or suppress long relationships.

- [ ] **Step 4: Run payload tests and emit the payload**

Run: `python scripts/database/lv3_render_lucid.py docs/database/erd/trooi-erd-lv3-physical.json`
Expected summary: `entities=29`, `relationships=<physical_fk_count>`, deterministic payload SHA-256.

- [ ] **Step 5: Create the Lucid master with the real ERD engine**

Use Lucid data-backed ERD creation with the emitted payload. Title: `TrọƠi — ERD LV3 Physical Candidate — PostgreSQL/PostGIS`.

Do not use loose Standard Import rectangles for the master schema. Auxiliary presentation views are separate and non-authoritative.

- [ ] **Step 6: QA the Lucid master**

Fetch/search the document and confirm all 29 tables, type-bearing attributes, PK/FK markers, physical relationship count, and all 5 upstream + 1 doc reconciliation notes outside the schema entities. Export a full-page PNG and inspect for data loss. Readability fixes may move ERD entities but must never delete/suppress schema relationships.

- [ ] **Step 7: Record visual metadata and commit Task 5**

Add only `visualReview.documentId`, `visualReview.editUrl`, `visualReview.createdFromContractSha256` to LV3 JSON. Re-run validator and payload tests.

```bash
git add scripts/database/lv3_render_lucid.py scripts/database/tests/test_lv3_render_lucid.py docs/database/erd/trooi-erd-lv3-physical.json
git commit -m "docs(database): add LV3 data-backed Lucid master ERD"
```
### Task 6: Final LV3 parity QA and review gate

**Files:**
- Modify: `docs/database/README.md`
- Modify: `docs/database/erd/README.md`

**Interfaces:**
- Consumes: validated LV3 JSON, rendered SQL, executable PostGIS evidence, and Lucid master metadata.
- Produces: one clean `DRAFT_REVIEW` LV3 candidate ready for user review; no freeze and no upstream reconciliation yet.

- [ ] **Step 1: Run full automated verification**

```powershell
python -m unittest discover -s scripts/database/tests -p "test_lv3_*.py" -v
python scripts/database/lv3_validate.py docs/database/erd/trooi-erd-lv2-logical.json docs/database/erd/trooi-erd-lv3-physical.json docs/database/schema/trooi-schema-lv3.sql
npm test
git diff --check
```

Expected: all LV3 tests PASS; validator PASS; repository tests 9/9 PASS; diff check exit 0.

- [ ] **Step 2: Repeat clean PostGIS apply, smoke, and catalog parity**

Repeat Task 4 Steps 6-9 from a fresh `trooi-lv3-pg` container using the committed SQL and smoke/catalog tooling, then remove the container. Expected: schema apply exit 0, `LV3_SCHEMA_SMOKE_PASS`, and `LV3 PostgreSQL catalog parity: PASS`.

- [ ] **Step 3: Prove deterministic parity**

Re-render SQL to a temporary file and compare SHA-256 with committed `trooi-schema-lv3.sql`. Re-render Lucid payload twice and compare SHA-256. Assert physical FK count from the contract equals Lucid payload relationship count. Re-assert declared CHECK/UNIQUE/index/FK object-name sets match both rendered SQL and the applied PostgreSQL catalog.

- [ ] **Step 4: Update database status docs**

Set:

```text
LV1 = REVIEWED / FROZEN
LV2 = REVIEWED / FROZEN
LV3 = DRAFT_REVIEW — physical JSON + executable SQL + data-backed Lucid ready
```

Document that ORM/migration tooling remains unselected and the schema is not yet a migration.

- [ ] **Step 5: Commit and push the LV3 review candidate**

```bash
git add docs/database/README.md docs/database/erd/README.md
git commit -m "docs(database): prepare LV3 physical candidate review"
git push origin database/schema-foundations
```

- [ ] **Step 6: Fresh verify branch state and STOP for human review**

Run: `git status --short --branch` and `git log -5 --oneline`.
Expected: branch clean and synced to `origin/database/schema-foundations`.

Report: Lucid edit link, physical JSON path, SQL path, executable validation evidence, table/FK/CHECK/index counts, and the 5 upstream + 1 doc reconciliation markers. **Do not set LV3 to `REVIEWED_FROZEN`, do not start migrations, and do not reconcile `>>` markers until the user explicitly approves the LV3 candidate.**

## Post-LV3 gate

After explicit LV3 approval, run a separate reconciliation/design pass over Canonical → LV1 → LV2 → LV3 for the 5 upstream markers and 1 doc marker. That pass decides promote / keep-lower-layer / reject for each debt item, removes the resolved `>>` markers, and only then establishes the final clean ERD baseline. It is intentionally outside this implementation plan because it may change upstream authority and therefore requires its own user-reviewed decision.
