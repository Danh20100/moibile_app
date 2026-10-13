# Payment persistence failure handoff — Duy Anh

Baseline: integration `55985da6453773be9a6a456e43f93bf01c8b333d` plus Profile's uncommitted Identity Foundation files, migration chain 000001–000008. Profile HEAD `079047bc986e71a2993959c0e7c22cc6834deaeb`. No Payment files changed. Release integration remains BLOCKED.

Reproduction: use a detached disposable integration checkout with the Profile file inventory overlaid, install with `pnpm install --frozen-lockfile`, and an isolated PostgreSQL/PostGIS database named `trooi_test` at loopback port 55433. Set `TEST_DATABASE_URL` privately; do not use a shared database. Run:

```powershell
pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/demo-gateway-migration.integration.ts tests/integration/persistence/migration-parity.integration.ts
```

Actual rerun: **15 tests, 7 PASS, 8 FAIL, 0 SKIP**, exit 1. Local evidence: `test-results/profile-foundation/stabilization/payment-handoff-repeat.log`. An earlier attempt had connection-termination errors (6 PASS/9 FAIL); it is retained separately in `payment-handoff.log` and is not used as evidence of an additional Payment defect. The stable rerun reproduces the eight Task 2.5 failures.

All paths below are under `tests/integration/persistence/`. Test definition and failing assertion line numbers are separate.

| File / test line | Exact test name | Assertion / expected / actual |
| --- | --- | --- |
| `demo-gateway-migration.integration.ts:61` | DEMO null snapshot without legacy blocker, exact transaction identity and provider stages are enforced; down refuses history before DDL | :103 `assert.rejects(runMigrations('down'), /Cannot roll back while DEMO checkout or history rows exist/)`; actual **Missing expected rejection**. |
| `demo-gateway-migration.integration.ts:111` | 000006 up and no-DEMO down/up preserve MOMO and SEPAY histories, payment links and exact prior constraints | :120 latest migration expected `000005_optional_sepay_gateway`; actual `000008_identity_foundation`. |
| `demo-gateway-migration.integration.ts:170` | production sepay snapshot is stored once, keeps its invoice, and blocks rollback | :173 latest expected `000007_sepay_production`; actual `000008_identity_foundation`. |
| `migration-parity.integration.ts:21` | optional_sepay_upgrade_preserves_momo_rows | :37 latest expected `000004_gateway_checkout_durability`; actual `000008_identity_foundation`. |
| `migration-parity.integration.ts:140` | provider_snapshot_mismatch_is_rejected; local_invoice_collision_rejected_before_handoff; remote_id_scopes_and_roles_are_distinct; sepay_down_refuses_existing_rows | :207 latest expected `000005_optional_sepay_gateway`; actual `000008_identity_foundation`. |
| `migration-parity.integration.ts:227` | initial migration matches the frozen physical catalog | :257 public table count expected **29**; actual **33**. |
| `migration-parity.integration.ts:309` | durability migration preserves legacy IDs/results and blocks unreconstructible replay | :321 migration history expected 000001–000003; actual 000001–000004. |
| `migration-parity.integration.ts:619` | gateway durability constraints remain at SQL level and public catalog stays 29 | :658 public table count expected **29**; actual **33**. |

The six migration-specific failures assume a fixed full-chain tip or a fixed number of down steps. Generic `down` now targets 000008, not Payment migration 000006; with empty Identity tables it can succeed while DEMO history remains. This does not demonstrate that 000006's guard failed. The two catalog failures apply a frozen-v1 total to the full additive schema.

Requested owner fix: isolate migration-specific tests at a named prefix/target (e.g. an `applyThrough(target)` harness), asserting the intended prefix history and up/down invariants. Do not depend on full-release latest migration or fixed relative down counts. Keep frozen v1's exact 29-table assertion on the v1-only baseline; full-chain assertions should compare the catalog to frozen-v1 plus approved addendum entity names. Do not modify frozen v1, hardcode a replacement total, or roll back populated Identity data to reach a Payment target. Business scenarios in affected owner tests should move to validated JSON fixtures under that lane's governance.

Acceptance: migration-specific 000004–000007 tests and full-chain 000001–000008 catalog tests both pass, then rerun the full persistence/release suite. Preserve Canonical v3.7, frozen Database v1 and `vnext.identity-foundation.1` structures/fingerprints, User UUIDs and ownership; do not skip or mark these failures expected. This handoff requests test baseline corrections, not changes to Payment runtime or historical migrations. No message has been sent on the owner's behalf. This document is the complete outbound message for Duy Anh; owner forwarding is required.
