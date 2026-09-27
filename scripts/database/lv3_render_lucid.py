from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any


def _is_globally_unique_fk(table: dict[str, Any], column_name: str) -> bool:
    for unique in table.get("uniqueConstraints", []):
        if unique.get("columns") == [column_name]:
            return True

    for index in table.get("indexes", []):
        if not index.get("unique") or index.get("columns") != [column_name]:
            continue
        where = str(index.get("where") or "").strip()
        if not where:
            return True
        if where.upper() == f"{column_name} IS NOT NULL".upper():
            return True

    return False


def build_lucid_payload(
    contract: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    entities: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []

    for table in contract["tables"]:
        attributes = []
        for column in table["columns"]:
            attribute: dict[str, Any] = {
                "name": column["name"],
                "type": column["type"],
            }
            if column.get("primaryKey"):
                attribute["key"] = "PK"
            elif column.get("references"):
                attribute["key"] = "FK"
            attributes.append(attribute)

        entities.append({
            "id": table["name"],
            "name": table["name"],
            "attributes": attributes,
        })

    for table in contract["tables"]:
        for column in table["columns"]:
            ref = column.get("references")
            if not ref:
                continue

            from_cardinality = (
                "zeroOrOne"
                if _is_globally_unique_fk(table, column["name"])
                else "zeroOrMore"
            )
            relationships.append({
                "from": table["name"],
                "to": ref["table"],
                "fromAttribute": column["name"],
                "toAttribute": ref["column"],
                "fromCardinality": from_cardinality,
                "toCardinality": "zeroOrOne" if column["nullable"] else "one",
                "label": ref["name"],
            })

    return {"entities": entities, "relationships": relationships}


def _stable_json(payload: dict[str, Any]) -> str:
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def main(argv: list[str]) -> int:
    if len(argv) not in {2, 3}:
        print(
            "usage: lv3_render_lucid.py CONTRACT_JSON [OUTPUT_JSON]",
            file=sys.stderr,
        )
        return 2

    contract = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    payload = build_lucid_payload(contract)
    encoded = _stable_json(payload)

    if len(argv) == 3:
        Path(argv[2]).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )

    print(f"entities={len(payload['entities'])}")
    print(f"relationships={len(payload['relationships'])}")
    print(f"sha256={hashlib.sha256(encoded.encode('utf-8')).hexdigest()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
