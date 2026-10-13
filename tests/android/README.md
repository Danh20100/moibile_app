# Android tests at repository root

The Kotlin Android test suites are co-located with the existing NestJS/TypeScript backend tests in repository-root tests/, but kept under their own tests/android/ namespace. Existing backend tests under tests/core/, tests/conformance/, tests/database/ and tests/audit/ are unchanged.

## Android Gradle Plugin 9.2.1 mappings

| Root location | Android Gradle source set | Runs with |
| --- | --- | --- |
| tests/android/unit/java/ | test | :app:testDebugUnitTest |
| tests/android/unitDebug/java/ | testDebug | :app:testDebugUnitTest |
| tests/android/unitDebug/resources/ | testDebug resources | Debug unit fixtures |
| tests/android/instrumentation/java/ | androidTest | :app:compileDebugAndroidTestKotlin |
| tests/android/instrumentationDebug/java/ | androidTestDebug | :app:assembleDebugAndroidTest |

The application module configures these in app/build.gradle.kts through AndroidSourceSet.kotlin.directories, as required by AGP 9 built-in Kotlin. Do not relocate tests using only AndroidSourceSet.java: Gradle may misleadingly succeed while discovering zero JVM tests.

The additional app/src/debug/assets folder remains on testDebug.resources; debug fixture isolation is unchanged.

## Regression / CI guards

Run on Windows PowerShell, from repository root:

    python scripts/verify_android_test_layout.py
    .\gradlew.bat --offline :app:testDebugUnitTest :app:assembleDebugAndroidTest --console=plain
    python scripts/verify_android_test_results.py

The result guard requires at least 49 XML suites / 192 JVM cases; it detects empty Gradle test discovery even if the task reports BUILD SUCCESSFUL. The Android instrumentation APK is compiled and packaged by Gradle, but native runtime still requires a verified Android device/emulator; no native success is implied.

## Migration provenance

76 files moved in place on 2026-10-12: 75 Kotlin files and one resources file. The source content hashes were verified against a pre-move ZIP in the local developer temp directory:
D:\Projects\.temp\trooi-ui-test-migration-pre-20261012.zip.
No changes were made to app production API, database schema or payment flows as part of the move.
