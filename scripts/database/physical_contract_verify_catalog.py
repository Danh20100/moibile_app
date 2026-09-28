from __future__ import annotations

import json
import sys
from pathlib import Path


def expected_catalog(contract: dict) -> dict[str, list[str]]:
    return {
        "tables": sorted(table["name"] for table in contract["tables"]),
        "primaryKeys": sorted(table["primaryKey"]["name"] for table in contract["tables"]),
        "foreignKeys": sorted(
            column["references"]["name"]
            for table in contract["tables"]
            for column in table["columns"]
            if column.get("references")
        ),
        "checks": sorted(check["name"] for table in contract["tables"] for check in table.get("checks", [])),
        "uniqueConstraints": sorted(unique["name"] for table in contract["tables"] for unique in table.get("uniqueConstraints", [])),
        "indexes": sorted(index["name"] for table in contract["tables"] for index in table.get("indexes", [])),
    }


def _compare_set(kind: str, expected: list[str], actual: list[str], errors: list[str]) -> None:
    expected_set = set(expected)
    actual_set = set(actual)
    missing = sorted(expected_set - actual_set)
    unexpected = sorted(actual_set - expected_set)
    if missing or unexpected:
        errors.append(f"{kind} mismatch: missing={missing}, unexpected={unexpected}")


def verify_catalog(contract: dict, catalog: dict) -> list[str]:
    expected = expected_catalog(contract)
    errors: list[str] = []
    labels = {
        "tables": "table",
        "primaryKeys": "primary key",
        "foreignKeys": "foreign key",
        "checks": "check constraint",
        "uniqueConstraints": "unique constraint",
        "indexes": "index",
    }
    for key, label in labels.items():
        _compare_set(label, expected[key], catalog.get(key, []), errors)
    return errors


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 2:
        print(
            "usage: physical_contract_verify_catalog.py <contract.json> <catalog.json>",
            file=sys.stderr,
        )
        return 2
    contract = json.loads(Path(args[0]).read_text(encoding="utf-8-sig"))
    catalog = json.loads(Path(args[1]).read_text(encoding="utf-8-sig"))
    errors = verify_catalog(contract, catalog)
    if errors:
        print("Physical contract PostgreSQL catalog parity: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Physical contract PostgreSQL catalog parity: PASS")
    print(f"tables={len(catalog.get('tables', []))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
