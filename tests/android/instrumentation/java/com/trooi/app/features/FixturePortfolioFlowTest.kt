package com.trooi.app.features

import android.content.Intent
import android.content.ContentValues
import android.graphics.Bitmap
import android.provider.MediaStore
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.MainActivity
import com.trooi.app.core.data.TroOiRepositoryImpl
import com.trooi.app.core.demo.DemoRentalGraph
import com.trooi.app.core.model.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class FixturePortfolioFlowTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(tag: String) = compose.waitUntil(30000) {
        runCatching { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }.getOrDefault(false)
    }
    private fun screenshot(name: String) {
        compose.waitForIdle()
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
    @Test fun importedDraftRequiresReviewThenPublishesOneCanonicalListing() = runBlocking {
        val context = instrumentation.targetContext
        context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        compose.waitUntil(30000) { runCatching { compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty() ||
            compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }.getOrDefault(false) }
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
        val repository = TroOiRepositoryImpl(context)
        val owner = repository.refreshSessionContext().getOrThrow()
        val before = repository.refreshAuthorizedRead(owner.access).getOrThrow()
        val baseline = before.localManagement!!
        val asset = baseline.assets.single { it.id == DemoRentalGraph.AN_NHIEN }
        var purchased = false
        if (asset.status == ManagedAssetStatus.DRAFT) {
            compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("owner-asset-${asset.id}"))
            compose.onNodeWithTag("owner-asset-${asset.id}").performClick()
            waitFor("owner-asset-edit")
            compose.onNodeWithTag("owner-asset-edit").performClick()
            waitFor("asset-wizard")
            repeat(5) { compose.onNodeWithTag("asset-next").performClick() }
            compose.onNodeWithTag("asset-publish").performClick()
            if (baseline.used == baseline.capacity()) {
                waitFor("capacity-confirm")
                compose.onNodeWithTag("capacity-confirm").performClick()
                compose.onNodeWithText("259.000đ / 1 năm").assertExists()
                screenshot("fixture-graph-capacity-review")
                compose.onNodeWithTag("capacity-confirm").performClick()
                compose.waitUntil(20000) { compose.onAllNodesWithText("Đã mở thêm 1 slot").fetchSemanticsNodes().isNotEmpty() }
                purchased = true
                compose.onNodeWithTag("capacity-confirm").performClick()
            }
            waitFor("ledger-screen")
        }
        val after = repository.refreshAuthorizedRead(owner.access).getOrThrow()
        assertEquals(baseline.capacity() + if (purchased) 1 else 0, after.localManagement!!.capacity())
        baseline.assets.filter { it.id != asset.id }.forEach { preserved -> assertEquals(preserved, after.localManagement!!.assets.single { it.id == preserved.id }) }
        assertEquals(before.operatorFinanceByRoom, after.operatorFinanceByRoom)
        assertEquals(before.tenancies, after.tenancies)
        assertEquals(ListingVisibility.PUBLISHED, after.localManagement!!.assets.single { it.id == asset.id }.listingStatus)
        assertEquals(1, after.publicListings.count { it.listingId == "demo-studio" })
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("owner-asset-${asset.id}"))
        screenshot("fixture-graph-owner")
        compose.onNodeWithTag("nav-tab-discovery").performClick()
        waitFor("discovery-results")
        compose.onNodeWithTag("discovery-results").performScrollToNode(hasTestTag("discovery-card-demo-studio"))
        compose.onNodeWithTag("discovery-detail-demo-studio").performClick()
        waitFor("listing-detail-demo-studio")
        screenshot("fixture-graph-detail")
    }
}
