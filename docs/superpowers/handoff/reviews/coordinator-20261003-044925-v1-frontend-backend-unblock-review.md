---
review_of: docs/superpowers/handoff/coordinator-20261003-033324-v1-frontend-backend-unblock.md
reviewer: codex-integration-review
reviewed_sha: b6e9b38e6c8567e28e91c971b9f8246fcf19cc05
status: approved
---

# V1 frontend backend unblock integration review

## Scope and authority

- Feature head reviewed: `b6e9b38e6c8567e28e91c971b9f8246fcf19cc05`.
- Staging before merge: `2f67f7c0702c635e934dbbe3504aa2ec74da5f52`.
- Full staging-to-feature diff: seven expected implementation/handoff commits plus the separate route-contract fix `b6e9b38`; 51 changed files. No unexpected unrelated commits.
- Read the coordinator handoff and earlier backend-gap handoff; checked claims against `docs/database/v1/canonical.md`, `docs/database/v1/erd/README.md`, the versioned SQL schema, `docs/contexts/source-of-truth.md`, `docs/contexts/integration-contracts.md`, relevant V1 Search, Deposit, Dashboard, and Operational History backlogs, generated OpenAPI, runtime controllers/services/repositories, and tests.

## Findings

- CRITICAL: 0.
- IMPORTANT: 1 found and fixed. Manual Room operational state was exposed as `PATCH`, while the handoff's V1 command contract requires `POST /api/v1/rooms/{id}/operational-state`. Commit `b6e9b38` aligns the route, source assertion, generated OpenAPI, and bearer-security test. No IMPORTANT findings remain.
- MINOR: 0 blocking.
- NOTE: The current Dashboard and History projections use bounded per-Room/per-Tenancy queries. They are source-scoped and acceptable at the present MVP scale; revisit with production query measurements.

## Contract and security audit

- `GET /listings?roomId=` is bearer protected, authorizes the Room operator, returns only the current non-archived Listing, and returns 404 when absent. The database retains the one-current-Listing constraint.
- `GET /finance/payments?tenancyId=` authorizes the operator or historically linked participant; an unrelated user is denied. It reads Payment records directly and preserves Payment, Billing, Allocation, and Receipt distinctions.
- `GET /incidents/{id}/events` authorizes the source Incident and reads append-only events in deterministic order.
- Notification list/detail/read routes are protected. `sourceType` and `sourceId` are derived from `messageOrPayloadReference`, with no second business state.
- Dashboard checks Organization ownership and reads Room, Tenancy, and Incident sources. `outstandingReceivable` and `confirmedPaymentTotal` remain `null` pending authoritative finance semantics.
- Deposit commands and reads are Tenancy-scoped. One lifecycle per Tenancy is enforced by the schema. Requirement comes from versioned Terms; funding from confirmed Payment applications; settlement from actions/events. Settlement actor comes from the verified principal. Requirement changes while funds are held yield `requirementAmount: null`, `state: null`, and `blockedByOpenPolicy: true`; this case is covered by tests.
- Listing publish/unpublish/archive and Room/Tenancy lifecycle command provenance are server-derived. Manual Room state accepts only vacant, maintenance, or inactive and cannot impersonate activation or checkout. Terms and Notice bodies do not accept authoritative user IDs; the service checks the Terms/participant relationship and the controller checks operator/participant access.
- Former-rental history allows historically linked participants to read source-backed history without restoring operational writes. Incident association by Room and occupancy window remains a read projection. Room history is operator-only and composes source records/events without a duplicate history table.
- Public radius/price Search is truly public in runtime and OpenAPI, uses PostGIS `ST_DWithin` on `Listing.publicLocationProjection`, filters `PUBLISHED` and numeric price in SQL, and returns no exact operational Property location. The partial GiST published-location and price indexes remain available. Search does not mutate state.
- AuthGuard is global and obtains identity from verified Google tokens. Protected routes advertise bearer security. Generated command DTOs omit client-owned provenance IDs, and Deposit/Dashboard open-policy fields are nullable.

## Verification on clean feature head

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, zero warnings |
| `pnpm openapi:generate` | PASS; generated file matches reviewed source |
| `pnpm e2e:coverage` | PASS: 83 atomic flows, 198 cases, 24 backlog files, 8 frozen Notification use cases |
| `pnpm test` | PASS: 284/284, 0 failed |
| `pnpm test:conformance:database-v1` | PASS: 57/57 |
| `pnpm build` | PASS |
| `git diff --check` | PASS |
| `node --env-file=.env --import tsx --test tests/integration/persistence/postgis-search.integration.ts` | PASS: 1/1; `TEST_DATABASE_URL` verified as `localhost/trooi_test`, distinct from `localhost/trooi_dev` |

## Complexity audit (report only)

- `delete:` Isolated FUTURE Subscription and Onboarding runtime scaffolds are unused by `AppModule`; remove their 499 TypeScript lines when historical scaffold tests and documentation can be retired. `[src/modules/subscription, src/modules/onboarding]`
- `delete:` Unreferenced `UpdateRoomOperationalStateDto` duplicates the lifecycle DTO; remove it when tidying Room DTO exports. `[src/modules/room/dto/index.ts]`
- `net: -~510 lines, -0 deps possible.` These are pre-existing, non-blocking cleanup opportunities and were not changed in this integration fix.

## Remaining authority blockers and recommendation

Textual public-area/geocoder semantics, independent availability vocabulary, room/property type owner and vocabulary, nested Terms object schemas, Dashboard finance aggregation, and Deposit requirement changes after partial funding remain OPEN or blocked by authority. No FUTURE capability was promoted.

**Recommendation: approve the reviewed feature head for the explicit staging merge, followed by the full post-merge gate set and verified test-database PostGIS run.** Do not merge or modify `main`.
