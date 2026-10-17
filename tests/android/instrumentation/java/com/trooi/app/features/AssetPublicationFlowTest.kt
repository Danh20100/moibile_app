package com.trooi.app.features

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ContentValues
import android.graphics.Bitmap
import android.provider.MediaStore
import android.view.accessibility.AccessibilityNodeInfo
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.MainActivity
import com.trooi.app.R
import com.trooi.app.core.data.TroOiRepositoryImpl
import com.trooi.app.core.model.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Actual app -> native picker -> persistent catalog -> purchase -> public discovery. */
class AssetPublicationFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(tag: String) = compose.waitUntil(20000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun screenshot(name: String) {
        compose.waitForIdle()
        android.os.SystemClock.sleep(750)
        val bitmap = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
        val resolver = instrumentation.targetContext.contentResolver
        val uri = requireNotNull(resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "$name-${System.currentTimeMillis()}.png")
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/TroOiRuntime")
        }))
        requireNotNull(resolver.openOutputStream(uri)).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
    }
    private fun field(tag: String, value: String) {
        compose.onNodeWithTag("asset-wizard-scroll").performScrollToNode(hasTestTag(tag))
        compose.onNodeWithTag(tag).performTextReplacement(value)
    }
    private fun nativeNodes(): List<AccessibilityNodeInfo> {
        val root = instrumentation.uiAutomation.rootInActiveWindow ?: return emptyList()
        val result = mutableListOf<AccessibilityNodeInfo>()
        fun visit(node: AccessibilityNodeInfo) { result += node; repeat(node.childCount) { node.getChild(it)?.let(::visit) } }
        visit(root)
        return result
    }
    private fun nativeClick(node: AccessibilityNodeInfo) {
        var current: AccessibilityNodeInfo? = node
        while (current != null) {
            if (current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return
            current = current.parent
        }
        error("Native picker item was not clickable")
    }
    private fun pickTwoRealPhotos() {
        val resolver = instrumentation.targetContext.contentResolver
        listOf(R.drawable.rental_studio, R.drawable.rental_kitchen).forEachIndexed { index, resource ->
            val uri = requireNotNull(resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, "TroOi-space-$index-${System.currentTimeMillis()}.jpg")
                put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/TroOiSpaces")
                put(MediaStore.Images.Media.DATE_TAKEN, System.currentTimeMillis() + index)
            }))
            requireNotNull(resolver.openOutputStream(uri)).use { out -> instrumentation.targetContext.resources.openRawResource(resource).use { it.copyTo(out) } }
        }
        val automation = instrumentation.uiAutomation
        automation.serviceInfo = automation.serviceInfo.apply { flags = flags or AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS }
        compose.onNodeWithTag("asset-pick-photos").performClick()
        val deadline = android.os.SystemClock.uptimeMillis() + 15000
        var thumbnails: List<AccessibilityNodeInfo>
        do {
            thumbnails = nativeNodes().filter { it.viewIdResourceName?.endsWith("icon_thumbnail") == true || it.contentDescription?.toString()?.startsWith("Photo taken") == true }
            if (thumbnails.size >= 2) break
            android.os.SystemClock.sleep(200)
        } while (android.os.SystemClock.uptimeMillis() < deadline)
        check(thumbnails.size >= 2) { "Picker thumbnails missing: ${nativeNodes().map { "${it.viewIdResourceName}:${it.text}:${it.contentDescription}" }}" }
        nativeClick(thumbnails[0])
        android.os.SystemClock.sleep(300)
        nativeClick(nativeNodes().filter { it.viewIdResourceName?.endsWith("icon_thumbnail") == true || it.contentDescription?.toString()?.startsWith("Photo taken") == true }[1])
        // The system photo picker publishes its confirmation action asynchronously after selection.
        // Wait for the actual accessible action rather than racing its transient layout update.
        val confirmDeadline = android.os.SystemClock.uptimeMillis() + 10000
        var add: AccessibilityNodeInfo? = null
        do {
            add = nativeNodes().firstOrNull {
                it.viewIdResourceName?.endsWith("button_add") == true ||
                    it.text?.toString()?.startsWith("Add") == true ||
                    it.text?.toString() == "Done"
            }
            if (add != null) break
            android.os.SystemClock.sleep(100)
        } while (android.os.SystemClock.uptimeMillis() < confirmDeadline)
        checkNotNull(add) { "Picker add action missing: ${nativeNodes().map { "${it.viewIdResourceName}:${it.text}" }}" }
        nativeClick(add)
        compose.waitUntil(15000) { compose.onAllNodesWithTag("asset-cover-1").fetchSemanticsNodes().isNotEmpty() }
    }
    @Test fun ownerDraftPhotosPurchasePublishRestartAndArchiveUseOneCatalog() = runBlocking {
        compose.waitUntil(20000) { compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty() || compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }
        if (compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty()) {
            compose.onNodeWithTag("nav-tab-profile").performClick()
            compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("account-logout"))
            compose.onNodeWithTag("account-logout").performClick()
            // Logout is a protected confirmation; the first tap only opens the dialog.
            compose.onAllNodesWithText("Đăng xuất").onLast().performClick()
            compose.waitUntil(15000) {
                runCatching { compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }.getOrDefault(false)
            }
        }
        compose.onAllNodesWithText("Đăng nhập").onFirst().performClick()
        compose.onAllNodes(hasSetTextAction())[0].performTextReplacement("owner@trooi.local")
        compose.onAllNodes(hasSetTextAction())[1].performTextReplacement("TroOi2026!")
        compose.onNodeWithText("Đăng nhập").performClick()
        waitFor("ledger-screen")
        val repository = TroOiRepositoryImpl(instrumentation.targetContext)
        val account = repository.refreshSessionContext().getOrThrow()
        val before = repository.refreshAuthorizedRead(account.access).getOrThrow()
        val baseline = before.localManagement!!
        assertEquals(baseline.capacity(), baseline.used)
        compose.onNodeWithTag("owner-asset-${com.trooi.app.core.demo.DemoData.ROOM}").performClick()
        waitFor("owner-asset-detail")
        screenshot("owner-asset-detail")
        compose.onNodeWithTag("owner-detail-back").performClick()
        compose.onNodeWithTag("ledger-add-asset").performClick()
        waitFor("asset-wizard")
        screenshot("asset-type-selection")
        compose.onNodeWithTag("asset-type-Phòng trọ").performClick()
        compose.onNodeWithTag("asset-next").performClick()
        field("asset-name", "Phòng C01")
        field("asset-address", "18 Đường D5, Phường 25, Bình Thạnh, TP.HCM")
        field("asset-public-area", "Bình Thạnh, TP.HCM")
        field("asset-area", "24")
        compose.onNodeWithTag("asset-area").performImeAction()
        compose.onNodeWithTag("asset-wizard-scroll").performScrollToIndex(0)
        screenshot("asset-basics")
        compose.onNodeWithTag("asset-location-pin").performClick()
        compose.waitUntil(30000) { compose.onAllNodes(hasTestTag("asset-pin-center") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("asset-pin-center").performClick()
        screenshot("asset-location-pin")
        compose.onNodeWithText("Lưu vị trí").performClick()
        // A draft can only be persisted after valid rent/deposit and a completed physical description.
        // The production validation must NOT be bypassed to satisfy the old test fixture.
        compose.onNodeWithTag("asset-next").performClick()
        compose.onNodeWithTag("asset-wc-PRIVATE").performClick()
        field("asset-max-occupants", "2")
        field("asset-description", "Bản nháp đã ghi nhận diện tích và mô tả không gian.")
        compose.onNodeWithTag("asset-next").performClick()
        field("asset-rent", "3200000")
        field("asset-deposit", "3200000")
        compose.onNodeWithTag("asset-save-draft").assertIsEnabled().performClick()
        compose.waitUntil(15000) { compose.onAllNodesWithTag("asset-wizard").fetchSemanticsNodes().isEmpty() }
        val draftRead = repository.refreshAuthorizedRead(account.access).getOrThrow()
        val draft = draftRead.localManagement!!.assets.single { asset -> baseline.assets.none { it.id == asset.id } }
        assertEquals(baseline.used, draftRead.localManagement!!.used)
        assertEquals(ManagedAssetStatus.DRAFT, draft.status)
        assertTrue(draft.operationalLatitude.toDouble() in 10.0..11.0)
        assertTrue(draft.operationalLongitude.toDouble() in 106.0..107.0)
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("owner-asset-${draft.id}"))
        compose.onNodeWithTag("owner-asset-${draft.id}").performClick()
        compose.onNodeWithTag("owner-asset-edit").performClick()
        compose.onNodeWithTag("asset-next").performClick()
        compose.onNodeWithTag("asset-wc-PRIVATE").performClick()
        field("asset-max-occupants", "2")
        field("asset-floor", "1")
        field("asset-description", "Phòng nhiều ánh sáng, có bếp và ban công riêng. Phù hợp thuê dài hạn.")
        compose.onNodeWithTag("asset-floor").performImeAction()
        compose.onNodeWithTag("asset-wizard-scroll").performScrollToIndex(0)
        screenshot("asset-physical-details")
        compose.onNodeWithTag("asset-next").performClick()
        field("asset-rent", "3200000")
        field("asset-deposit", "3200000")
        field("asset-electricity", "3.500đ/kWh")
        field("asset-water", "20.000đ/m³")
        field("asset-available", "15/10/2026")
        compose.onNodeWithTag("asset-next").performClick()
        compose.onNodeWithText("Wi-Fi").performClick()
        compose.onNodeWithText("Bếp").performClick()
        field("asset-rules", "Không hút thuốc trong phòng\nTối đa 2 người\nGiờ giấc tự do")
        compose.onNodeWithTag("asset-next").performClick()
        pickTwoRealPhotos()
        compose.onNodeWithTag("asset-wizard-scroll").performScrollToNode(hasTestTag("asset-cover-1"))
        compose.onNodeWithTag("asset-cover-1").performClick()
        screenshot("asset-photo-gallery")
        compose.onNodeWithTag("asset-next").performClick()
        screenshot("asset-preview")
        compose.onNodeWithTag("asset-detail-preview").performClick()
        screenshot("asset-detail-preview")
        compose.onNodeWithTag("listing-back").performClick()
        compose.onNodeWithTag("asset-publish").performClick()
        waitFor("capacity-dialog")
        screenshot("capacity-full")
        assertEquals(baseline.capacity(), repository.refreshAuthorizedRead(account.access).getOrThrow().localManagement!!.capacity())
        compose.onNodeWithTag("capacity-confirm").performClick()
        screenshot("capacity-purchase-review")
        compose.onNodeWithTag("capacity-confirm").performClick()
        compose.waitUntil(10000) { compose.onAllNodesWithText("Đã mở thêm 1 slot").fetchSemanticsNodes().isNotEmpty() }
        screenshot("capacity-after-purchase")
        compose.onNodeWithTag("capacity-confirm").performClick()
        compose.waitUntil(10000) { compose.onAllNodesWithTag("asset-wizard").fetchSemanticsNodes().isEmpty() }
        val after = repository.refreshAuthorizedRead(account.access).getOrThrow()
        val published = after.localManagement!!.assets.single { it.id == draft.id }
        assertEquals(2, published.photoUris.size)
        assertEquals(draft.operationalLatitude, published.operationalLatitude)
        assertEquals(draft.operationalLongitude, published.operationalLongitude)
        assertEquals(ListingVisibility.PUBLISHED, published.listingStatus)
        assertEquals(baseline.used + 1, after.localManagement!!.used)
        assertEquals(before.operatorFinanceByOrganization, after.operatorFinanceByOrganization)
        assertEquals(before.tenancies, after.tenancies)
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("owner-asset-${draft.id}"))
        screenshot("owner-new-asset")
        compose.activityRule.scenario.recreate()
        waitFor("ledger-screen")
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("ledger-capacity"))
        compose.onNodeWithTag("ledger-capacity").assertTextEquals("${baseline.used + 1} / ${baseline.capacity() + 1} đang quản lý")
        compose.onNodeWithTag("nav-tab-discovery").performClick()
        waitFor("discovery-results")
        compose.onNodeWithTag("discovery-results").performScrollToNode(hasTestTag("discovery-card-${published.listingId}"))
        screenshot("published-local-listing")
        compose.onNodeWithTag("discovery-detail-${published.listingId}").performClick()
        compose.onNodeWithText("Phòng C01").assertExists()
        compose.onNodeWithText("18 Đường D5, Phường 25, Bình Thạnh, TP.HCM").assertDoesNotExist()
        screenshot("published-local-detail")
        compose.onNodeWithTag("listing-detail-${published.listingId}").performScrollToNode(hasText("Chi phí thuê"))
        screenshot("published-local-detail-costs")
        compose.onNodeWithTag("listing-detail-${published.listingId}").performScrollToIndex(0)
        compose.onNodeWithTag("listing-back").performClick()
        compose.onNodeWithTag("nav-tab-core").performClick()
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("owner-asset-${draft.id}"))
        compose.onNodeWithTag("owner-asset-${draft.id}").performClick()
        compose.onNodeWithTag("owner-asset-archive").performClick()
        compose.onNodeWithTag("owner-archive-confirm").performClick()
        compose.waitUntil(10000) { compose.onAllNodesWithTag("owner-asset-detail").fetchSemanticsNodes().isEmpty() }
        val archived = repository.refreshAuthorizedRead(account.access).getOrThrow()
        assertEquals(baseline.used, archived.localManagement!!.used)
        assertEquals(baseline.capacity() + 1, archived.localManagement!!.capacity())
        assertTrue(archived.publicListings.none { it.listingId == published.listingId })
        assertEquals(before.operatorFinanceByOrganization, archived.operatorFinanceByOrganization)
        screenshot("capacity-after-archive")
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("owner-asset-${draft.id}"))
        compose.onNodeWithTag("owner-asset-${draft.id}").performClick()
        compose.onNodeWithTag("owner-asset-edit").performClick()
        repeat(5) { compose.onNodeWithTag("asset-next").performClick() }
        compose.onNodeWithTag("asset-publish").performClick()
        compose.waitUntil(10000) { compose.onAllNodesWithTag("asset-wizard").fetchSemanticsNodes().isEmpty() }
        assertEquals(baseline.used + 1, repository.refreshAuthorizedRead(account.access).getOrThrow().localManagement!!.used)
    }
}
