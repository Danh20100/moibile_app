# TrọƠi · Profile experience redesign — 2026-10-13

> Target: Android Jetpack Compose, `temp/profile-operator-mvp-20261013`.
> Status: UI implementation candidate, NOT final visual acceptance.
> Authority: Canonical v3.7, Android native moss-green theme, current navigation/security contracts.
> Scope: Account/Profile hub and account-settings information architecture. Do not alter financial, identity, tenant, or operator business truth.

## 1. Baseline and diagnosis

Source-reviewed files: `ProfileScreen.kt`, `AccountSettingsFlow.kt`,
`ProfilePresentation.kt`, `LandlordOnboardingScreen.kt`, `OperatorWorkspace.kt`,
`TroOiPrimitives.kt`, and the profile/operator contract test.

Original problems:

1. Root Profile had a tall centered identity panel, two equally-weighted tiles, an operator promotion card, and six undifferentiated list rows. The account-management actions appeared too late.
2. No clear distinction between digital identity, participation in a tenancy, and operation of an organization. User relationships must not be reduced to a single global role.
3. Deep settings pages use a string-built path and full-screen dialogs. This remains a technical-debt navigation issue: typography alone cannot resolve it.
4. Many contact, PIN, KYC, payment-method, marketing-notification and preference actions have no authoritative persistence contract. Their appearance must not suggest completed server-side updates.
5. A single large `AccountSettingsFlow.kt` mixes navigation, presentation state, local draft state and domain-specific settings.

This is a source-code audit. At the time of this document the emulator build is verified, but signed-in screenshot/a11y visual acceptance is NOT verified.

## 2. Experience contract

**Profile is the user's account hub**, not an alternate operator dashboard.

- Digital identity: display name, profile image, personal data, account entry and security.
- Relationship projections: tenancy history and organization/operator entry are contextual shortcuts only.
- Security: PIN, password, login email and Google-linked account stay under one security destination. Contact email and login identity are never conflated.
- Finance: payment evidence is read only from the source-backed tenant/operator projections; receipts are not synthesized from an app/browser success page.
- Features not persisted by a verified backend remain labeled as previews or unavailable. Do not display a fabricated confirmation or verification badge.
- Both landlord and tenant relationships can be simultaneously present.

## 3. Updated mobile hierarchy

```text
Profile
├── Page header · Hồ sơ + notifications
├── Identity hero · name + contextual relationship(s)
│   └── Quản lý hồ sơ
├── Tài khoản
│   ├── Xem hồ sơ
│   └── Cài đặt tài khoản
├── Hoạt động của bạn
│   ├── Lịch sử thuê
│   ├── Kết nối · Chưa khả dụng
│   └── Contextual chủ trọ/operator entry
├── Thông tin & hỗ trợ
│   ├── Quyền riêng tư & Pháp lý
│   ├── Giới thiệu chủ nhà
│   └── Nhận trợ giúp
└── Đăng xuất · isolated destructive row
```

The six previously approved root menu destinations and their relative order are preserved.
Navigation, screen IDs and accessibility test tags remain intact.

Account settings are grouped in user language:

- Hồ sơ & truy cập: personal details; login and security.
- Quyền riêng tư & thông báo: privacy controls; notification topics.
- Tiện ích tài khoản: payment/receipts; language.

No new backend setting, identity role, KYC approval, financial allocation or organization permission is introduced.

## 4. Visual specification

Uses approved native Material 3/Moss Green roles from `Color.kt` and `Theme.kt`;
does not introduce an independent design palette.

| Element | Pattern |
|---|---|
| Identity hero | Single primary panel, left-aligned avatar, name/relationship, explicit manage action |
| Section label | Text-first hierarchy, optional supporting description |
| Navigation rows | Quiet paper group, 66dp minimum row, leading icon, title, subtitle, chevron |
| Contextual operator | Primary-container feature entry; says "setup" for non-operator, "open" for operator |
| History / connections | Compact 2-column shortcuts; unimplemented contact list labeled unavailable |
| Destructive action | Separate logout surface with semantic error color |
| Form settings | Grouped settings tiles, supporting text and honest preview notices |

- Spacing follows existing 4/8/12/16/20dp rhythm and native theme tokens.
- Container width is limited for wider layouts; dynamic text and TalkBack need device QA.
- State and permissions are expressed with text, never color only.
- No unsupported claim that KYC, linked Google, contact methods or preference changes were saved.

## 5. Implemented changes

- `ProfileScreen.kt`: redesigned visual hierarchy, hero, operator call to action, grouped menu rows and compact shortcuts.
- `AccountSettingsFlow.kt`: grouped settings home, personal-information panel and security hub; preview boundaries explicitly marked.
- `ProfilePresentation.kt`: supports simultaneous landlord and tenant contextual labels.
- `tests/core/profile-operator-navigation.contract.test.ts`: design-contract assertions added.

## 6. Acceptance matrix

