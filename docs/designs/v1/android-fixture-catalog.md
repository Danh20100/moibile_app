# Android Debug fixture catalog v1

Implementation status: **Round 4 implemented and verified**. Product/domain authority remains the canonical database/API contract; this document describes synthetic Android scenario inputs, never server authorization.

## Ownership and runtime

`app/src/debug/assets/fixtures/v1/` is the only immutable Mock scenario source. `FixtureCatalog.parse` and `FixtureDomains.kt` are its typed schema/mapper. Debug initializes Android assets through `initializeDebugFixtures`; JVM Debug tests load the identical directory as resources. `DemoData`, `DemoRentalGraph` and `ListingFixtures` are consumers/projection adapters. Release compiles no catalog/parser/assets and binds Backend-only.

| File | Content |
| --- | --- |
| `manifest.json` | Exact `schemaVersion=1`, `catalogId=trooi-debug-rental-v1`, `scenario=small-rental-lifecycle`; domain names must map to their exact basename, with no traversal. |
| `accounts.json` | Ordered login accounts, display/contact metadata and capability relationships. Sandbox email only. No global USER role. |
| `references.json` | Organization→Property→Room→Tenancy links, consumer aliases, external listing-owner identity/organization links. Alias names are fixture lookup keys, not domain roles. |
| `rentals.json` | Ordered assets and public points; symbolic bundled photo names; seeded owner room IDs and historical capacity entitlements. |
| `operations.json` | Authorized read projections, tenancy participants, notices, incident timelines, dashboard and rental history. Room/owner display facts and history photos resolve from the graph. |
| `finance.json` | `HISTORICAL_DEMO` financial read labels, scoped to existing Tenancy/Room/Organization. No transaction command, allocation, receipt issuance or verification token. |
| `conversations.json` | Existing room/user IDs and ordered seeded messages; senders must belong to the conversation. |

## Schema contract

The Kotlin parsers whitelist exact object fields. Missing/extra fields, invalid types/enums, duplicate entity IDs, dangling relationships, inconsistent asset ownership, invalid lifecycle/media/public-point combinations and finance scope fail during parsing. Lists preserve source ordering. Required strings are nonblank; asset display defaults such as empty service/availability/operational-coordinate strings must be supplied explicitly. Nullable model values use explicit JSON null. Timestamps use ISO Instant; display notice/event dates use strict `dd/MM/yyyy`; financial labels use nonnegative Vietnamese grouped integers plus `đ`. Runtime dashboard amounts are supplied projection values and are never calculated from seed payments.

Drawable bindings are restricted to bundled `rental_living`, `rental_bedroom`, `rental_kitchen`, `rental_studio`, `rental_balcony`. No Android resource integer is authored in JSON. Public Listing projection omits operational address/coordinates. Mutable saved portfolios/messages remain separate local preview state; source migration does not erase or overwrite them. Existing legacy saved-ID normalization and owner reconciliation remain intact.

Sandbox password, PIN hash and deterministic OTP stay in Debug-only hooks. They never validate a Backend write. `DemoPaymentClient` continues to require the isolated loopback server response, independently of historical catalog finance. Backend mode never falls back to Mock.

## Adding or revising a scenario

1. Edit the appropriate domain file, preserve stable IDs and deterministic list order, and update references for every relationship. Reuse existing entities instead of copying labels/photography into a second projection.
2. Extend the explicit typed parser only for fields required by real callers. A breaking shape requires a schema-version migration; version 1 deliberately supports one named scenario, with no selector or generic fallback.
3. Add rejection cases for new required fields/enums/relationships and projection assertions. The test-only `fixtures/parity-v1.json` records the pre-Round-4 read projection; deliberate scenario changes require explaining and reviewing any golden change, never blindly regenerating it to make tests pass.
4. Run Debug/Release builds, full Debug unit tests, Android asset parsing and mode isolation, then `app/scripts/verify_fixture_isolation.py` against the actual APKs. A source-set declaration alone does not prove packaging isolation.
5. Record executed checks and remaining limits in the dated round report. Logout clears the session, not saved portfolios/messages. Clear application storage only when explicitly choosing to discard local preview state; no destructive reset is required by catalog migration.

Evidence: Round 4 report, runtime architecture. The architecture viewer has Vietnamese authored content; fixed viewer controls and HTML language fall back to English. Artifact validation is 9/9 showcase, browser containment passes four desktop sizes, and Light/Dark screenshot inspection is recorded separately from app QA.
