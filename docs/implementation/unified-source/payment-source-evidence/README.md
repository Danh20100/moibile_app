# Historical Payment QA evidence

Extracted byte-for-byte from `origin/recovery/payment-methods` at `5230a0489209b84ef0dcf69acb67f69fce0efac5`, including the reports from `683bc65` and `cacf164` and all screenshots/video referenced by them. These reports describe the source branch's obsolete backendDebug APK and fixture-driven QA, not this unified worktree or live bank payments.

Do not run their backendDebug commands in the unified branch. Current build commands are `:app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest`. Migrated automatic panel/notification coverage is `tests/android/instrumentationDebug/java/com/trooi/app/features/PaymentIntegrationUiTest.kt`; it requires an exclusive authorized emulator window. The old interactive PaymentManualSession host has not been restored.

Current financial semantics take precedence over historic callback assertions: a confirmed checkout for the same amount reuses its obligation/key; the primary action now refreshes that confirmed record. A changed amount or failed checkout can use the existing new-intent path, subject to the preserved backend reauthentication gate. No UI action confirms money or allocates it.
