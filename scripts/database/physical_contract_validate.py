from __future__ import annotations

import json
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

REQUIRED_TRANSACTION_GUARDS = {"deposit_settlement_amount_cap"}
REQUIRED_POST_PHYSICAL_OPEN_POLICIES = {
    "Search/Map room/property type authoritative owner and vocabulary",
    "Charge over-allocation across multiple Payments targeting one Charge",
    "Review multiplicity per eligible Participant/Tenancy",
}
CANONICAL_ROOT = Path(__file__).resolve().parents[2]
REQUIRED_COLUMN_KEYS = {"name", "logicalAttribute", "type", "nullable", "primaryKey"}

APPROVED_PHYSICAL_DECOMPOSITIONS = {
    ("PROPERTY", "operational_location"): {
        "operational_address_text",
        "operational_location",
    },
}


def _table_map(contract: dict) -> dict[str, dict]:
    return {
        table.get("name"): table
        for table in contract.get("tables", [])
        if table.get("name")
    }


def _logical_table_map(contract: dict) -> dict[str, dict]:
    return {
        table.get("logicalEntity"): table
        for table in contract.get("tables", [])
        if table.get("logicalEntity")
    }


def _column_map(table: dict) -> dict[str, dict]:
    return {
        column.get("name"): column
        for column in table.get("columns", [])
        if column.get("name")
    }


def _validate_sources(logical_contract: dict, contract: dict, errors: list[str]) -> None:
    if contract.get("status") != "REVIEWED_FROZEN":
        errors.append(
            f"Physical contract status must be REVIEWED_FROZEN, got {contract.get('status')!r}"
        )
    source = contract.get("source", {})
    for name in ("lv1", "lv2"):
        status = source.get(name, {}).get("status")
        if status != "REVIEWED_FROZEN":
            errors.append(
                f"source {name} must be REVIEWED_FROZEN, got {status!r}"
            )
    canonical = source.get("canonical", {})
    if source.get("canonicalVersion") != "v3.7" or canonical.get("version") != "v3.7":
        errors.append("canonical source must be v3.7")
    if logical_contract.get("source", {}).get("canonical", {}).get("version") != "v3.7":
        errors.append("Logical contract canonical source must be v3.7")


def _validate_markers(contract: dict, errors: list[str]) -> None:
    markers = contract.get("reconciliationMarkers", [])
    if markers:
        errors.append("reconciliation markers must be empty after physical contract freeze")


def _validate_open_policies(contract: dict, errors: list[str]) -> None:
    policies = set(contract.get("openPolicies", []))
    missing = REQUIRED_POST_PHYSICAL_OPEN_POLICIES - policies
    if missing:
        errors.append(
            "missing post-freeze OPEN policies: " + ", ".join(sorted(missing))
        )

    canonical_path = contract.get("source", {}).get("canonical", {}).get("path")
    if not canonical_path:
        errors.append("canonical v3.7 must declare post-freeze OPEN policies")
        return

    path = Path(canonical_path)
    if not path.is_absolute():
        path = CANONICAL_ROOT / path
    try:
        canonical = path.read_text(encoding="utf-8")
    except OSError:
        errors.append("canonical v3.7 must declare post-freeze OPEN policies")
        return

    missing = {
        policy
        for policy in REQUIRED_POST_PHYSICAL_OPEN_POLICIES
        if f"{policy}: **[OPEN]**." not in canonical
    }
    if missing:
        errors.append(
            "canonical v3.7 must declare post-freeze OPEN policies: "
            + ", ".join(sorted(missing))
        )


def _validate_frozen_vocabulary(
    table: dict,
    attribute: dict,
    mapped_columns: list[dict],
    errors: list[str],
) -> None:
    values = attribute.get("values")
    if not values or not mapped_columns:
        return

    column_name = mapped_columns[0]["name"]
    expressions = [
        str(check.get("expression", ""))
        for check in table.get("checks", [])
    ]
    matching = [
        expression
        for expression in expressions
        if column_name in expression
        and all(f"'{value}'" in expression for value in values)
    ]
    if not matching:
        errors.append(
            f"table {table.get('name')} must enforce frozen vocabulary "
            f"for {attribute['name']}"
        )


