import copy
import hashlib
import json
import unittest
from pathlib import Path

from scripts.database.physical_contract_render_lucid import build_lucid_payload


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / "docs/database/v1/erd/physical.json"


class PhysicalContractLucidRendererTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
        cls.payload = build_lucid_payload(cls.contract)

    def test_payload_has_all_29_tables(self):
        self.assertEqual(29, len(self.payload["entities"]))
        self.assertEqual(
            {table["name"] for table in self.contract["tables"]},
            {entity["name"] for entity in self.payload["entities"]},
        )

    def test_every_column_keeps_exact_physical_type(self):
        expected = {
            (table["name"], column["name"]): column["type"]
            for table in self.contract["tables"]
            for column in table["columns"]
        }
        actual = {
            (entity["name"], attribute["name"]): attribute.get("type")
            for entity in self.payload["entities"]
            for attribute in entity["attributes"]
        }
        self.assertEqual(expected, actual)

    def test_pk_fk_markers_match_contract(self):
        expected = {}
        for table in self.contract["tables"]:
            for column in table["columns"]:
                marker = None
                if column.get("primaryKey"):
                    marker = "PK"
                elif column.get("references"):
                    marker = "FK"
                expected[(table["name"], column["name"])] = marker

        actual = {
            (entity["name"], attribute["name"]): attribute.get("key")
            for entity in self.payload["entities"]
            for attribute in entity["attributes"]
        }
        self.assertEqual(expected, actual)

    def test_every_physical_fk_becomes_relationship(self):
        expected = {
            (
                table["name"],
                column["name"],
                column["references"]["table"],
                column["references"]["column"],
            )
            for table in self.contract["tables"]
            for column in table["columns"]
            if column.get("references")
        }
        actual = {
            (
                relationship["from"],
                relationship["fromAttribute"],
                relationship["to"],
                relationship["toAttribute"],
            )
            for relationship in self.payload["relationships"]
        }
        self.assertEqual(expected, actual)

    def test_no_visual_only_entity_is_added(self):
        self.assertEqual(
            {table["name"] for table in self.contract["tables"]},
            {entity["id"] for entity in self.payload["entities"]},
        )

    def test_payload_is_deterministic(self):
        payload2 = build_lucid_payload(copy.deepcopy(self.contract))
        encoded1 = json.dumps(
            self.payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        encoded2 = json.dumps(
            payload2,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        self.assertEqual(
            hashlib.sha256(encoded1.encode()).hexdigest(),
            hashlib.sha256(encoded2.encode()).hexdigest(),
        )


class PhysicalContractLucidCardinalityFinalReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
        cls.payload = build_lucid_payload(cls.contract)
        cls.by_fk = {
            relationship["label"]: relationship
            for relationship in cls.payload["relationships"]
        }

    def test_globally_unique_fk_is_not_rendered_as_many(self):
        for fk_name in (
            "fk_deposits_tenancy",
            "fk_payments_replacement_payment",
            "fk_payment_claims_resulting_payment",
        ):
            self.assertEqual(
                "zeroOrOne",
                self.by_fk[fk_name]["fromCardinality"],
                fk_name,
            )

    def test_status_scoped_unique_fk_remains_historical_many(self):
        for fk_name in (
            "fk_listings_room",
            "fk_tenancies_room",
            "fk_receipts_payment",
        ):
            self.assertEqual(
                "zeroOrMore",
                self.by_fk[fk_name]["fromCardinality"],
                fk_name,
            )


if __name__ == "__main__":
    unittest.main()
