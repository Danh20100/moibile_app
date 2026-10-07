# Isolated DemoPay payment vertical slice

Status: architecture APPROVED by the user on 2026-10-07, including independent creator/owner recipients and provider-preserving Android recovery. This written specification and its implementation plan are submitted for review; implementation is not started. The user explicitly authorized producing both documents in this turn.

Baseline: `integration/v1-current`, HEAD `492fefd14e2da6c47258cc844daba9d02ef13764`, clean tracked tree/index before document creation. Read against current provider adapters, coordinator, settlement, persistence ports/migrations, Android checkout/session hints/notification UI, core/HTTP and PostgreSQL tests.

## Purpose and authority

Demonstrate tenant checkout, browser confirmation, internally verified simulated evidence, atomic Payment creation, payer/owner notifications and authenticated Android refresh. DEMO is a separate non-production provider visibly called **TrọƠi DemoPay / MÔ PHỎNG / Thanh toán mô phỏng**. It moves no real money and proves application integration, not external-provider verification or production acceptance.

MoMo remains supported. Its request/signature bytes, strict create-response/IPN verification, classification/finality, omitted-provider default, fingerprints, 31-day replay, legacy blockers and empty 204 ACK remain unchanged. The intentional provider-independent change is primary-owner notification fan-out. SEPAY remains unavailable; its approved documents and B3/B4/B5 contracts are not edited, bypassed or resolved. SePay Task 3 remains IN PROGRESS / BLOCKED; Task 4 is not started.

## Architecture and sequence

Keep `PaymentGatewayService` responsible for principal authorization, amount validation, fingerprint conflicts, durable intent and safe checkout projection. Extend the explicit registry to MOMO → existing adapter, SEPAY → null, DEMO → configured `DemoGatewayAdapter` or null. No dynamic loading or new framework/dependency.

1. Authenticated tenant explicitly selects DEMO and POSTs checkout with UUID Idempotency-Key.
2. Coordinator persists immutable intent before producing the browser URL; adapter performs no network request.
3. Browser GET validates the signed capability before lookup, reads the exact DEMO checkout and renders escaped HTML. It performs no writes.
4. User submits a normal HTML POST confirmation form with the same capability.
5. DEMO verifier validates capability and stored immutable binding, then creates a nominal internal `VerifiedGatewayEvidence` instance with stage `DEMO_CONFIRMATION`.
6. `GatewaySettlementService.settle()` locks/rereads identity and terminal state, writes Payment/link, independently resolves recipients, then writes deduplicated notifications in that transaction.
7. Success page offers `trooi://payment/demo`. Android reads the remembered checkout using authenticated backend access; only SUCCEEDED plus resultingPaymentId can establish confirmation. Existing Payment-list corroboration in RentalViewModel stays intact.

The adapter neither inserts Payment nor chooses notification recipients. Public HTTP DTOs cannot construct trusted evidence. Generic DEMO notification methods throw unsupported/fail closed; there is no DEMO IPN protocol.

## Provider and configuration

Extend `GatewayProvider` to `MOMO | SEPAY | DEMO`, DTO enums and snapshot discrimination with `{ provider: 'DEMO'; requestSnapshot: null }`. Omitted provider is MOMO; explicit null/unknown is rejected. Existing-key fingerprint conflict is checked before availability. Existing MOMO fingerprint stays SHA256(JSON.stringify(['MOMO', tenancyId, amountVnd])); DEMO uses the same algorithm with 'DEMO'. Reuse the current whole-VND 1000–50000000 amount policy without changing MoMo errors.

Lazy `loadDemoConfig(env): DemoConfig | null` requires explicit `DEMO_PAYMENT_ENABLED=true`, NODE_ENV other than production, configured absolute base URL and a nonblank signing key of at least 32 UTF-8 bytes. Missing/invalid values return null and cannot break startup, manual payments or MoMo. Production always returns null even with valid DEMO variables. Endpoints also check availability on every request, including previously issued tokens.