| Gate | Evidence | State |
|---|---|---|
| Profile identity and authorized navigation contracts | `tsx --test` | rerun after final edits |
| Android debug Kotlin compilation | `:app:compileDebugKotlin` | PASS |
| Android debug APK packaging | `:app:assembleDebug` | PASS |
| Signed-in profile visual screenshot | Emulator, both tenant and operator | PENDING |
| Night mode, font scaling 1.3/2.0, TalkBack, IME/insets | Physical/emulator QA | PENDING |
| Unpersisted control honesty | Source audit | review required |
| Backend profile round trip | Google session against isolated backend | PENDING |
| All operator workspace screens redesign | Separate scope, not changed in this patch | NOT STARTED |

## 7. Next refactor stages

1. Replace string-concatenated settings routes and nested Dialog management with typed navigation entries, single top-level back ownership and route tests.
2. Split `AccountSettingsFlow` into Personal, Security, Privacy/Notifications, Finance and Help screens; extract semantic UI primitives and move state into per-feature view models.
3. Conduct screenshot comparison at common compact/expanded breakpoints, light/dark, font-scale and with tenant/operator/mixed capabilities. Tune clipping, color contrast, touch targets and scroll restoration from observed images.

Avoid rewriting v1 database, Canonical/ERD, SePay, KYC proof, or any uncommitted schema proposals under `docs/database/vnext/`. This is intentionally a UI-only change.

---

## Revision 2 — release-style Profile, three-step operator onboarding, help catalog

User-reviewed screenshot fixes implemented on the same temporary worktree:

1. **Account hero**: full-width clickable identity row, 64dp avatar, no tall blank header/footer, retained moss-green emphasis. Entry leads to personal details.
2. **Personal fields**: values and trailing 48dp Edit buttons share one horizontal row; identity verification gets a separate primary-container entry.
3. **Owner onboarding**: informative feature intro (room operations, receivables, incidents), then exactly three counted steps:
   - 1/3 capture CCCD front/back; bundled ML Kit Latin OCR runs **on device**, only suggests name/DOB and does not verify identity;
   - 2/3 review and correct autofilled name/DOB, explicitly confirm details;
   - 3/3 phone and email contact information, agreement, then submit;
   - property/room onboarding is deferred to Operator Workspace.
4. **Offline profile content catalog**: `app/src/main/assets/content/profile-catalog.vi.json` indexes both legal document routes (still backed by their original Markdown texts) and help FAQ content. `ProfileCatalog.kt` loads it from app assets. `AccountSettingsFlow.kt` renders both navigators from the catalog instead of hard-coded help text.

### Implementation boundaries

- `CitizenIdOcr.kt` uses bundled `com.google.mlkit:text-recognition:16.0.1`, which is **text recognition, not identity verification**. Recognition quality on photographed real Vietnamese identity cards has NOT been acceptance-tested; image capture through `TakePicturePreview` may be low resolution, so high-resolution camera capture remains a separate production-hardening task.
- Identity-card Bitmaps and raw recognized text are not added to persistent storage; only user-edited form values enter the transient onboarding request.
- Debug local onboarding can create an operator workspace with zero assets, which is consistent with `Organization → 0..N Property`. This does NOT create a production backend identity-verification record: provider KYC, server-side storage/retention, contact verification and a secure operator activation workflow still need dedicated backend contracts.
- Release-style text removes developer-internal API/mock explanations from user-facing surfaces but does not manufacture verified KYC, successful finance transactions, or saved preferences.
- Existing database-vNext JSON modifications are unrelated and remain untouched.

### Evidence

- TypeScript profile/operator contract tests: **12/12 PASS**.
- Android `:app:assembleDebug`: **PASS** after OCR dependency integration (re-run following final changes).
- Android `:app:testDebugUnitTest --tests 'com.trooi.app.features.profile.*'`: **PASS**, including new CCCD extraction tests.
- Full Android unit suite still exposes a **pre-existing contradictory assertion** in `CheckoutTransportTest.createSendsIdempotencyKeyAndDoesNotOverrideAuthorization`: it requires a `provider` field and then requires that same field not exist. This is unrelated to Profile UI.
- Visual validation with user-supplied screenshots informed the redesign; the newly rebuilt screens still need signed-in emulator screenshots, dark-mode/TalkBack/large-font checks.

### Final local verification
- Final debug APK build: **PASS**, installed successfully to `emulator-5554` with `adb install -r` (existing app data preserved).
- TypeScript Profile/Operator contracts: **12/12 PASS**.
- Android Profile-focused unit tests: **PASS** (including `CitizenIdOcrTest`).
- Full Android unit test suite: **197/198 PASS**, one contradictory Checkout Transport assertion unrelated to this UI redesign.
- `git diff --check`: no whitespace errors (Git only notes Windows CRLF normalization for onboarding source).
- Worktree changes remain uncommitted; unrelated in-progress database JSON files were not edited.
