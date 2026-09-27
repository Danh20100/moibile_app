import copy
import json
import unittest
from pathlib import Path

from scripts.database.lv3_validate import validate_contract

ROOT = Path(__file__).resolve().parents[3]
LV1_PATH = ROOT / "docs/database/erd/trooi-erd-lv1-conceptual.json"
LV2_PATH = ROOT / "docs/database/erd/trooi-erd-lv2-logical.json"


def load_lv2():
    return json.loads(LV2_PATH.read_text(encoding="utf-8"))


def physical_type(attribute_name):
    if attribute_name.endswith("_id"):
        return "uuid"
    if "amount" in attribute_name or "price" in attribute_name:
        return "numeric(18,2)"
    return "text"


def build_valid_contract(lv2):
    tables = []
    for entity in lv2["entities"]:
        columns = []
        checks = []
        for i, attribute in enumerate(entity["attributes"]):
            column = {
                "name": attribute["name"],
                "logicalAttribute": attribute["name"],
                "type": physical_type(attribute["name"]),
                "nullable": attribute["presence"] != "required",
                "primaryKey": i == 0,
            }
            if (
                entity["name"] == "PROPERTY"
                and attribute["name"] == "operational_location"
            ):
                address_column = copy.deepcopy(column)
                address_column["name"] = "operational_address_text"
                address_column["type"] = "text"
                columns.append(address_column)
                column["type"] = "geography(Point,4326)"
            columns.append(column)
            values = attribute.get("values")
            if values:
                literals = ",".join(f"'{value}'" for value in values)
                checks.append({
                    "name": (
                        f"ck_{entity['id']}_{attribute['name']}_vocabulary"
                    ),
                    "expression": f"{attribute['name']} IN ({literals})",
                    "sourceKind": "row_check",
                })

        tables.append({
            "logicalEntity": entity["name"],
            "name": f"t_{entity['id']}",
            "columns": columns,
            "checks": checks,
            "uniqueConstraints": [],
            "indexes": [],
        })

    return {
        "schemaVersion": "1.0",
        "level": "LV3_PHYSICAL",
        "status": "REVIEWED_FROZEN",
        "source": {
            "canonicalVersion": "v3.6",
            "lv1": {
                "path": str(LV1_PATH),
                "status": "REVIEWED_FROZEN",
            },
            "lv2": {
                "path": str(LV2_PATH),
                "status": "REVIEWED_FROZEN",
            },
        },
        "platform": {
            "database": "PostgreSQL",
            "extensions": ["postgis"],
        },
        "tables": tables,
        "transactionGuards": [
            {
                "id": "deposit_settlement_amount_cap",
                "description": (
                    "Cumulative Deposit Settlement refunded+retained amount may "
                    "not exceed cumulative Deposit Payment Application amount "
                    "for the same Deposit."
                ),
                "enforcement": "transaction",
            }
        ],
        "openPolicies": list(lv2["openPolicies"]),
        "openPolicyFreezes": [],
        "excludedFuture": list(lv2["excludedFuture"]),
        "reconciliationMarkers": []
    }