`DEMO_PAYMENT_PUBLIC_BASE_URL` is an origin only: HTTPS generally; HTTP permitted only in non-production for localhost, 127.0.0.1, 10.0.2.2 or loopback ::1. Reject credentials, query, fragment, non-root path and whitespace; normalize trailing slash. Never derive origin from request/Host/forwarded headers/client input. Emulator example is nonsecret `http://10.0.2.2:3000`; backend routes include the existing `/api/v1` prefix. Android receives the same origin through a dedicated nonsecret backendDebug build setting, not through a backend response.

Add disabled/blank placeholders only to `.env.example`. Do not read/change local `.env`, provider credentials or secret-bearing Task 0 backup. Runtime supplies a fresh demo-only key outside tracked files; fixtures use explicitly nonsecret dummy bytes. DEMO is confined to the already-authorized disposable `trooi_test` dataset for rehearsal, never operational/prod data. Fixture setup and destructive test resets must assert that database before connecting/resetting.

## Capability and threat boundary

Use node:crypto HMAC-SHA256, base64url payload and signature, fixed version 1, provider DEMO, purpose `demo-confirm`, canonical UUID checkoutId, integer expiry and an immutable-intent SHA256 digest. Default lifetime is 15 minutes, an implementation default. Sign the exact encoded payload bytes; timing-safe compare equal-length MACs. Reject oversized tokens (default 4096 characters), invalid encoding/shape, duplicate/noncanonical fields, wrong version/provider/purpose, missing values, tampering and expiry (now >= exp) before database access.

Digest a fixed ordered tuple of checkout ID, tenancy, creator, amount, reference, provider, merchant scope, invoice, request ID, idempotency key, fingerprint, creation timestamp, NULL snapshot and NULL remote ID. Verifier recomputes it from the stored row; no client amount/reference/identity is trusted. DEMO scope is `demo:local`, invoice `TROOI-DEMO-<checkout UUID without dashes>`, request ID `DEMO-REQ-<same identity>`. Final verifier requires those exact values, DEMO, NULL snapshot/remote ID and intact durable key/fingerprint. Settlement rereads all binding fields under lock to prevent a verification/settlement race.

Capability is a bearer permission to simulate this checkout, not payer authentication or proof of money. Anyone possessing it can explicitly confirm; this is accepted only for the isolated demo. Never persist it in Android hints, terminal observations or notifications, or log tokens/keys/bearers. A captured token can replay the same permitted action until expiry; stable identity and settlement locking prevent a second Payment. Signing-key rotation invalidates prior capabilities. No general one-time-token table is needed.

HTML responses use Cache-Control: no-store, Referrer-Policy: no-referrer, X-Content-Type-Options: nosniff and CSP with no scripts/assets, form-action 'self', base-uri 'none', frame-ancestors 'none'. Escape text and attributes; no analytics, external resources or client JS. Confirmation uses POST, never GET. If Origin is present on POST it must match the configured origin; absent Origin does not replace token verification. Controller-owned generic errors omit token-bearing request.url. Add targeted DEMO-path redaction to the global exception filter for parser/other pre-controller failures, because controller catches cannot cover those failures; preserve all non-DEMO error paths/behavior. Test malformed/oversized JSON as well as controller exceptions for token leakage. Deployment/access logs must exclude/redact these paths before rehearsal; inability to establish that is a runtime blocker.

## HTTP, state and replay

Public routes relative to existing api/v1 prefix:

| Route | Behavior |
| --- | --- |
| GET finance/checkouts/demo/pay/:token | Validate, exact direct repository read, HTML only, zero mutation. Do not call findCheckout() stale-lease recovery. |
| POST finance/checkouts/demo/pay/:token/success | Validate, load, DEMO verify, shared settle, render success only after commit. No client success/amount DTO. |

