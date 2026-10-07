# SePay Payment Gateway Sandbox — Task 0 contract receipt

Date: 2026-10-07, Asia/Saigon (UTC+07). Research began at 00:31:03 UTC; baseline/source revision recheck completed at 00:33:15 UTC. Scope: official documentation/source review and nonsecret local cryptographic checks only.

**Receipt status: fresh task review APPROVED; awaiting user review, with unresolved contract blockers. Sandbox acceptance: UNVERIFIED. Task 1: not started.** The user's latest approval authorizes the spec/plan and Task 0 only, with review before Task 1; it supersedes the drafts' PROPOSED headers. Those approved documents remain byte-for-byte unchanged. This receipt does not close their unknown contracts or authorize enabling any channel. No written provider clarification was supplied or obtained; questions below are prepared only, not sent.

## 1. Baseline, preservation and boundaries

Workspace `D:/Temp/TroOiIntegration-v1-current`; branch `integration/v1-current`; HEAD `48d6420a9ecebd204933b6ad6b73d374d8bdc812`, ahead of upstream by one commit, behind zero. Tracked working tree and index were clean. Initially untracked: `docs/superpowers/specs/2026-10-07-sepay-sandbox-design.md` and `docs/superpowers/plans/2026-10-07-sepay-sandbox.md`.

Worktree inventory, inspected read-only:

| Path | Revision | Branch |
| --- | --- | --- |
| `D:/Projects/TroOi-Project` | `e9d3883` | `design/app-ui-redesign` |
| `D:/Temp/TroOiIntegration-v1-current` | `48d6420` | `integration/v1-current` |
| `D:/Temp/TroOiRemainingGates` | `fe7631c` | detached |
| `D:/Temp/TroOiV1PaymentHardening` | `9b133e8` | `integration/v1-payment-hardening` |

Coordinator backup: `D:/Temp/TroOiSePayTask0-20261007-ee62492d`. It contains the two drafts, local `.env`, hash manifest, configuration-presence inventory, and empty staged/unstaged patches. **The backup includes credentials/configuration and is local-only; do not publish it.** Fresh hash comparison found all three original files unchanged. No reset/stash, source edit, migration execution, Android change, staging, commit, merge or push occurred. Only this receipt is a new repository deliverable; research/check artifacts are outside the repository.

Configuration was inventoried by presence only, without exposing values. All eight entries were absent from process configuration and nonempty local assignments: `SEPAY_ENABLED`, `SEPAY_ENVIRONMENT`, `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`, `SEPAY_IPN_SECRET_KEY`, `SEPAY_PUBLIC_BASE_URL`, `SEPAY_HANDOFF_SIGNING_KEY`, `TROOI_PAYMENT_PUBLIC_ORIGIN`. `.env copy.example` does not exist. No merchant account, dashboard, tunnel, form submission, Sandbox REST query or IPN delivery was exercised.

Migration inventory: `000001_initial_schema.ts`, `000002_prepare_initial_rollback.ts`, `000003_gateway_checkouts.ts`, `000004_gateway_checkout_durability.ts`; SQL up/down pairs exist for 000001, 000003 and 000004, with no 000005. Exact SHA256 inventory is in `official-contract-evidence/baseline-check-output.json` outside the repository. Read 000003/000004 up SQL: current constraints are MOMO-only, seven-key captureWallet snapshot, positive numeric transaction identity, global local-order uniqueness plus provider/partner scoping, immutable intent/first dispatch and user/key uniqueness. These require future conditional migration; none were changed or run. No live database/public-table-count verification is claimed.

MoMo strict HMAC, omitted-provider behavior, fingerprint/snapshot/ID compatibility, raw empty 204 ACK, finality and 31-day replay policy remain mandatory. Charge, Checkout, Payment, Allocation, Claim, Deposit application and Receipt remain distinct; no automatic allocation/application/Receipt is authorized. This documentation-only task changed none of their implementation. MoMo live signature/UAT blockers remain separate and UNVERIFIED; SePay evidence cannot substitute for MoMo acceptance.

## 2. Official sources and evidence strength

