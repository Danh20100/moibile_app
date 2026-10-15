# Profile / Identity / Database vNext — Source gap audit (2026-10-12)

**Status:** HISTORICAL SOURCE AUDIT at HEAD `079047b`; runtime observations retained. The subsequent [Google-first decision register](../specs/2026-10-12-profile-identity-decision-register.md) supersedes authentication recommendations and gate statuses. No migration/runtime implementation is claimed.
**Branch:** `feature/profile-identity-foundation`; rebuilt on `design/app-ui-redesign` at `ef1da3b`. Original audit and design draft were preserved in `archive/profile-identity-foundation-integration-base-20261012`.
**Inputs:** approved 2026-10-12 Profile/DB context handoff (the decisions marked CHỐT), repository Canonical v3.7, ERD v1 conceptual/logical/physical, SQL migrations `000001`–`000005`, NestJS identity source and MinIO/Redis scaffold. The handoff's table names are *proposals*, not frozen tables.

## Source of truth and freeze guard

- [Canonical v3.7](../../database/v1/canonical.md) → [Conceptual](../../database/v1/erd/conceptual.json) → [Logical](../../database/v1/erd/logical.json) → [Physical](../../database/v1/erd/physical.json) → migrations/runtime. None may be silently rewritten by Profile.
- Existing `USER` is the digital identity; no global Tenant/Landlord/Operator role. Capability is derived from Organization primary ownership and Tenancy/Participant relationships. `tenancy_participants.user_id` stays nullable.
- Existing `terms_acknowledgements` is about a TenancyTerms version, **not** app Terms/Privacy acceptance; `payments.verification` is about money, **not** Email or KYC verification.
- Branch `feature/profile-identity-foundation` currently has a **scaffold** for Redis and S3-compatible storage, not operational adapters. The Android redesign is now included in this branch's base, but Android UI is not evidence that these Backend migrations/APIs are implemented.

## Observed runtime and persistence gaps

| Capability | Confirmed on this branch | Missing / decision required |
| --- | --- | --- |
| User account | `users(user_id uuid PK)` in migration `000001` and Kysely `UsersTable` | Profile/contact fields, lifecycle and legal identity not persisted |
| Google Sign-In | `POST /identity-access/auth/google` validates provider token; `verifyGoogleIdToken` derives a stable UUID from `issuer + subject`; `ensureUser` writes user PK | No durable provider mapping or persisted Google name/avatar/email; never backfill from transient SessionContext |
| Session context | `GET /identity-access/me` resolves Organization owner and Tenancy Participant relationship and returns optional Google claims | No separately governed session/revocation or real reauthentication model proven |
| Profile API | `GET /identity-access/users/:id` exposes `UserReference {userId}` | No full Profile CRUD, access/field projection or avatar lifecycle |
| Email OTP | No Gmail sender or secure challenge persistence on reviewed HEAD | Approved use is verification/recovery/sensitive-operation proof only; parameters remain G1-O OPEN; no independent OTP registration/login |
| Optional password | No durable password credential in reviewed schema | Approved after Google registration + secure reauth; User-owned hash contract proposed; G1-P/R/S remain OPEN |
| Notification prefs | `notifications` delivers recipient/category/status/read timestamps | Per-User category/channel preference not persisted; security messages must not be disabled as marketing |
| Legal acceptance | `terms_acknowledgements` linked to tenancy terms | Account-level versioned Terms/Privacy acceptance absent |
| Data/consent/deletion | Canonical/User relationships persist | No user consent events, data-subject request lifecycle, account deletion workflow confirmed |
| Media | `incident_events.attachment_reference text` and `payment_claims.evidence_reference` are existing reference semantics | No general S3 object metadata table, ownership visibility/retention policy, or backend upload/download API |
| KYC | No verified `identity_verifications`/document-media table in inspected v1 baseline | Policy, state machine, document/selfie lifecycle, review threshold and audit remain open |
| Help/support | Static content strategy exists in approved context | User support ticket workflow not confirmed in Backend; help/legal Android Asset path is proposed and not verified in this branch |
| Redis | `RedisConfig`, `CachePort` and `NoopCacheAdapter` from adopted scaffold | No live Redis client or OTP store; **a no-op cache is unacceptable for OTP proof** |
| Object storage | `ObjectStorageConfig`, `ObjectStoragePort` and `UnavailableObjectStorageAdapter` from adopted scaffold; local Compose | No real S3 adapter, bucket bootstrap, private credential segregation or audited media authorization |

### Specific audit evidence

