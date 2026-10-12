package com.trooi.app.features

import android.graphics.Rect
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.demo.DebugFixtureCatalog
import com.trooi.app.core.demo.FixtureCatalog
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Test

/** Native accessibility actions work independently of Espresso's API 37 input harness. */
class NativeSharedPrimitivesTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (root == null) emptyList() else
        listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }
    private fun tagged(tag: String): AccessibilityNodeInfo {
        repeat(50) {
            nodes(instrumentation.uiAutomation.rootInActiveWindow).firstOrNull { it.viewIdResourceName == tag }?.let { return it }
            Thread.sleep(100)
        }
        error("Missing native primitive: $tag")
    }
    @Test fun debugAndroidAssetsLoadTheSameCatalogAsAdapters() {
        val context = instrumentation.targetContext
        val catalog = FixtureCatalog.parse(context.assets.open("fixtures/v1/manifest.json").bufferedReader().use { it.readText() }) {
            context.assets.open("fixtures/v1/$it").bufferedReader().use { it.readText() }
        }
        assertEquals(catalog, DebugFixtureCatalog.current)
    }
    @Test fun nativeSharedActionsAndCompactInformationLayoutWorkInBothThemes() {
        listOf(false, true).forEach { dark ->
            val clicks = mutableIntStateOf(0)
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            Column(Modifier.width(320.dp).safeDrawingPadding().semantics { testTagsAsResourceId = true }) {
                                TroOiPageHeader("Tiêu đề trang")
                                TroOiButton("Primary", { clicks.intValue++ }, modifier = Modifier.testTag("primary"))
                                TroOiButton("Disabled", { clicks.intValue++ }, enabled = false, modifier = Modifier.testTag("disabled"))
                                TroOiButton("Secondary", { clicks.intValue++ }, style = TroOiButtonStyle.SECONDARY, modifier = Modifier.testTag("secondary"))
                                TroOiButton("Busy", { clicks.intValue++ }, busy = true, modifier = Modifier.testTag("busy"))
                                TroOiInformationRow("Địa chỉ cư trú", "Căn hộ A02, Bình Thạnh, TP. Hồ Chí Minh", "Xem chi tiết",
                                    onClick = { clicks.intValue++ }, actionModifier = Modifier.testTag("info-action"))
                            }
                        }
                    }
                } }
                assertTrue(tagged("primary").performAction(AccessibilityNodeInfo.ACTION_CLICK))
                assertTrue(nodes(instrumentation.uiAutomation.rootInActiveWindow).single { it.text?.toString() == "Tiêu đề trang" }.isHeading)
                assertTrue(tagged("secondary").performAction(AccessibilityNodeInfo.ACTION_CLICK))
                assertFalse(tagged("disabled").isEnabled)
                assertFalse(tagged("busy").isEnabled)
                val value = nodes(instrumentation.uiAutomation.rootInActiveWindow).single { it.text?.toString() == "Căn hộ A02, Bình Thạnh, TP. Hồ Chí Minh" }
                val valueBounds = Rect().also(value::getBoundsInScreen)
                val actionBounds = Rect().also(tagged("info-action")::getBoundsInScreen)
                assertTrue(actionBounds.top >= valueBounds.bottom)
                assertTrue(tagged("info-action").performAction(AccessibilityNodeInfo.ACTION_CLICK))
                instrumentation.waitForIdleSync()
                assertEquals(3, clicks.intValue)
            }
        }
    }
    @Test fun sharedFieldPreservesInputErrorAndSecretSemanticsInBothThemes() {
        listOf(false, true).forEach { dark ->
            val value = mutableStateOf("")
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            Column(Modifier.width(320.dp).safeDrawingPadding().semantics { testTagsAsResourceId = true }) {
                                TroOiFormField(value.value, { value.value = it }, Modifier.fillMaxWidth().testTag("shared-secret"),
                                    label = { androidx.compose.material3.Text("Mật khẩu hiện tại") }, singleLine = true,
                                    visualTransformation = PasswordVisualTransformation(), isError = true,
                                    supportingText = { androidx.compose.material3.Text("Mật khẩu hiện tại không đúng.") })
                                TroOiFormField("Nội dung dài cần hỗ trợ", {}, Modifier.fillMaxWidth().testTag("shared-disabled"), enabled = false)
                            }
                        }
                    }
                } }
                val secret = tagged("shared-secret")
                assertTrue(secret.isPassword)
                assertTrue(secret.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "test-secret")
                }))
                instrumentation.waitForIdleSync()
                assertEquals("test-secret", value.value)
                assertFalse(tagged("shared-disabled").isEnabled)
                assertTrue(nodes(instrumentation.uiAutomation.rootInActiveWindow).any { it.text?.toString() == "Mật khẩu hiện tại không đúng." })
            }
        }
    }
    @Test fun genericTextAndActionRolesHaveReadableContrastInBothThemes() {
        for (dark in listOf(false, true)) {
            var pairs = emptyMap<String, Pair<Color, Color>>()
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent { TroOiTheme(darkTheme = dark) {
                    val colors = androidx.compose.material3.MaterialTheme.colorScheme
                    pairs = mapOf("body" to (colors.onSurface to colors.surface),
                        "background" to (colors.onBackground to colors.background),
                        "supporting" to (colors.onSurfaceVariant to colors.surface),
                        "primary" to (colors.onPrimary to colors.primary),
                        "secondary" to (colors.onPrimaryContainer to colors.primaryContainer),
                        "destructive" to (colors.onError to colors.error),
                        "error" to (colors.error to colors.surface))
                } } }
                instrumentation.waitForIdleSync()
                assertEquals(7, pairs.size)
                for ((name, pair) in pairs) {
                    val (a, b) = pair.first.luminance() to pair.second.luminance()
                    val ratio = (maxOf(a, b) + 0.05f) / (minOf(a, b) + 0.05f)
                    assertTrue("$name dark=$dark contrast=$ratio", ratio >= 4.5f)
                }
            }
        }
    }
}
