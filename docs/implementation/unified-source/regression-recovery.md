# Regression recovery inventory

Source refs: Profile `f35f79ed95a4e78f5a349d29c77c967a2c1f9588`, Payment `5230a0489209b84ef0dcf69acb67f69fce0efac5`, baseline `e5e6c6db6f4ceb0a3d68765bbef387e870babc94`. Residual x-reg/x-red/x-ctl HEADs are `55985da6453773be9a6a456e43f93bf01c8b333d`; their uncommitted test content was read without modifying them.

Categories: **1** already equivalent; **2** missing/valuable and recovered; **3** superseded; **4** obsolete architecture; **5** contradicts authoritative contract; **6** obsolete fixture/configuration dependency. Safety-gated live scripts are separately deferred, rather than counted as passed tests.

## Profile and candidate

| Source candidate | Category | Decision / target |
|---|---|---|
| profile-display-name-mvp.test.ts | 2 | Imported in phase 1: own-account writes, edited name across Google claims, invalid name rejection |
| profile-operator-navigation.contract.test.ts | 2 | Imported in phase 1 with standalone Settings callback/save-navigation regression |
| CitizenIdOcrTest.kt | 2 | Imported source extraction/invalid-date cases; phase 3 adds future birth date/numeric-name rejection |
| ProfilePresentationTest.kt | 2, 3 | Retained old coverage, migrated approved relationship labels and callbacks |
| ContractBoundaryTest.kt, CheckoutTransportTest.kt, CheckoutFlowTest.kt | 1, 3 | Candidate's validated JSON versions retain source cases and add runtime/isolation/restart guards; no inline-fixture downgrade |
| finance.behavior.test.ts, momo-client.test.ts, momo-hmac.test.ts, sepay-protocol.test.ts | 1, 3 | Equivalent fixture-backed cases plus candidate extensions retained |
| sepay-production.test.ts | 3, 5 | Candidate retains settled-detail requirement and rejects list-only evidence; old paid/list fallback expectations excluded |
| identity-persistence-alignment.test.ts | 3 | Candidate preserves explicit development-user allowlist and denied environments; unrestricted demo claims excluded |
| Source physical-backed identity contract case | 1 | Already relocated to tests/verification/identity-foundation-contract.test.ts; do not duplicate |
| manual-verification.workflow.test.ts, compreface-verifier.test.ts, private-s3-object-storage.test.ts | 1, 3 | Candidate fixture-backed component checks and extra fail-closed storage/authorization validation retained |
| application-wiring.integration.ts, demo-gateway-migration.integration.ts, migration-parity.integration.ts, payment-gateway-concurrency.integration.ts, payment-gateway.integration.ts | 1, 3 | Candidate named-prefix and validated-fixture versions preserve source case inventory |
| guards/rental-concurrency.integration.ts, guards/rental-guards.integration.ts and rental-test-support.ts | 1, 3 | Candidate deterministic lifecycle fixtures and invalid-time rollback checks retained; fresh isolated suite passes |
| Source removed LocalOcrDemoTest.kt and OCR assets | 1 | Candidate Debug-only demo and its validated assets preserved |
| Source removed sepay-flow.integration.ts, restart/freeze/cross-branch fixture suites and tests/support loaders | 1 | All candidate suites/loaders retained; source deletions not imported |
| Source old tests/core/fixtures signed provider data | 6 | Use current tests/fixtures/payment datasets, schemas and loaders |
| Source deleted Android JSON fixtures and JsonFixtures.kt | 1 | Candidate validated model/transport/checkout fixtures and loader retained |
| Source identity-test-architecture/governance and fixture-loader replacements | 3 | Candidate broader governance, seed-claim fixtures and finite-number validation retained |
| compreface-live.integration.test.ts, private-s3-live.integration.test.ts | Deferred | Existing foundation handoff excludes these until approved public-fixture provenance/isolation/failure cleanup; no production or live-provider PASS |
| New Profile transport success/failure and PostgreSQL reconnect tests | 2 | Actual authenticated PATCH + session projection, rejected write without GET, cross-account controller ownership and persistence after reconnect |
| New optional-property onboarding model tests | 2 | First asset optional; no publish without asset; incomplete identity/contact/agreements reject |

## Payment branch (current tests/android destinations)

