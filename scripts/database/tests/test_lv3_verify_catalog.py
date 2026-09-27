import copy
import json
import unittest
from pathlib import Path

from scripts.database.lv3_verify_catalog import expected_catalog, verify_catalog

ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = ROOT / "docs/database/erd/trooi-erd-lv3-physical.json"


def load_contract():
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


class LV3CatalogParityTests(unittest.TestCase):
    def setUp(self):
        self.contract = load_contract()
        self.catalog = expected_catalog(self.contract)

    def test_accepts_matching_catalog(self):
        self.assertEqual([], verify_catalog(self.contract, self.catalog))

    def test_rejects_missing_declared_check(self):
        catalog = copy.deepcopy(self.catalog)
        catalog["checks"].pop()
        self.assertTrue(any("check" in e.lower() for e in verify_catalog(self.contract, catalog)))

    def test_rejects_missing_declared_unique_or_index(self):
        catalog = copy.deepcopy(self.catalog)
        catalog["indexes"].pop()
        self.assertTrue(any("index" in e.lower() for e in verify_catalog(self.contract, catalog)))

    def test_rejects_unexpected_schema_constraint(self):
        catalog = copy.deepcopy(self.catalog)
        catalog["checks"].append("ck_unexpected")
        self.assertTrue(any("check" in e.lower() for e in verify_catalog(self.contract, catalog)))

    def test_rejects_fk_set_mismatch(self):
        catalog = copy.deepcopy(self.catalog)
        catalog["foreignKeys"].pop()
        self.assertTrue(any("foreign" in e.lower() or "fk" in e.lower() for e in verify_catalog(self.contract, catalog)))


if __name__ == "__main__":
    unittest.main()
