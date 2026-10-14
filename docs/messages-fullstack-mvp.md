# Cross-account Messaging MVP

Implemented only in `feature/messages-fullstack-mvp`, based on `239e0e82b39ed0d62237dab9a07cc76a316f482e`. The WIP was read-only; only the Messages screen and image preparation UI were copied. Profile, Payment, frozen migration 000008 and frozen JSON were preserved.

## Behavior

Google Bearer authentication supplies the sender. A conversation opens from an inquiry or tenancy UUID; the server derives the inquiry sender or tenancy participants and the property organization owner. All parties need a bound verified Google identity. Missing parties, duplicate/self-chat parties and outsiders are rejected. A unique context conversation snapshots its participants; those participants retain historical access after the context ends. Membership is not dynamically expanded when tenancy participants change.

PostgreSQL stores conversations, participants, immutable messages, immutable attachment metadata and read watermarks. Foreign keys restrict deletion of history. Migration 000009 is additive. Object keys and credentials never appear in API projections. Attachments are private, accessed through the authenticated conversation endpoint, with `Cache-Control: private, no-store`.

Messages accept text (up to 4,000 characters), or up to five JPEG images, or both. Each image is limited to 2,000,000 bytes, with canonical base64, MIME and JPEG signature validation. Uploads complete before the database transaction. Failed uploads/database writes trigger best-effort object deletion, including a potentially completed upload whose response failed. No failed send is presented as a saved message. An uncertain network failure after a database commit may still leave a message on the server; refresh before retrying.

Android provides conversation search, detail, drafts, gallery selection, camera thumbnails, local previews, read indicators, refresh errors and retained drafts after failed sends. Backend images are authenticated byte downloads decoded in memory; they are not written to public storage or loaded from URLs. The send credential is pinned to the account whose identity was checked. Messages refresh approximately every eight seconds while the screen is resumed, and on resume. The detail hides root navigation without changing Profile/Payment navigation.

Use **Nhắn tin** from an acknowledged Inquiry, Operator Inquiry detail, or Tenant/Operator Tenancy detail. Debug retains manual context UUID entry as a diagnostic fallback. Both participants must already have durable `auth_identities` bindings. Current Google authentication does not yet create these bindings: approved identity-resolver activation remains a production gate. The isolated HTTP test explicitly seeds bindings; authenticating once is insufficient. Demo mode remains local-only and cannot upload images; it never simulates cross-account delivery.

## Isolated local setup (PowerShell)

Run from the target worktree. This compose project has separate names, ports and persistent volumes; it does not reuse existing containers or databases.

```powershell
docker compose -p trooi-messages-mvp -f compose.messaging.yml --profile messaging up -d
Copy-Item .env.messaging.example .env.messaging
# Edit .env.messaging locally: set a real GOOGLE_CLIENT_ID for Google login.
node --env-file=.env.messaging --import tsx scripts/database/migrate.ts up
node --env-file=.env.messaging --import tsx scripts/messaging/init-local-bucket.ts
node --env-file=.env.messaging build/main.js
```

The example credentials are disposable local fixture values. Do not use them in deployed environments. The initializer refuses every endpoint except `http://127.0.0.1:9047`. The database listens on `127.0.0.1:55447`, MinIO on `9047` (API) / `9048` (console), and the backend example uses `3047`. For an emulator, configure `-PtrooiApiBaseUrl=http://10.0.2.2:3047` and the matching `-PtrooiGoogleWebClientId=...`. Use HTTPS with private bucket policy for deployment; the existing storage adapter's non-loopback HTTP restriction remains intact.

## API (under the existing API_PREFIX)

| Method | Path | Payload/result |
| --- | --- | --- |
| POST | `messaging/conversations` | `{contextType:"inquiry"|"tenancy",contextId:UUID}` → `{id}` |
| GET | `messaging/conversations` | Own conversations with participants/context/read watermark |
| GET | `messaging/conversations/:id/messages` | Ordered messages with immutable sender, ISO time, `delivery:"server"`, attachment IDs |
| POST | `messaging/conversations/:id/messages` | `{text?,images?:[{contentType:"image/jpeg",base64}]}` → saved message |
| POST | `messaging/conversations/:id/read` | Server message read watermark |
| GET | `messaging/conversations/:id/attachments/:attachmentId` | Private `{contentType,base64}` |

