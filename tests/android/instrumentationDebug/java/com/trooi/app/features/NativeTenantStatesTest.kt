package com.trooi.app.features

import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.accessibility.AccessibilityNodeInfo
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.*
import com.trooi.app.features.tenancy.RentPaymentScreen
import com.trooi.app.features.tenant.V1TenantPortalScreen
import com.trooi.app.ui.components.TroOiScreenScaffold
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Test
import java.io.File

/** Catalog projections exercise layout only; checkout callbacks reject without transport or storage. */
class NativeTenantStatesTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (root == null) emptyList() else
        listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }
    private fun visible(): List<AccessibilityNodeInfo> {
        if (Build.VERSION.SDK_INT >= 34) instrumentation.uiAutomation.clearCache()
        return nodes(instrumentation.uiAutomation.rootInActiveWindow)
    }
    private fun find(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo {
        repeat(50) { visible().firstOrNull(predicate)?.let { return it }; Thread.sleep(100) }
        error("Missing tenant control: " + visible().joinToString { "${it.text}:${it.viewIdResourceName}" })
    }
    private fun tag(value: String) = find { it.viewIdResourceName == value }
    private fun click(text: String) {
        repeat(12) {
            var node = visible().firstOrNull { it.text?.toString() == text || it.text?.toString()?.startsWith("$text\n") == true }
            while (node != null && !node.isClickable) node = node.parent
            if (node?.isEnabled == true && node.isVisibleToUser && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                instrumentation.waitForIdleSync(); return
            }
            visible().firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            Thread.sleep(500)
        }
        error("Unreachable tenant action: $text")
    }
    private fun shell(command: String): String = ParcelFileDescriptor.AutoCloseInputStream(
        instrumentation.uiAutomation.executeShellCommand(command)).bufferedReader().use { it.readText() }
    private fun framebuffer(): Bitmap? {
        val encoded = shell("screencap -p /data/local/tmp/trooi-fallback.png && base64 /data/local/tmp/trooi-fallback.png")
        val bytes = runCatching { android.util.Base64.decode(encoded, android.util.Base64.DEFAULT) }.getOrNull() ?: return null
        return android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }
    private fun capture(name: String, dark: Boolean) {
        Thread.sleep(500)
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "round5-tenant-states").apply { mkdirs() }
        var bitmap: Bitmap? = null
        val deadline = android.os.SystemClock.uptimeMillis() + 2000
        while (bitmap == null && android.os.SystemClock.uptimeMillis() < deadline) {
            bitmap = instrumentation.uiAutomation.takeScreenshot()
            if (bitmap == null) Thread.sleep(300)
        }
        val captured = checkNotNull(bitmap ?: framebuffer()) { "Screenshot was null after UiAutomation and screencap: $name" }
        File(directory, "$name-320-font1.3-${if (dark) "dark" else "light"}.png").outputStream().use {
            captured.compress(Bitmap.CompressFormat.PNG, 100, it)
        }
        captured.recycle()
    }
    private fun projection(): TroOiUiState {
        val account = DemoData.accounts.first()
        return TroOiUiState(isAuthenticated = true, backendUserId = account.userId, access = account.access,
            read = DemoData.authorizedRead(account.access), selectedContext = SelectedContext.Tenant(DemoData.TENANCY))
    }

    @Test fun paymentFieldKeepsHeaderAndActionAboveDockedKeyboard() {
        fun shell(command: String): String = android.os.ParcelFileDescriptor.AutoCloseInputStream(
            instrumentation.uiAutomation.executeShellCommand(command)).bufferedReader().use { it.readText() }
        val original = shell("settings get secure show_ime_with_hard_keyboard").trim()
        try {
            shell("settings put secure show_ime_with_hard_keyboard 1")
            for (dark in listOf(false, true)) ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                var imeTop = Int.MAX_VALUE
                scenario.onActivity { activity ->
                    activity.enableEdgeToEdge()
                    activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
                    activity.setContent {
                        TroOiTheme(darkTheme = dark) {
                            val density = LocalDensity.current
                            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                                Box(Modifier.width(320.dp).fillMaxHeight().semantics { testTagsAsResourceId = true }) {
                                    RentPaymentScreen(projection(), {}, {}, {}, { null },
                                        { _, _ -> Result.failure(IllegalStateException("No native submission")) },
                                        { Result.failure(IllegalStateException("No native checkout")) })
                                }
                            }
                        }
                    }
                }
                assertTrue(tag("rent-payment-amount").performAction(AccessibilityNodeInfo.ACTION_CLICK))
                repeat(50) {
                    scenario.onActivity { activity ->
                        val root = activity.window.decorView
                        val bottom = root.rootWindowInsets?.getInsets(android.view.WindowInsets.Type.ime())?.bottom ?: 0
                        if (bottom > 0) imeTop = root.height - bottom
                    }
                    if (imeTop == Int.MAX_VALUE) Thread.sleep(100)
                }
                assertTrue("Keyboard must actually dock", imeTop < Int.MAX_VALUE)
                val action = tag("rent-payment-review")
                val bounds = Rect().also { action.getBoundsInScreen(it) }
                assertTrue("Payment action must be above IME", bounds.bottom <= imeTop)
                assertTrue(visible().any { it.contentDescription?.toString() == "Về Sổ" && it.isVisibleToUser })
                capture("payment-ime", dark)
                shell("input keyevent 4")
                var hidden = false
                repeat(50) {
                    scenario.onActivity { activity ->
                        hidden = activity.window.decorView.rootWindowInsets?.getInsets(android.view.WindowInsets.Type.ime())?.bottom == 0
                    }
                    if (!hidden) Thread.sleep(100)
                }
                assertTrue("First Back hides keyboard", hidden)
                tag("rent-payment-screen")
            }
        } finally {
            shell(if (original == "null") "settings delete secure show_ime_with_hard_keyboard" else "settings put secure show_ime_with_hard_keyboard $original")
        }
    }

    @Test fun paymentValidationAndRejectedCheckoutRetainAmountWithoutConfirmation() {
        for (dark in listOf(false, true)) {
            var submitted: Pair<String, String>? = null
            var creates = 0
            var backs = 0
            var done = 0
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            Box(Modifier.width(320.dp).fillMaxHeight().semantics { testTagsAsResourceId = true }) {
                                RentPaymentScreen(projection(), { backs++ }, { done++ }, {}, { null },
                                    { tenancy, amount -> creates++; submitted = tenancy to amount; Result.failure(IllegalStateException("Native rejected checkout")) },
                                    { Result.failure(IllegalStateException("No checkout to refresh")) })
                            }
                        }
                    }
                } }
                fun amount(value: String) {
                    assertTrue(tag("rent-payment-amount").performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                        Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value) }))
                    find { it.viewIdResourceName == "rent-payment-amount" && it.text?.toString() == value }
                }
                amount("999"); find { it.viewIdResourceName == "rent-payment-review" && !it.isEnabled }
                amount("1000"); find { it.viewIdResourceName == "rent-payment-review" && it.isEnabled }
                capture("payment-form", dark)
                click("Tiếp tục"); tag("rent-payment-open"); assertEquals(0, creates)
                capture("payment-review", dark)
                click("Mở trang thanh toán")
                repeat(10) {
                    if (visible().none { it.viewIdResourceName == "rent-payment-error" }) {
                        visible().firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                        Thread.sleep(300)
                    }
                }
                tag("rent-payment-error")
                assertEquals(1, creates); assertEquals(DemoData.TENANCY to "1000", submitted); assertEquals(0, done)
                assertFalse(visible().any { it.viewIdResourceName == "rent-payment-confirmed" || it.viewIdResourceName == "rent-payment-done" })
                capture("payment-rejected", dark)
                click("Sửa số tiền")
                repeat(5) {
                    if (visible().none { it.viewIdResourceName == "rent-payment-amount" }) {
                        visible().firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)
                        Thread.sleep(300)
                    }
                }
                assertEquals("1000", tag("rent-payment-amount").text.toString())
                var back = find { it.contentDescription?.toString() == "Về Sổ" }
                while (!back.isClickable) back = back.parent
                assertTrue(back.performAction(AccessibilityNodeInfo.ACTION_CLICK)); instrumentation.waitForIdleSync(); assertEquals(1, backs)
            }
        }
    }

    @Test fun portalKeepsLinkedProjectionAndSelectedNavigationInBothThemes() {
        val before = InstrumentationRegistry.getArguments().getString("stage") == "before"
        for (dark in listOf(false, true)) ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity -> activity.setContent {
                TroOiTheme(darkTheme = dark) {
                    val density = LocalDensity.current
                    CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                        TroOiScreenScaffold(contentWindowInsets = WindowInsets.safeDrawing) { insets ->
                            Box(Modifier.width(320.dp).fillMaxHeight().padding(insets).consumeWindowInsets(insets).semantics { testTagsAsResourceId = true }) {
                                V1TenantPortalScreen(projection(), {})
                            }
                        }
                    }
                }
            } }
            find { it.text?.toString() == "Khu vực người thuê" }; capture("portal-linked", dark)
            click("Deposit")
            // Compose exposes Selected on Button as checked/stateDescription, unlike Tab's isSelected.
            if (!before) find { it.viewIdResourceName == "tenant-portal-deposit" && it.isChecked && it.stateDescription != null }
            capture("portal-deposit-selected", dark)
        }
    }
}
