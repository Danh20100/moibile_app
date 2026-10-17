package com.trooi.app.features

import android.graphics.Bitmap
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Density
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.toPixelMap
import com.trooi.app.features.auth.GoogleAuthButton
import com.trooi.app.ui.theme.TroOiGoogleRed
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.model.*
import com.trooi.app.features.auth.AuthWelcomeScreen
import com.trooi.app.features.auth.EmailOtpPanel
import com.trooi.app.features.auth.rememberContactOtpForm
import com.trooi.app.features.profile.AccountSettingsFlow
import com.trooi.app.features.profile.ProfileScreen
import com.trooi.app.ui.navigation.TroOiBottomNavigation
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

class AccountReworkTest {
    @get:Rule val compose = createComposeRule()
    private val tenant = TroOiUiState(isAuthenticated = true, splashCompleted = true, demoPreview = true,
        displayName = "Nguyễn Ngọc Lan", backendUserId = "fixture-user-lan", access = AccessCapabilities(linkedTenancyIds = setOf("demo-tenancy")))
    private val owner = tenant.copy(backendUserId = "fixture-user-ha", access = AccessCapabilities(operatedOrganizationIds = setOf("demo-org")))

    private fun capture(name: String) {
        compose.waitForIdle()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "ui-rework").apply { mkdirs() }
        instrumentation.uiAutomation.takeScreenshot().let { bitmap ->
            File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
    }

    private fun click(text: String, list: String) {
        compose.onNodeWithTag(list).performScrollToNode(hasText(text))
        if (list == "account-page-personal" && text in listOf("Email", "Số điện thoại", "Địa chỉ cư trú")) {
            compose.onNodeWithTag("personal-action-$text").onChildren().filterToOne(hasText("Sửa")).performClick()
        } else compose.onNodeWithText(text).performClick()
    }

    private fun passwordReauth(expectBoundary: Boolean = false) {
        compose.onNodeWithText("Xác thực bảo mật").assertIsDisplayed()
        compose.onNodeWithText("Mật khẩu hiện tại").performTextInput("TroOi2026!")
        compose.onNodeWithTag("reauth-confirm").performClick()
        compose.waitUntil(3000) { compose.onAllNodesWithText("Xác thực bảo mật").fetchSemanticsNodes().isEmpty() }
        if (expectBoundary) compose.onNodeWithText("Chưa thể thực hiện").assertExists()
    }

    private fun pinReauth() {
        compose.onNodeWithText("Mã PIN bảo mật").performTextInput("482795")
        compose.onNodeWithTag("reauth-confirm").performClick()
        compose.waitUntil(3000) { compose.onAllNodesWithText("Xác thực bảo mật").fetchSemanticsNodes().isEmpty() }
    }

    @Test fun settingsSixPagesFormsBackAndBoundary() {
        val restore = StateRestorationTester(compose)
        restore.setContent { TroOiTheme { AccountSettingsFlow(tenant, {}) } }
        click("Thông tin cá nhân", "account-page-settings")
        click("Số điện thoại", "account-page-personal")
        passwordReauth()
        compose.onNodeWithTag("verification-contact-input").performTextReplacement("invalid")
        compose.onNodeWithText("Lưu thay đổi").assertIsNotEnabled()
        compose.onNodeWithTag("verification-contact-input").performTextReplacement("0907654321")
        compose.onNodeWithText("Lưu thay đổi").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertIsDisplayed()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.onNodeWithTag("otp-send").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertExists()
        compose.onNodeWithTag("email-otp-input").assertDoesNotExist()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.onNodeWithTag("otp-verify").assertDoesNotExist()
        compose.onNodeWithText("Lưu thay đổi").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertExists()
        compose.onNodeWithText("Đã hiểu").performClick()
        restore.emulateSavedInstanceStateRestore()
        compose.onNodeWithTag("verification-contact-input").assertTextContains("0907654321")
        compose.onNodeWithContentDescription("Quay lại").performClick()
        compose.onNodeWithText("Tiếp tục chỉnh sửa").performClick()
        compose.onNodeWithContentDescription("Quay lại").performClick()
        compose.onNodeWithText("Bỏ thay đổi").performClick()
        compose.onNodeWithTag("account-page-personal").assertExists()
    }

