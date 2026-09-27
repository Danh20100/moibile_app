from __future__ import annotations

import json
import sys
from pathlib import Path


def _column_sql(column: dict) -> str:
    nullability = "" if column["nullable"] else " NOT NULL"
    return f"{column['name']} {column['type']}{nullability}"


def _table_constraints(table: dict) -> list[str]:
    parts = []
    pk = table["primaryKey"]
    parts.append(f"CONSTRAINT {pk['name']} PRIMARY KEY ({', '.join(pk['columns'])})")
    for check in table.get("checks", []):
        parts.append(f"CONSTRAINT {check['name']} CHECK ({check['expression']})")
    for unique in table.get("uniqueConstraints", []):
        parts.append(f"CONSTRAINT {unique['name']} UNIQUE ({', '.join(unique['columns'])})")
    return parts


def _render_table(table: dict) -> list[str]:
    body = [_column_sql(c) for c in table["columns"]] + _table_constraints(table)
    lines = [f"CREATE TABLE {table['name']} ("]
    lines.extend(f"    {item}{',' if i < len(body) - 1 else ''}" for i, item in enumerate(body))
    lines.append(");")
    return lines


def _render_foreign_keys(contract: dict) -> list[str]:
    lines = []
    for table in contract["tables"]:
        for column in table["columns"]:
            ref = column.get("references")
            if not ref:
                continue
            lines.append(
                f"ALTER TABLE {table['name']} ADD CONSTRAINT {ref['name']} "
                f"FOREIGN KEY ({column['name']}) REFERENCES {ref['table']}({ref['column']}) "
                f"ON DELETE {ref['onDelete']};"
            )
    return lines


def _render_indexes(contract: dict) -> list[str]:
    lines = []
    for table in contract["tables"]:
        for index in table.get("indexes", []):
            unique = "UNIQUE " if index.get("unique") else ""
            method = index.get("method", "btree")
            using = f" USING {method}" if method != "btree" else ""
            where = f" WHERE {index['where']}" if index.get("where") else ""
            lines.append(
                f"CREATE {unique}INDEX {index['name']} ON {table['name']}{using} "
                f"({', '.join(index['columns'])}){where};"
            )
    return lines


def _render_notes(contract: dict) -> list[str]:
    lines = ["-- Transaction/application guards (not database CHECK constraints)"]
    for guard in contract.get("transactionGuards", []):
        lines.append(f"-- GUARD {guard['id']}: {guard['description']}")
    lines.append("-- Reconciliation debt")
    for marker in contract.get("reconciliationMarkers", []):
        lines.append(f"-- {marker['kind']} {marker['id']}: {marker.get('text', '')}")
    return lines


def render_sql(contract: dict) -> str:
    lines = [
        "-- Generated from trooi-erd-lv3-physical.json. Do not hand-edit.",
        "CREATE EXTENSION IF NOT EXISTS postgis;",
        "",
    ]
    for table in contract["tables"]:
        lines.extend(_render_table(table))
        lines.append("")
    lines.extend(_render_foreign_keys(contract))
    lines.append("")
    lines.extend(_render_indexes(contract))
    lines.append("")
    lines.extend(_render_notes(contract))
    return "\n".join(lines).rstrip() + "\n"


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 2:
        print("usage: lv3_render_sql.py <contract.json> <output.sql>", file=sys.stderr)
        return 2
    contract = json.loads(Path(args[0]).read_text(encoding="utf-8"))
    output = Path(args[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    sql = render_sql(contract)
    output.write_text(sql, encoding="utf-8", newline="\n")
    print(f"LV3 SQL rendered: {output}")
    print(f"bytes={len(sql.encode('utf-8'))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
