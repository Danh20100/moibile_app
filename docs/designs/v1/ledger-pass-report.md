# Sổ frontend pass — coordinator handoff

Worktree: `D:\Projects\.worktrees\TroOi-Project\design-app-ui-redesign`

Branch: `design/app-ui-redesign`

HEAD: `c49bb716baaa33c4659d492953ee81283d9918bd` — unchanged.

The previously reviewed dirty Profile/Discovery/Listing work remains in place. This pass only changes the files listed below; pre-existing repository/model/navigation changes are not new work from this pass. No reset, stash, discard, revert, clean, commit, push, merge, rebase or history rewrite was performed.

## Exact files changed in this pass

New:

- `app/src/main/java/com/trooi/app/features/ledger/LedgerPresentation.kt`
- `app/src/main/java/com/trooi/app/features/ledger/LedgerScreen.kt`
- `app/src/main/java/com/trooi/app/features/ledger/LedgerSessionViewModel.kt`
- `app/src/test/java/com/trooi/app/features/ledger/LedgerPresentationTest.kt`
- `app/src/test/java/com/trooi/app/features/ledger/DemoSlotSessionTest.kt`
- `app/src/androidTest/java/com/trooi/app/features/LedgerUiTest.kt`
- `docs/designs/v1/ledger-pass-report.md` (this handoff)

Updated only for ledger routing or its necessary regression expectations:

- `app/src/main/java/com/trooi/app/ui/TroOiApp.kt`
- `app/src/main/java/com/trooi/app/features/profile/ProfileScreen.kt`
- `app/src/main/java/com/trooi/app/features/tenant/TenantScreens.kt`
- `app/src/test/java/com/trooi/app/features/profile/ProfilePresentationTest.kt`
- `app/src/androidTest/java/com/trooi/app/features/RedesignUiTest.kt`

Ignored build evidence: `ledger-compile.log`, `ledger-focused-tests.log`, `ledger-final-gates.log`, `.tmp/ledger-focused-counts.json`, standard APK/test/lint outputs. These are local artifacts, not product code.

## Tenant Sổ

`AppPage.CoreWorkspace` now renders `LedgerScreen`. Authenticated linked tenancy IDs determine selectable assets. Empty relationships show “Bạn chưa có tài sản thuê nào được liên kết.” and a Khám phá CTA; demo unlock does not fabricate tenant relationships. Missing linked-asset projections retain unavailable values rather than inventing rent, lifecycle, ownership or money.

One asset is naturally selected. Multiple assets use horizontal selector chips; selection changes the asset plate and the finance/deposit/incidents/history below. The six sections are Tài sản đang thuê, Khoản cần thanh toán, Tiền cọc, Thanh toán / xác nhận, Sự cố and Lịch sử.

Charges display obligations and their supplied outstanding amount. Confirmed payments are separate records; unknown allocation never implies full settlement. Deposit records and receipts remain separate. History uses supplied tenancy notices; unavailable history/incidents remain explicitly unavailable. There is no new history API or invented incident workflow.

Thanh toán selects the authorized existing tenancy navigation context and opens the existing tenant finance screen. The CTA does not create money records or invoke checkout. Presentation switching itself never selects a backend relationship or changes access.

## Landlord/operator Sổ

Owner presentation provides Tài sản của tôi/capacity near the top, Tổng quan vận hành, Người thuê, Công nợ / khoản phải thu, Sự cố and Hoạt động gần đây. Rental units remain asset-centric; this surface does not use khu trọ as its default unit.

Real operators see accessible room projections, scoped receivables/incidents, and a link to the existing real asset-management workspace. The local slot sandbox is separately labeled; its capacity does not claim to be the real account's purchased entitlement, and mock purchases never enforce or change backend capacity. Missing real people/history projections link or refer to the existing per-asset management surface rather than inventing them.

Demo-host users see seeded Studio S01 and clearly marked operational examples. New mock assets do not imply a tenant exists. Archiving the seeded asset stops its current-tenant/current-incident presentation; recorded obligations and historical examples remain labeled and retained.

## Slot lifecycle and demo checkout

- Free capacity starts at one active asset slot; the seeded demo asset occupies 1/1.
- One active/managed individual rental unit consumes one slot.
- Draft and archived/stopped-management assets consume no slot.
- Archiving releases capacity; activating a draft or archived asset checks capacity again.
- Adding a second active asset while full opens the paywall.
- The paywall explains Free = one rental asset with tenant, receivable, incident and operational-history management.
- Offer: “+1 slot · 29.000đ/tháng”, explicitly “Giá minh họa”. This is placeholder pricing.
- Flow: paywall → Mở thêm 1 slot → local review → explicit Thanh toán mô phỏng → local success → capacity 1/2 → add another mock asset → 2/2.
- A full-capacity user can also choose to create a non-consuming draft.
- Form fields: unit type, name/code, address, rent, deposit, area, status. Required text and nonnegative numeric values are validated; area must exceed zero.

The badge CHẾ ĐỘ DEMO remains visible. Purchase is guarded by the local checkout step and cannot increment twice by replaying success. There is no actual charge, provider verification, auto-renewal or subscription. Slot purchase has no gateway, API, repository, Payment, PaymentAllocation, DepositPaymentApplication, Receipt, Charge, tenancy, organization or subscription-record creation dependency.

## Presentation and navigation

Tenant-only defaults to tenant Sổ. Operator-only defaults to owner Sổ. Dual relationships expose a local switch. Profile's demo unlock allows tenant/demo-owner switching and its demo management CTA opens owner Sổ. Real operators retain their existing real management route.

`LedgerSessionViewModel` holds presentation choice, demo unlock and immutable demo capacity/assets in memory at the navigation layer. Same-account Activity recreation preserves them; logout, account change and process death reset them. No billing state is saved to disk, AccessCapabilities or SessionContext, and no persisted USER.role or API role switch is introduced.

