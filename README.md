# TroOi frontend v0.1.1

Frontend for TroOi: Android (repository root) and static web (`web/`).
This branch was created from `frontend/app-foundations` for the explicitly requested `frontend/app_foundations` update.

## Android

- Kotlin + Jetpack Compose, MVVM, Hilt.
- Windows: install JDK 17 and Android SDK 36, then provide `local.properties` (ignored by Git) with the SDK path.
- Build and test: `./gradlew testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest`.
- Debug APK: `app/build/outputs/apk/debug/app-debug.apk`.
- Build AAB: `./gradlew bundleRelease`. For Google Play release signing, copy `keystore.properties.example` into a local ignored `keystore.properties` and configure your own secure upload key.

## Web

- `cd web`; run `npm run check`, `npm test`, `npm run test:browser`, `npm run dev`.
- Vercel Root Directory: `web`; SPA fallback is configured in `web/vercel.json`.
- The web currently uses demo data in `web/runtime-config.js`.

## Current release boundaries

The release Android repository returns `Backend OpenAPI chua duoc cau hinh` for login/sign-up until the backend contract is integrated. Web production API adapters are also not integrated. The release AAB requires your own upload keystore; never commit passwords or signing keys.

Do not treat the successful demo/debug builds as proof of physical-device crash freedom. Connect a physical device (USB debugging), then run `./gradlew connectedDebugAndroidTest` and perform role-switch/scroll QA.
