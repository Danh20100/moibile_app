# Phase 4 — Selective Messaging integration

## Scope and provenance

Target: `integration/unified-source-candidate`, worktree `D:/Projects/.worktrees/TroOi-Project/integration-unified-source-candidate`.
Starting HEAD: `8606a27db87adaeb13ecc5f69db9ab66692a1aae`.
Source: local `feature/messages-fullstack-mvp` at `c3929adc74f223c58d12d2dc0194155964f22506`, inspected read-only in its existing worktree.
Common ancestor: `239e0e82b39ed0d62237dab9a07cc76a316f482e`.
Preflight confirmed both pinned HEADs and clean target/source trees, one target-exclusive commit, four source-exclusive commits and zero overlapping changed paths. Existing source dirt in other protected worktrees was captured and preserved. No concurrent target writer was identified.

Complete source diff, branch/ref inventory, protected status/diff/untracked SHA256 snapshots and command logs are local ignored artifacts under `test-results/phase4-messaging/`. These are execution evidence, not committed generated assets.

Four reviewed source commits were cherry-picked with `-x`, without conflicts:

| Original source | Unified commit | Responsibility |
|---|---|---|
| `49a77f3e31fa6517c9478d7cc8b1451326923aba` | `4e330d24252a647cace6d103f2ab279882ac3974` | Durable authorized Backend, PostgreSQL, private attachments |
| `426c69b6a50bfe87f28e44526e9fc468020ae533` | `dc2df6fee0366a2a83044b50dd0816bee1bbc4ea` | Existing Android architecture connected to Messages |
| `d87feaf15c93fdea662f5fc59ffd55e0e49cf552` | `e6635b9be2cd4d1526dc5ff6ab61ef0bc4e943e5` | Request-scoped account binding, read recovery, durable volumes |
| `c3929adc74f223c58d12d2dc0194155964f22506` | `21e9a3a68866a229abf28b984e272166a08b33b1` | Cross-account HTTP/Android regressions and setup |

Compatibility/security corrections and final validation are separate focused integration commits; final SHA and file count are recorded in the handoff. No merge, push, PR, main/source mutation, worktree registration change or frozen schema rewrite occurred.

## Source ownership and feature reconciliation

