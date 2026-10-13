# Retired UI QA history — archived

Old UI-only reports and captured evidence were removed from the active checkout, **not lost**. Active source, tests, fixtures and current architecture remain.

- `D:\Projects\.archives\TroOi-Project/retired-android-ui-qa-documents-a7f39a3-20261012.zip` — SHA-256 `30db0ad00562e1f7d08958a0b61c8e0c73a45c929c474860eb9dc12cfbf87e20`, 12 old QA reports, 5 old UI drafts, 2 former manifest/index files, and 8 pre-purge reference/config backups.
- `D:\Projects\.archives\TroOi-Project/ui-redesign-evidence-a7f39a3-20261012.zip` — SHA-256 `f18e4f433ad6764818d32e9ae8a9c3e869a5447e958cc491a179044c9d29ff01`, 1690 raw evidence files including all previously retained 173 files.
- `D:\Projects\.archives\TroOi-Project/legacy-docs-demo-a7f39a3-20261012.zip` — 164 retired generated demo files.
- Every original checksum index remains available **inside the ZIP archives**.

These files are currently stored **only on this developer machine**. They must be replicated to durable shared storage before team recovery is assured.

Use [current QA](ANDROID_UI_CURRENT_QA.md), [architecture](../designs/v1/android-frontend-architecture.md), and [Android test layout](../../tests/android/README.md) for the live system. Historic Round 2–7 results are provenance, **not evidence that native tests passed after tests were moved**.

Do not run the obsolete 615-path staging manifest, which includes archived items.

## Superseded one-off native smoke scripts

13 old `app/scripts/ui_round*` / `ui_rework_smoke.py` one-off regression drivers were archived and removed. None was called by active CI/tests/docs; only internal references between obsolete smoke drivers were found. Generic architecture and fixture verifiers and the active `tools/ui-test-control` remain.

- Developer-local ZIP: `D:\Projects\.archives\TroOi-Project\retired-ui-round-smoke-scripts-a7f39a3-20261012.zip`
- SHA-256: `04b134fb0df7a1a29f78b4c6a936c09f485194485ac2878e789180e34cd3233d`
- Includes exact per-script SHA-256 manifest and all 13 originals.
- Not a replacement for the current native AndroidTest harness. No native tests were run by this cleanup.
