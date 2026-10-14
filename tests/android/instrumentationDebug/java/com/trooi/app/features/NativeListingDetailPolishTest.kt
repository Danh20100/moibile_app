package com.trooi.app.features

import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
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
import com.trooi.app.features.discovery.ListingDetailScreen
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Isolated native render: no authentication, backend writes or production data. */
class NativeListingDetailPolishTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()

    private fun descendants(node: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> =
        if (node == null) emptyList() else listOf(node) +
            (0 until node.childCount).flatMap { descendants(node.getChild(it)) }

    private fun visibleNodes(): List<AccessibilityNodeInfo> {
        if (Build.VERSION.SDK_INT >= 34) instrumentation.uiAutomation.clearCache()
        return descendants(instrumentation.uiAutomation.rootInActiveWindow)
    }

    private fun scrollUntil(target: String) {
        repeat(24) {
            val nodes = visibleNodes()
            if (nodes.any { it.text?.toString() == target && it.isVisibleToUser }) return
            val scrollable = nodes.filter { it.isScrollable && it.isVisibleToUser }
                .maxByOrNull { node -> Rect().let { node.getBoundsInScreen(it); it.height() } }
            if (scrollable != null) {
                scrollable.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                instrumentation.waitForIdleSync()
            }
            Thread.sleep(260)
        }
        save("missing-section.png")
        error("Missing section or field: $target; nodes=" +
            visibleNodes().take(25).joinToString { "${it.className}:${it.text}:${it.isScrollable}" })
    }

    private fun save(name: String) {
        instrumentation.waitForIdleSync()
        Thread.sleep(350)
        val output = File(instrumentation.targetContext.getExternalFilesDir(null),
            "discovery-ui-polish").apply { mkdirs() }
        val bitmap = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
        File(output, name).outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        // Keep a separate QA capture after Gradle uninstalls the instrumentation APK.
        instrumentation.uiAutomation.executeShellCommand(
            "screencap -p /sdcard/Download/trooi-polish-$name"
        ).close()
        Thread.sleep(250)
    }

    @Test fun listingCardsAmenityIconsAndCostRowsRenderAtCompactWidth() {
        for (dark in listOf(false, true)) {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    activity.setContent {
                        TroOiTheme(darkTheme = dark) {
                            val density = LocalDensity.current
                            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                                Box(Modifier.width(320.dp).fillMaxHeight()
                                    .semantics { testTagsAsResourceId = true }) {
                                    ListingDetailScreen("demo-room", onBack = {}, preview = true)
                                }
                            }
                        }
                    }
                }
                val suffix = if (dark) "dark" else "light"
                instrumentation.waitForIdleSync()
                Thread.sleep(700)
                save("start-$suffix.png")
                scrollUntil("Tiện nghi")
                scrollUntil("Máy giặt chung")
                assertTrue(visibleNodes().any { it.viewIdResourceName?.startsWith("listing-amenity-") == true })
                save("amenities-$suffix.png")
                scrollUntil("Chi phí thuê")
                scrollUntil("Cọc dự kiến")
                scrollUntil("2.800.000đ")
                assertTrue(visibleNodes().any { it.viewIdResourceName?.startsWith("listing-cost-") == true })
                save("costs-$suffix.png")
                scrollUntil("Khu vực công khai")
                scrollUntil("Vị trí được công khai ở mức khu vực, không phải địa chỉ chính xác.")
                save("location-$suffix.png")
            }
        }
    }
}