No cancel endpoint is required: close/back/return links perform no mutation. Page shows amount/reference plus warning and **Xác nhận thanh toán**. Success says **Thanh toán đã được xác nhận** and **MÔ PHỎNG**, never invoice paid off. SUCCEEDED GET can show recorded state but cannot write or mint evidence.

Use raw controller HTML responses without altering global JSON envelopes or MoMo 204. Disabled DEMO yields generic 503; invalid/expired capability yields generic 403; absent exact checkout yields 404; immutable/terminal conflict yields 409; unexpected persistence failure yields generic 500. These are local DEMO responses, not SePay/MoMo policy. Do not echo tokens in any error path.

Lifecycle: INITIATED → CREATED (signed URL ready) → SUCCEEDED (verified POST plus atomic commit). Cancel/expired token leaves checkout unpaid; no timeout/return-based FAILED/SUCCEEDED transition. Existing FAILED rows never become successful. Valid duplicate success on SUCCEEDED uses the same settlement ID and validates the committed Payment before returning idempotently. Terminal checkout does not get another handoff.

Matching-key replay finds the same intent. A live CREATED capability returns that intent; an expired CREATED capability can be renewed only by authenticated same-key POST under the existing dispatch lock/lease, using the same immutable identities, no money write. Extend lease eligibility narrowly for DEMO CREATED refresh; never change MOMO predicates. Nonterminal interrupted local dispatch may resume safely because DEMO has no external acceptance ambiguity. Concurrent refresh/confirmation must not overwrite SUCCEEDED; existing locked lifecycle guard applies. Config loss prevents new/renewed URLs and confirmation but leaves history readable. GET never renews a URL.

## Finance and recipient semantics

Exactly one Payment at most per confirmed checkout: source GATEWAY, verification PROVIDER_VERIFIED, stable providerSettlementId `DEMO-<checkout UUID without dashes>`. Charge is receivable; Payment is not Allocation. No PaymentAllocation, DepositPaymentApplication, Receipt, deposit funding or automatic balance discharge. Existing global invoice and scoped provider transaction uniqueness remain intact.

After successful evidence verification, inside the same settlement transaction:

1. Evaluate creator using existing assertCanReadTenancy. ForbiddenException excludes only creator; it does not return from settlement, suppress owner or roll back Payment. Unexpected authorization infrastructure errors propagate and roll back.
2. Independently resolve tenancy → room → property → organization → primaryOwnerUserId using repositories already supplied in TransactionContext. Missing relation/blank owner is a data-integrity failure: throw generic settlement error and roll back; no silent omission/arbitrary fallback. Database constraints remain responsible for valid owner user identity.
3. Deduplicate eligible IDs and insert PAYMENT_CONFIRMED with messageOrPayloadReference `payment:<paymentId>`. If creator equals owner, one notification even when independently creator-ineligible but eligible as canonical owner.
4. Any notification insertion failure rolls back Payment, checkout and all earlier notifications. Valid retry can then commit one complete result. Already committed duplicate does not resend/backfill notifications.

This intentionally adds owner notification for MoMo too; its cryptographic/protocol/payment semantics do not change. Tests that formerly asserted creator-only fan-out must now assert the intentional eligible recipient set.

## Android recovery and presentation

Retain V1PaymentGateway, CheckoutFlow, RentalViewModel, BackendClient/BackendApi, DTO and route identities. Add explicit GatewayProvider model and defaulted optional provider parameter to create(). Omitted parameter still omits JSON provider and maps to MOMO; explicit choice serializes exact name.

CheckoutIntent and PendingCheckoutHint gain defaulted provider identity. Persist known MOMO/DEMO/SEPAY exactly. A legacy JSON hint with absent provider means MOMO; null/unknown/non-string provider fails closed, drops that invalid pending hint and cannot trigger automatic POST. Known SEPAY restores its identity but stays unavailable/nonlaunchable. Provider switching is an explicit new intent/new UUID key; retain the old durable checkout server-side and never mutate its provider. Reuse the same key only for same tenancy, normalized amount and provider.