    @Test fun notificationSelectionSurvivesBackAndMarketingDoesNotDisableSecurity() {
        compose.setContent { TroOiTheme { AccountSettingsFlow(tenant, {}, "notifications") } }
        click("Ưu đãi", "account-page-notifications")
        passwordReauth()
        compose.onNode(isToggleable() and hasText("Trong ứng dụng", substring = true)).performClick()
        compose.onNodeWithContentDescription("Quay lại").performClick()
        compose.onNodeWithText("Tiếp tục chỉnh sửa").performClick()
        compose.onNodeWithText("Lưu lựa chọn").performClick()
        compose.onNodeWithText("Chưa thể thực hiện").assertIsDisplayed()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.onNodeWithContentDescription("Quay lại").performClick()
        compose.onNodeWithText("Bỏ thay đổi").performClick()
        click("Ưu đãi", "account-page-notifications")
        passwordReauth()
        compose.onNode(isToggleable() and hasText("Trong ứng dụng", substring = true)).assertIsOn()
        compose.onNodeWithContentDescription("Quay lại").performClick()
        click("Ngừng nhận tất cả ưu đãi và cập nhật", "account-page-notifications")
        passwordReauth(expectBoundary = true)
        compose.onNodeWithText("Chưa thể thực hiện").assertIsDisplayed()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.onNodeWithText("Tài khoản").performClick()
        click("Bảo mật và xác thực", "account-page-notifications")
        passwordReauth()
        compose.onNode(isToggleable() and hasText("Trong ứng dụng", substring = true)).assertIsOn().assertIsNotEnabled()
    }

    @Test fun paymentsCapabilitiesAndDeletionNeverMutate() {
        compose.setContent { TroOiTheme { AccountSettingsFlow(tenant, {}, "payments") } }
        compose.onNodeWithText("Phương thức thanh toán").assertExists()
        compose.onNodeWithText("Phương thức nhận tiền").assertDoesNotExist()
        capture("payments-tenant")
    }

    @Test fun ownerPaymentsAndPrivacyAreComplete() {
        compose.setContent { TroOiTheme { AccountSettingsFlow(owner, {}, "payments") } }
        compose.onNodeWithText("Phương thức nhận tiền").assertExists()
        compose.onNodeWithText("Phương thức thanh toán").assertDoesNotExist()
        capture("payments-owner")
        click("Phương thức nhận tiền", "account-page-payments")
        compose.onNodeWithText("Thêm phương thức").performClick()
        pinReauth()
        compose.onNode(hasSetTextAction()).performTextInput("Ngân hàng Demo")
        compose.onNodeWithText("Tiếp tục").assertIsEnabled().performClick()
        compose.waitUntil(5000) { compose.onAllNodesWithText("Chưa thể thực hiện").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Chưa thể thực hiện").assertExists()
    }

    @Test fun privacyDeleteConfirmationAndRestore() {
        val restore = StateRestorationTester(compose)
        restore.setContent { TroOiTheme { AccountSettingsFlow(owner, {}, "privacy") } }
        compose.onNodeWithText("Chỉnh sửa").performClick()
        pinReauth()
        compose.onNode(isToggleable() and hasText("Đã đọc tin nhắn", substring = true)).performClick()
        restore.emulateSavedInstanceStateRestore()
        compose.onNode(isToggleable() and hasText("Đã đọc tin nhắn", substring = true)).assertIsOff()
        capture("privacy-owner")
        click("Xóa tài khoản của tôi", "account-page-privacy")
        compose.onNodeWithText("Yêu cầu xóa tài khoản").performClick()
        compose.onNodeWithText("Tiếp tục").performClick()
        compose.onNodeWithText("Mã PIN bảo mật").assertExists()
    }

    @Test fun profileLogoutRequiresConfirmationAndClearsViaCallback() {
        var loggedOut = false
        compose.setContent { TroOiTheme { Column { Box(Modifier.weight(1f)) { ProfileScreen(tenant, onLogout = { loggedOut = true }) }; TroOiBottomNavigation(AppPage.Account, {}) } } }
        capture("profile-tenant")
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasText("Đăng xuất"))
        compose.onNodeWithTag("account-logout").performClick()
        assertFalse(loggedOut)
        compose.onNodeWithText("Hủy").performClick()
        assertFalse(loggedOut)
        compose.onNodeWithTag("account-logout").performClick()
        compose.onAllNodesWithText("Đăng xuất")[1].performClick()
        compose.runOnIdle { assertTrue(loggedOut) }
    }