All responses retain the existing `TransportOutcome`/TransformInterceptor envelope. No sender/recipient authority is accepted in message bodies. Images use a scoped JSON request limit of 13,400,000 bytes; Android enforces a 3,000,000-byte messaging response cap. Very large histories will need pagination before that cap is reached; this MVP does not truncate history silently. There are no push notifications, background delivery, read receipts for other participants, automatic retries of POST or stress/performance work.

## Verification

The integration test refuses any database URL except the dedicated loopback `55447/messaging_test` database. It appends isolated fixture contexts and creates a fresh private bucket per run. It does not reset an existing database.

```powershell
$env:DATABASE_URL='postgresql://messaging_test:local-messaging-test-only@127.0.0.1:55447/messaging_test'
$env:MESSAGING_TEST_DATABASE_URL=$env:DATABASE_URL
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec tsx --test tests/integration/messaging.integration.ts
```

Android verification used a copied dependency cache inside the target worktree, without stopping the other agent's Gradle daemon:

```powershell
$env:ANDROID_HOME='C:\Users\TranTien\AppData\Local\Android\Sdk'
$env:JAVA_HOME='C:\Users\TranTien\.gradle\jdks\eclipse_adoptium-21-amd64-windows.2'
& 'C:\Users\TranTien\.gradle\wrapper\dists\gradle-9.4.1-bin\arn2x92ynaizyzdaamcbpbhtj\gradle-9.4.1\bin\gradle.bat' --gradle-user-home .gradle-messaging --no-daemon --max-workers=2 '-Dorg.gradle.java.installations.auto-download=false' :app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest
```

Final verification on 2026-10-14:

| Check | Status | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS | Application and test TypeScript projects |
| `pnpm lint` | PASS | Zero warnings/errors |
| `pnpm test` | PASS | 462 tests, 0 failures/cancellations/skips |
| `pnpm build` | PASS | Nest production build |
| Isolated messaging HTTP integration command above | PASS | 1 integration test; A→B / B→A, private JPEG, public/outsider denial, immutable sender boundary, read state, failed-upload compensation, self-chat/unverified rejection, ended-context access and independent database reload |
| Fresh migration chain in isolated persistent PostgreSQL | PASS | 000001 through 000009 applied successfully |
| Private local bucket initializer | PASS | `node --env-file=.env.messaging.example --import tsx scripts/messaging/init-local-bucket.ts` |
| Android command above | PASS | 212 unit tests, 0 failures/errors/skips; both debug and instrumentation APKs assembled |
| `git diff --check` | PASS | No whitespace errors |
| Native instrumentation/device visual execution | BLOCKED | Shared emulator left untouched; no isolated device used |
| Live Google-account Android cross-account E2E | BLOCKED | No usable live two-account credentials/device demonstration |

The first backend run failed because the runtime audit lacked DATABASE_URL and its inactive-storage assertion needed the narrow Messaging exception; both were corrected. HTTP integration exposed missing DTO reflection under tsx, fixed by explicit typed validation pipes. Android initially exposed legacy callback signatures and an overlapping target build hit a Windows file lock; callers were updated and the final serial build passed. These earlier failures are resolved, not omitted from the final result.

Real HTTP server integration is demonstrated with two deterministic test identities and a test Google verifier. HTTP authentication/authorization, PostgreSQL and private S3 storage are real. This is not a live Google-account Android demonstration. **Live Google Android E2E: BLOCKED** pending usable account credentials and an isolated device. The shared emulator was not modified. Instrumentation APK compilation is checked, but native instrumentation execution, TalkBack, screenshots and physical camera behavior are not claimed.

Review: separate standards/spec reviews caught and corrected the account-switch send race, hidden 200-message history window, image-only list preview and read failure recovery. Native source audit checked labels, 48dp image controls, Material colors, keyboard insets, bounded image decoding and error/draft behavior. Device visual inspection remains unverified.