Root navigation is Khám phá | Sổ | Tin nhắn | Hồ sơ on compact and expanded layouts. Existing travelling-notch implementation is unchanged by this pass; legacy tenant/operator detail pages keep Sổ selected. Favorites is not a root tab. Messages and Discovery semantics are preserved.

## Real versus mock data and imagery

Real/backend builds use authenticated relationships and authorized existing read projections. Tenant mock projections are rendered only when supplied by the existing demo build/session and labeled Dữ liệu minh họa. Real users with no linked tenancy get the honest empty state.

Demo owner assets, seeded tenant/receivable/incident/history examples and all slot pricing/purchases are illustrative local data. Real operator assets stay distinct from the demo sandbox.

No new photographs were downloaded. Existing bundled local drawable fallbacks were preserved. Sổ uses the established asset plate/text treatment; licensed room photography remains a polish item.

## Verification

| Gate | Result |
|---|---|
| Focused ledger/Profile/Discovery/navigation unit tests | 55 passed; 13 suites; 0 failures/errors/skips |
| New ledger unit coverage within those counts | 12 passed |
| `:app:testDebugUnitTest` | 151 passed; 31 suites; 0 failures/errors/skips |
| `:app:assembleDebug` | Passed |
| `:app:assembleBackendDebug` | Passed |
| `:app:lintDebug` | Passed; 0 errors, 31 warnings, 2 hints; no findings in the new ledger files |
| `:app:compileDebugAndroidTestKotlin` | Passed; includes 3 new ledger interaction tests |
| `git diff --check` | Passed |

The two APK build gates, full unit gate, lint gate and instrumentation compilation gate completed successfully in the final Gradle invocation (109 tasks; 22 executed, 87 up-to-date). Focused tests completed separately against the same source. The existing Gradle installation and writable worktree caches were used offline because the default wrapper cache location was unavailable.

Instrumentation tests were compiled, not executed. No emulator, backend or Docker services were started. No production runtime visual verification was performed. Source audit checked native Material controls, semantic theme roles, horizontal selectors, scrollable/IME-safe form and sheet, 48dp chip/action sizing, honest unavailable states and explicit demo provenance. Font scaling, TalkBack and actual device rendering remain runtime review items.

Independent code-review standards and spec reviewers found no outstanding material findings after the session-lifecycle and demo-wording corrections. The small final root-tab mapping was reviewed in-thread and covered by a runnable unit check.

D4 tenant payment integration: **NOT STARTED**. Gateway return/settlement code, tenancy/payment workspaces, backend/server and database code were not edited in this pass. Existing payment-return routing remains intact.

## Direction contract

THESIS: Sổ is a per-unit operational record, with owner capacity explaining monetization before the add action.

OWN-WORLD: Inherit docs/designs/v1/DESIGN.md: warm paper surfaces, bottle-green asset plate, semantic state labels, flat dividers and Material controls.

STORY: Tenant selects an asset and reads obligations, confirmed money, deposit and events; owner sees managed units and understands the free-slot ceiling.

FIRST VIEWPORT: Sổ title, local presentation selector when available, then selected asset or owner capacity. The add action sits with capacity; checkout discloses demo provenance before confirmation.

FORM: Precisely specified extension of the established Room Ledger world; no concept seed or visual-world replacement.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. Existing DESIGN.md is preserved, source review is complete, no new raster ships; runtime visual review remains explicitly unverified.

## Delivery verdict

| Status | Verdict |
|---|---|
| IMPLEMENTED | YES |
| TESTED | YES — unit/build/lint; instrumentation compile only |
| SOURCE_REVIEWED | YES |
| PRODUCT_SPEC_ALIGNED | YES |
| RUNTIME_VISUAL_VERIFIED | NO |
| READY_FOR_COORDINATOR_REVIEW | YES |
| Commit/push | NONE |

## Final git status

```text
 M app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt
 M app/src/main/java/com/trooi/app/core/data/TroOiRepository.kt
 M app/src/main/java/com/trooi/app/core/model/Models.kt
 M app/src/main/java/com/trooi/app/features/discovery/ExploreScreen.kt
 M app/src/main/java/com/trooi/app/features/tenant/TenantScreens.kt
 M app/src/main/java/com/trooi/app/ui/TroOiApp.kt
 M app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt
 M app/src/main/java/com/trooi/app/ui/navigation/TroOiBottomNavigation.kt
 M app/src/test/java/com/trooi/app/features/RoomLedgerDesignRegressionTest.kt
 M app/src/test/java/com/trooi/app/features/discovery/ExploreNavigationTest.kt
?? app/src/androidTest/
?? app/src/main/java/com/trooi/app/features/discovery/DiscoveryCards.kt
?? app/src/main/java/com/trooi/app/features/discovery/ListingDetailScreen.kt
?? app/src/main/java/com/trooi/app/features/discovery/ListingFixtures.kt
?? app/src/main/java/com/trooi/app/features/ledger/
?? app/src/main/java/com/trooi/app/features/profile/
?? app/src/main/res/drawable/demo_room_blue.xml
?? app/src/main/res/drawable/demo_room_sage.xml
?? app/src/main/res/drawable/demo_room_sand.xml
?? app/src/test/java/com/trooi/app/features/auth/AuthEntryTest.kt
?? app/src/test/java/com/trooi/app/features/discovery/DiscoveryCardsTest.kt
?? app/src/test/java/com/trooi/app/features/discovery/ListingFixturesTest.kt
?? app/src/test/java/com/trooi/app/features/ledger/
?? app/src/test/java/com/trooi/app/features/profile/
?? docs/designs/v1/ledger-pass-report.md
```