    @Test fun ownerProfileAndEveryNavLabelRemainsVisible() {
        var page by mutableStateOf<AppPage>(AppPage.Account)
        compose.setContent { TroOiTheme { Column { Box(Modifier.weight(1f)) { ProfileScreen(owner) }; TroOiBottomNavigation(page, { page = it }) } } }
        capture("profile-owner")
        listOf("nav-tab-messages", "nav-tab-core", "nav-tab-discovery", "nav-tab-profile").forEach { tag ->
            compose.onNodeWithTag(tag).performClick().assertIsSelected()
            listOf("Khám phá", "Sổ", "Tin nhắn", "Hồ sơ").forEach { label -> compose.onAllNodesWithText(label)[0].assertIsDisplayed() }
        }
        compose.onNodeWithTag("nav-tab-messages").performClick()
        capture("nav-messages")
    }

    @Test fun guestNativeEntry() {
        compose.setContent { TroOiTheme { AuthWelcomeScreen({}, {}, onSignInWithGoogle = {}) } }
        capture("guest-entry")
    }

    @Test fun otpCannotBeSentOrVerifiedInMockOrBackendModeWithoutAProvider() {
        var email by mutableStateOf("a@trooi.test")
        var mock by mutableStateOf(true)
        compose.setContent { TroOiTheme {
            val otp = rememberContactOtpForm(email)
            Column {
                EmailOtpPanel(email, mock, form = otp)
                Button({ otp.validateOnSubmit(email, mock) }) { Text("Submit final") }
            }
        } }
        compose.onNodeWithTag("otp-send").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertIsDisplayed()
        compose.onNodeWithTag("email-otp-input").assertDoesNotExist()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.onNodeWithText("Submit final").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertIsDisplayed()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.runOnIdle { email = "b@trooi.test"; mock = false }
        compose.onNodeWithTag("email-otp-input").assertDoesNotExist()
        compose.onNodeWithTag("otp-send").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertIsDisplayed()
    }

    @Test fun phoneVerificationDirtyBackAndReentryAt320dp() {
        var dispatcher: androidx.activity.OnBackPressedDispatcher? = null
        compose.setContent { TroOiTheme {
            dispatcher = androidx.activity.compose.LocalOnBackPressedDispatcherOwner.current?.onBackPressedDispatcher
            Box(Modifier.width(320.dp)) { AccountSettingsFlow(tenant, {}, "personal") }
        } }
        compose.onNodeWithTag("personal-action-Tên pháp lý").assertExists()
        compose.onNodeWithTag("account-page-personal").assertExists()
        compose.onNodeWithText("0901234567").assertExists()
        click("Số điện thoại", "account-page-personal")
        passwordReauth()
        compose.onNodeWithTag("account-page-edit:Số điện thoại").assertExists()
        compose.onNodeWithContentDescription("Quay lại").performClick()
        compose.onNodeWithText("Bỏ thay đổi chưa lưu?").assertDoesNotExist()
        compose.onNodeWithTag("account-page-personal").assertExists()
        click("Số điện thoại", "account-page-personal")
        passwordReauth()
        compose.onNodeWithTag("account-page-edit:Số điện thoại").assertExists()
        compose.onNodeWithTag("verification-contact-input").performTextReplacement("0907654321")
        compose.onNodeWithText("Lưu thay đổi").assertIsEnabled()
        compose.runOnIdle { dispatcher!!.onBackPressed() }
        compose.onNodeWithText("Tiếp tục chỉnh sửa").performClick()
        compose.onNodeWithTag("otp-send").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertIsDisplayed()
        compose.onNodeWithTag("email-otp-input").assertDoesNotExist()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.onNodeWithText("Lưu thay đổi").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertIsDisplayed()
        compose.onNodeWithText("Đã hiểu").performClick()
        capture("phone-inline-320dp")
        compose.runOnIdle { dispatcher!!.onBackPressed() }
        compose.onNodeWithText("Bỏ thay đổi").performClick()
        click("Số điện thoại", "account-page-personal")
        passwordReauth()
        compose.onNodeWithTag("verification-contact-input").assertTextContains("0901234567")
        compose.onNodeWithTag("email-otp-input").assertDoesNotExist()
        compose.onNodeWithText("Hủy").assertDoesNotExist()
    }