Each source was reread on 2026-10-07. Documentation pages have no exposed immutable revision; their dated tool-rendered extraction is archived, not represented as an official versioned release. All six required pages were successfully read through the web tool. The first Node.js-guide web read failed, then a subsequent read succeeded. Direct Python downloads of documentation returned 403; no raw documentation HTML snapshot is claimed. An extra `/vi/cong-thanh-toan/API` attempt returned 404 through the web tool and is not used as contract evidence.

| Reference | Primary source | What it establishes |
| --- | --- | --- |
| S1 | [Sandbox](https://developer.sepay.vn/vi/cong-thanh-toan/sandbox) | Separate simulated environment; checkout/API hosts; merchant REST Basic Auth; separate environment credentials. |
| S2 | [IPN](https://developer.sepay.vn/vi/cong-thanh-toan/IPN) | Public HTTPS POST, SECRET_KEY header mode, event names, 200 acknowledgement and examples. |
| S3 | [Quick start](https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau) | Browser form/return flow; a BANK_TRANSFER IPN example. |
| S4 | [Node.js guide](https://developer.sepay.vn/vi/cong-thanh-toan/sdk/nodejs) | One-time fields, order sensitivity, invoice described as unique; invoice-based SDK retrieval example. |
| S5 | [Order detail](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/chi-tiet-don-hang) | Remote-order-ID path, transaction-history example, named order statuses. |
| S6 | [Order list](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/danh-sach-don-hang) | Keyword search, pagination and filters; no documented exact-invoice uniqueness guarantee. |
| S7 | [SDK checkout source](https://github.com/sepayvn/sepay-pg-node/blob/62178220f36cda2f6657731ef182ecd84dd67e2f/src/checkout.ts) | Exact signer implementation and builder mutation. |
| S8 | [SDK order source](https://github.com/sepayvn/sepay-pg-node/blob/62178220f36cda2f6657731ef182ecd84dd67e2f/src/order.ts) | Invoice placed in detail path; query-shape differences from REST guide. |
| S9 | [SDK client source](https://github.com/sepayvn/sepay-pg-node/blob/62178220f36cda2f6657731ef182ecd84dd67e2f/src/client.ts) | Sandbox origins/versioned paths and static mutable environment URLs. |
| S10 | [SDK types](https://github.com/sepayvn/sepay-pg-node/blob/62178220f36cda2f6657731ef182ecd84dd67e2f/src/types.ts) | Current local SDK type declarations; not an exhaustive provider contract. |

Fresh `git ls-remote https://github.com/sepayvn/sepay-pg-node.git HEAD` returned the pinned revision `62178220f36cda2f6657731ef182ecd84dd67e2f`. Immutable raw sources downloaded successfully (HTTP 200):

| Artifact under external `official-contract-evidence/` | SHA256 |
| --- | --- |
| `sdk-checkout.ts` | `febbdfcb729d983555cb7f433b1a209bb55e603d0cd3807dd4049579cb2ab73e` |
| `sdk-order.ts` | `b2b55f2818ca98c7e0dc0007d0193474c7f03ffa1138c443035dff88df78aca6` |
| `sdk-client.ts` | `259cfcbe07e9eca2402821abdd2b06fd1528c6badd142410bf15bda7fb66fb9b` |
| `sdk-types.ts` | `7f69950f257fc8db25a2aec93248f1c8b4449aa666f173d8319748f12b5c7cf5` |

## 3. Contract register: resolved, partial and unresolved

RESOLVED means established by the cited official documentation/source only. PARTIAL means examples or source settle part of a question. UNRESOLVED means required behavior cannot be safely chosen. None of these classifications means Sandbox execution passed.

| Item | Status | Evidence / limit / consequence |
| --- | --- | --- |
| Provider scope | RESOLVED | Payment Gateway Sandbox; not Bank Webhooks/Bank Hub/VA. Local approved scope is one-time PURCHASE/BANK_TRANSFER/VND; other methods/production/refund/void are excluded. S1/S4. |
| Checkout target | RESOLVED | Browser POST form to `https://pay-sandbox.sepay.vn/v1/checkout/init`; no documented server JSON create-checkout-URL endpoint. S1/S3/S9. |
| Merchant read-back origin/auth | RESOLVED | `https://pgapi-sandbox.sepay.vn`, versioned `/v1` paths; Basic Auth `base64(merchant_id:secret_key)`, Sandbox credentials distinct from Production. S1/S9. |
| Credential relationship | PARTIAL | Merchant ID/secret pair signs forms and authenticates REST. IPN header uses a secret when auth type SECRET_KEY is configured. Whether its configured secret must equal the merchant secret or may be independent is not established. S1/S2/S7. Separate local config is a design decision, not provider proof. |
| Signed fields/order | RESOLVED at source level | S7 enumerates current object keys in insertion order, filters its allowlist, skips undefined, renders null as empty, joins raw `key=value` strings with commas and HMAC-SHA256/Base64 signs. Never alphabetically sort or iterate the allowlist to reorder. |
| Form serialization/escaping | PARTIAL | S4 requires matching field order; S7 signs raw values, not HTML/URL-escaped bytes. HTML escaping must preserve decoded submitted values. Provider parsing of commas, equals, ampersands, quotes, Unicode, empty/omitted fields and normalization is not fully specified; transport compatibility remains UNVERIFIED. |
| Builder order | RESOLVED at source level | S7 appends `merchant` when absent and defaults missing operation; existing key insertion positions persist. Caller order therefore matters. A guide's displayed JSON order is not proof of an independent canonical sort. |
| `custom_data` correlation | RESOLVED limitation | Accepted as a guide/type field but absent from S7 signing allowlist; cannot authenticate invoice/intent/amount. Local design uses immutable invoice and merchant-scoped REST evidence instead. |
| Invoice uniqueness/bounds | PARTIAL | S4 calls invoice unique. Uniqueness namespace, case sensitivity, allowed characters/length/retention and the 44-character planned invoice's acceptance are UNRESOLVED. Local `TROOI-SEPAY-<32 UUID hex>` is correlation, not a documented provider idempotency key. |
| Duplicate invoice/resume | UNRESOLVED | No reviewed source guarantees repeated POST returns the existing order, forbids a second order/charge, or defines behavior for pending/paid/cancelled/expired invoices or different amount/method/merchant. No safe same-invoice resume rule can be enabled. |
| Delayed/lost/late-paid race | UNRESOLVED | No provider guarantee covers lost accepted POST, temporarily absent lookup, delayed first submission and concurrent replay/late success. 404/empty list is not proof of no remote order. Keep local claim/invoice/first timestamps; no automatic resubmit/new invoice/reset. These are local requirements, not provider guarantees. |
| Detail lookup identifier | UNRESOLVED conflict | S5 specifies `/v1/order/detail/{order_id}` with a remote `SEPAY-...` ID; S4/S8 use invoice in the same detail path. Whether either/both work, precedence and alias collisions are unspecified. Never silently interchange local invoice and remote order ID. |
| Discovery before remote-ID binding | PARTIAL | S6 documents `/v1/order`, `q` keyword, page/per_page and meta total/has_more/current_page/page_count. Exact invoice filtering, merchant-scoped completeness, ordering/snapshot consistency, search latency and page limits are unspecified. Never choose first hit or infer absence from one page. |
| API filter discrepancies | UNRESOLVED conflict | S6 uses `end_created_at`, string sort and named statuses; S4/S8 use `to_created_at`, object sort and guide example COMPLETED. SDK query type omits page. Do not adopt SDK query shape/status as the verified REST contract. |
| Order identity mapping | PARTIAL | Examples distinguish `id`, `order_id` and `order_invoice_number`. API example `id` is numeric text, IPN example `id` is UUID text; `order_id` is another remote string. No documented cross-channel alias mapping. Bind remote ID only after exact merchant/invoice/amount verification. |
| Stable transaction identity | UNRESOLVED | S2/S3 IPN includes UUID-like transaction `id` and opaque `transaction_id`; S5 history example has numeric-text `id` and no `transaction_id`. Stability, uniqueness scope, API/IPN join and redelivery identity are unproven. Cannot select a safe settlement uniqueness key from these samples. |
| Order statuses | PARTIAL | S5/S6 define CAPTURED=paid, CANCELLED=cancelled, AUTHENTICATION_NOT_NEEDED=waiting. Exhaustiveness, transitions, bank-transfer expiry, late payment after cancellation and irreversible finality are unspecified. CAPTURED alone is insufficient under local settlement policy. |
| BANK_TRANSFER evidence | PARTIAL | S3 bank-transfer sample uses CAPTURED, APPROVED PAYMENT, VND, matching amounts and AUTHENTICATION_SUCCESSFUL; customer/agreement are null. S2/S5 CARD samples do not establish bank-transfer semantics. Full amount/status/transaction cardinality and partial/overpayment handling remain UNRESOLVED. |
| Amount/range | PARTIAL | Examples contain decimal-formatted order amount and integer-text transaction amount. No verified provider minimum/maximum, decimal rules or tolerance policy. Whole VND `[1000,50000000]` is local policy only; support throughout that range remains UNVERIFIED. No partial/extra/rounded amount becomes a Payment. |
| IPN transport/auth | RESOLVED documented shape | Public HTTPS POST JSON; `X-Secret-Key` with configured SECRET_KEY mode; events ORDER_PAID and TRANSACTION_VOID. This is not a bank-webhook HMAC contract. S2. Local timing-safe authentication-before-lookup is a required safeguard, not a claim about provider code. |
| IPN nested schema | PARTIAL conflict | S2 marks customer object required, while S3 BANK_TRANSFER has null customer/agreement. Required identity fields, nullable fields, alternate events and bank-transfer schema need confirmation before a strict DTO contract is pinned. |
| IPN successful ACK | PARTIAL | S2 requires HTTP 200 to acknowledge success and shows `{ "success": true }`; raw `200 {"success":true}` is the approved local success projection. Whether exact body is required, and duplicate delivery ACK/retry behavior, are not fully stated. |
| IPN failure/retry policy | UNRESOLVED | Matrix below is incomplete by official evidence. Sample 401 does not establish production failure policy; no documented timeout/retry schedule/maximum attempts/status-class/body rules. Entire dependent IPN mapping/channel remains disabled. |
| REST errors/visibility | UNRESOLVED | Reviewed detail/list docs show successful 200 examples, not complete errors, timeout/rate-limit/retry rules or consistency bounds. Query uncertainty cannot settle or authorize resume. Fixed local 5s timeout/no redirects are future design safeguards, not provider promises. |
| Origin topology | RESOLVED as approved local design | A=authenticated Android API (may be emulator/private); B=independently pinned public HTTPS backend with same dataset; C=fixed provider checkout/API origins above. B must equal backend SEPAY_PUBLIC_BASE_URL origin and Android PAYMENT_PUBLIC_ORIGIN; never derive trust from response/Host/proxy headers. Actual deployment identity is UNVERIFIED. |
| Local intent vs remote order | RESOLVED as approved local design | Local checkout UUID, immutable invoice and local request correlation precede provider form. CREATED is local readiness, not accepted remote order or Payment. Remote order/transaction identifiers are distinct namespaces; return URI is never payment evidence. Global local invoice/user-key constraints remain separate from scoped remote identity. |

## 4. Canonical nonsecret signer fixture

**SOURCE_ALGORITHM_VERIFIED only; SANDBOX_UNVERIFIED.** No actual merchant credential or provider request was used. Python standard-library HMAC, Node standard-library HMAC and the pinned SDK's extracted `signFields` method independently agreed. Additional checks passed: reverse order changes signature, wrong secret changes signature, custom_data does not change signature, undefined is omitted, null equals empty, and merchant-appended builder ordering produces its own different but internally matching signature.

This fixture deliberately supplies merchant first; it proves that explicit order, not every SDK builder's output order or server acceptance. The builder-appended variant is separately checked in the runnable artifact. Source signed allowlist: merchant, env, operation, payment_method, order_amount, currency, order_invoice_number, order_description, customer_id, agreement_id, agreement_name, agreement_type, agreement_payment_frequency, agreement_amount_per_payment, success_url, error_url, cancel_url, order_id. Out-of-scope agreement fields are not application feature authorization. S7.

Nonsecret key: `TASK0_NONSECRET_SECRET`. Ordered fields are preserved in `signer-fixture.json`; exact UTF-8 canonical string:

```text
merchant=TASK0_NONSECRET_MERCHANT,operation=PURCHASE,payment_method=BANK_TRANSFER,order_amount=1000,currency=VND,order_invoice_number=TROOI-SEPAY-00000000000040008000000000000001,order_description=Task0 fixture,success_url=https://merchant.example/api/v1/finance/checkouts/sepay/return/success,error_url=https://merchant.example/api/v1/finance/checkouts/sepay/return/error,cancel_url=https://merchant.example/api/v1/finance/checkouts/sepay/return/cancel
```

HMAC-SHA256 Base64: `SUbHvJLD4/My0NVFoz59z0FmJwlqQmclnJEADt4nxMo=`. No URI/HTML escaping occurs before this HMAC. Arbitrary delimiter/Unicode transport rules are not resolved by this ASCII-only check.

## 5. SepayIpnResponsePolicy evidence matrix

This is a contract-gap matrix, **not an executable response policy**. UNRESOLVED means there is no approved numeric failure status/body/retry mapping. Local internal safeguards in the last column are requirements independent of provider HTTP conventions. Every unresolved row blocks enabling this IPN channel; do not substitute 401/409/503, return a success ACK merely to suppress retries, or copy MoMo's 204 policy.

| Category | Verified provider HTTP status | Verified body | Verified retry/timeout semantics | Local invariant / dependency |
| --- | --- | --- | --- | --- |
| Authenticated fully corroborated success after commit | 200 documented | `{ "success": true }` is sample; exact enforcement PARTIAL | UNRESOLVED | Success ACK after atomic settlement, never before commit. |
| Verified duplicate of committed success | UNRESOLVED duplicate-specific; local spec intends 200 | Local spec intends raw `{"success":true}`; duplicate-specific provider rule UNRESOLVED | UNRESOLVED redelivery identity/suppression | Verify exact committed identity; no second Payment/link/notice. |
| Missing/wrong secret, unsupported auth type | 401 appears only in PHP example; complete contract UNRESOLVED | `{ "error": "Unauthorized" }` appears only in sample; contract UNRESOLVED | UNRESOLVED | Reject before invoice lookup/provider query/money writes. |
| Malformed JSON, oversized/invalid shape, missing/invalid nested fields | UNRESOLVED | UNRESOLVED | UNRESOLVED | Keep Trust parser/body limit; no money write. |
| Authenticated unknown invoice or wrong merchant/provider namespace | UNRESOLVED | UNRESOLVED | UNRESOLVED, including later retry after local/provider visibility | No remote binding/money write; do not guess not-found success. |
| Identity/amount/currency/method mismatch, conflicting aliases, ambiguous transactions | UNRESOLVED | UNRESOLVED | UNRESOLVED | Keep unresolved; no money write or evidence downgrade. |
| Conflicting terminal outcome or settlement ID belongs to another intent | UNRESOLVED | UNRESOLVED | UNRESOLVED | Immutable committed money/link; conflict cannot replace it. |
| Unsupported event (including TRANSACTION_VOID outside scope) or unknown status | UNRESOLVED | UNRESOLVED | UNRESOLVED | No automatic void/refund/failure conversion; keep finance unchanged. |
| Upstream timeout/network/404/5xx/rate limit/invalid response/visibility uncertainty | UNRESOLVED | UNRESOLVED | UNRESOLVED | Read outside DB lock; no Payment/resume permission from uncertain read. |
| Database error/transaction rollback/process interruption before commit | UNRESOLVED | UNRESOLVED | UNRESOLVED | Roll back Payment/link/notice together; no success acknowledgement for uncommitted work. |

S2 is evidence for the limited success/sample-auth cells only. No reviewed official source supplies the remaining matrix or replay delivery guarantees. Distinguish provider retry behavior from future local reconcile/coalescing rules; neither is implemented here.

## 6. Written clarification questions — prepared, not sent

1. For Sandbox one-time PURCHASE/BANK_TRANSFER/VND, confirm signed and submitted field order, encoding/normalization of Unicode/comma/equals/quotes/ampersand, null/empty/omitted fields, and whether the attached nonsecret fixture order and signature are accepted. Confirm invoice allowed characters, maximum/minimum length, case sensitivity, uniqueness namespace/retention and support for our 44-character invoice and whole-VND range 1000–50000000.
2. For duplicate invoice POSTs, define order/charge uniqueness for pending, paid, cancelled and expired invoices, conflicting amount/method and concurrent submissions. Give written assurance that explicit same-invoice resume cannot create a second payable order/charge, including when the first POST was accepted but response lost, its lookup is temporarily absent, it is delayed, or payment succeeds while read-back/resume/second submission runs. If no assurance exists, identify a safe recovery operation; otherwise our resume must remain disabled.
3. Does detail/{identifier} accept remote order_id, invoice, or both? Specify lookup precedence/alias collisions, merchant scope and not-found semantics. How can an invoice be discovered exactly before knowing remote order_id? Define q matching, all-page completeness/max limits/ordering, concurrent-page consistency and visibility delay; reconcile `page`, `end_created_at` vs `to_created_at`, string/object sort and COMPLETED vs documented order statuses.
4. Identify the immutable settlement transaction key and uniqueness namespace/retention. Map API history id to IPN transaction.id/transaction_id and map order.id/order_id across channels, with representative BANK_TRANSFER API/IPN examples and duplicate deliveries. Can several approved payments fund one invoice? Define partial/overpaid/extra transactions and exact amounts/status/authentication/expiry/cancellation/late-paid transitions; which outcomes are irreversible?
5. Confirm IPN SECRET_KEY configuration relationship to merchant REST/form secret, required/nullable BANK_TRANSFER nested fields (including customer=null), supported events, redelivery identity and event ordering. For every category in §5 give required HTTP status, exact response body/content type, whether redelivery occurs, delay/backoff/max attempts, request timeout, treatment of 2xx/4xx/5xx/body mismatch and manual redelivery availability. Confirm verified-duplicate ACK and database-rollback/upstream-uncertainty behavior without premature success ACK.

Written answers must be retained with date, provider author and scope, reviewed against this receipt and approved spec/plan before dependent behavior proceeds. Task 8 later checks actual transport compatibility; a Sandbox observation alone does not prove a universal no-second-charge or failure/retry guarantee.

## 7. Dependency gates and review handoff

| Blocker | Affected future behavior/tasks | Required resolution |
| --- | --- | --- |
| B1: invoice bounds, form encoding/ordering transport compatibility, provider amount support | Task 3 form validation/signing; Task 4 release; Task 8 acceptance | Written/official contract for unknown bounds/encoding; actual compatibility execution belongs to Task 8. Source signer check alone cannot activate forms. |
| B2: safe duplicate invoice/resume, lost/late-paid races | Task 4 resume/handoff recovery, Task 6 recovery UI, Task 8 recovery acceptance | Written guarantee or approved narrower recovery design; keep resume contract-gated/disabled meanwhile. |
| B3: detail identifier conflict, exact paginated discovery, visibility/REST errors | Task 3 client/read-back, Task 4 reconcile/resume/IPN, Task 8 | Confirmed lookup/correlation/error strategy; no assumed invoice-path fallback or first-hit search. |
| B4: stable transaction/order identity mapping and BANK_TRANSFER amount/status/finality | Task 1 concrete remote/settlement ID constraints as applicable; Tasks 3–5 verified settlement, Task 8 | Stable scoped join/key and exact supported outcomes; examples cannot justify settlement identity. Storage scaffolding may be reviewed separately but cannot settle this question. |
| B5: IPN failure/status/body/retry matrix plus auth/schema ambiguities | Task 3 auth/DTO, Task 4 HTTP policy/channel, Task 8 | Complete written verified response matrix and schema; keep entire affected IPN channel disabled. |
| B6: real Sandbox account/credentials, public HTTPS origin/backend-dataset alignment, authorized principal/device | Task 8 live acceptance | Provision/execute only when Task 8 authorized. All live results UNVERIFIED. Absence does not justify skipping deterministic Tasks 1–7. |

Task 0 can complete the evidence receipt while B1–B5 remain unresolved; it has **not resolved the required protocol guarantees**. No dependent implementation is authorized by this handoff: user review before Task 1 is the explicit stop boundary. Missing contract details require reviewed spec/plan revisions before their dependent code, but Task 0 does not rewrite the approved drafts. No READY_TO_MERGE or V1_ACCEPTANCE_COMPLETE claim is made.

## 8. Exact checks, outputs and external artifacts

External evidence root: `D:/Temp/TroOiSePayTask0-20261007-ee62492d/official-contract-evidence/`. `source-manifest.json` records exact URLs, UTC times, successful SDK byte counts/hashes and all direct-fetch errors. `web-official-extract.json` preserves the web-tool result for the six required URLs and extra failed API overview; SHA256 `0a369207ac4b271a97efb655f4a5078b152accb86ef03676044b9e9e1fdc0d51`. Source downloads ran at 00:31:53–00:31:56 UTC. The raw documentation 403 is an artifact retrieval limitation, not a merchant API/IPN failure observation.

Reproducible commands executed, from the workspace unless an absolute script is shown:

```powershell
git rev-parse HEAD
git branch --show-current
git status --short
git worktree list
git rev-list --left-right --count '@{upstream}...HEAD'
git diff --stat
git diff --cached --stat
git ls-remote https://github.com/sepayvn/sepay-pg-node.git HEAD
rg --files database/migrations
python --version
node --version
python 'D:/Temp/TroOiSePayTask0-20261007-ee62492d/fetch-official.py'
python 'D:/Temp/TroOiSePayTask0-20261007-ee62492d/official-contract-evidence/signer-check.py'
python 'D:/Temp/TroOiSePayTask0-20261007-ee62492d/official-contract-evidence/baseline-check.py'
```

`fetch-official.py` contains every exact documentation/immutable-source GET URL, no credentials. It accesses documentation and GitHub only. `baseline-check.py` captures command timestamps/stdout, all migration hashes, backup equality and `.env copy.example` absence. Python `3.14.7`, Node `v24.19.0`. `signer-fixture.json` SHA256 `841b22d0d6b4f80cc3c6fcfac62ec89e752f1ea2e9f0a0ea3f1d7988bfc68ac8`; `signer-check.py` and `signer-check-output.txt` preserve the runnable independent check and output. The check exits 0 with:

```text
PASS: Python HMAC, Node HMAC and pinned SDK signFields agree; order/custom_data/undefined/null/wrong-secret and merchant-appended builder checks pass. Sandbox UNVERIFIED.
```

No backend/Android/database test suite was run for this receipt-only change; no acceptance test was skipped and relabeled PASS. Final preservation/source recheck at 00:35:55–00:35:56 UTC passed: HEAD unchanged, index/tracked diffs empty, all three backup comparisons true, migration hashes unchanged and SDK HEAD still pinned. `git diff --check` and `git diff --no-index --check -- NUL docs/testing/sepay-gateway-contract-20261007.md` reported no whitespace errors; Git emitted only its expected LF-to-CRLF warning. Status contained only the two original untracked drafts and this new receipt. Commit boundary remains pending explicit Task 0 review; no commit was created.

Fresh Task 0 reviewer approved spec compliance and task quality with no remaining findings: six official Gateway pages, artifact hashes, independent signer reproduction, unchanged HEAD/tracked/index and original-file preservation were rechecked. Coordinator corrected the example filename to `.env copy.example` and reran baseline verification at 00:36:57–00:36:59 UTC, exit 0. Receipt approval is not contract closure: B1–B5 remain BLOCKED, B6/Sandbox remains UNVERIFIED, and user review before Task 1 is still required.