1. `database/migrations/sql/000001_initial_schema.up.sql`: 29 v1 tables, including users, organizations, tenancy_participants, terms_acknowledgements, notifications and incident_events; users contains only `user_id`.
2. `database/migrations/000001_initial_schema.ts` through `000005_optional_sepay_gateway.ts`: later baseline migrations are payment-gateway-related, not Profile/Media/KYC vNext migrations.
3. `src/integrations/google-identity/verify-token.ts` and `src/common/identity/deterministic-user-id.ts`: Google principal `userId` derives deterministically from provider issuer and subject using fixed namespace; treat this as a compatibility and account-linking invariant until a reviewed migration maps it to `auth_identities`.
4. `src/modules/identity-access/services/identity-access.service.ts` only calls `ensureUser` for Google auth and joins existing Organization/Tenancy relationships for session context.
5. `src/infrastructure/database/repositories/identity.repository.ts` inserts only user PK, and `src/infrastructure/database/schema.types.ts` contains no approved vNext Profile tables.
6. `compose.infrastructure.yml` runs opt-in loopback-only S3-compatible SILO/MinIO and ephemeral Redis, but adapters intentionally have no durable operational behavior. No bucket/public access is implied.

## Boundaries and priorities

- P0: Under the approved update, Email OTP is never standalone login/registration. Google/password must resolve to the same existing User; never infer ownership by email, rekey alias-derived IDs or automatically merge legacy conflicts.
- P0: Do **not** conflate email `verified_at`, identity review status, face comparison result and payment `verification`.
- P0: Redis is optional for *cache*; OTP verification must fail closed when its challenge/attempt store is unavailable. No plaintext OTP in database/logs, and no Android SMTP credentials.
- P0: Public Listing media and private incident/KYC evidence require different ownership and read policy. Storage credentials must stay server-side.
- P1: Do not overwrite v1 migration history or change tenancy/room/listing/financial invariants. Migrations must be additive and tested in an isolated DB.
- P1: Current frontend/Android UI, design prototypes and 2026-10-12 handoff are **scope**, not implementation attestations.

## Outputs of this gate

- [Logical design with ERD](../specs/2026-10-12-profile-identity-vnext-logical-design.md).
- [Sequenced migration/API/test plan](../plans/2026-10-12-profile-identity-foundation-execution.md).
- [Current branch scope entry](../../contexts/layers/profile-identity-foundation.md).

**Acceptance:** This audit records evidence versus missing capability. No migration, live DB, Android source, or production credentials were changed in this design-only commit. The Android UI is inherited unchanged from the branch base. Remaining OPEN decisions are tracked by G1–G7 in the decision register; approved Google-first product choices are not reopened.

## Current source verification

The [foundation source review and policy gate](../audits/2026-10-12-profile-identity-foundation-source-review.md) supersedes stale observations above for HEAD `079047b`. The actual migration tip is `000005_optional_sepay_gateway`; public content is JSON-only under the current task instruction. Authentication choices are now approved in the decision register; physical review and migration execution remain gated.

## Task 1 source findings — 2026-10-13 (read-only review)

Profile HEAD remains `079047b`, branch `feature/profile-identity-foundation`; preflight has 10 existing changed/untracked files, preserved before this review. Local migration tip `000005` is not a global available-number inventory: Payment Integration `integration/clean-ui-payment-recovery` at `55985da` contains `000006_demo_gateway.ts` and `000007_sepay_production.ts`, with their SQL. Profile must allocate neither number; Duy Anh owns Payment. Historical statements above describe the Profile baseline only.

`verifyGoogleIdToken` directly derives User UUID; both `authenticateWithGoogle` and `AuthGuard` consume it. Only the former calls `ensureUser`, which inserts only User PK. `getSessionContext` still projects transient provider claims. The verified identity types/parser drop `hd`, nonce and freshness claims, so proposed mailbox authority and secure interactive reauth cannot be asserted from current payloads. The Google client library performs verification, but these application metadata/lookup boundaries still need Account Verification changes after authorization.

Task 1 supplies single-current-primary-email/revision, immutable canonical-principal/legacy resolution, credential CAS and minimal Profile completion proposals in the logical/physical specs and register. EMAIL-01/EMAIL-02 are explicit owner invariants; normalization/security/completion/recycling candidates remain PROPOSED/OPEN. No new table is frozen and no additional session/event/history table is selected. Extended G2–G7 features are independent from the minimal identity schema. Fresh documentation/scope verification is recorded in the source review; historical runtime PASS counts are not current Task 1 results.