Before persisting response ID, launching URL, replaying recovery or showing confirmation, verify response provider matches remembered provider. A mismatch fails closed and performs no launch/reinterpretation. Recovery can never replace a DEMO hint with MOMO default. Hints contain no capability/payUrl/auth secret.

DEMO selection appears only in backendDebug (`DEBUG && BACKEND_BACKED`), with explicit simulated copy; SEPAY not selectable. Add a dedicated DEMO origin build setting; allow exact scheme/host/effective port only for DEMO in backendDebug, with expected pay-route path and no URL credentials/fragment. Preserve existing MoMo launcher unchanged. Add /demo return recognition and manifest entry without changing /momo behavior; unknown provider/path goes to safe recovery. Return query parameters cannot choose checkout/provider or paid state. Use stored hint ID/key and authenticated GET/same-key POST as appropriate.

PAYMENT_CONFIRMED title is **Đã ghi nhận thanh toán**, body **Khoản thanh toán đã được xác nhận.** Apply only presentation in notification list/detail; preserve category/reference/sourceType/sourceId in models and navigation. No unrelated redesign.

## Migration and verification

Add `000006_demo_gateway` TS plus up/down SQL; leave 000001–000005 bytes untouched. Up replaces only provider/snapshot/transaction/stage CHECKs: DEMO snapshot must be NULL; DEMO non-null provider_trans_id must exactly equal its checkout-derived synthetic ID, not merely arbitrary DEMO-prefixed text. DEMO_CONFIRMATION is allowed only for DEMO; DEMO must not use misleading PAYMENT_IPN/RECONCILIATION stages. Existing MOMO/SEPAY expressions retain their previous acceptance. No new columns/tables, data rewrite, or change to SePay handoff trigger/remote-ID constraints. Down first refuses any DEMO rows, then restores exact 000005 constraints. Public table count stays 29.

Required evidence: named backend anchors from the user, including GET read-only, bad/expired token, return/cancel no-op, one Payment, duplicates, owner/creator independent eligibility/deduplication, rollback and zero financial side effects. Preserve all MoMo HMAC/client/result/core/HTTP/manual tests and SEPAY unavailable assertions. Add URL/HTML/header/error leak, expiry-renewal and response-race regressions. PostgreSQL tests require real guarded trooi_test, deterministic two-pool lock/barrier evidence, serial destructive suites, migration up/down/public29 and pre/post MoMo/SePay row equality. Unavailable DB is BLOCKED, never an in-memory substitute PASS.

Android gates: testBackendDebugUnitTest, assembleBackendDebug, lintBackendDebug; provider serialization/recovery/mismatch/selection and forged return tests. Existing backendDebug instrumentation path uses `-PtrooiInstrumentationBuildType=backendDebug :app:connectedBackendDebugAndroidTest`, only when an available device/environment supports it. Actual tenant/browser/owner rehearsal needs an isolated seeded dataset, authenticated principals, reachable backend and installed backendDebug; absent prerequisites are explicit BLOCKED/UNVERIFIED. No real provider requests are allowed, and no fixture response counts as live acceptance.

Final nonsecret docs/testing receipt records exact HEAD/build/commands/counts, migration, concurrency and owner evidence, per-gate PASS/FAIL/BLOCKED/UNVERIFIED and remaining limitations. Capture only redacted screenshots/artifacts outside repo; no tokens. Docs-only planning does not execute any gate or imply PASS.

## Non-goals and readiness

No SePay protocol/signing changes, reconciliation/resume/IPN policy, external calls, real-money simulation, production enablement, payment schema changes, allocation/receipt automation, redesign branch edits, plugin framework, local env access, push/merge/history rewrite or unrelated infrastructure startup.

Implementation-review readiness and rehearsal readiness are separate: backend/unit/build gates can be green with explicit PostgreSQL/device blockers, but that cannot be called complete demonstrated end-to-end acceptance or READY_TO_MERGE. Final review must identify every unexecuted gate. No silent waiver of required evidence.