class LV3ValidatorTests(unittest.TestCase):
    def setUp(self):
        self.lv2 = load_lv2()
        self.contract = build_valid_contract(self.lv2)

    def test_accepts_complete_contract(self):
        self.assertEqual([], validate_contract(self.lv2, self.contract))

    def test_rejects_missing_lv2_entity(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"].pop()
        self.assertTrue(
            any(
                "29" in error or "entity" in error.lower()
                for error in validate_contract(self.lv2, contract)
            )
        )

    def test_rejects_missing_lv2_attribute(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"][1]["columns"].pop()
        self.assertTrue(
            any(
                "attribute" in error.lower()
                for error in validate_contract(self.lv2, contract)
            )
        )

    def test_rejects_future_table(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"].append({
            "logicalEntity": "PARTNER_MARKETPLACE",
            "name": "partner_marketplace",
            "columns": [],
            "checks": [],
            "uniqueConstraints": [],
            "indexes": [],
        })
        self.assertTrue(validate_contract(self.lv2, contract))

    def test_rejects_any_reconciliation_marker(self):
        contract = copy.deepcopy(self.contract)
        contract["reconciliationMarkers"] = [{
            "kind": "UPSTREAM_RECONCILE",
            "id": "stale_debt",
        }]
        errors = validate_contract(self.lv2, contract)
        self.assertTrue(
            any("reconciliation markers must be empty" in error.lower() for error in errors)
        )


    def test_rejects_missing_post_lv3_open_policy(self):
        contract = copy.deepcopy(self.contract)
        contract["openPolicies"].remove(
            "Search/Map room/property type authoritative owner and vocabulary"
        )
        errors = validate_contract(self.lv2, contract)
        self.assertTrue(
            any("room/property type" in error.lower() for error in errors)
        )


    def test_rejects_open_policy_vocabulary_freeze(self):
        contract = copy.deepcopy(self.contract)
        contract["openPolicyFreezes"] = [
            "PAYMENT_CLAIM.status=APPROVED",
        ]
        self.assertTrue(
            any(
                "open" in error.lower()
                for error in validate_contract(self.lv2, contract)
            )
        )

    def test_rejects_transaction_guard_emitted_as_check(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"][0]["checks"].append({
            "name": "ck_bad",
            "expression": "TRUE",
            "sourceKind": "transaction_guard",
        })
        self.assertTrue(
            any(
                "transaction" in error.lower()
                for error in validate_contract(self.lv2, contract)
            )
        )

    def test_rejects_non_frozen_lv3_status(self):
        contract = copy.deepcopy(self.contract)
        contract["status"] = "DRAFT_REVIEW"
        self.assertTrue(
            any(
                "lv3" in error.lower() and "reviewed_frozen" in error.lower()
                for error in validate_contract(self.lv2, contract)
            )
        )

    def test_rejects_non_frozen_lv1_or_lv2(self):
        contract = copy.deepcopy(self.contract)
        contract["source"]["lv2"]["status"] = "DRAFT_REVIEW"
        self.assertTrue(
            any(
                "reviewed_frozen" in error.lower()
                for error in validate_contract(self.lv2, contract)
            )
        )

    def test_rejects_malformed_column_shape(self):
        contract = copy.deepcopy(self.contract)
        del contract["tables"][0]["columns"][0]["nullable"]
        self.assertTrue(
            any(
                "column" in error.lower()
                for error in validate_contract(self.lv2, contract)
            )
        )

    def test_rejects_dangling_fk_reference(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"][0]["columns"][0]["references"] = {
            "table": "missing_table",
            "column": "missing_id",
            "onDelete": "NO ACTION",
        }
        self.assertTrue(
            any(
                "reference" in error.lower() or "foreign" in error.lower()
                for error in validate_contract(self.lv2, contract)
            )
        )

    def test_rejects_disallowed_type_family(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"][0]["columns"][0]["type"] = "varchar(255)"
        self.assertTrue(
            any(
                "type" in error.lower()
                for error in validate_contract(self.lv2, contract)
            )
        )


class LV3RepositoryContractTests(unittest.TestCase):
    def test_repository_lv3_contract_matches_frozen_lv2(self):
        lv3_path = ROOT / "docs/database/erd/trooi-erd-lv3-physical.json"
        lv2 = load_lv2()
        lv3 = json.loads(lv3_path.read_text(encoding="utf-8"))
        errors = validate_contract(lv2, lv3)
        self.assertEqual([], errors)
        self.assertEqual(29, len(lv3["tables"]))
        self.assertEqual(
            "REVIEWED_FROZEN",
            lv3["source"]["lv2"]["status"],
        )
        self.assertEqual([], lv3.get("reconciliationMarkers", []))
        self.assertIn(
            "Search/Map room/property type authoritative owner and vocabulary",
            lv3["openPolicies"],
        )
        self.assertIn(
            "Charge over-allocation across multiple Payments targeting one Charge",
            lv3["openPolicies"],
        )
        self.assertIn(
            "Review multiplicity per eligible Participant/Tenancy",
            lv3["openPolicies"],
        )


class LV3ValidatorFinalReviewTests(unittest.TestCase):
    def setUp(self):
        self.lv2 = load_lv2()
        self.contract = build_valid_contract(self.lv2)

    def test_rejects_duplicate_logical_entity_as_extra_table(self):
        contract = copy.deepcopy(self.contract)
        duplicate = copy.deepcopy(contract["tables"][0])
        duplicate["name"] = f"{duplicate['name']}_duplicate"
        contract["tables"].append(duplicate)
        errors = validate_contract(self.lv2, contract)
        self.assertTrue(
            any(
                "29" in error or "unique logicalentity" in error.lower()
                for error in errors
            )
        )

    def test_rejects_required_attribute_mapped_only_nullable(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"][0]["columns"][0]["nullable"] = True
        errors = validate_contract(self.lv2, contract)
        self.assertTrue(
            any("nullability" in error.lower() for error in errors)
        )

    def test_accepts_approved_property_location_decomposition(self):
        property_table = next(
            table
            for table in self.contract["tables"]
            if table["logicalEntity"] == "PROPERTY"
        )
        mapped_names = {
            column["name"]
            for column in property_table["columns"]
            if column["logicalAttribute"] == "operational_location"
        }
        self.assertEqual(
            {"operational_address_text", "operational_location"},
            mapped_names,
        )
        self.assertEqual([], validate_contract(self.lv2, self.contract))

    def test_rejects_undeclared_duplicate_attribute_mapping(self):
        contract = copy.deepcopy(self.contract)
        user_table = next(
            table
            for table in contract["tables"]
            if table["logicalEntity"] == "USER"
        )
        duplicate = copy.deepcopy(user_table["columns"][0])
        duplicate["name"] = "user_id_duplicate"
        user_table["columns"].append(duplicate)
        errors = validate_contract(self.lv2, contract)
        self.assertTrue(any("exactly once" in error.lower() for error in errors))

    def test_rejects_missing_deposit_settlement_amount_cap_guard(self):
        contract = copy.deepcopy(self.contract)
        contract["transactionGuards"] = [
            guard
            for guard in contract["transactionGuards"]
            if guard["id"] != "deposit_settlement_amount_cap"
        ]
        errors = validate_contract(self.lv2, contract)
        self.assertTrue(
            any(
                "deposit_settlement_amount_cap" in error
                for error in errors
            )
        )

    def test_rejects_deposit_settlement_cap_without_transaction_enforcement(self):
        contract = copy.deepcopy(self.contract)
        guard = next(
            guard
            for guard in contract["transactionGuards"]
            if guard["id"] == "deposit_settlement_amount_cap"
        )
        guard["enforcement"] = "database_check"
        errors = validate_contract(self.lv2, contract)
        self.assertTrue(
            any(
                "transaction enforcement" in error.lower()
                for error in errors
            )
        )

    def test_rejects_missing_frozen_vocabulary_check(self):
        contract = copy.deepcopy(self.contract)
        room_table = next(
            table
            for table in contract["tables"]
            if table["logicalEntity"] == "ROOM"
        )
        room_table["checks"] = []
        errors = validate_contract(self.lv2, contract)
        self.assertTrue(
            any("vocabulary" in error.lower() for error in errors)
        )


if __name__ == "__main__":
    unittest.main()
