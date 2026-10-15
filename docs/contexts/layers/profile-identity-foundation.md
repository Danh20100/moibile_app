# Profile · Identity · Database vNext — active scope

**Status:** Google-first authentication model APPROVED; physical mechanisms and remaining security parameters under review. Documentation only; no new migration/runtime implementation.
**Branch:** `feature/profile-identity-foundation`, rebuilt on the clean Android + Backend + MinIO/Redis foundation `design/app-ui-redesign` at `ef1da3b` (2026-10-12). Prior integration-based branch preserved at `archive/profile-identity-foundation-integration-base-20261012`. No schema or runtime identity feature has been implemented here.

## Approved boundaries (12 October 2026 handoff)

- Native product: Android Kotlin/Jetpack Compose → NestJS → PostgreSQL/PostGIS. 3D marketing landing page is a separate repository.
- `USER` is immutable digital identity, not a scalar tenant/landlord role; capability is relationship-derived. Tenant participants can be unregistered (`user_id = NULL`).
- Profile main menu: **Xem hồ sơ**, **Cài đặt tài khoản**, **Quyền riêng tư & Pháp lý**, **Giới thiệu chủ nhà**, **Nhận trợ giúp**, **Đăng xuất**. Account deletion lives last within Settings.
- Only Google Sign-In initially registers an account; preserve existing `user_id` and resolve verified issuer aliases without rekeying. Google and optional Email + Password later authenticate the same User; no merge by matching email.
- Persist Google's verified email as primary login email and name as initial editable `display_name`; request input when name is missing. Google name is not legal name; later Google login cannot overwrite user edits.
- Optional password setup follows secure reauthentication after Google registration; store secure hashes only, preferably Argon2id. Email OTP serves email verification, recovery and sensitive operations, never independent registration/login. SMTP stays in Backend; no phone OTP.
- Private S3-compatible storage for user/avatar/KYC/listing/incident bytes, PostgreSQL metadata and Backend authorization; Redis for OTP proof/limits with fail-closed verification and optional performance cache.
- CCCD/KYC stack is a proposed CameraX + ML Kit + CompreFace 1:1 workflow, **not a guarantee of verified identity**.
- Terms/Privacy/FAQ content remains immutable versioned offline JSON-only Public Content Catalog, with version acceptance/consent data in Backend only.
- Support requests, deletion/data access, primary-email changes and KYC lifecycle require reviewed Backend/DB contracts before implementation.

**OPEN:** normalization/freshness/reuse mechanisms (MVP secondary login emails excluded; primary-change security invariant approved); password/reauth/recovery/OTP/session parameters; conflicting legacy alias remediation; remaining Profile visibility, privacy/retention, media, KYC, notification and support contracts. No silent merging, global roles, bank-details/social-graph scope or frozen-migration revisions are authorized.

## Working documents

1. [Actual DB/Auth gap audit](../../superpowers/audits/2026-10-12-profile-db-vnext-gap-audit.md)
2. [Proposed logical ERD, permissions and open policy gates](../../superpowers/specs/2026-10-12-profile-identity-vnext-logical-design.md)
3. [Phased migration/Backend/Android plan](../../superpowers/plans/2026-10-12-profile-identity-foundation-execution.md)
4. [Current Database v1 authority](../../database/v1/README.md)
5. [MinIO/Redis scaffold status](object-storage-cache-foundation.md)
6. [Approved decisions, G1–G7 and branch ownership](../../superpowers/specs/2026-10-12-profile-identity-decision-register.md)
7. [Physical proposal](../../superpowers/specs/2026-10-12-profile-identity-foundation-physical-proposal.md)

The original CHỐT scope and the owner's subsequent explicit Google-first update are recorded in the decision register. Canonical v3.7 remains frozen. Profile/Foundation owns durable contracts and future migrations; Account Verification owns auth/password/OTP/session runtime; Android integration owns the JSON catalog migration. No other worktree is edited here.

## Current source verification

The [foundation source review and policy gate](../../superpowers/audits/2026-10-12-profile-identity-foundation-source-review.md) records the initial baseline at HEAD `079047b`; its former authentication recommendations are superseded by the decision register. Profile-local migration tip is `000005_optional_sepay_gateway`; Payment Integration `55985da` already contains `000006_demo_gateway` and `000007_sepay_production`, so neither number is available to Profile; public content is JSON-only under the current task instruction. The approved authentication model does not authorize migration execution. Existing legal Markdown assets still require the planned JSON-only asset/parser/test migration.

Task 1 review (2026-10-13) adds explicit email invariants, proposed normalization/security parameters, four-table readiness/blocker classification and future test/repository handoff. No physical schema is frozen; see the decision register. Extended Profile/KYC/media/catalog gates do not all block the minimal identity slice.
