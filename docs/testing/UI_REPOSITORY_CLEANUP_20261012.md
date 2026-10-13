# UI redesign repository cleanup — 2026-10-12

**Target**: design/app-ui-redesign worktree under D:\Projects\.worktrees\TroOi-Project\design-app-ui-redesign, HEAD a7f39a3. **No staging, commit, push, merge or reset performed** by this cleanup.

## Intent, in-scope and preserved systems

The retired web/ landing page and Merge Guardian removal were performed by the repository owner in preceding commit a7f39a3; this cleanup does not reverse them.

The root src/, database/, package.json, pnpm-lock.yaml, Dockerfile, docker-compose.yml, compose.persistence.yml and backend-database-v1-conformance.yml remain: these are **live NestJS/PostgreSQL Backend assets**, not the retired web frontend. Keep the existing root TypeScript tests/ tree, scripts and Android production main/debug/release source sets.

## Android Kotlin test migration

- Moved and SHA-256 checked **76 physical files** from app/src test trees into tests/android/:
  - 40 Kotlin JVM unit sources -> tests/android/unit/java
  - 9 Kotlin unitDebug sources -> tests/android/unitDebug/java
  - 1 Debug unit test resource -> tests/android/unitDebug/resources
  - 9 Kotlin base instrumentation sources -> tests/android/instrumentation/java
  - 17 Kotlin debug instrumentation sources -> tests/android/instrumentationDebug/java
- Removed empty app/src/test, app/src/testDebug, app/src/androidTest, app/src/androidTestDebug, app/src/androidTestBackendDebug and app/src/backendDebug directories. app/src now contains **only main, debug, release**.
- Updated app/build.gradle.kts: AGP 9.2.1 built-in Kotlin requires AndroidSourceSet.kotlin.directories (not java.srcDirs); kept Debug assets added to testDebug resources.
- Added scripts/verify_android_test_layout.py and scripts/verify_android_test_results.py. The latter rejects a falsely green Gradle task that discovers zero tests; baseline 49 suites and 192 JVM cases.
- Added tests/android/README.md and extended CI Android workflow with these checks, enabling branch design/app-ui-redesign as a workflow trigger.
- Backup made and content-hash verified BEFORE move: D:\Projects\.temp\trooi-ui-test-migration-pre-20261012.zip plus .json manifest.
- Important: the first Java-only source-set mapping produced a false-green zero-test task. It was corrected using AGP 9 Kotlin directories and subsequently **49 JVM suites / 192 tests / 0 failures** were verified; consult the fresh source-scoped final gate.

## QA artifacts: archive-first, selective on-repo evidence

- Physical original: **1,690 files** in docs/testing/artifacts, including 173 .log files ignored by earlier rules and 197 Kotlin source snapshots.
- Verified external archive: D:\Projects\.archives\TroOi-Project\ui-redesign-evidence-a7f39a3-20261012.zip
- SHA-256 of ZIP: f18e4f433ad6764818d32e9ae8a9c3e869a5447e958cc491a179044c9d29ff01
- Every one of 1,690 source files was compared against its archive member checksum before cleanup; a full checksum index is stored at docs/testing/evidence/ui-redesign-round7-all-artifacts-sha256.tsv.
- Preserved **173 curated proof files** (all exact Markdown-linked artifact targets plus selected final-state Light/Dark and machine-readable checks) at original repo paths. Removed remaining **1,517 archived extras** from checkout.
- Added scoped .gitignore rule /docs/testing/artifacts/. Curated files must be **explicitly staged with git add -f**, or a future commit would omit the evidence. See docs/testing/evidence/ui-redesign-round7-curated-paths.txt.
- Archived 6 untracked historical drafts and 11 ignored ui-rework root logs in the same QA ZIP. Removed only 2 draft files with no document references; retained 4 still mentioned in other docs.
- **Durability caveat**: both ZIPs exist on this development machine, NOT a team-accessible remote archive. Replicate before treating checkout+Git as a complete historical record.

## Legacy HTML and graphic demo tree

- docs/demo/ contained **164 tracked generated output files**: 142 PNG, 10 JSON, 6 HTML, 5 XML, 1 Markdown, with no references found in source, scripts, tests, current docs or workflow.
- Archived before removing: D:\Projects\.archives\TroOi-Project\legacy-docs-demo-a7f39a3-20261012.zip
- SHA-256: 5da73028ed0381da03bc5ca38ae7565575ade3d2f27b233eb6f1f24d1a0c1ada
- Verified all 164 archive members against source SHA-256, then removed docs/demo from checkout. Tracked deletions are intentional and not yet staged.
- Recovery details: docs/testing/LEGACY_DEMO_ARCHIVE.md.

## CI and document safeguards

- Kept existing Backend conformance workflow and active Android runtime workflow. No workflow references to removed web/ remain. Added Android root-test layout verification and explicit test XML case-count guard to frontend CI.
- Updated root README and docs/README to link the new test layout and archive records.
- Historical markdown and referenced drafts remain available; do not rewrite approved historical QA claim dates or replace historical evidence with unsupported claims.
- Cleanup has not run instrumentation on the changed layout; compilation/packaging and 192 JVM test cases are required static gates, NOT device runtime QA.

## Pending before commit/integration