def _validate_tables(logical_contract: dict, contract: dict, errors: list[str]) -> None:
    expected = {
        entity["name"]: entity
        for entity in logical_contract.get("entities", [])
    }
    tables = contract.get("tables", [])
    actual = _logical_table_map(contract)

    logical_names = [
        table.get("logicalEntity")
        for table in tables
        if table.get("logicalEntity")
    ]
    if len(tables) != len(expected) or len(logical_names) != len(set(logical_names)):
        errors.append(
            "physical tables must contain exactly 29 unique logicalEntity mappings"
        )

    if set(actual) != set(expected):
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        errors.append(
            "physical entity set must match exact 29 logical entities; "
            f"missing={missing}, extra={extra}"
        )

    names = [table.get("name") for table in tables]
    if len(names) != len(set(names)):
        errors.append("physical table names must be unique")

    for logical_name, entity in expected.items():
        table = actual.get(logical_name)
        if not table:
            continue

        columns = table.get("columns")
        if not isinstance(columns, list) or not columns:
            errors.append(
                f"table {table.get('name')} must define physical columns"
            )
            continue

        for column in columns:
            if (
                not isinstance(column, dict)
                or not REQUIRED_COLUMN_KEYS.issubset(column)
            ):
                errors.append(
                    f"table {table.get('name')} has malformed column shape"
                )
                continue
            if column.get("type") not in ALLOWED_TYPES:
                errors.append(
                    f"column {table.get('name')}.{column.get('name')} "
                    f"uses disallowed type {column.get('type')!r}"
                )

        for attribute in entity.get("attributes", []):
            mapped_columns = [
                column
                for column in columns
                if column.get("logicalAttribute") == attribute["name"]
            ]
            if not mapped_columns:
                errors.append(
                    f"table {table.get('name')} is missing logical attribute "
                    f"mapping {attribute['name']!r}"
                )
                continue
            approved_decomposition = APPROVED_PHYSICAL_DECOMPOSITIONS.get(
                (logical_name, attribute["name"])
            )
            if approved_decomposition is not None:
                mapped_names = {column["name"] for column in mapped_columns}
                if mapped_names != approved_decomposition:
                    errors.append(
                        f"table {table.get('name')} physical decomposition for "
                        f"{attribute['name']!r} must be exactly "
                        f"{sorted(approved_decomposition)}"
                    )
                    continue
            elif len(mapped_columns) != 1:
                errors.append(
                    f"table {table.get('name')} must map logical attribute "
                    f"{attribute['name']!r} exactly once"
                )
                continue

            if (
                attribute.get("presence") == "required"
                and any(
                    column.get("nullable") is not False
                    for column in mapped_columns
                )
            ):
                errors.append(
                    f"table {table.get('name')} nullability does not preserve "
                    f"required logical attribute {attribute['name']!r}"
                )

            _validate_frozen_vocabulary(
                table,
                attribute,
                mapped_columns,
                errors,
            )


def _validate_references(contract: dict, errors: list[str]) -> None:
    tables = _table_map(contract)
    for table in contract.get("tables", []):
        for column in table.get("columns", []):
            ref = column.get("references")
            if not ref:
                continue
            target = tables.get(ref.get("table"))
            if target is None:
                errors.append(
                    f"foreign reference {table.get('name')}.{column.get('name')} "
                    f"targets missing table {ref.get('table')!r}"
                )
                continue
            target_columns = _column_map(target)
            if ref.get("column") not in target_columns:
                errors.append(
                    f"foreign reference {table.get('name')}.{column.get('name')} "
                    f"targets missing column {ref.get('table')}.{ref.get('column')}"
                )
            if ref.get("onDelete") not in {"NO ACTION", "RESTRICT"}:
                errors.append(
                    f"foreign reference {table.get('name')}.{column.get('name')} "
                    "must use NO ACTION/RESTRICT"
                )


def _validate_transaction_guards(contract: dict, errors: list[str]) -> None:
    guards = contract.get("transactionGuards", [])
    by_id = {guard.get("id"): guard for guard in guards if guard.get("id")}
    for guard_id in REQUIRED_TRANSACTION_GUARDS:
        guard = by_id.get(guard_id)
        if guard is None:
            errors.append(f"missing required transaction guard {guard_id}")
            continue
        if guard.get("enforcement") != "transaction":
            errors.append(
                f"transaction guard {guard_id} must use transaction enforcement"
            )


def _validate_checks(contract: dict, errors: list[str]) -> None:
    for table in contract.get("tables", []):
        for check in table.get("checks", []):
            if check.get("sourceKind") == "transaction_guard":
                errors.append(
                    f"transaction guard {check.get('name')} must not be emitted "
                    "as row-local CHECK"
                )
    if contract.get("openPolicyFreezes"):
        errors.append("OPEN policy vocabulary/policy must not be frozen in the physical contract")


def validate_contract(
    logical_contract: dict,
    physical_contract: dict,
    sql_text: str | None = None,
) -> list[str]:
    errors: list[str] = []
    _validate_sources(logical_contract, physical_contract, errors)
    _validate_tables(logical_contract, physical_contract, errors)
    _validate_references(physical_contract, errors)
    _validate_checks(physical_contract, errors)
    _validate_transaction_guards(physical_contract, errors)
    _validate_open_policies(physical_contract, errors)
    _validate_markers(physical_contract, errors)
    return errors


def _load_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) not in {2, 3}:
        print(
            "usage: physical_contract_validate.py <logical.json> <physical.json> [schema.sql]",
            file=sys.stderr,
        )
        return 2

    logical_contract = _load_json(args[0])
    physical_contract = _load_json(args[1])
    sql_text = (
        Path(args[2]).read_text(encoding="utf-8")
        if len(args) == 3
        else None
    )
    errors = validate_contract(logical_contract, physical_contract, sql_text)
    if errors:
        print("Physical contract validation: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Physical contract validation: PASS")
    print(
        f"tables={len(physical_contract.get('tables', []))} "
        f"reconciliation={len(physical_contract.get('reconciliationMarkers', []))}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
