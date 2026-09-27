import copy
import hashlib
import json
import unittest
from pathlib import Path

from scripts.database.lv3_render_lucid import build_lucid_payload


ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = ROOT / "docs/database/erd/trooi-erd-lv3-physical.json"


class LV3LucidRendererTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
        cls.payload = build_lucid_payload(cls.contract)

    def test_payload_has_all_29_tables(self):
        self.assertEqual(29, len(self.payload["entities"]))
        self.assertEqual(
            {t["name"] for t in self.contract["tables"]},
            {e["name"] for e in self.payload["entities"]},
        )

    def test_every_column_keeps_exact_physical_type(self):
        expected = {
            (t["name"], c["name"]): c["type"]
            for t in self.contract["tables"] for c in t["columns"]
        }
        actual = {
            (e["name"], a["name"]): a.get("type")
            for e in self.payload["entities"] for a in e["attributes"]
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
            (e["name"], a["name"]): a.get("key")
            for e in self.payload["entities"] for a in e["attributes"]
        }
        self.assertEqual(expected, actual)

    def test_every_physical_fk_becomes_relationship(self):
        expected = {
            (t["name"], c["name"], c["references"]["table"], c["references"]["column"])
            for t in self.contract["tables"] for c in t["columns"] if c.get("references")
        }
        actual = {
            (r["from"], r["fromAttribute"], r["to"], r["toAttribute"])
            for r in self.payload["relationships"]
        }
        self.assertEqual(expected, actual)
    def test_no_visual_only_entity_is_added(self):
        self.assertEqual(
            {t["name"] for t in self.contract["tables"]},
            {e["id"] for e in self.payload["entities"]},
        )

    def test_payload_is_deterministic(self):
        payload2 = build_lucid_payload(copy.deepcopy(self.contract))
        encoded1 = json.dumps(self.payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        encoded2 = json.dumps(payload2, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        self.assertEqual(hashlib.sha256(encoded1.encode()).hexdigest(), hashlib.sha256(encoded2.encode()).hexdigest())


if __name__ == "__main__":
    unittest.main()