1. Confirm latest Gradle Debug+Release+AndroidTest assemble, JVM tests and lint, architecture guard, documentation links and fixture isolation on final cleanup source.
2. Generate fresh exact Git staging manifests **after** moves/deletions; include force-add of the 173 curated proof files and the 164 intentional tracked deletions.
3. Review secrets in raw logs/screenshots and evidence paths before commit. The earlier quick pattern scan is not proof of absence of all secrets.
4. Replicate SHA-verified ZIPs to a durable team artifact store; developer-local archive is currently the only complete recovery copy.
5. Independent code review and verified native device UI regression are separate acceptance gates. Neither Git commit nor merge is authorized by this cleanup task.

## Final verified static QA and staging snapshot

After migration, archived-file cleanup and CI guard updates, the final source-scoped quality gate completed on 2026-10-12:

| Check | Observed result |
| --- | --- |
| Gradle Debug/Release APK assemble | PASS |
| AndroidTest APK assemble | PASS (compilation/packaging; no device execution) |
| Debug JVM unit tests | PASS: **49 JUnit XML suites / 192 tests / 0 failure / 0 error / 0 skipped** |
| Android lint | PASS, Gradle task completed without failure |
| Gradle combined run | **BUILD SUCCESSFUL in 4m18s, 143 actionable tasks** |
| Root Android layout verifier | PASS: all 75 Kotlin files and one unitDebug fixture resource assigned to AGP9 Kotlin source sets |
| Unit test discovery verifier | PASS, no false-green zero-test task |
| Frontend architecture guard | PASS |
| Markdown local link audit | PASS: **142 documents, 421 local links, zero missing** |
| Debug/Release fixture isolation | PASS: **7 Debug JSON assets** match source; **53 sentinel strings** excluded from Release APK/DEX |
| Git diff --check | Exit 0; local CRLF advisories only |

Gradle log: D:\Projects\.temp\trooi-ui-redesign-post-cleanup-full-qa-20261012.log.

**Pre-commit manifest regenerated AFTER all structural moves/deletions**:
D:\Projects\.temp\trooi-redesign-post-cleanup-staging-20261012\

- stage-normal-status-paths.txt.nul: **442 paths** (56 modified tracked, 219 deleted tracked, 167 untracked); intentionally captures old test path removals and all 164 retired demo paths.
- stage-force-curated-proof-paths.txt.nul: **173 exact archived-and-retained QA evidence files** that are ignored by the new rule.
- stage-all-paths.txt.nul: **615 paths total**, with SHA check of every retained proof file.
- status-summary.json: exact worktree HEAD, counts, and archive pointers.

**Staging caution:** these manifests are external preparatory data and are not stage instructions for another HEAD. If source/branch changes, regenerate them. No Git index writes have been performed. Do not commit raw QA binary data without a privacy/secret review. Both complete ZIP archives currently remain only on this developer machine; durable sharing/replication is still pending.

**Independent native QA:** no new UI instrumentation was executed after source relocation. Existing Round 7 native results remain historical evidence for the earlier source; they are not proof of the relocated-source runtime. The separate Architecture Cleanup ARCH-N remains blocked by emulator ANR and independent reviewer terminal startup errors; this repository cleanup does not resolve those blockers.

## Superseding retirement of old UI QA (2026-10-12)

Earlier sections proposing 173 curated files for Git staging are **historical only**. On the owner's cleanup instruction, all 173 old artifacts and 12 Round 2–7 UI reports, five old UI drafts, and two evidence index files were retired after archive verification. See [legacy QA archive](LEGACY_UI_QA_ARCHIVE.md) and [current Android QA](ANDROID_UI_CURRENT_QA.md).

The former 615-path staging manifest is INVALID; regenerate the manifest before any staging. No stage/commit/merge performed.

## Final current-only UI cleanup gate (2026-10-12)

- Archived-and-retired: 12 historic UI QA reports, 5 old UI drafts, 2 obsolete artifact manifests, the 173 remaining Round 2-7 screenshot/JSON/log assets, and 13 one-off UI smoke Python scripts. The old 1,690 raw evidence files, reports, scripts, and 164 retired demo files are available in SHA-256-verified developer-local ZIPs; they have not been copied to a shared store.
- Active Android source, 75 Kotlin tests + 1 resource, Debug fixtures, Backend, SePay contracts, architecture record, generic verifiers and CI remain in place.
- A new compact QA baseline is in [ANDROID_UI_CURRENT_QA.md](ANDROID_UI_CURRENT_QA.md); archived provenance in [LEGACY_UI_QA_ARCHIVE.md](LEGACY_UI_QA_ARCHIVE.md).
- Fresh static gate after removal: Debug/Release/AndroidTest packaging + 192 JVM cases + lint BUILD SUCCESSFUL in 20s. No native tests were run.
- Active Markdown link checker PASS: 127 docs / 301 local links / zero missing.
- Staging manifest recalculated under D:\Projects\.temp\trooi-redesign-current-only-staging-20261012: 412 working-tree entries (56 modified, 219 deleted, 137 untracked), no force-added legacy proof, 0 staged. HEAD a7f39a3 unchanged.
- Earlier proposed 615-path and 342-path manifests are superseded. No stage, commit, push, or merge has occurred.