package com.trooi.app.features

import android.graphics.Bitmap
import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.model.*
import com.trooi.app.features.notifications.V1NotificationDetailScreen
import com.trooi.app.features.shared.GatewayCheckout
import com.trooi.app.features.shared.RentalPayment
import com.trooi.app.features.shared.RentalTenancy
import com.trooi.app.features.tenancy.*
import com.trooi.app.ui.theme.TroOiTheme
import java.io.File
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PaymentIntegrationUiTest {
    @get:Rule val compose = createComposeRule()
    private val tenancy = RentalTenancy("tenancy-qa", "room-qa", "ACTIVE", "2026-10-01T00:00:00Z", null)

    @Test fun paymentPanelKeepsConfirmationAndWriteGuardsWhileActionsRemainReachable() {
        var creates = 0
        var refreshes = 0
        var replays = 0
        var amount by mutableStateOf("1000")
        val checkout = GatewayCheckout(
            id = "95e18db8-f8e9-4708-838a-328fceb219e2", tenancyId = tenancy.id,
            amount = "1000.00", referenceCode = "QA UI 001", provider = "SEPAY",
            status = "CREATED", createdAt = "2026-10-13T00:00:00Z", replayAllowed = true,
        )
        var state by mutableStateOf(RentalUiState(tenantMode = true, linkedTenancyStatus = "ACTIVE", gatewayCheckout = checkout))
        compose.setContent {
            ProofFrame(dark = false, fontScale = 1f) {
                GatewayPaymentPanel(state, amount, { amount = it }, { creates++ }, { replays++ }, { refreshes++ })
            }
        }
        compose.onNodeWithText("Chuyển khoản ngân hàng").assertIsDisplayed()
        compose.onNodeWithText("Thanh toán MoMo", substring = true).assertDoesNotExist()
        assertAlignedPaymentActions()
        proof("payment-light-actions")
        compose.onNodeWithText("Chuyển khoản ngân hàng").performScrollTo()
        proof("payment-light-pending")
        compose.onNodeWithTag("gateway-create").performScrollTo().assertIsEnabled().performClick()
        compose.onNodeWithTag("gateway-refresh").performScrollTo().performClick()
        compose.onNodeWithTag("gateway-replay").performScrollTo().performClick()
        assertEquals(listOf(1, 1, 1), listOf(creates, refreshes, replays))
        compose.onNodeWithText("Xem mã giao dịch").performScrollTo().performClick()
        compose.onNodeWithText(checkout.id).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Ẩn mã giao dịch").performScrollTo().performClick()
        compose.onNodeWithText(checkout.id).assertDoesNotExist()

        compose.runOnIdle { state = state.copy(gatewayCheckout = checkout.copy(status = "SUCCEEDED", resultingPaymentId = "payment-qa", replayAllowed = false)) }
        compose.onNodeWithText("Đang đồng bộ khoản thanh toán").performScrollTo().assertIsDisplayed()
        compose.runOnIdle {
            state = state.copy(payments = listOf(RentalPayment("payment-qa", tenancy.id, "1000.00", "GATEWAY", "PROVIDER_VERIFIED", "2026-10-13T00:00:00Z")))
        }
        compose.onNodeWithText("Đã ghi nhận thanh toán").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("gateway-replay").assertDoesNotExist()
        compose.onNodeWithTag("gateway-create").performScrollTo().performClick()
        assertEquals(1, creates)
        assertEquals(2, refreshes)
        compose.onNodeWithTag("gateway-checkout-amount").performScrollTo().performTextReplacement("5000")
        compose.onNodeWithTag("gateway-create").performScrollTo().performClick()
        assertEquals(2, creates)
        proof("payment-light-confirmed")

        compose.runOnIdle { state = state.copy(linkedTenancyStatus = "ENDED") }
        compose.onNodeWithTag("gateway-create").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag("gateway-refresh").performScrollTo().assertIsEnabled()
        compose.runOnIdle { state = state.copy(linkedTenancyStatus = "ACTIVE", busy = true) }
        compose.onNodeWithTag("gateway-create").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag("gateway-refresh").performScrollTo().assertIsNotEnabled()
        compose.runOnIdle { state = state.copy(busy = false, checkoutCreateFailed = true, gatewayCheckout = checkout.copy(status = "FAILED")) }
        compose.onNodeWithText("Thanh toán chưa hoàn tất").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Chưa mở được thanh toán.", substring = true).performScrollTo().assertIsDisplayed()
        proof("payment-light-error")
        compose.onNodeWithTag("gateway-checkout-amount").performScrollTo().performTextReplacement("1000.50")
        compose.onNodeWithTag("gateway-create").performScrollTo().assertIsNotEnabled()
    }

    @Test fun notificationDetailDarkLargeFontPreservesActionsAndEmptyLoadingStates() {
        val note = NotificationCard("notice-qa", "PAYMENT_CONFIRMED", "payment:payment-qa", "PENDING",
            "2026-10-13T00:00:00Z", sourceType = "PAYMENT", sourceId = "payment-qa")
        var state by mutableStateOf(TroOiUiState(read = FrontendReadSnapshot(notifications = listOf(note))))
        var marked = ""
        var source = ""
        compose.setContent {
            TroOiTheme(darkTheme = true) {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, 2f)) {
                    Column(Modifier.width(320.dp).background(MaterialTheme.colorScheme.background).testTag("proof-frame")) {
                        Text("Dữ liệu kiểm thử giao diện", color = MaterialTheme.colorScheme.onBackground)
                        V1NotificationDetailScreen(state, note.notificationId, {}, { marked = it }, { source = it })
                    }
                }
            }
        }
        proof("notification-dark-large")
        compose.onNodeWithText("Đánh dấu đã đọc").performScrollTo().assertIsDisplayed().performClick()
        compose.onNodeWithText("Xem thanh toán").performScrollTo().assertIsDisplayed().performClick()
        assertEquals(note.notificationId, marked)
        assertEquals(note.notificationId, source)
        compose.runOnIdle { state = state.copy(read = FrontendReadSnapshot(notifications = listOf(note.copy(sourceId = null)))) }
        compose.onNodeWithText("Xem thanh toán").assertDoesNotExist()
        compose.runOnIdle { state = state.copy(runtimeLoading = true, read = FrontendReadSnapshot()) }
        compose.onNodeWithText("Đang mở thông báo…").assertIsDisplayed()
        compose.runOnIdle { state = state.copy(runtimeLoading = false) }
        compose.onNodeWithText("Không tìm thấy thông báo này.").assertIsDisplayed()
    }

    @Test fun paymentPanelDarkLargeFontKeepsEveryActionReachable() {
        val actions = mutableListOf<String>()
        val checkout = GatewayCheckout("checkout-qa", tenancy.id, "50000000.00", "QA UI 002", "SEPAY",
            "UNKNOWN", "2026-10-13T00:00:00Z", true)
        compose.setContent {
            ProofFrame(dark = true, fontScale = 2f) {
                GatewayPaymentPanel(
                    RentalUiState(tenantMode = true, linkedTenancyStatus = "ACTIVE", gatewayCheckout = checkout),
                    "50000000", {}, { actions += "create" }, { actions += "replay" }, { actions += "refresh" },
                )
            }
        }
        assertAlignedPaymentActions()
        compose.onNodeWithTag("gateway-create").performScrollTo().assertIsDisplayed().performClick()
        compose.onNodeWithTag("gateway-refresh").performScrollTo().assertIsDisplayed().performClick()
        compose.onNodeWithTag("gateway-replay").performScrollTo().assertIsDisplayed().performClick()
        compose.onNodeWithText("Xem mã giao dịch").performScrollTo().performClick()
        compose.onNodeWithText(checkout.id).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Đã ghi nhận thanh toán").assertDoesNotExist()
        assertEquals(listOf("create", "refresh", "replay"), actions)
        proof("payment-dark-large")
    }

    private fun assertAlignedPaymentActions() {
        val actions = listOf(
            compose.onNodeWithTag("gateway-create"),
            compose.onNodeWithTag("gateway-refresh"),
            compose.onNodeWithTag("gateway-replay"),
            compose.onNodeWithText("Xem mã giao dịch"),
        )
        val bounds = actions.map { it.performScrollTo().assertIsDisplayed().fetchSemanticsNode().boundsInRoot }
        assertTrue("Payment buttons share a width", bounds.maxOf { it.width } - bounds.minOf { it.width } <= 1f)
        assertTrue("Payment buttons share a left edge", bounds.maxOf { it.left } - bounds.minOf { it.left } <= 1f)
        assertTrue("Payment buttons share a height: ${bounds.map { it.height }}", bounds.maxOf { it.height } - bounds.minOf { it.height } <= 1f)
    }

    @Test fun paymentInputAndActionRemainReachableWithKeyboard() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        fun shell(command: String): String = android.os.ParcelFileDescriptor.AutoCloseInputStream(
            instrumentation.uiAutomation.executeShellCommand(command)).bufferedReader().use { it.readText() }
        val original = shell("settings get secure show_ime_with_hard_keyboard").trim()
        val keyboardHeight = mutableIntStateOf(0)
        val host = mutableStateOf<android.view.View?>(null)
        try {
            shell("settings put secure show_ime_with_hard_keyboard 1")
            var amount by mutableStateOf("")
            var creates = 0
            compose.setContent {
                val view = androidx.compose.ui.platform.LocalView.current
                SideEffect { host.value = view }
                keyboardHeight.intValue = WindowInsets.ime.getBottom(LocalDensity.current)
                ProofFrame(dark = false, fontScale = 1f) {
                    GatewayPaymentPanel(
                        RentalUiState(tenantMode = true, linkedTenancyStatus = "ACTIVE"),
                        amount, { amount = it }, { creates++ }, {}, {},
                    )
                }
            }
            val input = compose.onNodeWithTag("gateway-checkout-amount").performScrollTo()
            input.performClick()
            compose.runOnIdle {
                val view = host.value ?: return@runOnIdle
                val target = view.findFocus() ?: view
                val imm = view.context.getSystemService(android.view.inputmethod.InputMethodManager::class.java)
                imm.showSoftInput(target, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
            }
            compose.waitUntil(8_000) {
                val inset = host.value?.rootWindowInsets?.getInsets(android.view.WindowInsets.Type.ime())?.bottom ?: 0
                keyboardHeight.intValue > 0 || inset > 0
            }
            input.performTextReplacement("1500000")
            input.assertIsDisplayed().assertIsFocused()
            compose.onNodeWithTag("gateway-create").performScrollTo().assertIsDisplayed()
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_TAB)
            compose.onNodeWithTag("gateway-create").assertIsFocused()
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
            compose.waitForIdle()
            assertEquals(1, creates)
            proof("payment-keyboard")
        } finally {
            val restore = original.takeIf { it.isNotEmpty() && it != "null" } ?: "0"
            shell("settings put secure show_ime_with_hard_keyboard $restore")
        }
    }

    @Composable
    private fun ProofFrame(dark: Boolean, fontScale: Float, content: @Composable () -> Unit) {
        TroOiTheme(darkTheme = dark) {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
                Column(Modifier.width(320.dp).fillMaxHeight().background(MaterialTheme.colorScheme.background)
                    .windowInsetsPadding(WindowInsets.safeDrawing).imePadding()) {
                    Text("Dữ liệu kiểm thử giao diện", modifier = Modifier.padding(18.dp),
                        color = MaterialTheme.colorScheme.onBackground)
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(18.dp).testTag("proof-frame"),
                        verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        content()
                    }
                }
            }
        }
    }

    private fun proof(name: String) {
        compose.mainClock.advanceTimeBy(500)
        compose.waitForIdle()
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val folder = File(context.getExternalFilesDir(null), "ui-proof").apply { mkdirs() }
        File(folder, "$name.png").outputStream().use {
            compose.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }
}
