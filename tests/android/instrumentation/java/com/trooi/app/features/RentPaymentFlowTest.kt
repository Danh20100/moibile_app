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
import com.trooi.app.core.data.AppDataSource
import com.trooi.app.core.data.RuntimeDataSource
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
        val bitmap = requireNotNull(captureScreenshot())
        val resolver = instrumentation.targetContext.contentResolver
        val uri = requireNotNull(resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "$name-${System.currentTimeMillis()}.png")
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/TroOiRuntime")
        }))
        requireNotNull(resolver.openOutputStream(uri)).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
    }
    private fun captureScreenshot(): Bitmap? {
        repeat(3) { attempt ->
            instrumentation.uiAutomation.takeScreenshot()?.let { return it }
            if (attempt < 2) android.os.SystemClock.sleep(300)
        }
        return null
    }
    private fun nativeNode(text: String): AccessibilityNodeInfo? {
        val matches = mutableListOf<AccessibilityNodeInfo>()
        fun visit(node: AccessibilityNodeInfo) {
            if (node.text?.toString() == text || node.contentDescription?.toString() == text) matches += node
            repeat(node.childCount) { index -> node.getChild(index)?.let(::visit) }
        }
        val roots = instrumentation.uiAutomation.windows.mapNotNull { it.root }
        (roots.ifEmpty { listOfNotNull(instrumentation.uiAutomation.rootInActiveWindow) }).forEach(::visit)
        fun area(node: AccessibilityNodeInfo): Int {
            val bounds = android.graphics.Rect()
            node.getBoundsInScreen(bounds)
            return if (bounds.width() <= 0 || bounds.height() <= 0) 0 else bounds.width() * bounds.height()
        }
        return matches.filter { area(it) > 0 }.maxByOrNull { area(it) + if (it.isClickable) 1_000_000 else 0 }
    }
    private fun chromeFirstRunLabels() = listOf(
        "Use without an account", "Accept & continue", "Accept and continue", "No thanks", "Got it",
        "More", "Continue", "Yes, I'm in", "Không cảm ơn",
    )
    private fun dismissChromeFirstRun(deadlineMs: Long = 15000) {
        val deadline = android.os.SystemClock.uptimeMillis() + deadlineMs
        while (android.os.SystemClock.uptimeMillis() < deadline) {
            val extra = chromeFirstRunLabels().firstNotNullOfOrNull { nativeNode(it) } ?: break
            tapBounds(extra)
            android.os.SystemClock.sleep(400)
        }
    }
    private fun shell(command: String) {
        val pipe = instrumentation.uiAutomation.executeShellCommand(command)
        try { java.io.FileInputStream(pipe.fileDescriptor).readBytes() } finally { pipe.close() }
    }
    /** Wipe/pm-clear leaves Chrome unable to take ACTION_VIEW until first-run is dismissed once. */
    private fun warmChromeForPaymentHandoff() {
        shell("am start -a android.intent.action.VIEW -d 'about:blank' com.android.chrome")
        android.os.SystemClock.sleep(1000)
        dismissChromeFirstRun()
        shell("am force-stop com.android.chrome")
        android.os.SystemClock.sleep(300)
    }
    private fun awaitNative(text: String) {
        val deadline = android.os.SystemClock.uptimeMillis() + 20000
        while (nativeNode(text) == null && android.os.SystemClock.uptimeMillis() < deadline) {
            val extra = chromeFirstRunLabels().firstNotNullOfOrNull { candidate -> nativeNode(candidate) }
            if (extra != null) tapBounds(extra) else android.os.SystemClock.sleep(250)
        }
        check(nativeNode(text) != null) {
            "Browser never showed '$text' | ${nativeDiag(text)}"
        }
        clickUntil(text, untilGone = true)
    }
    private fun nativeDiag(lookingFor: String): String =
        "lookingFor=$lookingFor | ${FailureEvidenceCapture.diagnosticSummary(instrumentation)}"
    private fun tapBounds(node: AccessibilityNodeInfo) {
        val bounds = android.graphics.Rect()
        node.getBoundsInScreen(bounds)
        if (bounds.width() <= 0 || bounds.height() <= 0) return
        val down = android.os.SystemClock.uptimeMillis()
        listOf(android.view.MotionEvent.ACTION_DOWN to down, android.view.MotionEvent.ACTION_UP to down + 90).forEach { (action, eventTime) ->
            android.view.MotionEvent.obtain(down, eventTime, action, bounds.exactCenterX(), bounds.exactCenterY(), 0).apply {
                source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                instrumentation.uiAutomation.injectInputEvent(this, true)
                recycle()
            }
        }
        android.os.SystemClock.sleep(400)
    }
    private fun clickUntil(text: String, untilGone: Boolean = false, untilText: String? = null) {
        val deadline = android.os.SystemClock.uptimeMillis() + 25000
        var attempts = 0
        fun arrived() = (untilText != null && nativeNode(untilText) != null) || (untilGone && nativeNode(text) == null && attempts > 0)
        while (!arrived() && android.os.SystemClock.uptimeMillis() < deadline && attempts < 4) {
            if (nativeNode(text) != null) {
                clickNative(text, motion = attempts % 2 == 1)
                attempts++
                android.os.SystemClock.sleep(2000)
            } else android.os.SystemClock.sleep(250)
        }
        check(arrived()) { "Native action did not complete: $text | ${nativeDiag(text)}" }
    }
    private fun clickNative(text: String, motion: Boolean = false) {
        val deadline = android.os.SystemClock.uptimeMillis() + 20000
        var node: AccessibilityNodeInfo?
        do { node = nativeNode(text); if (node != null) break; android.os.SystemClock.sleep(250) } while (android.os.SystemClock.uptimeMillis() < deadline)
        val target = requireNotNull(node) { "Missing native action: $text | ${nativeDiag(text)}" }
        if (!motion) {
            var current: AccessibilityNodeInfo? = target
            while (current != null) {
                if (current.isClickable && current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return
                current = current.parent
            }
        }
        val bounds = android.graphics.Rect()
        target.getBoundsInScreen(bounds)
        val down = android.os.SystemClock.uptimeMillis()
        listOf(android.view.MotionEvent.ACTION_DOWN to down, android.view.MotionEvent.ACTION_UP to down + 90).forEach { (action, eventTime) ->
            android.view.MotionEvent.obtain(down, eventTime, action, bounds.exactCenterX(), bounds.exactCenterY(), 0).apply {
                source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                instrumentation.uiAutomation.injectInputEvent(this, true)
                recycle()
            }
            android.os.SystemClock.sleep(90)
        }
    }
    private fun shellTap(text: String): String {
        val bounds = android.graphics.Rect()
        val node = nativeNode(text) ?: return "missing $text"
        node.getBoundsInScreen(bounds)
        val command = instrumentation.uiAutomation.executeShellCommand("input tap ${bounds.centerX()} ${bounds.centerY()}")
        val output = try { java.io.FileInputStream(command.fileDescriptor).readBytes().toString(Charsets.UTF_8).trim() } finally { command.close() }
        return "tap ${bounds.toShortString()} output=${output.ifBlank { "ok" }}"
    }
    private fun resumedActivity(): String {
        val command = instrumentation.uiAutomation.executeShellCommand("dumpsys activity activities")
        val output = try { java.io.FileInputStream(command.fileDescriptor).readBytes().toString(Charsets.UTF_8) } finally { command.close() }
        return output.lineSequence().firstOrNull { it.contains("topResumedActivity") }?.trim().orEmpty()
    }
    private fun returnFromBrowser() {
        val choices = listOf("Open", "Just once", "Always", "Open app", "Mở", "Chỉ một lần", "Luôn luôn")
        val deadline = android.os.SystemClock.uptimeMillis() + 20000
        while (android.os.SystemClock.uptimeMillis() < deadline) {
            val confirmed = runCatching {
                compose.onAllNodesWithTag("rent-payment-confirmed").fetchSemanticsNodes().isNotEmpty()
            }.getOrDefault(false)
            if (confirmed) return
            val choice = choices.firstOrNull { nativeNode(it) != null }
            when {
                choice != null -> shellTap(choice)
                nativeNode("English") != null && nativeNode("Close") != null -> shellTap("Close")
                nativeNode("Về TrọƠi") != null -> shellTap("Về TrọƠi")
                resumedActivity().contains("com.trooi.app") -> return
            }
            android.os.SystemClock.sleep(1000)
        }
        error("Browser did not return to the app")
    }
    private fun ensureAppForeground() {
        if (resumedActivity().contains("com.trooi.app")) return
        val choices = listOf("Open", "Just once", "Always", "Open app", "Mở", "Chỉ một lần", "Luôn luôn")
        val welcome = listOf("Use without an account", "Accept & continue", "No thanks", "Got it")
        val deadline = android.os.SystemClock.uptimeMillis() + 10000
        while (!resumedActivity().contains("com.trooi.app") && android.os.SystemClock.uptimeMillis() < deadline) {
            val choice = choices.firstOrNull { nativeNode(it) != null }
            val greeting = welcome.firstNotNullOfOrNull { nativeNode(it) }
            when {
                choice != null -> shellTap(choice)
                greeting != null -> tapBounds(greeting)
                nativeNode("English") != null && nativeNode("Close") != null -> shellTap("Close")
                else -> instrumentation.targetContext.startActivity(
                    Intent(instrumentation.targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
            android.os.SystemClock.sleep(500)
        }
    }
    private fun probeDemoPay() {
        val connection = java.net.URL("http://127.0.0.1:3001/api/v1/demo/login").openConnection() as java.net.HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json")
        connection.connectTimeout = 5000
        connection.readTimeout = 5000
        connection.doOutput = true
        connection.outputStream.use { it.write("""{"identifier":"tenant@trooi.local","password":"wrong"}""".toByteArray()) }
        val status = runCatching { connection.responseCode }.getOrElse { error("DemoPay is not reachable from the emulator: ${it.javaClass.simpleName}") }
        check(status == 401) { "DemoPay probe returned HTTP $status" }
        connection.disconnect()
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
        check(RuntimeDataSource.chooseDebugSource(instrumentation.targetContext, AppDataSource.MOCK))
        warmChromeForPaymentHandoff()
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
        probeDemoPay()
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
        probeDemoPay()
        compose.onNodeWithTag("rent-payment-open").performClick()
        // create()+openBrowser is async; wait for browser, confirm CTA, or rent-payment-error.
        run {
            val handoffDeadline = android.os.SystemClock.uptimeMillis() + 25000
            var sawChrome = false
            while (android.os.SystemClock.uptimeMillis() < handoffDeadline) {
                if (nativeNode("Xác nhận thanh toán") != null) break
                val resumed = resumedActivity()
                if (resumed.contains("chrome", ignoreCase = true) || resumed.contains("browser", ignoreCase = true)) {
                    sawChrome = true
                    dismissChromeFirstRun(deadlineMs = 800)
                }
                val openError = runCatching {
                    compose.onAllNodesWithTag("rent-payment-error").fetchSemanticsNodes().isNotEmpty()
                }.getOrDefault(false)
                if (openError) {
                    // Browser missing after wipe: warm once and tap open again.
                    if (!sawChrome) {
                        warmChromeForPaymentHandoff()
                        compose.onNodeWithTag("rent-payment-open").performClick()
                        android.os.SystemClock.sleep(500)
                        continue
                    }
                    error("rent-payment-open failed | ${nativeDiag("Xác nhận thanh toán")}")
                }
                android.os.SystemClock.sleep(300)
            }
            check(nativeNode("Xác nhận thanh toán") != null || sawChrome) {
                "Payment VIEW never reached Chrome | ${nativeDiag("Xác nhận thanh toán")}"
            }
        }
        awaitNative("Xác nhận thanh toán") // Explicit browser POST; GET/deep links cannot settle.
        clickUntil("Xác nhận thanh toán", untilText = "Về TrọƠi")
        screenshot("rent-payment-browser-confirmed")
        returnFromBrowser()
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
        // The confirmation action can sit below the fold. A coordinate click misses it; the semantics action still runs.
        compose.onNodeWithTag("rent-payment-done").performSemanticsAction(androidx.compose.ui.semantics.SemanticsActions.OnClick)
        compose.waitForIdle()
        assertTrue(hints.read()?.pendingCheckouts.isNullOrEmpty())
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("ledger-payment-entry"))
        compose.onNodeWithTag("ledger-payment-entry").performClick()
        waitFor("rent-payment-amount")
        compose.onNodeWithTag("rent-payment-amount").performTextReplacement("2000")
        compose.onNodeWithTag("rent-payment-review").performSemanticsAction(androidx.compose.ui.semantics.SemanticsActions.OnClick)
        waitFor("rent-payment-open")
        compose.onNodeWithTag("rent-payment-open").performSemanticsAction(androidx.compose.ui.semantics.SemanticsActions.OnClick)
        // Return before confirmation: a forged success URI still leaves the checkout CREATED.
        val deadline = android.os.SystemClock.uptimeMillis() + 15000
        while (hints.read()?.pendingCheckouts?.singleOrNull()?.checkoutId == null && android.os.SystemClock.uptimeMillis() < deadline) android.os.SystemClock.sleep(250)
        val stored = hints.read()?.pendingCheckouts?.singleOrNull()
        check(!stored?.checkoutId.isNullOrBlank()) {
            "Second checkout was not stored before the forged return: ${hints.read()?.pendingCheckouts}"
        }
        forgedReturn()
        ensureAppForeground()
        waitFor("rent-payment-refresh")
        compose.onNodeWithTag("rent-payment-confirmed").assertDoesNotExist()
        val second = requireNotNull(hints.read()?.pendingCheckouts?.single())
        assertNotEquals(completed.idempotencyKey, second.idempotencyKey)
        assertEquals("CREATED", backend.get(DemoData.accounts[0].userId, requireNotNull(second.checkoutId)).status)
        assertEquals(after.payments, backend.finance(DemoData.accounts[0].userId).payments)
        screenshot("rent-payment-forged-return-pending")
    }
}