| Domain | Source ref | Target files | Current implementation | Changes retained | Conflicts / resolution | Fresh evidence |
|---|---|---|---|---|---|---|
| Messaging Backend | 49a77f3, d87feaf | src/modules/messaging/*, app.module, HTTP parser | Existing Nest/global AuthGuard/response envelope | Inquiry/Tenancy open-or-reuse, own list/history, text/JPEG send, private retrieval, read state | Add module to existing graph; server-only sender and membership; no separate auth client | HTTP A/B/C, unit/validation, Backend gates |
| Messaging DB | 49a77f3 | database/migrations/000009*, schema.types | Frozen 000001–000008 | Conversations, participants, messages, attachment metadata, watermark, indexes/FKs, immutable history | Additive 000009 only; Identity tests retain exact named 000008 boundary | Fresh nine-migration chain, down/up, 81 persistence tests |
| Private storage | 49a77f3, d87feaf | object-storage port, private-S3 adapter, compose.messaging.yml, env example, init script | Existing private storage abstraction | Opaque Messaging keys, authenticated bytes, best-effort orphan cleanup, private durable local volumes | Optional deletion extension preserves existing callers; validate real JPEG content before upload | Real MinIO round-trip, anonymous/outsider denial, upload compensation |
| Android Messages | 426c69b, d87feaf | BackendApi/Client/repository, DTO/model, ViewModel/App, MessagesScreen/MessageImages | Current Kotlin/Compose runtime and navigation | Gallery/camera thumbnail, preview/private retrieval, errors/retry/draft retention, read/unread, visible/resume refresh, detail hides bottom nav | House TroOi buttons replace raw text/action buttons; pin token; generation guards; immutable history union prevents stale refresh hiding acknowledged send | 216 JVM tests, APKs, lint/architecture/isolation; device execution blocked |
| Contextual navigation | Unified authoritative Inquiry/Tenancy APIs | InquiryComposer, TenantScreens/Flow, Operator/RentalWorkspace, repository/VM/App | Existing createInquiry already returns durable ID; details hold authorized IDs | Nhắn tin after Inquiry acknowledgement, Operator Inquiry detail, Tenant/Operator Tenancy detail | Preserve returned Inquiry/conversation IDs and select existing Messages detail; UUID entry Debug-only; no directory or fabricated relation | ID-preservation and delayed-refresh JVM regressions; instrumentation compile |
| Identity/Profile/Operator/Payment | Unified 8606a27 and earlier integrations | Existing production modules/screens, foundation freeze, current tests | Phase 1–3 implementation | Own-profile persistence/name preservation, six Profile roots, OCR three-step onboarding UI; Payment backend truth, auth/idempotency, bank-transfer UX | No production KYC/onboarding/reauth/resolver activation; no financial behavior rewrite | Full Backend/persistence/JVM regressions; frozen byte fingerprints; APK isolation |

## Corrections and decisions

1. Source JPEG validation accepted a six-byte signature and a two-million-byte zero buffer. A regression test reproduced this before changing production. `jpeg-js@0.4.4` now decodes content strictly before upload, with a 16-megapixel/128-MiB decode ceiling in addition to five-image/two-million-byte limits. These are defensive decoder resource bounds; Android already prepares images at a 1280px longest edge. Original bytes remain stored and retrieved, without public URLs. Source HTTP's malformed progressive fixture was replaced by a real encoded JPEG. Exact maximum-byte acceptance and overflow rejection are tested. The portable dependency avoids writing a homegrown JPEG parser; [decoder options](https://github.com/jpeg-js/jpeg-js#decode-options) document strictness and allocation bounds.
2. The ordinary journey uses IDs already returned by the server. Successful open retains the authoritative conversation ID, refreshes the existing Messages state and selects detail; the hint is consumed so polling/back navigation does not reopen it. Optional callback placement preserves existing positional instrumentation callers.
3. Account-switch protection from d87feaf remains intact: a captured credential is passed through send, mismatch rejects dispatch, request authorization is bound to that captured token and session-generation checks reject stale UI results. No draft is sent under a newly switched account.
4. A refresh initiated before send could replace the cache/UI with an older history after send succeeded. Cache publication/session clear are synchronized; immutable server messages are retained by ID and chronological order at repository and ViewModel transitions. Delayed-refresh regression verifies acknowledged send survives, and duplicate acknowledgement does not duplicate history.
5. Identity freeze tests previously asserted that the entire migration inventory ended at 000008. The failure was reproduced; their helper now copies the actual exact eight-migration prefix into ignored target-local test artifacts. The frozen source migration/SQL/specs are untouched. Full-chain 000009 validation runs separately; missing predecessor and populated Identity rollback refusal remain tested.
6. Source setup claimed one Google login created verified identity bindings. Current unified Google authentication ensures User but does not populate `auth_identities`; Messaging correctly requires those durable bindings. Documentation is corrected. The explicitly isolated HTTP verifier seeds test bindings; this does not activate or prove production identity resolution. New production conversations remain fail-closed until approved identity resolver integration.
7. Standards/spec reviews found no additional authorization leak. Historical tenancy membership is the source's authorized snapshot model, including former participants; unrelated accounts remain denied. A lower read-watermark write can race a newer read; this is a known read-state correctness limitation, not an access bypass.

## Migration and isolated infrastructure

Inventory is exactly 000001 initial schema, 000002 initial rollback preparation, 000003 gateway checkouts, 000004 checkout durability, 000005 optional SePay, 000006 demo gateway, 000007 production SePay, 000008 frozen Identity Foundation, and 000009 Messaging. Consult actual migration filenames for exact names. No duplicate/recreated Identity tables.

Docker Desktop was initially stopped, then started successfully (server 29.8.2). Existing source Compose containers/projects were not used or modified. `docker compose -p trooi-unified-messaging-phase4 -f compose.messaging.yml --profile messaging up -d` created a separate project with private project-prefixed volumes, PostgreSQL loopback 55447 and MinIO API/console 9047/9048. The committed example has explicitly local fixture credentials, never production secrets. The source bucket initialization script remains available; the HTTP test creates its own private uniquely named test bucket.

Messaging HTTP uses `MESSAGING_TEST_DATABASE_URL=postgres://messaging_test:local-messaging-test-only@127.0.0.1:55447/messaging_test`. A separate empty `messaging_phase4_rollback` database in that owned PostgreSQL server proved fresh up through 000009, down of 000009 only, Identity tables/history retained at eight migrations, then reapplication. No shared/production database was reset. Earlier integration-owned test containers were restarted for regressions: port 55433 (schema-resetting persistence tests) and distinct port 55439 (runtime HTTP audit), both `trooi_test`. They are kept isolated from Messaging and each other. At handoff, only integration-owned test containers are stopped; project volumes/data are retained and source/unrelated Compose projects are untouched.

## Fresh unified test matrix

Commands use Java 21, installed Android SDK and local Python. Each final successful command has exit status 0. Earlier source evidence is historical and is not counted below.

| Gate | Command | Passed | Failed | Skipped | Blocked |
|---|---|---:|---:|---:|---|
| Backend typecheck | pnpm typecheck | 1 gate | 0 | 0 | — |
| Backend lint | pnpm lint | 1 gate | 0 | 0 | — |
| Backend unit/contracts/runtime HTTP | pnpm test (isolated runtime DATABASE_URL) | 464 tests | 0 | 0 | — |
| Backend build | pnpm build | 1 gate | 0 | 0 | — |
| Messaging private cross-account HTTP | pnpm exec tsx --test tests/integration/messaging.integration.ts | 1 test with multiple functional assertions | 0 | 0 | — |
| Persistence/Identity/Payment/migration parity | pnpm exec tsx --test --test-concurrency=1 [all persistence integration files] | 81 tests | 0 | 0 | — |
| Fresh 000001–000009 | pnpm db:migrate against empty owned rollback database | 9 migrations | 0 | 0 | — |
| 000009 rollback/reapply | pnpm db:migrate:down; assert history/table boundary; pnpm db:migrate | 1 down + 1 up | 0 | 0 | — |
| Android JVM | gradlew.bat :app:testDebugUnitTest | 216 tests | 0 | 0 | — |
| Android Debug | gradlew.bat :app:assembleDebug | 1 APK | 0 | 0 | — |
| Android Release | gradlew.bat :app:assembleRelease | 1 unsigned APK | 0 | 0 | Production signing/configuration acceptance |
| Instrumentation compile | gradlew.bat :app:assembleDebugAndroidTest | 1 APK | 0 | 0 | Device execution below |
| Android lint | gradlew.bat :app:lintDebug | 0 errors; 61 warnings, 2 hints | 0 | 0 | — |
| Current architecture | python app/scripts/verify_frontend_architecture.py | 1 gate | 0 | 0 | — |
| APK fixture isolation | python app/scripts/verify_fixture_isolation.py [Debug APK] [Release unsigned APK] | 7 exact Debug assets; 53 excluded Release sentinels | 0 | 0 | — |
| Instrumentation/device UI | No exclusive device window confirmed | 0 | 0 | 0 | Execution, camera/gallery, dark/large-font/keyboard/TalkBack acceptance |
| Live Google/SePay | No approved live-provider run | 0 | 0 | 0 | Live Google plus resolver activation; existing SePay/reauth gates |

Initial broad Backend run failed one public listing HTTP test because the runtime test database credentials were wrong; corrected local credentials and initialized independent runtime DB gave a fresh green rerun. Initial Android instrumentation compile failed because a new optional callback preceded a positional required callback; moved it after existing parameters, then rebuilt. Neither failure was hidden or addressed by weakening assertions. JPEG source-fixture failure was corrected as described above. No Gradle artifact-lock failure occurred; target Gradle builds were serial.

## Functional and UI acceptance

The real Nest HTTP harness with isolated test Google verifier proves A and B open the same authorized Inquiry conversation; A's text/JPEG is persisted; B reads correct sender/content and privately retrieves the original bytes; B replies and A receives it; independent DB/service reconnection reads history. C cannot open, list, read, send, mark read or retrieve the image; anonymous MinIO retrieval is 403. Spoofed sender fields are rejected. Upload failure returns 503 without a successful message and removes the first orphan object best-effort. Verified historical tenancy context is allowed and outsider access rejected. Read state is acknowledged by Backend. Transport/JVM tests prove account-switch mismatch blocks send, Bearer attachment retrieval, bounded response/no hidden retry, authoritative open ID and delayed-refresh retention.

Source-level native audit retained Material theme colors/sp typography, labelled icon controls, IME padding, lazy history, bounded off-main image work, failure draft retention and existing root/detail navigation. TroOi house buttons enforce action sizing. No screenshot/TalkBack/camera/keyboard/dark-mode/large-font device PASS is claimed; compiled existing instrumentation scenarios remain unexecuted. These limits are explicit rather than inferred from builds.

## Remaining production and navigation gaps

- **Integration defects:** no known failing supported build/test gate. Read-watermark monotonicity under concurrent requests remains a minor source limitation. Backend history is unpaginated, and Android caps Messaging responses at three million bytes: sufficiently long history fails closed rather than silently truncating. Pagination is future functional hardening; no load/benchmark work was requested.
- **Missing Backend activation:** durable approved Google identity resolver/binding activation is required before ordinary newly authenticated accounts can create conversations. Production onboarding/KYC and Payment reauthentication remain unimplemented/inactive by prior contracts; this phase does not bypass them.
- **Provider limits:** no actual approved Google accounts or live SePay confirmation/allocation/receipt chain was exercised. Test-verifier E2E is explicitly isolated.
- **Device acceptance:** camera thumbnails, gallery grants, lifecycle/account-switch interaction, dark theme, large fonts, keyboard and accessibility require an exclusive device window; unsigned Release also needs deployment/signing acceptance.
- **Contextual navigation:** covered currently represented Inquiry acknowledgement, Operator Inquiry detail, and Tenant/Operator Tenancy detail. There is no persistent tenant sent-Inquiry list to recover an old Inquiry that never acquired a conversation after restart; existing conversations remain available in Messages. No unrelated-user directory or invented context is provided.
- **Deferred domains:** Admin analytics, unrelated Marketplace/subscription work and production KYC remain outside scope. Phase 1–3's historical Messaging exclusion is superseded only by this approved Phase 4 integration.

Recommendation: **unified_partial_with_explicit_gates**. Fixture-backed full-stack Messaging and supported unified regressions are reviewable; production identity activation, live providers and device acceptance are not complete. This is not a production-readiness declaration.

## Imported or modified file inventory

47 unique paths changed from the Phase 4 starting HEAD (including this report).

```text
.env.messaging.example
.gitignore
app/src/debug/java/com/trooi/app/core/data/DebugTroOiRepository.kt
app/src/debug/java/com/trooi/app/core/data/TroOiRepositoryImpl.kt
app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt
app/src/main/java/com/trooi/app/core/data/TroOiRepository.kt
app/src/main/java/com/trooi/app/core/model/ConversationCard.kt
app/src/main/java/com/trooi/app/core/model/Models.kt
app/src/main/java/com/trooi/app/core/network/BackendApi.kt
app/src/main/java/com/trooi/app/core/network/BackendClient.kt
app/src/main/java/com/trooi/app/core/network/dto/MessagingDtos.kt
app/src/main/java/com/trooi/app/features/inquiry/InquiryComposer.kt
app/src/main/java/com/trooi/app/features/messages/MessageImages.kt
app/src/main/java/com/trooi/app/features/messages/MessagesScreen.kt
app/src/main/java/com/trooi/app/features/organization/OperatorWorkspace.kt
app/src/main/java/com/trooi/app/features/tenancy/RentalWorkspace.kt
app/src/main/java/com/trooi/app/features/tenant/TenantFlow.kt
app/src/main/java/com/trooi/app/features/tenant/TenantScreens.kt
app/src/main/java/com/trooi/app/ui/TroOiApp.kt
app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt
compose.messaging.yml
database/migrations/000009_messaging.ts
database/migrations/sql/000009_messaging.down.sql
database/migrations/sql/000009_messaging.up.sql
docs/implementation/unified-source/final-acceptance.md
docs/implementation/unified-source/phase4-messaging-integration.md
docs/messages-fullstack-mvp.md
package.json
pnpm-lock.yaml
scripts/messaging/init-local-bucket.ts
src/app.module.ts
src/common/http/body-parsers.ts
src/infrastructure/database/schema.types.ts
src/infrastructure/object-storage/private-s3-object-storage.adapter.ts
src/modules/messaging/messaging.controller.ts
src/modules/messaging/messaging.dto.ts
src/modules/messaging/messaging.module.ts
src/modules/messaging/messaging.repository.ts
src/modules/messaging/messaging.service.ts
src/persistence/ports/object-storage.port.ts
tests/android/instrumentationDebug/java/com/trooi/app/features/NativeMessagingStatesTest.kt
tests/android/unit/java/com/trooi/app/core/network/MessagingRepositoryTest.kt
tests/android/unit/java/com/trooi/app/core/network/MessagingTransportTest.kt
tests/integration/messaging.integration.ts
tests/integration/persistence/support/identity-vnext-migrations.ts
tests/messaging.test.ts
tests/verification/account-verification-foundation.test.ts
```
