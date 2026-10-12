package com.trooi.app.features

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
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

/** Real activity, native photo picker and durable capability; original demo accounts are preserved. */
class LandlordOnboardingFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val temporaryMedia = mutableListOf<Uri>()
    private fun waitFor(tag: String) = compose.waitUntil(20000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun screenshot(name: String) {
        compose.waitForIdle()
        android.os.SystemClock.sleep(750)
        val bitmap = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
        val uri = requireNotNull(context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "$name-${System.currentTimeMillis()}.png")
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/TroOiRuntime")
        }))
        requireNotNull(context.contentResolver.openOutputStream(uri)).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
    }
    private fun logout() {
        compose.onNodeWithTag("nav-tab-profile").performClick()
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("account-logout"))
        compose.onNodeWithTag("account-logout").performClick()
    }
    private fun login(email: String) {
        compose.waitUntil(20000) { compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }
        compose.onAllNodesWithText("Đăng nhập").onFirst().performClick()
        compose.onAllNodes(hasSetTextAction())[0].performTextReplacement(email)
        compose.onAllNodes(hasSetTextAction())[1].performTextReplacement("TroOi2026!")
        compose.onNodeWithText("Đăng nhập").performClick()
        waitFor("ledger-screen")
    }
    private fun field(tag: String, value: String) {
        compose.onNodeWithTag("asset-wizard-scroll").performScrollToNode(hasTestTag(tag))
        compose.onNodeWithTag(tag).performTextReplacement(value)
    }
    private fun nativeNodes(): List<AccessibilityNodeInfo> {
        val result = mutableListOf<AccessibilityNodeInfo>()
        fun visit(node: AccessibilityNodeInfo) { result += node; repeat(node.childCount) { node.getChild(it)?.let(::visit) } }
        instrumentation.uiAutomation.rootInActiveWindow?.let(::visit)
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
    private fun pickSingle(tag: String) {
        instrumentation.uiAutomation.serviceInfo = instrumentation.uiAutomation.serviceInfo.apply { flags = flags or AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS }
        compose.onNodeWithTag(tag).performClick()
        val deadline = android.os.SystemClock.uptimeMillis() + 15000
        var photo: AccessibilityNodeInfo? = null
        while (photo == null && android.os.SystemClock.uptimeMillis() < deadline) {
            photo = nativeNodes().firstOrNull { it.viewIdResourceName?.endsWith("icon_thumbnail") == true || it.contentDescription?.toString()?.startsWith("Photo taken") == true }
            if (photo == null) android.os.SystemClock.sleep(200)
        }
        nativeClick(requireNotNull(photo) { "Native photo picker did not show media" })
        if (tag == "asset-pick-photos") {
            val confirmDeadline = android.os.SystemClock.uptimeMillis() + 15000
            var confirm: AccessibilityNodeInfo? = null
            while (confirm == null && android.os.SystemClock.uptimeMillis() < confirmDeadline) {
                confirm = nativeNodes().firstOrNull { it.viewIdResourceName?.endsWith("button_add") == true || it.text?.toString()?.startsWith("Add") == true || it.text?.toString() == "Done" }
                if (confirm == null) android.os.SystemClock.sleep(200)
            }
            nativeClick(requireNotNull(confirm) { "Native picker confirmation did not appear" })
            compose.waitUntil(15000) { compose.onAllNodesWithTag("asset-cover-0").fetchSemanticsNodes().isNotEmpty() }
        } else {
            compose.waitUntil(15000) { compose.onAllNodes(hasTestTag(tag) and hasText("Thay ảnh")).fetchSemanticsNodes().isNotEmpty() }
        }
    }
    private fun addImage(name: String, write: (java.io.OutputStream) -> Unit) {
        val uri = requireNotNull(context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "$name-${System.currentTimeMillis()}.jpg")
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/TroOiOnboardingTest")
            put(MediaStore.Images.Media.DATE_TAKEN, System.currentTimeMillis())
        }))
        temporaryMedia += uri
        requireNotNull(context.contentResolver.openOutputStream(uri)).use(write)
    }
    private fun specimenPhoto(label: String) {
        val bitmap = Bitmap.createBitmap(800, 500, Bitmap.Config.ARGB_8888)
        Canvas(bitmap).apply {
            drawColor(Color.rgb(236, 241, 244))
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.DKGRAY; textSize = 38f }
            drawText("SPECIMEN - NOT A DOCUMENT", 35f, 80f, paint)
            drawText(label, 35f, 145f, paint)
            paint.color = Color.rgb(174, 187, 196)
            drawCircle(400f, 290f, 80f, paint)
        }
        addImage("identity-specimen") { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        bitmap.recycle()
    }
    @Test fun fullOnboardingCreatesOnePrivateAssetAndRestoresOnlyItsOwnCapability() = runBlocking {
        compose.waitUntil(20000) { compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty() || compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }
        if (compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty()) logout()
        // Only this dedicated QA fixture is reset; original tenant/owner catalogs remain untouched.
        val prefs = context.getSharedPreferences("trooi_debug_session", android.content.Context.MODE_PRIVATE)
        assertTrue(prefs.edit().remove("organization:fixture-user-linh").remove("management:fixture-user-linh").commit())
        val originalOwnerCatalog = prefs.getString("management:fixture-user-ha", null)
        try {
            login("onboarding@trooi.local")
            compose.onNodeWithTag("nav-tab-profile").performClick()
            compose.onNodeWithText("Thành viên TrọƠi").assertExists()
            compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("profile-landlord-cta"))
            compose.onNodeWithTag("profile-landlord-cta").performClick()
            screenshot("onboarding-intro")
            compose.onNodeWithTag("onboarding-next").performClick()
            compose.onNodeWithTag("onboarding-name").performTextReplacement("Phạm Thảo Linh Nguyễn")
            compose.onNodeWithTag("onboarding-birthday").performTextReplacement("15/06/1995")
            compose.onNodeWithTag("onboarding-birthday").performImeAction()
            screenshot("onboarding-personal")
            compose.onNodeWithTag("onboarding-next").performClick()
            listOf("front", "back", "selfie").forEach { side ->
                specimenPhoto(side)
                compose.onNodeWithTag("onboarding-scroll").performScrollToNode(hasTestTag("onboarding-id-$side"))
                pickSingle("onboarding-id-$side")
            }
            compose.onNodeWithTag("onboarding-scroll").performScrollToNode(hasTestTag("onboarding-identity-accept"))
            compose.onNodeWithTag("onboarding-identity-accept").performClick()
            screenshot("onboarding-identity-local")
            compose.onNodeWithTag("onboarding-next").performClick()
            compose.onNodeWithTag("onboarding-phone").performTextReplacement("0901234567")
            compose.onNodeWithTag("onboarding-email").performTextReplacement("linh@example.test")
            compose.onNodeWithTag("onboarding-email").performImeAction()
            compose.onNodeWithTag("onboarding-contact-confirm").performClick()
            screenshot("onboarding-contact")
            compose.onNodeWithTag("onboarding-next").performClick()
            compose.onNodeWithTag("onboarding-first-asset").performClick()
            compose.onNodeWithTag("asset-type-Căn hộ").performClick()
            compose.onNodeWithTag("asset-next").performClick()
            field("asset-name", "Căn hộ L01")
            field("asset-address", "24 Đường D5, Bình Thạnh, TP.HCM")
            field("asset-public-area", "Bình Thạnh, TP.HCM")
            field("asset-area", "34")
            compose.onNodeWithTag("asset-area").performImeAction()
            compose.onNodeWithTag("asset-next").performClick()
            field("asset-bedrooms", "1")
            field("asset-bathrooms", "1")
            field("asset-max-occupants", "2")
            field("asset-floor", "3")
            field("asset-description", "Căn hộ thoáng sáng, có bếp riêng. Phù hợp thuê dài hạn.")
            compose.onNodeWithTag("asset-next").performClick()
            field("asset-rent", "4200000")
            field("asset-deposit", "4200000")
            compose.onNodeWithTag("asset-next").performClick()
            compose.onNodeWithTag("asset-next").performClick()
            addImage("rental-space") { output -> context.resources.openRawResource(R.drawable.rental_studio).use { it.copyTo(output) } }
            pickSingle("asset-pick-photos")
            compose.onNodeWithTag("asset-next").performClick()
            compose.onNodeWithTag("asset-save-active").performClick()
            compose.waitUntil(15000) { compose.onAllNodesWithTag("asset-wizard").fetchSemanticsNodes().isEmpty() }
            screenshot("onboarding-first-asset")
            assertNull(prefs.getString("organization:fixture-user-linh", null))
            compose.onNodeWithTag("onboarding-next").performClick()
            compose.onNodeWithTag("onboarding-scroll").performScrollToNode(hasTestTag("onboarding-acknowledgement"))
            compose.onNodeWithTag("onboarding-acknowledgement").performClick()
            screenshot("onboarding-review")
            compose.onNodeWithTag("onboarding-next").performClick()
            compose.waitUntil(15000) { compose.onAllNodesWithText("Bạn đã sẵn sàng").fetchSemanticsNodes().isNotEmpty() }
            screenshot("onboarding-complete")
            compose.onNodeWithTag("onboarding-next").performClick()
            waitFor("ledger-screen")
            compose.onNodeWithText("Tài sản của tôi").assertExists()
            screenshot("onboarding-owner-ledger")
            val repository = TroOiRepositoryImpl(context)
            val session = repository.refreshSessionContext().getOrThrow()
            assertEquals(setOf("local-organization-fixture-user-linh"), session.access.operatedOrganizationIds)
            val read = repository.refreshAuthorizedRead(session.access).getOrThrow()
            val asset = read.localManagement!!.assets.single()
            assertEquals("Căn hộ L01", asset.name)
            assertEquals(1, read.localManagement!!.used)
            assertEquals(ListingVisibility.DRAFT, asset.listingStatus)
            assertEquals(listOf(asset.id), read.operationalRooms.map { it.roomId })
            assertTrue(read.tenancies.isEmpty())
            assertTrue(read.operatorFinanceByOrganization.isEmpty())
            assertTrue(read.publicListings.none { it.listingId == asset.listingId })
            assertEquals(originalOwnerCatalog, prefs.getString("management:fixture-user-ha", null))
            listOf("Phạm Thảo Linh Nguyễn", "15/06/1995", "1995-06-15", "0901234567", "linh@example.test").forEach { personal ->
                assertFalse(personal, prefs.all.values.any { it.toString().contains(personal) })
            }
            compose.activityRule.scenario.recreate()
            waitFor("ledger-screen")
            compose.onNodeWithText("Tài sản của tôi").assertExists()
            logout()
            login("onboarding@trooi.local")
            compose.onNodeWithText("Căn hộ L01").assertExists()
            logout()
            login("tenant@trooi.local")
            compose.onNodeWithText("Tài sản đang thuê").assertExists()
            assertTrue(TroOiRepositoryImpl(context).refreshSessionContext().getOrThrow().access.operatedOrganizationIds.isEmpty())
            logout()
            login("owner@trooi.local")
            compose.onNodeWithText("Tài sản của tôi").assertExists()
            assertEquals(originalOwnerCatalog, prefs.getString("management:fixture-user-ha", null))
        } finally { temporaryMedia.forEach { context.contentResolver.delete(it, null, null) } }
    }
}
