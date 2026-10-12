# Android current quality baseline — 2026-10-12

This records the **current** build and test state after the Android test migration, not archived Round 2–7 evidence.

| Gate | Last verified result |
| --- | --- |
| JVM tests | **192/192 PASS**, 49 XML suites |
| Debug + Release builds | PASS |
| AndroidTest APK | Compiled/packaged PASS, **native test execution after relocation NOT RUN** |
| Android lint | PASS |
| Release bundle | `:app:bundleRelease` PASS |
| Architecture and Debug/Release fixture isolation | PASS |
| Markdown documentation links | PASS after legacy purge: 127 docs / 301 local links / 0 missing |

Source and Debug fixtures remain in `app/src/`. JVM tests and instrumentation sources remain in `tests/android/` with AGP 9 Kotlin source-set mappings. Current API, Backend contracts, finance/security behavior, and CI gates remain unchanged by the legacy-document cleanup.

For old screenshots/reports see [legacy UI QA archive](LEGACY_UI_QA_ARCHIVE.md). Separate Architecture Cleanup ARCH-N native ANR/reviewer blockers are **not resolved here**.

No Git staging, commit, push or merge is authorized by this document.
