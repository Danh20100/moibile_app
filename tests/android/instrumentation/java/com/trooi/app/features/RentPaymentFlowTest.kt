package com.trooi.app.features

import android.content.Intent
import android.net.Uri
import android.graphics.Bitmap
import android.content.ContentValues
import android.provider.MediaStore
import android.view.accessibility.AccessibilityNodeInfo
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.MainActivity
import com.trooi.app.core.auth.SessionHintsStore
import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.demo.DemoPaymentClient
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Actual Android -> browser -> signed DemoPay settlement -> backend checkout and Payment read. */
class RentPaymentFlowTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(tag: String) = compose.waitUntil(30000) {
        // Browser/app transitions briefly have no Compose root; absence is a wait, not a test failure.
        runCatching { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }.getOrDefault(false)
    }
    private fun screenshot(name: String) {
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
    private fun nativeNode(text: String): AccessibilityNodeInfo? {
        fun find(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
            if (node.text?.toString() == text || node.contentDescription?.toString() == text) return node
            repeat(node.childCount) { index -> node.getChild(index)?.let { find(it)?.let { found -> return found } } }
            return null
        }
        return instrumentation.uiAutomation.rootInActiveWindow?.let(::find)
    }
    private fun clickNative(text: String) {
        val deadline = android.os.SystemClock.uptimeMillis() + 20000
        var node: AccessibilityNodeInfo?
        do { node = nativeNode(text); if (node != null) break; android.os.SystemClock.sleep(250) } while (android.os.SystemClock.uptimeMillis() < deadline)
        val bounds = android.graphics.Rect()
        requireNotNull(node) { "Missing native action: $text" }.getBoundsInScreen(bounds)
        val time = android.os.SystemClock.uptimeMillis()
        listOf(android.view.MotionEvent.ACTION_DOWN, android.view.MotionEvent.ACTION_UP).forEach { action ->
            android.view.MotionEvent.obtain(time, time + 50, action, bounds.exactCenterX(), bounds.exactCenterY(), 0).apply {
                source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                instrumentation.uiAutomation.injectInputEvent(this, true)
                recycle()
            }
        }
    }
    private fun forgedReturn() = instrumentation.targetContext.startActivity(Intent(Intent.ACTION_VIEW,
        Uri.parse("trooi://payment/demo?status=SUCCEEDED&checkoutId=forged&amount=50000000"))
        .setPackage(instrumentation.targetContext.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))

    @Test fun confirmationRequiresBackendThenRetiresOnlyVerifiedIntent() = runBlocking {
        instrumentation.uiAutomation.serviceInfo = instrumentation.uiAutomation.serviceInfo.apply {
            flags = flags or android.accessibilityservice.AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            feedbackType = android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_GENERIC
        }
        instrumentation.targetContext.startActivity(Intent(instrumentation.targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        compose.waitUntil(30000) { compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty() || compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }
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
        compose.onAllNodes(hasSetTextAction())[0].performTextReplacement("tenant@trooi.local")
        compose.onAllNodes(hasSetTextAction())[1].performTextReplacement("TroOi2026!")
        compose.onNodeWithText("Đăng nhập").performClick()
        waitFor("ledger-screen")
        compose.waitUntil(30000) { compose.onAllNodesWithTag("ledger-payment-entry").fetchSemanticsNodes().isNotEmpty() }
        val backend = DemoPaymentClient()
        val before = backend.finance(DemoData.accounts[0].userId)
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("ledger-payment-entry"))
        compose.onNodeWithTag("ledger-payment-entry").performClick()
        waitFor("rent-payment-amount")
        compose.onNodeWithTag("rent-payment-amount").performTextReplacement("1000")
        compose.waitForIdle()
        compose.onNodeWithTag("rent-payment-review").performClick()
        waitFor("rent-payment-open")
        screenshot("rent-payment-review")
        compose.onNodeWithTag("rent-payment-open").performClick()
        clickNative("Xác nhận thanh toán") // Explicit browser POST; GET/deep links cannot settle.
        val confirmedDeadline = android.os.SystemClock.uptimeMillis() + 20000
        while (nativeNode("Về TrọƠi") == null && android.os.SystemClock.uptimeMillis() < confirmedDeadline) android.os.SystemClock.sleep(250)
        screenshot("rent-payment-browser-confirmed")
        clickNative("Về TrọƠi")
        // Chrome may request permission to open the external app once.
        android.os.SystemClock.sleep(750)
        nativeNode("Open")?.let { clickNative("Open") }
        waitFor("rent-payment-confirmed")
        screenshot("rent-payment-success")
        val hints = SessionHintsStore(instrumentation.targetContext)
        val completed = requireNotNull(hints.read()?.pendingCheckouts?.single())
        val checkout = backend.get(DemoData.accounts[0].userId, requireNotNull(completed.checkoutId))
        assertEquals("SUCCEEDED", checkout.status)
        assertEquals("DEMO", checkout.provider)
        val after = backend.finance(DemoData.accounts[0].userId)
        assertEquals(before.payments.size + 1, after.payments.size)
        assertTrue(after.payments.any { it.paymentId == checkout.resultingPaymentId && it.amountLabel == "1.000đ" })
        assertEquals(before.charges, after.charges)
        assertEquals(before.deposits, after.deposits)
        assertTrue(after.receipts.isEmpty())
        forgedReturn()
        waitFor("rent-payment-confirmed")
        assertEquals(after.payments, backend.finance(DemoData.accounts[0].userId).payments)
        compose.onNodeWithTag("rent-payment-done").performClick()
        assertTrue(hints.read()?.pendingCheckouts.isNullOrEmpty())
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("ledger-payment-entry"))
        compose.onNodeWithTag("ledger-payment-entry").performClick()
        waitFor("rent-payment-amount")
        compose.onNodeWithTag("rent-payment-amount").performTextReplacement("2000")
        compose.onNodeWithTag("rent-payment-review").performClick()
        compose.onNodeWithTag("rent-payment-open").performClick()
        // Return before confirmation: a forged success URI still leaves the checkout CREATED.
        val deadline = android.os.SystemClock.uptimeMillis() + 15000
        while (hints.read()?.pendingCheckouts?.singleOrNull()?.checkoutId == null && android.os.SystemClock.uptimeMillis() < deadline) android.os.SystemClock.sleep(250)
        forgedReturn()
        waitFor("rent-payment-refresh")
        compose.onNodeWithTag("rent-payment-confirmed").assertDoesNotExist()
        val second = requireNotNull(hints.read()?.pendingCheckouts?.single())
        assertNotEquals(completed.idempotencyKey, second.idempotencyKey)
        assertEquals("CREATED", backend.get(DemoData.accounts[0].userId, requireNotNull(second.checkoutId)).status)
        assertEquals(after.payments, backend.finance(DemoData.accounts[0].userId).payments)
        screenshot("rent-payment-forged-return-pending")
    }
}
