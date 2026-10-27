package com.trooi.app.features

import android.graphics.Bitmap
import android.graphics.Rect
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
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.features.auth.*
import com.trooi.app.ui.splash.TroOiBrandAssembly
import com.trooi.app.ui.components.TroOiScreenScaffold
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Test
import java.io.File

/** Native screenshots and accessibility checks avoid the Espresso/API37 input harness. */
class NativeAuthLayoutTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (root == null) emptyList() else
        listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }

    @Test fun authBrandWordmarkExposesOneAccessibleName() {
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity -> activity.setContent { TroOiTheme { AuthBrandHero() } } }
            for (attempt in 0 until 50) {
                if (nodes(instrumentation.uiAutomation.rootInActiveWindow).any { it.text?.isNotEmpty() == true }) break
                Thread.sleep(100)
            }
            instrumentation.waitForIdleSync()
            val screenNodes = nodes(instrumentation.uiAutomation.rootInActiveWindow)
            assertEquals(1, screenNodes.count { it.contentDescription?.toString() == "TrọƠi" })
            assertFalse(screenNodes.any { it.text?.toString() in listOf("Trọ", "Ơi") })
        }
    }

    @Test fun animatedBrandAssemblyExposesOneAccessibleName() {
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity -> activity.setContent {
                TroOiTheme {
                    TroOiBrandAssembly(playProgress = 0.5f, containerWidthPx = 1080f, containerHeightPx = 2400f)
                }
            } }
            for (attempt in 0 until 50) {
                if (nodes(instrumentation.uiAutomation.rootInActiveWindow).any { it.contentDescription?.isNotEmpty() == true }) break
                Thread.sleep(100)
            }
            instrumentation.waitForIdleSync()
            val screenNodes = nodes(instrumentation.uiAutomation.rootInActiveWindow)
            assertEquals(1, screenNodes.count { it.contentDescription?.toString() == "TrọƠi" })
            assertFalse(screenNodes.any { it.text?.toString() in listOf("T", "r", "ọ", "Ơ", "i") })
        }
    }

    @Test fun compactAuthScreensRemainReadableAndRecoveryActionIsReachableInBothThemes() {
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "round5-auth").apply { mkdirs() }
        for (dark in listOf(false, true)) for (screen in listOf("welcome", "login", "signup", "recovery")) {
            var recovered = false
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            TroOiScreenScaffold(contentWindowInsets = WindowInsets.safeDrawing) { insets ->
                                Box(Modifier.width(320.dp).fillMaxHeight().padding(insets).consumeWindowInsets(insets)) {
                                    when (screen) {
                                        "welcome" -> AuthWelcomeScreen({}, {})
                                        "login" -> LoginScreen({}, {}, {}, { _, _ -> })
                                        "signup" -> SignUpScreen({}, {}, { _, _, _, _ -> })
                                        else -> ForgotPasswordScreen({}, { recovered = true }, initialIdentifier = "test@example.test")
                                    }
                                }
                            }
                        }
                    }
                } }
                for (attempt in 0 until 50) {
                    if (nodes(instrumentation.uiAutomation.rootInActiveWindow).any { it.text?.isNotEmpty() == true }) break
                    Thread.sleep(100)
                }
                instrumentation.waitForIdleSync()
                Thread.sleep(500)
                val bitmap = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
                File(directory, "$screen-320-font1.3-${if (dark) "dark" else "light"}.png").outputStream().use {
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                }
                bitmap.recycle()
                if (screen == "recovery") {
                    var action = nodes(instrumentation.uiAutomation.rootInActiveWindow).firstOrNull { it.text?.toString() == "Gửi hướng dẫn khôi phục" }
                    assertNotNull(action)
                    while (action != null && !action.isClickable) action = action.parent
                    assertTrue(action?.isEnabled == true)
                    assertTrue(action!!.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                    instrumentation.waitForIdleSync()
                    assertTrue(recovered)
                }
            }
        }
    }

    @Test fun backendSignupShowsGoogleAndFullEmailFormWithoutClaimingEmailIsAvailable() {
        var registered = false
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity -> activity.setContent {
                TroOiTheme {
                    SignUpScreen({}, {}, { _, _, _, _ -> }, onGoogleRegister = { registered = true }, emailOtpEnabled = true)
                }
            } }
            for (attempt in 0 until 50) {
                if (nodes(instrumentation.uiAutomation.rootInActiveWindow).any { it.text?.toString() == "Đăng ký bằng Google" }) break
                Thread.sleep(100)
            }
            instrumentation.waitForIdleSync()
            val screenNodes = nodes(instrumentation.uiAutomation.rootInActiveWindow)
            assertTrue(screenNodes.any { it.text?.toString() == "Họ và tên" })
            assertTrue(screenNodes.any { it.text?.toString() == "Số điện thoại" })
            assertTrue(screenNodes.any { it.text?.toString()?.contains("Mật khẩu") == true })
            assertFalse(screenNodes.any { it.text?.toString() == "Gửi mã" })
            assertFalse(screenNodes.any { it.text?.toString()?.contains("Đăng ký bằng email chưa khả dụng") == true })
            val primary = screenNodes.firstOrNull { it.text?.toString() == "Gửi mã xác nhận" }
            val google = screenNodes.firstOrNull { it.text?.toString() == "Đăng ký bằng Google" }
            assertNotNull(primary)
            assertNotNull(google)
            val primaryBounds = Rect()
            val googleBounds = Rect()
            primary!!.getBoundsInScreen(primaryBounds)
            google!!.getBoundsInScreen(googleBounds)
            assertTrue("Google registration must follow the email form and primary action",
                googleBounds.top >= primaryBounds.bottom)
            val scrolling = screenNodes.firstOrNull { it.isScrollable }
            repeat(4) {
                scrolling?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                instrumentation.waitForIdleSync()
            }
            var action = nodes(instrumentation.uiAutomation.rootInActiveWindow)
                .firstOrNull { it.text?.toString() == "Đăng ký bằng Google" }
            assertNotNull(action)
            while (action != null && !action.isClickable) action = action.parent
            assertTrue(action?.isEnabled == true)
            assertTrue(action!!.performAction(AccessibilityNodeInfo.ACTION_CLICK))
            instrumentation.waitForIdleSync()
            assertTrue(registered)
        }
    }
}
