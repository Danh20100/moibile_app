package com.trooi.app.features

import android.view.KeyEvent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.profile.AccountSettingsFlow
import com.trooi.app.features.profile.BackendPasswordForm
import com.trooi.app.ui.components.TroOiActionDialog
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class AccountSecurityUiTest {
    @get:Rule val compose = createComposeRule()
    private val owner = TroOiUiState(isAuthenticated = true, demoPreview = true, backendUserId = "fixture-user-ha")

    @Test fun googleOnlyPasswordSetupUsesGoogleReauthenticationAndNeedsNoCurrentPassword() {
        var submitted: String? = null
        compose.setContent {
            TroOiTheme {
                BackendPasswordForm(
                    userId = "google-only-user", passwordConfigured = false, googleLinked = true,
                    busy = false, error = null, successMessage = null, onDirty = {}, onChange = { _, _ -> },
                    onSetup = { submitted = it },
                )
            }
        }
        compose.onNodeWithText("Mật khẩu hiện tại").assertDoesNotExist()
        compose.onNodeWithText("Mật khẩu mới").performTextInput("first-password-123")
        compose.onNodeWithText("Nhập lại mật khẩu mới").performTextInput("first-password-123")
        compose.onNodeWithText("Xác thực Google và thiết lập mật khẩu").performClick()
        assertEquals("first-password-123", submitted)
    }

    @Test fun configuredPasswordChangeStillRequiresCurrentPassword() {
        var changed: Pair<String, String>? = null
        compose.setContent {
            TroOiTheme {
                BackendPasswordForm(
                    userId = "password-user", passwordConfigured = true, googleLinked = true,
                    busy = false, error = null, successMessage = null, onDirty = {},
                    onChange = { current, next -> changed = current to next }, onSetup = {},
                )
            }
        }
        compose.onNodeWithText("Mật khẩu hiện tại").assertExists()
        compose.onNodeWithText("Đổi mật khẩu").assertIsNotEnabled()
        compose.onNodeWithText("Mật khẩu hiện tại").performTextInput("old-password-123")
        compose.onNodeWithText("Mật khẩu mới").performTextInput("next-password-123")
        compose.onNodeWithText("Nhập lại mật khẩu mới").performTextInput("next-password-123")
        compose.onNodeWithText("Đổi mật khẩu").performClick()
        assertEquals("old-password-123" to "next-password-123", changed)
    }

    private fun showKeyboardAccessibleLoginEmail() {
        compose.setContent {
            // Android starts in touch mode. Exercise the hardware-keyboard navigation contract explicitly.
            val inputMode = LocalInputModeManager.current
            LaunchedEffect(Unit) { inputMode.requestInputMode(InputMode.Keyboard) }
            TroOiTheme { AccountSettingsFlow(owner.copy(demoPreview = false), {}, "login-email") }
        }
    }

    @Test fun pinMismatchDirtyBackAndForgotNeverDowngrades() {
        compose.setContent { TroOiTheme { AccountSettingsFlow(owner, {}, "security") } }
        compose.onNodeWithText("Mã PIN bảo mật").performClick()
        compose.onNodeWithText("Thay đổi mã PIN").performClick()
        compose.onNodeWithText("Mã PIN mới").assertDoesNotExist()
        compose.onAllNodesWithText("Mã PIN bảo mật").onLast().performTextInput("482795")
        compose.onNodeWithTag("reauth-confirm").performClick()
        compose.waitUntil(8_000) { compose.onAllNodesWithText("Xác thực bảo mật").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithText("Mã PIN mới").performTextInput("482795")
        compose.onNodeWithText("Nhập lại mã PIN").performTextInput("482790")
        compose.onNodeWithText("Hai mã PIN chưa khớp.").assertExists()
        compose.onNodeWithText("Thay đổi mã PIN").assertIsNotEnabled()
        compose.onNodeWithText("Nhập lại mã PIN").performTextReplacement("482795")
        compose.onNodeWithText("Thay đổi mã PIN").performClick()
        compose.onNodeWithText("Chưa thể thực hiện").assertIsDisplayed()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.onNodeWithText("Mật khẩu hiện tại").assertDoesNotExist()
        compose.onAllNodesWithText("Quên mã PIN").onLast().performClick()
        compose.onNodeWithText("Khôi phục quyền truy cập").assertIsDisplayed()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.onNodeWithContentDescription("Quay lại").performClick()
        compose.onNodeWithText("Bỏ thay đổi chưa lưu?").assertIsDisplayed()
    }

    @Test fun googleOnlyFixtureHasRecoveryAndNoPasswordFallback() {
        compose.setContent { TroOiTheme { AccountSettingsFlow(owner.copy(backendUserId = "fixture-google-only"), {}, "edit:Địa chỉ cư trú") } }
        compose.onNode(hasSetTextAction()).assertDoesNotExist()
        compose.onNodeWithText("Xác thực để chỉnh sửa").performClick()
        compose.onNodeWithText("Khôi phục quyền truy cập").assertIsDisplayed()
        compose.onNodeWithText("Mật khẩu hiện tại").assertDoesNotExist()
    }


    @Test fun wrongPasswordAndCancellationKeepFormClosed() {
        compose.setContent { TroOiTheme { AccountSettingsFlow(owner.copy(backendUserId = "fixture-user-lan"), {}, "edit:Địa chỉ cư trú") } }
        compose.onNodeWithText("Xác thực để chỉnh sửa").performClick()
        compose.onNodeWithText("Xác thực bảo mật").assertExists()
        compose.onNodeWithTag("verification-contact-input").assertDoesNotExist()
        compose.onNodeWithText("Mật khẩu hiện tại").performTextInput("wrong")
        compose.onNodeWithTag("reauth-confirm").performClick()
        compose.waitUntil(8_000) { compose.onAllNodesWithText("Mật khẩu hiện tại không đúng.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("verification-contact-input").assertDoesNotExist()
        compose.onNodeWithText("Hủy").performClick()
        compose.onNodeWithText("Xác thực để chỉnh sửa").assertExists()
        compose.onNodeWithTag("verification-contact-input").assertDoesNotExist()
    }

    @Test fun backendCannotOpenProtectedFormOrUseMockProof() {
        compose.setContent { TroOiTheme { AccountSettingsFlow(owner.copy(demoPreview = false), {}, "edit:Địa chỉ cư trú") } }
        compose.onNodeWithText("Xác thực để chỉnh sửa").performClick()
        compose.onNodeWithText("Chưa thể thực hiện").assertIsDisplayed()
        compose.onNodeWithText("Xác thực bảo mật").assertDoesNotExist()
        compose.onNodeWithTag("verification-contact-input").assertDoesNotExist()
    }

    @Test fun backendNotificationPreferencesAreNotPresentedAsSavedOrEditable() {
        compose.setContent { TroOiTheme { AccountSettingsFlow(owner.copy(demoPreview = false), {}, "notifications") } }
        compose.onNodeWithText("Tùy chọn thông báo chưa được tải từ tài khoản.").assertExists()
        compose.onAllNodesWithText("Chưa tải tùy chọn", substring = true).assertCountEquals(5)
        compose.onNodeWithText("Ưu đãi").performClick()
        compose.onNodeWithText("Chưa thể thực hiện").assertIsDisplayed()
        compose.onNodeWithText("Đã hiểu").performClick()
        compose.onNodeWithText("Trong ứng dụng", substring = true).assertDoesNotExist()
        compose.onNodeWithText("Nhận thông báo qua email").assertDoesNotExist()
        compose.onNodeWithText("Lưu lựa chọn").assertDoesNotExist()
    }

    private fun withHardwareKeys(block: () -> Unit) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.setInTouchMode(false)
        instrumentation.waitForIdleSync()
        compose.waitForIdle()
        try {
            block()
        } finally {
            instrumentation.setInTouchMode(true)
        }
    }

    @Test fun backendLoginEmailGateCanBeActivatedByKeyboard() {
        showKeyboardAccessibleLoginEmail()
        withHardwareKeys {
            val action = compose.onNodeWithText("Thay đổi email")
            action.performSemanticsAction(SemanticsActions.RequestFocus)
            compose.waitUntil(5_000) { runCatching { action.assertIsFocused(); true }.getOrDefault(false) }
            InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
            compose.waitUntil(5_000) { compose.onAllNodesWithText("Chưa thể thực hiện").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("Chưa thể thực hiện").assertIsDisplayed()
            compose.onNodeWithText("Xác thực bảo mật").assertDoesNotExist()
        }
    }

    @Test fun loginEmailActionIsNextKeyboardFocusAfterBackButton() {
        showKeyboardAccessibleLoginEmail()
        withHardwareKeys {
            val back = compose.onNodeWithContentDescription("Quay lại")
            back.performSemanticsAction(SemanticsActions.RequestFocus)
            compose.waitUntil(5_000) { runCatching { back.assertIsFocused(); true }.getOrDefault(false) }
            InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(KeyEvent.KEYCODE_TAB)
            val email = compose.onNodeWithText("Thay đổi email")
            compose.waitUntil(5_000) { runCatching { email.assertIsFocused(); true }.getOrDefault(false) }
        }
    }

    @Test fun languageHasOnlyTwoSections() {
        compose.setContent { TroOiTheme { AccountSettingsFlow(owner, {}, "language") } }
        compose.onNodeWithText("Ngôn ngữ ứng dụng").assertExists()
        compose.onNodeWithText("Dịch tự động").assertExists()
        compose.onNodeWithText("Thêm ngôn ngữ").assertDoesNotExist()
        compose.onNodeWithText("Các ngôn ngữ khác mà bạn biết").assertDoesNotExist()
    }

    @Test fun dialogEqualActionsAtLargeFontAndBothThemeShapes() {
        var dark by mutableStateOf(false)
        var twoActions by mutableStateOf(true)
        compose.setContent { TroOiTheme(darkTheme = dark) {
            val density = LocalDensity.current
            val corners = (MaterialTheme.shapes.extraLarge.createOutline(Size(320f, 240f), LayoutDirection.Ltr, density) as Outline.Rounded).roundRect
            assertTrue(corners.topLeftCornerRadius.x > 0f)
            assertEquals(corners.topLeftCornerRadius, corners.topRightCornerRadius)
            assertEquals(corners.topLeftCornerRadius, corners.bottomLeftCornerRadius)
            assertEquals(corners.topLeftCornerRadius, corners.bottomRightCornerRadius)
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                TroOiActionDialog({}, { Text("Bỏ thay đổi chưa lưu?") }, { Text("Thông tin chưa được lưu.") },
                    confirmButton = { TextButton({}, Modifier.testTag("confirm")) { Text("Bỏ thay đổi") } },
                    dismissButton = if (twoActions) { { TextButton({}, Modifier.testTag("dismiss")) { Text("Tiếp tục chỉnh sửa") } } } else null)
            }
        } }
        val confirm = compose.onNodeWithTag("confirm").fetchSemanticsNode().boundsInRoot
        val dismiss = compose.onNodeWithTag("dismiss").fetchSemanticsNode().boundsInRoot
        assertEquals(confirm.width, dismiss.width, 1f)
        assertEquals(confirm.height, dismiss.height, 1f)
        compose.runOnIdle { dark = true; twoActions = false }
        val single = compose.onNodeWithTag("confirm").fetchSemanticsNode().boundsInRoot
        assertTrue(single.width > confirm.width * 1.9f)
    }
}