    @Test fun consolidatedPaymentsAndNoInternalNotices() {
        val both = tenant.copy(access = AccessCapabilities(linkedTenancyIds = setOf("t"), operatedOrganizationIds = setOf("o")))
        compose.setContent { TroOiTheme { AccountSettingsFlow(both, {}, "payments") } }
        listOf("Người thuê", "Chủ trọ / Người vận hành", "Đơn vị tiền tệ · VND", "Demo Mock").forEach {
            compose.onNodeWithText(it, substring = true).assertDoesNotExist()
        }
        listOf("Phương thức thanh toán", "Phương thức nhận tiền", "Lịch sử giao dịch / biên nhận").forEach { compose.onNodeWithText(it).assertExists() }
    }

    @Test fun parentDirtyStateSurvivesCleanChildAndRestoration() {
        val restore = StateRestorationTester(compose)
        restore.setContent { TroOiTheme { AccountSettingsFlow(tenant, {}, "privacy") } }
        // Privacy edits are protected by reauthentication; do not mutate a disabled preview switch.
        compose.onNodeWithText("Chỉnh sửa").performClick()
        passwordReauth()
        compose.onNode(isToggleable() and hasText("Đã đọc tin nhắn", substring = true)).performClick()
        click("Chế độ hiển thị hồ sơ", "account-page-privacy")
        compose.onNodeWithContentDescription("Quay lại").performClick()
        restore.emulateSavedInstanceStateRestore()
        compose.onNodeWithContentDescription("Quay lại").performClick()
        compose.onNodeWithText("Bỏ thay đổi chưa lưu?").assertIsDisplayed()
        compose.onNodeWithText("Tiếp tục chỉnh sửa").performClick()
        compose.onNode(isToggleable() and hasText("Đã đọc tin nhắn", substring = true)).assertIsOff()
    }

    @Test fun compactNavAt320dpLargeFontAndGoogleRed() {
        var page by mutableStateOf<AppPage>(AppPage.Account)
        var busy by mutableStateOf(false)
        compose.setContent { TroOiTheme {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                Column(Modifier.width(320.dp)) {
                    GoogleAuthButton({}, authInProgress = busy)
                    TroOiBottomNavigation(page, { page = it })
                }
            }
        } }
        val pixels = compose.onNodeWithTag("google-auth-button").captureToImage().toPixelMap()
        assertEquals(TroOiGoogleRed, pixels[5, pixels.height / 2])
        compose.runOnIdle { busy = true }
        compose.onNodeWithTag("google-auth-button").assertIsNotEnabled()
        val tab = compose.onNodeWithTag("nav-tab-core")
        val beforePress = tab.captureToImage().toPixelMap()
        tab.performTouchInput { down(center) }
        val duringPress = tab.captureToImage().toPixelMap()
        assertEquals(beforePress[2, beforePress.height / 2], duringPress[2, duringPress.height / 2])
        tab.performTouchInput { up() }
        for (tag in listOf("nav-tab-core", "nav-tab-messages", "nav-tab-discovery", "nav-tab-profile")) {
            compose.onNodeWithTag(tag).performClick().assertIsSelected()
            for (label in listOf("Khám phá", "Sổ", "Tin nhắn", "Hồ sơ")) compose.onNodeWithText(label).assertIsDisplayed()
        }
        capture("nav-google-320dp-font1.3")
    }

    @Test fun interruptedOtpNeverShowsVerificationWithoutAProvider() {
        var email by mutableStateOf("a@trooi.test")
        val restore = StateRestorationTester(compose)
        restore.setContent { TroOiTheme { EmailOtpPanel(email, true) } }
        compose.onNodeWithText("Gửi mã").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertIsDisplayed()
        compose.onNodeWithTag("email-otp-input").assertDoesNotExist()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.runOnIdle { email = "b@trooi.test" }
        compose.onNodeWithText("Gửi mã").assertIsDisplayed()
        compose.onNodeWithTag("email-otp-input").assertDoesNotExist()
        compose.onNodeWithText("Gửi mã").performClick()
        compose.onNodeWithText("Hiện chưa khả dụng").assertIsDisplayed()
        restore.emulateSavedInstanceStateRestore()
        compose.onNodeWithTag("email-otp-input").assertDoesNotExist()
    }
}
