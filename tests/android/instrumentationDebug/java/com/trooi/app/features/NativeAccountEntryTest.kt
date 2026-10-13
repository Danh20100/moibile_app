package com.trooi.app.features

import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.profile.AccountSettingsFlow
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Native accessibility automation avoids the Espresso InputManager incompatibility on API 37. */
@RunWith(AndroidJUnit4::class)
class NativeAccountEntryTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val automation get() = instrumentation.uiAutomation
    private fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> {
        if (root == null) return emptyList()
        return listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }
    }
    private fun matching(text: String) = nodes(automation.rootInActiveWindow).firstOrNull {
        it.text?.toString() == text || it.contentDescription?.toString() == text
    }
    private fun waitFor(text: String): AccessibilityNodeInfo {
        repeat(100) { matching(text)?.let { return it }; Thread.sleep(100) }
        error("Missing native control: $text")
    }
    private fun click(text: String) {
        repeat(100) {
            var node: AccessibilityNodeInfo? = matching(text)
            while (node != null && !node.isClickable) node = node.parent
            if (node?.isEnabled == true && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return
            Thread.sleep(100)
        }
        error("Cannot click native control: $text")
    }
    private fun input(value: String) {
        repeat(100) {
            val field = nodes(automation.rootInActiveWindow).firstOrNull { it.className == "android.widget.EditText" }
            if (field != null && field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value) })) return
            Thread.sleep(100)
        }
        error("Missing native input")
    }
    private fun noForm() {
        assertFalse(nodes(automation.rootInActiveWindow).any { it.viewIdResourceName == "verification-contact-input" })
        assertNull(matching("Lưu thay đổi"))
    }
    private fun host(mock: Boolean, userId: String, dark: Boolean = false, page: String = "personal",
        test: () -> Unit) {
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity -> activity.setContent {
                TroOiTheme(darkTheme = dark) {
                    val density = LocalDensity.current
                    CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                        Box(Modifier.width(320.dp).fillMaxHeight()) {
                            AccountSettingsFlow(TroOiUiState(isAuthenticated = true, demoPreview = mock,
                                backendUserId = userId), {}, page)
                        }
                    }
                }
            } }
            waitFor("Thông tin cá nhân").let { test() }
        }
    }
    @Test fun backendBlocksEditBeforeOpeningFormInBothThemes() {
        listOf(false, true).forEach { dark -> host(false, "fixture-user-ha", dark) {
            noForm(); click("Thay đổi Email"); waitFor("Hiện chưa khả dụng")
            assertNull(matching("Xác thực bảo mật")); noForm(); click("Đã hiểu"); noForm()
        } }
    }
    @Test fun wrongPasswordAndCancelKeepFormClosedThenCorrectMockOpensDraft() {
        host(true, "fixture-user-lan") {
            click("Thay đổi Email"); waitFor("Xác thực bảo mật"); noForm()
            input("wrong"); click("Tiếp tục"); waitFor("Mật khẩu hiện tại không đúng."); noForm()
            click("Hủy"); waitFor("Thông tin cá nhân"); noForm()
            click("Thay đổi Email"); input("TroOi2026!"); click("Tiếp tục"); waitFor("Lưu thay đổi")
            assertNull(matching("Xác thực bảo mật"))
        }
    }
    @Test fun configuredPinNeverOffersPasswordFallbackAndCancelKeepsFormClosed() {
        host(true, "fixture-user-ha", true) {
            click("Thay đổi Email"); waitFor("Xác thực bảo mật"); noForm()
            waitFor("Mã PIN bảo mật"); assertNull(matching("Mật khẩu hiện tại"))
            input("000000"); click("Tiếp tục"); waitFor("Mã PIN không đúng."); noForm()
            click("Quên mã PIN"); waitFor("Khôi phục quyền truy cập"); assertNull(matching("Mật khẩu hiện tại"))
            click("Đã hiểu"); noForm()
            click("Thay đổi Email"); input("482795"); click("Tiếp tục"); waitFor("Lưu thay đổi")
        }
    }
}