| Original app/src source test | Category | Decision |
|---|---|---|
| core/auth/SessionRestoreTest.kt | 1, 3 | Existing source-scoped restart coverage retained |
| core/model/ContextSelectionTest.kt, ContractBoundaryTest.kt, FeatureProjectionsTest.kt, SourceNavigationTest.kt | 1, 3 | Existing relationship/navigation/finance projections and validated fixtures retained |
| core/network/BackendOpenApiAlignmentTest.kt, BackendRuntimeContractTest.kt, BackendTransportTest.kt | 1, 3 | Current transport/API/authentication coverage retained |
| core/network/CheckoutTransportTest.kt | 1 | Bearer and Idempotency-Key assertions retained; explicit SEPAY already correct in both resolved refs. The reported contradictory assertion is absent; no production/test workaround |
| features/RentalPresentationTest.kt | 2 | All five source money/date/status/notification cases migrated in phase 2 |
| features/RoomLedgerDesignRegressionTest.kt, SharedSurfaceNavigationTest.kt, TrustReportSubmissionTest.kt, UxWarningRegressionTest.kt, V1CompletionContractTest.kt | 1, 3 | Current UI/design/security/navigation contracts supersede old generic V1 assertions |
| features/auth/AuthValidationTest.kt, discovery/MapSelectionTest.kt, PublicDiscoveryFiltersTest.kt, organization/RoomOperationsTest.kt | 1, 3 | Existing tests retained; no unrelated domain port |
| features/tenancy/CheckoutFlowTest.kt | 1, 3 | Candidate same-obligation idempotency, recovery, return URI and origin isolation are authoritative |
| features/tenancy/DepositApplicationTest.kt | 2, 3 | Migrated actual extracted-panel isolation assertion; obsolete MoMo substring removed |
| NativeMapSmokeTest.kt, SessionHintsPersistenceTest.kt, SourceNavigationSmokeTest.kt | 1, 3 | Existing current-Debug equivalents retained |
| RentalFlowUiTest.kt — four Payment/notification cases | 2 | Migrated as PaymentIntegrationUiTest.kt; current primitives, IME, geometry, dark/large fonts, callbacks, confirmation and ended/busy states |
| RentalFlowUiTest.kt — two TenantRentalOverview cases | 4 | Legacy overview component not restored; current NativeTenantStatesTest/navigation coverage retained |
| RentalPresentationSmokeTest.kt — two cases | 2 | Phase 3 PaymentPresentationSmokeTest.kt: long reference at 200% font using TroOiInformationRow; notification copy/callback identity |
| PaymentManualSession.kt | 4, 6 | Interactive old-variant host excluded; all 13 historical manual criteria and original images/layouts/video/events archived, not claimed as fresh device acceptance |
| Confirmed same-amount primary callback expectation | 5 | Source presentation must not create duplicate obligation; refresh current record, changed amount retains new-intent path; migrated assertion follows baseline CheckoutFlowTest |

## Read-only residual worktree comparisons

Compared every modified/untracked file under tests to the target after normalizing CRLF/LF only. Source deletions are never imported automatically.

| Worktree | Equivalent files | Different files | Missing target files | Source deletions | Resolution |
|---|---:|---:|---:|---:|---|
| x-reg | 58 | 7 | 0 | 2 | All differences superseded; old fixture locations excluded |
| x-red | 20 | 4 | 0 | 0 | All differences superseded by broader candidate validation |
| x-ctl | 7 | 1 | 0 | 0 | Identity alignment superseded by fixture-backed guarded version |

x-reg differences: identity-persistence-alignment, sepay-production, payment-seed-claim JSON/schema, sepay-production-regression JSON/schema, sepay-regression-fixtures. Candidate has stricter demo ownership and settled transaction proof; no downgrade imported.

x-red differences: identity-persistence-alignment, fixture-loader, identity-test-architecture, identity-test-governance. Candidate adds seed-claim scenarios, finite-number validation and broader gateway-field governance.

x-ctl difference: identity-persistence-alignment. Candidate has deterministic validated data and explicit allowlist/denied-environment checks.

No valuable residual test file was missing. Phase 3 recovers the remaining source smoke tests and fills two actual Profile/OCR gaps without altering production code, fixtures, security contracts, migrations, or build variants.

## Evidence limits

Instrumentation cases compile under Debug, but execution, actual app restart/manual navigation, camera OCR, dark/large-font geometry, keyboard and accessibility acceptance require an exclusive device window. Unit assertions and archived source captures cannot substitute for that evidence. Live Google/provider/KYC E2E remains NOT VERIFIED. Final gate results are in ownership-and-acceptance.md.
