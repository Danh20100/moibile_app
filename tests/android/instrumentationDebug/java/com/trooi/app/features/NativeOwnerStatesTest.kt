package com.trooi.app.features

import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
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
import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.*
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.OkHttpBackendApi
import com.trooi.app.core.auth.GoogleCredentialAuth
import com.trooi.app.core.network.InMemoryAuthTokenProvider
import com.trooi.app.features.landlord.*
import com.trooi.app.features.ledger.LedgerScreen
import com.trooi.app.features.ledger.OwnerAssetDetail
import com.trooi.app.features.organization.OperatorViewModel
import com.trooi.app.features.organization.V1OperatorWorkspace
import com.trooi.app.features.shared.V1ContractGateway
import com.trooi.app.ui.components.TroOiScreenScaffold
import com.trooi.app.ui.theme.TroOiTheme
import kotlinx.coroutines.CompletableDeferred
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.concurrent.atomic.AtomicInteger

/** Existing catalog projections and rejecting callbacks only; no live server or persisted success. */
class NativeOwnerStatesTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (root == null) emptyList() else
        listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }
    private fun visible(): List<AccessibilityNodeInfo> {
        if (Build.VERSION.SDK_INT >= 34) instrumentation.uiAutomation.clearCache()
        return nodes(instrumentation.uiAutomation.rootInActiveWindow)
    }
    private fun find(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo {
        repeat(50) { visible().firstOrNull(predicate)?.let { return it }; Thread.sleep(100) }
        error("Missing owner control: " + visible().joinToString { "${it.className}:${it.text}:${it.viewIdResourceName}:enabled=${it.isEnabled}:clickable=${it.isClickable}" })
    }
    private fun tag(value: String) = find { it.viewIdResourceName == value }
    private fun click(text: String) {
        repeat(12) {
            for (candidate in visible().filter { it.text?.toString() == text || it.text?.toString()?.startsWith("$text\n") == true }) {
                var node: AccessibilityNodeInfo? = candidate
                while (node != null && !node.isClickable) node = node.parent
                if (node?.isEnabled == true && node.isVisibleToUser && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                    instrumentation.waitForIdleSync(); return
                }
            }
            visible().firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            Thread.sleep(500)
        }
        error("Unreachable owner action: $text")
    }
    private fun capture(name: String, dark: Boolean) {
        Thread.sleep(500)
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "round5-owner-states").apply { mkdirs() }
        val bitmap = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
        File(directory, "$name-320-font1.3-${if (dark) "dark" else "light"}.png").outputStream().use {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
        }
        bitmap.recycle()
    }
    private fun projection(): TroOiUiState {
        val account = DemoData.accounts.first { it.access.operatedOrganizationIds.isNotEmpty() }
        return TroOiUiState(isAuthenticated = true, backendUserId = account.userId, access = account.access,
            read = DemoData.authorizedRead(account.access).copy(localManagement = DemoData.ownerManagement),
            selectedContext = SelectedContext.Operations(DemoData.ORGANIZATION))
    }

    @Test fun scopedOwnerProjectionAndSourceNavigationRenderInBothThemes() {
        val state = projection()
        for (dark in listOf(false, true)) for (case in listOf("dashboard", "properties", "finance", "incidents", "ledger")) {
            var source: SourceTarget? = null
            var operations = 0
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            TroOiScreenScaffold(contentWindowInsets = WindowInsets.safeDrawing) { insets ->
                                Box(Modifier.width(320.dp).fillMaxHeight().padding(insets).consumeWindowInsets(insets).semantics { testTagsAsResourceId = true }) {
                                    when (case) {
                                        "dashboard" -> V1OwnerDashboardScreen(state) { source = it }
                                        "properties" -> V1OwnerPropertiesScreen(state)
                                        "finance" -> V1OwnerFinanceScreen(state) { source = it }
                                        "incidents" -> V1OwnerIncidentsScreen(state) { source = it }
                                        else -> LedgerScreen(state, {}, {}, { operations++ })
                                    }
                                }
                            }
                        }
                    }
                } }
                tag(if (case == "ledger") "ledger-screen" else "v1-owner-$case")
                if (case == "finance") {
                    val charge = state.read.operatorFinanceByOrganization.getValue(DemoData.ORGANIZATION).charges.first()
                    click(charge.label); assertEquals("CHARGE", source?.type); assertEquals(charge.chargeId, source?.id)
                    assertEquals(DemoData.ORGANIZATION, source?.organizationId)
                }
                if (case == "incidents") {
                    val incident = state.read.incidents.first()
                    click(incident.title); assertEquals(incident.incidentId, source?.id); assertEquals(incident.roomId, source?.roomId)
                }
                assertEquals(0, operations)
                capture("owner-$case", dark)
            }
        }
    }

    @Test fun archiveRejectionRetainsDetailAndBusyDismissalIsBlocked() {
        for (dark in listOf(false, true)) {
            var closes = 0
            var edits = 0
            var archived: String? = null
            val rejected = CompletableDeferred<Result<Unit>>()
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            Box(Modifier.semantics { testTagsAsResourceId = true }) {
                                OwnerAssetDetail(projection(), DemoData.occupiedAsset, { closes++ }, { edits++ },
                                    { id -> archived = id; rejected.await() })
                            }
                        }
                    }
                } }
                find { it.text?.toString() == "Chỉnh sửa tài sản" }; capture("owner-detail", dark)
                click("Ngừng quản lý")
                find { it.text?.toString() == "Ngừng quản lý tài sản?" }
                click("Giữ quản lý"); assertNull(archived); assertEquals(0, closes)
                // Await the owner's active window after dismissal before reopening the dialog.
                find { it.text?.toString() == "Chỉnh sửa tài sản" }
                click("Ngừng quản lý")
                find { it.text?.toString() == "Ngừng quản lý tài sản?" }
                click("Ngừng quản lý")
                find { it.isClickable && !it.isEnabled && nodes(it).any { child -> child.text?.toString() == "Ngừng quản lý" } }
                assertEquals(DemoData.occupiedAsset.id, archived)
                ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("input keyevent 4")).use { it.readBytes() }
                find { it.text?.toString() == "Ngừng quản lý tài sản?" }; assertEquals(0, closes)
                instrumentation.runOnMainSync { rejected.complete(Result.failure(IllegalStateException("Native rejected archive"))) }
                find { it.text?.toString() == "Chưa lưu được thay đổi. Vui lòng thử lại." }
                assertEquals(0, closes); assertEquals(0, edits); capture("owner-archive-rejected", dark)
                click("Giữ quản lý"); find { it.text?.toString() == "Chỉnh sửa tài sản" }
                var back = find { it.contentDescription?.toString() == "Quay lại" }
                while (!back.isClickable) back = back.parent
                assertTrue(back.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                instrumentation.waitForIdleSync(); assertEquals(1, closes)
            }
        }
    }

    @Test fun operatorFailedReadRetryAndProtectedCreateKeepDraftWithoutWrite() {
        for (dark in listOf(false, true)) {
            val reads = AtomicInteger()
            val writes = AtomicInteger()
            val tokens = InMemoryAuthTokenProvider().apply { setToken("native-read-only-token") }
            val client = OkHttpClient.Builder().addInterceptor { chain ->
                if (chain.request().method == "GET") reads.incrementAndGet() else writes.incrementAndGet()
                Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(500).message("Native rejected read").body("{}".toResponseBody()).build()
            }.build()
            val identityApi = OkHttpBackendApi(BackendClient("http://127.0.0.1:1", tokens, true))
            val model = OperatorViewModel(
                V1ContractGateway(BackendClient("http://127.0.0.1:1", tokens, true, client)),
                identityApi,
                GoogleCredentialAuth(identityApi),
            )
            var created = 0
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            Box(Modifier.width(320.dp).fillMaxHeight().semantics { testTagsAsResourceId = true }) {
                                V1OperatorWorkspace(projection().access, "", onUnauthorized = {}, onWorkspaceCreated = { created++ }, model = model)
                            }
                        }
                    }
                } }
                tag("operator-error")
                val before = reads.get(); click("Thử lại")
                repeat(50) { if (reads.get() <= before || model.ui.value.busy) Thread.sleep(100) }
                assertTrue(reads.get() > before)
                visible().firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                Thread.sleep(300)
                assertTrue(tag("organization-name").performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                    Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "Khu trọ kiểm thử dài giữ nguyên bản nháp") }))
                find { it.viewIdResourceName == "organization-name" && it.text?.toString() == "Khu trọ kiểm thử dài giữ nguyên bản nháp" }
                click("Tạo khu trọ")
            assertEquals("NETWORK_UNAVAILABLE", model.ui.value.errorKind); assertNull(model.ui.value.success)
                assertEquals(0, writes.get()); assertEquals(0, created)
                assertEquals("Khu trọ kiểm thử dài giữ nguyên bản nháp", tag("organization-name").text.toString())
                capture("operator-protected-create", dark)
            }
        }
    }
}
