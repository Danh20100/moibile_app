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
            // Logout is a protected confirmation; the first tap only opens the dialog.
            compose.onAllNodesWithText("Đăng xuất").onLast().performClick()
            compose.waitUntil(15000) {
                runCatching { compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }.getOrDefault(false)
            }
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
        nativeClick(requireNotNull(photo) {
            "Native photo picker did not show media (activeWindow=" +
                instrumentation.uiAutomation.rootInActiveWindow?.packageName +
                ", nodes=" + nativeNodes().take(100).map { "${it.viewIdResourceName}:${it.text}:${it.contentDescription}" } + ")"
        })
        if (tag.startsWith("onboarding-id-")) {
            // Some API 37 Photo Picker builds use an explicit Done confirmation even for
            // a single selection. Only press it when the *native picker* is still foreground.
            val pickerDeadline = android.os.SystemClock.uptimeMillis() + 5000
            while (android.os.SystemClock.uptimeMillis() < pickerDeadline) {
                val root = instrumentation.uiAutomation.rootInActiveWindow
                if (root?.packageName?.toString()?.contains("photopicker", ignoreCase = true) != true) break
                val done = nativeNodes().firstOrNull { it.text?.toString() == "Done" || it.viewIdResourceName?.endsWith("button_add") == true }
                if (done != null) { nativeClick(done); break }
                android.os.SystemClock.sleep(150)
            }
        }
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
            // The native picker temporarily removes the Compose root while closing.
            // The current ScanPhotoTile updates its action to "Đổi ảnh" after a successful read.
            compose.waitUntil(15000) {
                runCatching {
                    compose.onAllNodes(hasTestTag(tag) and hasText("Đổi ảnh")).fetchSemanticsNodes().isNotEmpty()
                }.getOrDefault(false)
            }
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
    @Test fun fullOnboardingCreatesWorkspaceWithoutImplicitAssetAndRestoresOnlyItsOwnCapability() = runBlocking {
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
            // Current onboarding requires both ID images before the user reviews any OCR output.
            listOf("front", "back").forEach { side ->
                specimenPhoto(side)
                compose.onNodeWithTag("onboarding-scroll").performScrollToNode(hasTestTag("onboarding-id-$side"))
                pickSingle("onboarding-id-$side")
            }
            compose.onNodeWithTag("onboarding-next").assertIsEnabled().performClick()
            compose.onNodeWithTag("onboarding-name").performTextReplacement("Phạm Thảo Linh Nguyễn")
            compose.onNodeWithTag("onboarding-birthday").performTextReplacement("15/06/1995")
            compose.onNodeWithTag("onboarding-birthday").performImeAction()
            compose.onNodeWithTag("onboarding-scroll").performScrollToNode(hasTestTag("onboarding-identity-accept"))
            compose.onNodeWithTag("onboarding-identity-accept").performClick()
            screenshot("onboarding-identity-local")
            compose.onNodeWithTag("onboarding-next").performClick()
            compose.onNodeWithTag("onboarding-phone").performTextReplacement("0901234567")
            compose.onNodeWithTag("onboarding-email").performTextReplacement("linh@example.test")
            compose.onNodeWithTag("onboarding-email").performImeAction()
            compose.onNodeWithTag("onboarding-contact-confirm").performClick()
            compose.onNodeWithTag("onboarding-scroll").performScrollToNode(hasTestTag("onboarding-acknowledgement"))
            compose.onNodeWithTag("onboarding-acknowledgement").performClick()
            screenshot("onboarding-contact")
            // Operator capability is granted at submission, not during identity/photo capture.
            assertNull(prefs.getString("organization:fixture-user-linh", null))
            compose.onNodeWithTag("onboarding-next").assertIsEnabled().performClick()
            compose.waitUntil(15000) {
                compose.onAllNodesWithText("Hồ sơ chủ trọ đã sẵn sàng.").fetchSemanticsNodes().isNotEmpty()
            }
            screenshot("onboarding-complete")
            compose.onNodeWithTag("onboarding-next").performClick()
            waitFor("ledger-screen")
            compose.onNodeWithText("Tài sản của tôi").assertExists()
            screenshot("onboarding-owner-ledger")
            val repository = TroOiRepositoryImpl(context)
            val session = repository.refreshSessionContext().getOrThrow()
            assertEquals(setOf("local-organization-fixture-user-linh"), session.access.operatedOrganizationIds)
            val read = repository.refreshAuthorizedRead(session.access).getOrThrow()
            // First asset creation was moved to the Operator Workspace. Onboarding must not
            // silently create a room, listing, tenancy, receivable, or payment.
            assertTrue(read.localManagement!!.assets.isEmpty())
            assertEquals(0, read.localManagement!!.used)
            assertTrue(read.operationalRooms.isEmpty())
            assertTrue(read.tenancies.isEmpty())
            assertTrue(read.operatorFinanceByOrganization.isEmpty())
            assertEquals(originalOwnerCatalog, prefs.getString("management:fixture-user-ha", null))
            listOf("Phạm Thảo Linh Nguyễn", "15/06/1995", "1995-06-15", "0901234567", "linh@example.test").forEach { personal ->
                assertFalse(personal, prefs.all.values.any { it.toString().contains(personal) })
            }
            compose.activityRule.scenario.recreate()
            waitFor("ledger-screen")
            compose.onNodeWithText("Tài sản của tôi").assertExists()
            logout()
            login("onboarding@trooi.local")
            val restored = repository.refreshSessionContext().getOrThrow()
            assertEquals(setOf("local-organization-fixture-user-linh"), restored.access.operatedOrganizationIds)
            assertTrue(repository.refreshAuthorizedRead(restored.access).getOrThrow().localManagement!!.assets.isEmpty())
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
