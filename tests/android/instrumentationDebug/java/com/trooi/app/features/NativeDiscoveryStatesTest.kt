package com.trooi.app.features

import android.graphics.Bitmap
import android.os.Bundle
import android.os.Build
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
import com.trooi.app.features.discovery.ListingDetailScreen
import com.trooi.app.features.discovery.SearchExperienceScreen
import com.trooi.app.features.discovery.NativeMapView
import com.trooi.app.BuildConfig
import com.trooi.app.features.tenant.V1ListingDetailScreen
import com.trooi.app.features.inquiry.InquiryComposer
import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.ListingVisibility
import com.trooi.app.ui.components.TroOiScreenScaffold
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/** Native compact search callbacks and unavailable listing; no location grant or backend write. */
class NativeDiscoveryStatesTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (root == null) emptyList() else
        listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }
    private fun visible(): List<AccessibilityNodeInfo> {
        // Activity replacement and scrolling can leave cached virtual children behind.
        if (Build.VERSION.SDK_INT >= 34) instrumentation.uiAutomation.clearCache()
        return nodes(instrumentation.uiAutomation.rootInActiveWindow)
    }
    private fun waitFor(text: String) {
        repeat(50) {
            if (visible().any { it.text?.toString() == text }) return
            Thread.sleep(100)
        }
        error("Missing text: $text")
    }
    private fun click(text: String) {
        repeat(12) {
            var node = visible().firstOrNull { it.text?.toString() == text }
            while (node != null && !node.isClickable) node = node.parent
            if (node?.isEnabled == true && node.isVisibleToUser && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                instrumentation.waitForIdleSync(); return
            }
            visible().firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            Thread.sleep(500)
            instrumentation.waitForIdleSync()
        }
        instrumentation.uiAutomation.takeScreenshot()?.let { bitmap ->
            File(instrumentation.targetContext.getExternalFilesDir(null), "round5-discovery-failure.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
        error("Unreachable $text; nodes=" + visible().joinToString { "${it.className}:${it.text?.toString()?.take(80)}:${it.contentDescription}:scroll=${it.isScrollable}:visible=${it.isVisibleToUser}" })
    }

    @Test fun missingMapConfigurationRendersWithoutEspressoInBothThemes() {
        assumeTrue(BuildConfig.MAPS_API_KEY.isBlank())
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "round7-native-map").apply { mkdirs() }
        for (dark in listOf(false, true)) {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            TroOiScreenScaffold(contentWindowInsets = WindowInsets.safeDrawing) { insets ->
                                Box(Modifier.width(320.dp).fillMaxHeight().padding(insets).consumeWindowInsets(insets)) {
                                    NativeMapView(DemoData.read.publicListings, null, {}, {}, {})
                                }
                            }
                        }
                    }
                } }
                waitFor("Chưa cấu hình bản đồ")
                assertTrue(visible().any { it.text?.toString() == "Chưa cấu hình bản đồ" && it.isVisibleToUser })
                instrumentation.waitForIdleSync()
                Thread.sleep(500)
                val bitmap = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
                File(directory, "map-config-320-font1.3-${if (dark) "dark" else "light"}.png").outputStream().use {
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                }
                bitmap.recycle()
            }
        }
    }

    @Test fun publicFallbackAndInquiryRetainTheirBoundariesInCompactBothThemes() {
        val listing = DemoData.read.publicListings.first { it.visibility == ListingVisibility.PUBLISHED }.copy(rentalDetails = null)
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "round5-public-listing-states").apply { mkdirs() }
        for (dark in listOf(false, true)) for (case in listOf("public-detail", "public-unavailable", "inquiry-error", "inquiry-confirmed-projection")) {
            var logins = 0
            var reports: String? = null
            var backs = 0
            var submitted: Pair<String, String>? = null
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            TroOiScreenScaffold(contentWindowInsets = WindowInsets.safeDrawing) { insets ->
                                Box(Modifier.width(320.dp).fillMaxHeight().padding(insets).consumeWindowInsets(insets)) {
                                    if (case.startsWith("public-")) V1ListingDetailScreen(
                                        TroOiUiState(read = DemoData.read.copy(publicListings = if (case == "public-detail") listOf(listing) else emptyList())),
                                        listing.listingId, { backs++ }, { logins++ }, { id, text -> submitted = id to text }, { reports = it })
                                    else InquiryComposer(TroOiUiState(isAuthenticated = true,
                                        inquiryError = if (case == "inquiry-error") "Native inquiry error" else null,
                                        inquiryCompletedListingId = if (case == "inquiry-confirmed-projection") listing.listingId else null),
                                        listing.listingId, { logins++ }, { id, text -> submitted = id to text })
                                }
                            }
                        }
                    }
                } }
                when (case) {
                    "public-detail" -> {
                        waitFor(listing.title); click("Đăng nhập để liên hệ"); assertEquals(1, logins); assertNull(submitted)
                        click("Báo cáo tin đăng"); assertEquals(listing.listingId, reports)
                    }
                    "public-unavailable" -> { waitFor("Tin đăng không khả dụng"); click("← Quay lại"); assertEquals(1, backs) }
                    "inquiry-error" -> {
                        waitFor("Native inquiry error")
                        fun field() = visible().single { it.className == "android.widget.EditText" }
                        assertTrue(field().performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                            Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "x".repeat(1001)) }))
                        waitFor("x".repeat(1000)); click("Thử gửi lại")
                        assertEquals(listing.listingId to "x".repeat(1000), submitted)
                        assertEquals("x".repeat(1000), field().text.toString()); waitFor("Native inquiry error")
                        assertFalse(visible().any { it.text?.toString() == "Đã gửi yêu cầu liên hệ." })
                    }
                    else -> {
                        waitFor("Đã gửi yêu cầu liên hệ."); assertNull(submitted)
                        assertFalse(visible().any { it.className == "android.widget.EditText" })
                    }
                }
                Thread.sleep(500)
                val bitmap = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
                File(directory, "$case-320-font1.3-${if (dark) "dark" else "light"}.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                bitmap.recycle()
            }
        }
    }

    @Test fun searchPreservesLocalThenRemoteArgumentsAndResetAndClose() {
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "round5-discovery-states").apply { mkdirs() }
        for (dark in listOf(false, true)) {
            val events = mutableListOf<String>()
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            SearchExperienceScreen(onClose = { events += "close" },
                                onSearchSubmitted = { lat, lng, radius, min, max -> events += "remote:$lat:$lng:$radius:$min:$max" },
                                onResetSearch = { events += "reset" }, modifier = Modifier.width(320.dp),
                                onLocalSearch = { area, type, min, max -> events += "local:$area:$type:$min:$max" },
                                initialMinPrice = "3000000", initialMaxPrice = "5000000")
                        }
                    }
                } }
                waitFor("Tìm khu vực, trường hoặc địa điểm")
                assertTrue("Search title must be a heading", visible().any { it.isHeading && nodes(it).any { child -> child.text?.toString() == "Tìm phòng" } })
                val field = visible().first { it.className == "android.widget.EditText" }
                assertTrue(field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                    Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "Địa điểm dài kiểm thử tìm phòng") }))
                waitFor("Địa điểm dài kiểm thử tìm phòng")
                click("Tìm kiếm")
                assertEquals(listOf("local:Địa điểm dài kiểm thử tìm phòng:Tất cả:3000000:5000000", "remote:null:null:3000:3000000:5000000"), events)
                click("Xóa tất cả"); assertEquals("reset", events.last())
                click("Tìm kiếm"); assertEquals("local::Tất cả::", events[events.lastIndex - 1]); assertEquals("remote:null:null:3000:null:null", events.last())
                var close = visible().first { it.contentDescription?.toString() == "Đóng tìm kiếm" }
                while (!close.isClickable) close = close.parent
                assertTrue(close.performAction(AccessibilityNodeInfo.ACTION_CLICK)); instrumentation.waitForIdleSync()
                assertEquals("close", events.last())
                Thread.sleep(500)
                val bitmap = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
                File(directory, "search-320-font1.3-${if (dark) "dark" else "light"}.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                bitmap.recycle()
            }
        }
    }

    @Test fun unavailableListingKeepsItsBackActionInBothThemes() {
        for (dark in listOf(false, true)) {
            var backs = 0
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) { ListingDetailScreen("missing", { backs++ }, presentation = null) }
                } }
                waitFor("Tin đăng hiện không khả dụng."); click("Quay lại"); assertEquals(1, backs)
            }
        }
    }
}
