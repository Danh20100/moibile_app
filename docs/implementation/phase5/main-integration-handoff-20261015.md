# Integration -> main handoff (2026-10-15)

## Scope and evidence

- Source: `integration/discovery-ledger-ui-preview` @ `35ad67e`.
- Target: `main` (merge commit is created after this handoff).
- Previous target: `b3411fd`; the only merge conflict was `.gitignore`. Resolved with the source's secret/build-output exclusions, preserving the target's removal of the obsolete landing-page guard comment.
- The staged merge tree before the one test-fixture adjustment matched the integration source tree exactly. The test-only adjustment replaces inline SePay values with existing validated `S.values` fixture data. No SePay production logic or bank settlement amount was changed by this adjustment.
- Backend typecheck, NestJS build, ESLint: PASS.
- Payment tests + fixture governance: `17/17` PASS.
- Android `CheckoutIdentityTest`: PASS.
- Full default `pnpm test` on the main merge candidate: `501` tests; `494` passed, `3` failed, `4` cancelled. **Do not present this as a green full suite.**

## Remaining actions — Duy Anh

1. **Finance fixture governance:** `tests/verification/account-verification-foundation.test.ts` detects inline business data in `tests/core/finance.behavior.test.ts`. Move test data to schema-validated fixtures without changing financial behavior.
2. **Application restart fixture:** `tests/verification/application-restart-foundation.test.ts` expects distinct Owner and Tenant fixture principals, but the current values are undefined. Repair validated fixture binding and confirm allocated-balance comparison.
3. **Identity fixture governance:** `tests/verification/identity-test-architecture.test.ts` detects an inline business literal at `tests/integration/persistence/identity-vnext.integration.ts:246`.
4. **Runtime access audit environment:** `tests/audit/low-level-architecture/runtime.access.test.ts` requires a dedicated integration-test `DATABASE_URL`. Four runtime-audit cases cancelled without it. Use an appropriately migrated test DB, **not** the isolated real-money SePay database. Re-run `pnpm test` and the Android/full-stack smoke on the proper environment.
5. **Product/demo:** finish the remaining features and E2E demo scenarios; existing Listing wizard blocker remains separate until resolved and tested.

## Payment acceptance boundary

- The isolated SePay production bank-transfer smoke of **2,000 VND** used checkout `4a732deb-5183-426f-a125-373af0ad6158`.
- SePay REST observed one matching `CAPTURED` order, while its order-detail endpoint returned HTTP 404. A real, secret-authenticated SePay IPN matching the order, amount, bank-transfer method and transaction ID was cross-checked against REST.
- The corrected isolated runtime acknowledged a previously captured provider callback with HTTP 200; PostgreSQL stored checkout `SUCCEEDED` and one `PROVIDER_VERIFIED` Payment `00791baa-cf9a-4d17-ae10-678738bd13da`. Replaying the same callback did **not** create a second Payment.
- This is isolated finance E2E acceptance, **not** acceptance of a deployed production environment or the entire Android app. No additional live transfer is needed for these tests.
- Keep `.env` secrets, private merchant credentials and local SePay database out of Git. Do not expose the local demo login on public ngrok; production cutover requires separate review.

No feature branch, integration-agent worktree, running backend or database was reset as part of the main merge.
