package com.trooi.app.features

import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.demo.DemoRentalGraph
import com.trooi.app.core.model.*
import com.trooi.app.features.ledger.AssetWizard
import com.trooi.app.features.profile.LandlordOnboardingScreen
import com.trooi.app.features.shared.TrustReportReason
import com.trooi.app.features.shared.TrustReportScreen
import com.trooi.app.features.shared.V1ContextSwitcherScreen
import com.trooi.app.ui.components.TroOiScreenScaffold
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Test
import java.io.File

/** No identity media, location grant, persisted save, purchase, report receipt or completion proof. */
class NativeRemainingStatesTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (root == null) emptyList() else
        listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }
    private fun visible(): List<AccessibilityNodeInfo> {
        if (Build.VERSION.SDK_INT >= 34) instrumentation.uiAutomation.clearCache()
        return nodes(instrumentation.uiAutomation.rootInActiveWindow)
    }
    private fun find(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo {
        repeat(50) { visible().firstOrNull(predicate)?.let { return it }; Thread.sleep(100) }
        error("Missing remaining control: " + visible().joinToString { "${it.text?.toString()?.take(80)}:${it.viewIdResourceName}" })
    }
    private fun text(value: String) = find { it.text?.toString() == value }
    private fun tag(value: String) = find { it.viewIdResourceName == value }
    private fun scrollTo(value: String): AccessibilityNodeInfo {
        repeat(12) {
            visible().firstOrNull { it.viewIdResourceName == value && it.isVisibleToUser }?.let { return it }
            visible().firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            Thread.sleep(300)
        }
        return tag(value)
    }
    private fun click(value: String) {
        repeat(12) {
            for (candidate in visible().filter { it.text?.toString() == value || it.text?.toString()?.startsWith("$value\n") == true }) {
                var node: AccessibilityNodeInfo? = candidate
                while (node != null && !node.isClickable) node = node.parent
                if (node?.isEnabled == true && node.isVisibleToUser && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                    instrumentation.waitForIdleSync(); return
                }
            }
            visible().firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            Thread.sleep(500)
        }
        error("Unreachable remaining action: $value")
    }
    private fun set(node: AccessibilityNodeInfo, value: String) {
        assertTrue(node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
            Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value) }))
        text(value)
    }
    private fun shell(command: String): String = ParcelFileDescriptor.AutoCloseInputStream(
        instrumentation.uiAutomation.executeShellCommand(command)).bufferedReader().use { it.readText() }
    private fun capture(name: String, dark: Boolean) {
        Thread.sleep(500)
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "round5-remaining-states").apply { mkdirs() }
        val bitmap = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
        File(directory, "$name-320-font1.3-${if (dark) "dark" else "light"}.png").outputStream().use {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
        }
        bitmap.recycle()
    }
    private fun draft() = DemoData.ownerManagement.assets.single { it.id == DemoRentalGraph.AN_NHIEN }

    @Test fun wizardRejectedDraftSaveRetainsValuesAndAllStepsRemainReachable() {
        val validDraft = draft().copy(
            description = "Mô tả tài sản hợp lệ",
            operationalLatitude = "10.7769",
            operationalLongitude = "106.7009",
        )
        for (dark in listOf(false, true)) {
            var closes = 0
            var purchases = 0
            val saves = mutableListOf<Triple<LocalRentalAsset, Boolean, Boolean>>()
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            AssetWizard(validDraft, DemoData.ownerManagement, "Native owner", { closes++ },
                                { asset, activate, publish -> saves += Triple(asset, activate, publish); Result.failure(IllegalStateException("Native rejected save")) },
                                { purchases++; Result.failure(IllegalStateException("Native rejected purchase")) })
                        }
                    }
                } }
                text(validDraft.name)
                set(find { it.className == "android.widget.EditText" && it.text?.toString() == validDraft.name }, "Tên tài sản dài giữ nguyên sau lỗi lưu")
                capture("wizard-step1", dark)
                click("Lưu nháp"); text("Native rejected save")
                assertEquals(1, saves.size); assertEquals(false, saves.single().second); assertEquals(false, saves.single().third)
                assertEquals("Tên tài sản dài giữ nguyên sau lỗi lưu", saves.single().first.name)
                assertEquals(0, closes); assertEquals(0, purchases); capture("wizard-save-rejected", dark)
                for (step in 2..6) { click("Tiếp tục"); text("Bước $step / 6"); capture("wizard-step$step", dark) }
                assertEquals(1, saves.size); assertEquals(0, purchases); assertEquals(0, closes)
                click("Xem trước tin đăng"); text("Tên tài sản dài giữ nguyên sau lỗi lưu")
                capture("wizard-preview", dark)
                shell("input keyevent 4"); text("Bước 6 / 6")
            }
        }
    }

    @Test fun wizardFocusedFieldAndFooterFitDockedKeyboardAndFirstBackRetainsStep() {
        val automation = instrumentation.uiAutomation
        val originalFlags = automation.serviceInfo.flags
        val keyboard = shell("settings get secure show_ime_with_hard_keyboard").trim()
        try {
            automation.serviceInfo = automation.serviceInfo.apply { flags = flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS }
            shell("settings put secure show_ime_with_hard_keyboard 1")
            for (dark in listOf(false, true)) ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            AssetWizard(draft(), DemoData.ownerManagement, "Native owner", {},
                                { _, _, _ -> Result.failure(IllegalStateException("No native save")) },
                                { Result.failure(IllegalStateException("No native purchase")) })
                        }
                    }
                } }
                val field = find { it.className == "android.widget.EditText" && it.text?.toString() == draft().name }
                assertTrue(field.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                var ime: AccessibilityWindowInfo? = null
                repeat(50) {
                    ime = automation.windows.firstOrNull { it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD }
                    if (ime == null) Thread.sleep(100)
                }
                val imeBounds = Rect().also { checkNotNull(ime) { "Keyboard must actually dock" }.getBoundsInScreen(it) }
                Thread.sleep(500)
                capture("wizard-ime", dark)
                val focused = find { it.className == "android.widget.EditText" && it.text?.toString() == draft().name }
                val fieldBounds = Rect().also { focused.getBoundsInScreen(it) }
                var next = text("Tiếp tục")
                while (!next.isClickable) next = next.parent
                val nextBounds = Rect().also { next.getBoundsInScreen(it) }
                assertTrue("Focused field must be visible above IME", focused.isVisibleToUser && fieldBounds.bottom <= imeBounds.top)
                assertTrue("Continue must fit above IME", nextBounds.bottom <= imeBounds.top)
                text("Bước 1 / 6")
                shell("input keyevent 4")
                repeat(50) { if (automation.windows.any { it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD }) Thread.sleep(100) }
                assertFalse(automation.windows.any { it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD })
                text("Bước 1 / 6"); text(draft().name)
            }
        } finally {
            automation.serviceInfo = automation.serviceInfo.apply { flags = originalFlags }
            shell(if (keyboard == "null") "settings delete secure show_ime_with_hard_keyboard" else "settings put secure show_ime_with_hard_keyboard $keyboard")
        }
    }

    @Test fun onboardingCannotAdvanceWithoutIdentityMediaAndCancelDoesNotComplete() {
        for (dark in listOf(false, true)) {
            var dismisses = 0
            var finishes = 0
            var completed = 0
            val shown = mutableStateOf(true)
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            if (shown.value) LandlordOnboardingScreen("Người kiểm thử", { dismisses++; shown.value = false }, { finishes++ },
                                { completed++; Result.failure(IllegalStateException("No native completion")) })
                        }
                    }
                } }
                text("Trở thành chủ trọ"); capture("onboarding-start", dark); click("Bắt đầu")
                text("Quét căn cước công dân")
                assertTrue(visible().any { !it.isEnabled && nodes(it).any { child -> child.text?.toString() == "Tiếp tục" } })
                assertEquals(0, completed); assertEquals(0, finishes); capture("onboarding-identity-unready", dark)
                shell("input keyevent 4"); text("Trở thành chủ trọ")
                click("Đóng"); text("Đóng đăng ký chủ trọ?"); click("Tiếp tục đăng ký")
                text("Trở thành chủ trọ"); assertEquals(0, dismisses)
                click("Đóng"); click("Đóng đăng ký"); assertEquals(1, dismisses); assertEquals(0, completed); assertEquals(0, finishes)
            }
        }
    }

    @Test fun reportErrorRetainsCappedNoteReasonAndBusyBlocksSubmission() {
        val listing = DemoData.read.publicListings.first()
        for (dark in listOf(false, true)) for (busy in listOf(false, true)) {
            var submitted: Triple<String, String, String>? = null
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            TroOiScreenScaffold(contentWindowInsets = WindowInsets.safeDrawing) { insets ->
                                Box(Modifier.width(320.dp).fillMaxHeight().padding(insets).consumeWindowInsets(insets).semantics { testTagsAsResourceId = true }) {
                                    TrustReportScreen(TroOiUiState(isAuthenticated = true, read = DemoData.read,
                                        trustReportError = "Native report error", submittingTrustReport = busy), listing.listingId, {},
                                        { id, reason, note -> submitted = Triple(id, reason, note) })
                                }
                            }
                        }
                    }
                } }
                if (!busy) {
                    val reason = TrustReportReason.entries.last()
                    if (InstrumentationRegistry.getArguments().getString("stage") == "before") {
                        val row = scrollTo("trust-reason-" + reason.name)
                        assertTrue(nodes(row).first { it.isClickable && it.isEnabled }.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                    } else {
                        assertEquals(1, nodes(scrollTo("trust-reason-" + reason.name)).count { it.isClickable })
                        click(reason.label)
                        val row = tag("trust-reason-" + reason.name)
                        assertTrue(row.isChecked)
                        assertEquals(0, nodes(row).count { it.isClickable })
                    }
                    assertTrue(scrollTo("trust-report-note").performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                        Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "x".repeat(2001)) }))
                    text("x".repeat(2000)); click("Thử gửi lại")
                    assertEquals(Triple(listing.listingId, reason.name, "x".repeat(2000)), submitted)
                    text("Native report error"); assertFalse(visible().any { it.viewIdResourceName == "trust-report-receipt" })
                } else {
                    assertFalse(scrollTo("trust-report-note").isEnabled)
                    assertFalse(scrollTo("trust-report-submit").isEnabled)
                    repeat(6) {
                        visible().firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)
                        Thread.sleep(200)
                    }
                    click("Hủy"); assertNull(submitted)
                }
                capture(if (busy) "report-busy" else "report-error", dark)
            }
        }
    }

    @Test fun contextSelectionKeepsExactRelationshipIdsAndBackCallback() {
        for (dark in listOf(false, true)) for (account in DemoData.accounts.take(2)) {
            val events = mutableListOf<SelectedContext>()
            var backs = 0
            val state = TroOiUiState(displayName = account.displayName, access = account.access, read = DemoData.authorizedRead(account.access))
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            V1ContextSwitcherScreen(state, { events += it }, { backs++ })
                        }
                    }
                } }
                text("Chọn không gian"); click("Khám phá"); assertEquals(SelectedContext.Discovery, events.last())
                if (account.access.linkedTenancyIds.isNotEmpty()) {
                    val id = account.access.linkedTenancyIds.sorted().first()
                    click(state.read.tenancies.first { it.tenancyId == id }.roomLabel); assertEquals(SelectedContext.Tenant(id), events.last())
                }
                if (account.access.operatedOrganizationIds.isNotEmpty()) {
                    val id = account.access.operatedOrganizationIds.sorted().first()
                    click(state.read.organizations.first { it.organizationId == id }.displayName); assertEquals(SelectedContext.Operations(id), events.last())
                }
                capture(if (account.access.operatedOrganizationIds.isEmpty()) "context-tenant" else "context-owner", dark)
                click("← Quay lại"); assertEquals(1, backs)
            }
        }
    }
}
