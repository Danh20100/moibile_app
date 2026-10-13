# Account Verification — KYC MVP Foundation (implementation slice)

**Status:** Backend primitives under test. **Not an enabled production eKYC workflow.** Branch: `feature/account-verification`.

## Implemented in this branch

- `CompreFaceVerifier` accepts two JPEG byte buffers on the server, calls the documented `POST /api/v1/verification/verify` endpoint using `x-api-key`, extracts **exactly one face group and one match**, and returns similarity **as evidence only**. All malformed, unavailable, missing-key, and ambiguous responses fail closed. It does not approve identity.
- `PrivateS3ObjectStorageAdapter` implements the existing `ObjectStoragePort` for private object put/get using the AWS S3 SDK and existing opt-in object storage config; it does **not** create public URLs, ACLs, or upload endpoints. The default disabled factory returns the existing unavailable adapter. Caller still owns authorization, MIME/size limits, encryption/retention, checksum and durable metadata.
- `manual-verification.workflow.ts` is a **non-persistent**, revision-checked domain transition mechanism. A score cannot mark a User verified. Only an explicit decision by an authenticated, policy-authorized human reviewer can do so, **after the server validates permission**. No reviewer role/policy is invented in this slice.

## Already verified in isolated laboratory

An external, isolated Account Verification laboratory contains original CameraX + ML Kit + CompreFace upstream repos, a standalone Android adapter APK, a loopback-only Python relay, and repeatable public-fixture regression reports. That lab passed Android->ML Kit->relay->CompreFace with a face fixture, negative fixture, and camera capture of an empty scene; **camera capture containing an actual face is still unproven**. The relay does not belong in production.

## Latest verification evidence

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- Targeted tests: 11 PASS, 2 opt-in live tests SKIPPED when their lab variables are absent.
- Isolated live S3/MinIO adapter test: PASS — private bucket create, put/get roundtrip, missing key and anonymous GET denied.
- Isolated live CompreFace TypeScript adapter test: PASS — compares public same/different face fixtures against the real self-hosted API.
- The full `pnpm test` suite **did not pass** in this worktree because its runtime HTTP audit requires `DATABASE_URL`; no local application database was configured or changed. This is a test environment gate, not evidence of a regression.
- Lab containers and emulator were stopped after these validations. No real CCCD data was used.

## Hard gates still OPEN — do not circumvent

1. **G6 reviewer authority and policy:** which authenticated staff can inspect/reject/approve KYC, how conflicts are audited, and the assurance level required. `VERIFIED` must not be set by a similarity threshold.
2. **G5 media lifecycle and privacy:** user notice/consent, upload/finalize/checksum, exact allowed size/MIME, private access, retention/deletion, orphan cleanup and incident response. No identity images may be collected by production until these are agreed.
3. **Profile Database lane:** owns additive migration numbering, `media_objects`, `identity_verifications`, evidence relationships and durable atomic state transitions. Never introduce shadow in-memory identity storage or modify frozen migration files on this feature branch.
4. **Android runtime integration:** attach CameraX+ML Kit to actual authenticated API only after the above contract exists; use bounded decode to prevent OOM with high-resolution CCCD JPEGs. Live camera-positive test on an authorized device, OCR/QR, and document/manual review coverage remain.
5. **Auth:** the separately approved Google-first, optional-password and purpose-restricted Email OTP contract is independent from KYC. KYC success must never grant login/session access or bypass reauthentication.

## Test commands

From this worktree:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm exec tsx --test tests/integration/infrastructure/compreface-verifier.test.ts tests/integration/infrastructure/private-s3-object-storage.test.ts tests/core/manual-verification.workflow.test.ts
pnpm test
```

**Operational boundaries:** no production CompreFace API key in Android, no public CCCD storage, no live KYC HTTP routes, no approval shortcut, no migration, no push/merge in this implementation slice. The lab may be retested independently without touching TrọƠi data.

## Follow-up verification — 2026-10-13

- Rechecked Git on `feature/account-verification` at `079047bc986e71a2993959c0e7c22cc6834deaeb` with the existing uncommitted implementation preserved. `feature/profile-identity-foundation` was inspected read-only and not changed.
- Added a lightweight JPEG SOI/EOI envelope preflight to CompreFace input and a negative test proving malformed buffers never reach the network. **This is not complete JPEG validation or an approved G5 upload-size/MIME policy.** CompreFace is still the decoder; no image collection endpoint was enabled.
- Manual review authorization now requires an explicit boolean `true`; the test rejects a truthy non-boolean value. **This does not establish G6 reviewer authority or a durable DB transaction.**
- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `git diff --check`: PASS. Three targeted test files: **12 PASS, 0 FAIL** after these changes.
- Full `pnpm test` before follow-up edits: **352 PASS, 0 assertion failures, 4 CANCELLED, 2 opt-in SKIP**, exit 1. `tests/audit/low-level-architecture/runtime.access.test.ts` cannot start its HTTP suite because `DATABASE_URL` is absent. Do not interpret this as full-suite PASS or silently connect to a shared/production DB.
- Re-ran the isolated laboratory's `run-integration-regression.ps1`: **exit 0, component pipeline PASS, Android → ML Kit → relay → CompreFace six gates PASS** (public fixtures). Actual camera-positive face capture → whole chain remains NOT PROVEN. The lab script stopped only its own newly started resources.
- G5 private-media policy, G6 reviewer authority/assurance, and Profile-owned atomic persistence schema remain **OPEN**; Android endpoints, manual-review UI, production collection and authenticated app end-to-end remain **NOT IMPLEMENTED**.
- No commits, pushes, merges, existing migration edits, or changes to the Profile worktree were made during this follow-up.


## Four-source candidate continuation — 2026-10-13

Source provenance: Account Verification `f5bbebc51c1191be68fd0f59216bdb61ceb0abf2`, Integration `ec8d60e625b352f364724e6d199aac5fb7cea32a`, Payment Recovery `d1e16a034cd6ce40f197d2dec8d9a470338d14f9`, Identity `2d2ec1c17e0c6f8db0c152f93f5bfca53ed2ef20`. Earlier uncommitted/commit-free statements above describe historical work, not current source provenance.

The reviewed subset supplies importable, component-tested backend primitives. It deliberately adds no Nest module/provider registration, HTTP route, Android KYC caller or durable verified-state writer. Component integration is not operational KYC integration. The two original opt-in live scripts are deferred: they lack enforced isolated/public-fixture provenance, and the S3 script does not clean up its created objects/bucket on assertion failure. Their historical results are not fresh candidate acceptance evidence.

The private adapter now rejects remote plaintext HTTP and non-origin URLs before constructing or using an S3 client. HTTPS and loopback laboratory transport remain possible. This does not establish encryption-at-rest, authorization, approved size/MIME, decoding safety, retention/deletion or durable metadata. All original component assertions remain, with validated JSON inputs/expected outcomes and additional fail-closed security tests.

The separate four-table Identity addendum is **REVIEWED_FROZEN**, not merely proposed: owner decisions F-E1/F-E2/F-A1/F-C1/F-G2 and Account Verification `ACCEPTED_WITH_NON_SCHEMA_CONDITIONS` precede its manifest. Migration 000008 implements only those four tables. No media, verification, session, audit or consent schema is approved by that freeze. Those contracts retain the statuses in the Profile decision register and physical proposal.

G5/G6 and Auth Runtime Activation remain OPEN/BLOCKED. No source import or test result grants production collection/reviewer authority. Existing comparison timeouts/adapter retries are technical component configuration, not approved KYC assurance, recovery or privacy parameters.
