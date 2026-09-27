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
        for i, attribute in enumerate(entity["attributes"]):
            columns.append({
                "name": attribute["name"],
                "logicalAttribute": attribute["name"],
                "type": physical_type(attribute["name"]),
                "nullable": attribute["presence"] != "required",
                "primaryKey": i == 0,
            })
        tables.append({
            "logicalEntity": entity["name"],
            "name": f"t_{entity['id']}",
            "columns": columns,
            "checks": [],
            "uniqueConstraints": [],
            "indexes": [],
        })

    return {
        "schemaVersion": "1.0",
        "level": "LV3_PHYSICAL",
        "status": "DRAFT_REVIEW",
        "source": {
            "canonicalVersion": "v3.6",
            "lv1": {"path": str(LV1_PATH), "status": "REVIEWED_FROZEN"},
            "lv2": {"path": str(LV2_PATH), "status": "REVIEWED_FROZEN"},
        },
        "platform": {"database": "PostgreSQL", "extensions": ["postgis"]},
        "tables": tables,
        "transactionGuards": [],
        "openPolicies": list(lv2["openPolicies"]) + [
            "Charge over-allocation across multiple Payments targeting one Charge",
            "Review multiplicity per eligible Participant/Tenancy",
        ],
        "openPolicyFreezes": [],
        "excludedFuture": list(lv2["excludedFuture"]),
        "reconciliationMarkers": [
            {"kind": "UPSTREAM_RECONCILE", "id": "deposit_event_amount_single_owner"},
            {"kind": "UPSTREAM_RECONCILE", "id": "review_property_historical_target_upstream"},
            {"kind": "UPSTREAM_RECONCILE", "id": "room_property_type_search_filter"},
            {"kind": "UPSTREAM_RECONCILE", "id": "charge_overallocation_policy"},
            {"kind": "UPSTREAM_RECONCILE", "id": "review_multiplicity_policy"},
            {"kind": "DOC_RECONCILE", "id": "tech_stack_postgis"},
        ],
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
        self.assertTrue(any("29" in e or "entity" in e.lower() for e in validate_contract(self.lv2, contract)))

    def test_rejects_missing_lv2_attribute(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"][1]["columns"].pop()
        self.assertTrue(any("attribute" in e.lower() for e in validate_contract(self.lv2, contract)))

    def test_rejects_future_table(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"].append({"logicalEntity": "PARTNER_MARKETPLACE", "name": "partner_marketplace", "columns": [], "checks": [], "uniqueConstraints": [], "indexes": []})
        self.assertTrue(validate_contract(self.lv2, contract))

    def test_requires_exact_reconciliation_markers(self):
        contract = copy.deepcopy(self.contract)
        contract["reconciliationMarkers"].pop()
        self.assertTrue(any("reconciliation" in e.lower() for e in validate_contract(self.lv2, contract)))

    def test_rejects_open_policy_vocabulary_freeze(self):
        contract = copy.deepcopy(self.contract)
        contract["openPolicyFreezes"] = ["PAYMENT_CLAIM.status=APPROVED"]
        self.assertTrue(any("open" in e.lower() for e in validate_contract(self.lv2, contract)))

    def test_rejects_transaction_guard_emitted_as_check(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"][0]["checks"].append({"name": "ck_bad", "expression": "TRUE", "sourceKind": "transaction_guard"})
        self.assertTrue(any("transaction" in e.lower() for e in validate_contract(self.lv2, contract)))

    def test_rejects_non_frozen_lv1_or_lv2(self):
        contract = copy.deepcopy(self.contract)
        contract["source"]["lv2"]["status"] = "DRAFT_REVIEW"
        self.assertTrue(any("reviewed_frozen" in e.lower() for e in validate_contract(self.lv2, contract)))

    def test_rejects_malformed_column_shape(self):
        contract = copy.deepcopy(self.contract)
        del contract["tables"][0]["columns"][0]["nullable"]
        self.assertTrue(any("column" in e.lower() for e in validate_contract(self.lv2, contract)))

    def test_rejects_dangling_fk_reference(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"][0]["columns"][0]["references"] = {"table": "missing_table", "column": "missing_id", "onDelete": "NO ACTION"}
        self.assertTrue(any("reference" in e.lower() or "foreign" in e.lower() for e in validate_contract(self.lv2, contract)))

    def test_rejects_disallowed_type_family(self):
        contract = copy.deepcopy(self.contract)
        contract["tables"][0]["columns"][0]["type"] = "varchar(255)"
        self.assertTrue(any("type" in e.lower() for e in validate_contract(self.lv2, contract)))


if __name__ == "__main__":
    unittest.main()


class LV3RepositoryContractTests(unittest.TestCase):
    def test_repository_lv3_contract_matches_frozen_lv2(self):
        lv3_path = ROOT / "docs/database/erd/trooi-erd-lv3-physical.json"
        lv2 = load_lv2()
        lv3 = json.loads(lv3_path.read_text(encoding="utf-8"))
        errors = validate_contract(lv2, lv3)
        self.assertEqual([], errors)
        self.assertEqual(29, len(lv3["tables"]))
        self.assertEqual("REVIEWED_FROZEN", lv3["source"]["lv2"]["status"])
        upstream = [m for m in lv3["reconciliationMarkers"] if m["kind"] == "UPSTREAM_RECONCILE"]
        docs = [m for m in lv3["reconciliationMarkers"] if m["kind"] == "DOC_RECONCILE"]
        self.assertEqual(5, len(upstream))
        self.assertEqual(1, len(docs))
