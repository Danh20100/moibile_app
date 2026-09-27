from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ALLOWED_TYPES = {
    "uuid",
    "text",
    "integer",
    "smallint",
    "date",
    "timestamptz",
    "jsonb",
    "numeric(18,2)",
    "numeric(18,6)",
    "geography(Point,4326)",
}

REQUIRED_UPSTREAM_MARKERS = {
    "deposit_event_amount_single_owner",
    "review_property_historical_target_upstream",
    "room_property_type_search_filter",
    "charge_overallocation_policy",
    "review_multiplicity_policy",
}
REQUIRED_DOC_MARKERS = {"tech_stack_postgis"}
REQUIRED_COLUMN_KEYS = {"name", "logicalAttribute", "type", "nullable", "primaryKey"}

def _table_map(contract: dict) -> dict[str, dict]:
    return {table.get("name"): table for table in contract.get("tables", []) if table.get("name")}


def _logical_table_map(contract: dict) -> dict[str, dict]:
    return {table.get("logicalEntity"): table for table in contract.get("tables", []) if table.get("logicalEntity")}


def _column_map(table: dict) -> dict[str, dict]:
    return {column.get("name"): column for column in table.get("columns", []) if column.get("name")}


def _validate_sources(contract: dict, errors: list[str]) -> None:
    source = contract.get("source", {})
    for name in ("lv1", "lv2"):
        status = source.get(name, {}).get("status")
        if status != "REVIEWED_FROZEN":
            errors.append(f"source {name} must be REVIEWED_FROZEN, got {status!r}")
    if source.get("canonicalVersion") != "v3.6":
        errors.append("canonical source must remain v3.6")


def _validate_markers(contract: dict, errors: list[str]) -> None:
    markers = contract.get("reconciliationMarkers", [])
    upstream = {m.get("id") for m in markers if m.get("kind") == "UPSTREAM_RECONCILE"}
    docs = {m.get("id") for m in markers if m.get("kind") == "DOC_RECONCILE"}
    if upstream != REQUIRED_UPSTREAM_MARKERS or docs != REQUIRED_DOC_MARKERS:
        errors.append("reconciliation markers must be exactly 5 upstream + 1 doc")

def _validate_tables(lv2: dict, contract: dict, errors: list[str]) -> None:
    expected = {entity["name"]: entity for entity in lv2.get("entities", [])}
    actual = _logical_table_map(contract)
    if set(actual) != set(expected):
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        errors.append(f"physical entity set must match exact 29 LV2 entities; missing={missing}, extra={extra}")

    names = [table.get("name") for table in contract.get("tables", [])]
    if len(names) != len(set(names)):
        errors.append("physical table names must be unique")

    for logical_name, entity in expected.items():
        table = actual.get(logical_name)
        if not table:
            continue
        columns = table.get("columns")
        if not isinstance(columns, list) or not columns:
            errors.append(f"table {table.get('name')} must define physical columns")
            continue
        for column in columns:
            if not isinstance(column, dict) or not REQUIRED_COLUMN_KEYS.issubset(column):
                errors.append(f"table {table.get('name')} has malformed column shape")
                continue
            if column.get("type") not in ALLOWED_TYPES:
                errors.append(f"column {table.get('name')}.{column.get('name')} uses disallowed type {column.get('type')!r}")
        mapped_attributes = {column.get("logicalAttribute") for column in columns}
        expected_attributes = {attribute["name"] for attribute in entity.get("attributes", [])}
        missing_attributes = sorted(expected_attributes - mapped_attributes)
        if missing_attributes:
            errors.append(f"table {table.get('name')} is missing LV2 attribute mappings {missing_attributes}")

def _validate_references(contract: dict, errors: list[str]) -> None:
    tables = _table_map(contract)
    for table in contract.get("tables", []):
        for column in table.get("columns", []):
            ref = column.get("references")
            if not ref:
                continue
            target = tables.get(ref.get("table"))
            if target is None:
                errors.append(f"foreign reference {table.get('name')}.{column.get('name')} targets missing table {ref.get('table')!r}")
                continue
            target_columns = _column_map(target)
            if ref.get("column") not in target_columns:
                errors.append(f"foreign reference {table.get('name')}.{column.get('name')} targets missing column {ref.get('table')}.{ref.get('column')}")
            if ref.get("onDelete") not in {"NO ACTION", "RESTRICT"}:
                errors.append(f"foreign reference {table.get('name')}.{column.get('name')} must use NO ACTION/RESTRICT")


def _validate_checks(contract: dict, errors: list[str]) -> None:
    for table in contract.get("tables", []):
        for check in table.get("checks", []):
            if check.get("sourceKind") == "transaction_guard":
                errors.append(f"transaction guard {check.get('name')} must not be emitted as row-local CHECK")
    if contract.get("openPolicyFreezes"):
        errors.append("OPEN policy vocabulary/policy must not be frozen in LV3")


def validate_contract(lv2: dict, lv3: dict, sql_text: str | None = None) -> list[str]:
    errors: list[str] = []
    _validate_sources(lv3, errors)
    _validate_tables(lv2, lv3, errors)
    _validate_references(lv3, errors)
    _validate_checks(lv3, errors)
    _validate_markers(lv3, errors)
    return errors

def _load_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) not in {2, 3}:
        print("usage: lv3_validate.py <lv2.json> <lv3.json> [schema.sql]", file=sys.stderr)
        return 2
    lv2 = _load_json(args[0])
    lv3 = _load_json(args[1])
    sql_text = Path(args[2]).read_text(encoding="utf-8") if len(args) == 3 else None
    errors = validate_contract(lv2, lv3, sql_text)
    if errors:
        print("LV3 physical contract validation: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1
    upstream = sum(1 for m in lv3.get("reconciliationMarkers", []) if m.get("kind") == "UPSTREAM_RECONCILE")
    docs = sum(1 for m in lv3.get("reconciliationMarkers", []) if m.get("kind") == "DOC_RECONCILE")
    print("LV3 physical contract validation: PASS")
    print(f"tables={len(lv3.get('tables', []))} upstream={upstream} doc={docs}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
