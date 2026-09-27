import json
import re
import unittest
from pathlib import Path

from scripts.database.lv3_render_sql import render_sql

ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = ROOT / "docs/database/erd/trooi-erd-lv3-physical.json"


def load_contract():
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def declared_sets(contract):
    checks = {c["name"] for t in contract["tables"] for c in t["checks"]}
    uniques = {u["name"] for t in contract["tables"] for u in t["uniqueConstraints"]}
    indexes = {i["name"] for t in contract["tables"] for i in t["indexes"]}
    return checks, uniques, indexes


def rendered_sets(sql):
    checks = set(re.findall(r"CONSTRAINT\s+(ck_[a-z0-9_]+)\s+CHECK", sql))
    uniques = set(re.findall(r"CONSTRAINT\s+(uq_[a-z0-9_]+)\s+UNIQUE\s*\(", sql))
    indexes = set(re.findall(r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)", sql))
    return checks, uniques, indexes


class LV3SQLRendererTests(unittest.TestCase):
    def setUp(self):
        self.contract = load_contract()
        self.sql = render_sql(self.contract)

    def test_emits_postgis_extension(self):
        self.assertIn("CREATE EXTENSION IF NOT EXISTS postgis;", self.sql)

    def test_emits_uuid_and_numeric_types(self):
        self.assertIn("payment_id uuid NOT NULL", self.sql)
        self.assertIn("amount numeric(18,2) NOT NULL", self.sql)
        self.assertIn("reading_value numeric(18,6) NOT NULL", self.sql)

    def test_emits_partial_current_listing_index(self):
        self.assertIn("uq_listings_room_current", self.sql)
        self.assertIn("WHERE status <> 'ARCHIVED'", self.sql)

    def test_emits_nonterminal_tenancy_index(self):
        self.assertIn("uq_tenancies_room_nonterminal", self.sql)

    def test_emits_active_primary_index(self):
        self.assertIn("uq_tenancy_participants_active_primary", self.sql)

    def test_emits_current_receipt_index(self):
        self.assertIn("uq_receipts_payment_current", self.sql)

    def test_emits_trust_report_xor_check(self):
        self.assertRegex(self.sql, r"CONSTRAINT ck_trust_reports_exactly_one_target CHECK")

    def test_emits_deposit_provenance_check(self):
        self.assertRegex(self.sql, r"CONSTRAINT ck_deposit_events_provenance CHECK")

    def test_does_not_emit_transaction_guard_as_check(self):
        for guard in self.contract["transactionGuards"]:
            self.assertNotRegex(self.sql, rf"CONSTRAINT\s+{re.escape(guard['id'])}\s+CHECK")

    def test_every_declared_constraint_appears_in_rendered_sql(self):
        self.assertEqual(declared_sets(self.contract), rendered_sets(self.sql))


if __name__ == "__main__":
    unittest.main()
