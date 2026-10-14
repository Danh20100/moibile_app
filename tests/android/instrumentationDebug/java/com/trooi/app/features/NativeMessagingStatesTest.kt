package com.trooi.app.features

import android.graphics.Bitmap
import android.os.Bundle
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
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.FrontendReadSnapshot
import com.trooi.app.core.model.NotificationCard
import com.trooi.app.core.demo.DemoData
import com.trooi.app.features.messages.MessagesScreen
import com.trooi.app.features.notifications.*
import com.trooi.app.ui.components.TroOiScreenScaffold
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Test
import java.io.File

/** Actual feature branches, with native actions rather than the API37 Espresso input harness. */
class NativeMessagingStatesTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun nodes(root: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> = if (root == null) emptyList() else
        listOf(root) + (0 until root.childCount).flatMap { nodes(root.getChild(it)) }
    private fun click(label: String) {
        repeat(10) {
            val visible = nodes(instrumentation.uiAutomation.rootInActiveWindow)
            var action = visible.firstOrNull { it.text?.toString() == label }
            while (action != null && !action.isClickable) action = action.parent
            if (action?.isEnabled == true && action.isVisibleToUser && action.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return
            visible.firstOrNull { it.isScrollable }?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            Thread.sleep(150)
        }
        error("Unreachable action: $label")
    }
    private fun waitFor(label: String) {
        repeat(50) {
            if (nodes(instrumentation.uiAutomation.rootInActiveWindow).any { it.text?.toString() == label }) return
            Thread.sleep(100)
        }
        error("Missing text: $label")
    }
    private fun openConversation(id: String) {
        repeat(50) {
            val node = nodes(instrumentation.uiAutomation.rootInActiveWindow).firstOrNull { it.viewIdResourceName == "conversation-$id" }
            if (node?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true) return
            Thread.sleep(100)
        }
        error("Missing conversation: $id")
    }

    @Test fun olderMessagePageCanBeRequestedFromConversation() {
        val base = DemoData.conversations(DemoData.accounts.first().userId).first()
        val conversation = base.copy(olderMessagesCursor = "opaque-cursor")
        var requested: String? = null
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity -> activity.setContent {
                TroOiTheme {
                    Box(Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }) {
                        MessagesScreen(
                            TroOiUiState(read = FrontendReadSnapshot(conversations = listOf(conversation))),
                            {}, {}, onSave = { _, _, _ -> Result.success(Unit) },
                            onLoadOlderMessages = { requested = it },
                        )
                    }
                }
            } }
            openConversation(conversation.id)
            click("Tải tin nhắn cũ hơn")
            instrumentation.waitForIdleSync()
            assertEquals(conversation.id, requested)
        }
    }

    @Test fun rejectedLocalSaveKeepsDraftAndValidatesBeforeCallingTheRepository() {
        val conversation = DemoData.conversations(DemoData.accounts.first().userId).first()
        for (dark in listOf(false, true)) {
            var attempted: Pair<String, String>? = null
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            TroOiScreenScaffold(contentWindowInsets = WindowInsets.safeDrawing) { insets ->
                                Box(Modifier.width(320.dp).fillMaxHeight().padding(insets).consumeWindowInsets(insets).semantics { testTagsAsResourceId = true }) {
                                    MessagesScreen(TroOiUiState(read = FrontendReadSnapshot(conversations = listOf(conversation))), {}, {}, onSave = { id, draft, _ ->
                                        attempted = id to draft
                                        Result.failure(IllegalStateException("Native test rejection"))
                                    })
                                }
                            }
                        }
                    }
                } }
                openConversation(conversation.id)
                fun field() = nodes(instrumentation.uiAutomation.rootInActiveWindow).single { it.className == "android.widget.EditText" }
                fun saveButton(): AccessibilityNodeInfo {
                    repeat(30) {
                        nodes(instrumentation.uiAutomation.rootInActiveWindow)
                            .firstOrNull { it.viewIdResourceName == "message-save" }?.let { return it }
                        Thread.sleep(100)
                    }
                    error("Missing message-save button")
                }
                fun setDraft(value: String) {
                    assertTrue(field().performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                        Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value) }))
                    instrumentation.waitForIdleSync()
                    waitFor("${value.length}/500")
                }
                fun saveEnabled() = saveButton().isEnabled
                assertFalse(saveEnabled())
                setDraft("x".repeat(501)); assertFalse(saveEnabled()); assertNull(attempted)
                val draft = "Bản nháp kiểm thử phải được giữ khi lưu thất bại."
                setDraft(draft); assertTrue(saveEnabled()); assertTrue(saveButton().performAction(AccessibilityNodeInfo.ACTION_CLICK))
                waitFor("Chưa lưu được tin nhắn. Nội dung của bạn vẫn được giữ lại.")
                assertEquals(conversation.id to draft, attempted)
                assertEquals(draft, field().text.toString())
                assertFalse(nodes(instrumentation.uiAutomation.rootInActiveWindow).any {
                    it.text?.toString() == "Tin nhắn mới được lưu trên thiết bị, chưa gửi cho người nhận." ||
                        it.text?.toString() == "Đã gửi tin nhắn."
                })
            }
        }
    }

    @Test fun compactFeedbackStatesAndRecoveryActionsWorkInBothThemes() {
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "round5-messaging-states").apply { mkdirs() }
        for (dark in listOf(false, true)) for (case in listOf("messages-loading", "messages-error", "messages-empty",
            "notifications-loading", "notifications-empty", "notification-unavailable", "notification-detail", "notification-source")) {
            var retries = 0
            var explores = 0
            var marked: String? = null
            var source: String? = null
            val notification = NotificationCard("native-display-notification", "Cập nhật kiểm thử",
                "Nội dung dài dùng riêng trong test để kiểm tra khả năng xuống dòng ở kích thước nhỏ.",
                "DELIVERED", "11/10/2026", sourceType = if (case == "notification-source") "TENANCY" else null,
                sourceId = if (case == "notification-source") "native-display-tenancy" else null)
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { activity -> activity.setContent {
                    TroOiTheme(darkTheme = dark) {
                        val density = LocalDensity.current
                        CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                            TroOiScreenScaffold(contentWindowInsets = WindowInsets.safeDrawing) { insets ->
                                Box(Modifier.width(320.dp).fillMaxHeight().padding(insets).consumeWindowInsets(insets)) {
                                    when (case) {
                                        "notifications-loading" -> V1NotificationCenterScreen(TroOiUiState(runtimeLoading = true), {}, {})
                                        "notifications-empty" -> V1NotificationCenterScreen(TroOiUiState(), {}, {})
                                        "notification-unavailable" -> V1NotificationDetailScreen(TroOiUiState(), "missing", {}, {}, {})
                                        "notification-detail", "notification-source" -> V1NotificationDetailScreen(
                                            TroOiUiState(read = FrontendReadSnapshot(notifications = listOf(notification))), notification.notificationId,
                                            {}, { marked = it }, { source = it })
                                        else -> MessagesScreen(TroOiUiState(messagesLoading = case == "messages-loading",
                                            messagesLoadFailed = case == "messages-error"), { explores++ }, { retries++ }, onSave = { _, _, _ -> Result.success(Unit) })
                                    }
                                }
                            }
                        }
                    }
                } }
                val expected = when (case) {
                    "messages-loading" -> "Đang tải tin nhắn…"
                    "messages-error" -> "Chưa tải được tin nhắn. Vui lòng thử lại."
                    "messages-empty" -> "Chưa có cuộc trò chuyện"
                    "notifications-empty" -> "Bạn chưa có thông báo nào."
                    "notification-unavailable" -> "Không tìm thấy thông báo này."
                    "notification-detail", "notification-source" -> notification.message
                    else -> "Thông báo"
                }
                for (attempt in 0 until 50) {
                    if (nodes(instrumentation.uiAutomation.rootInActiveWindow).any { it.text?.toString() == expected }) break
                    Thread.sleep(100)
                }
                instrumentation.waitForIdleSync()
                val visible = nodes(instrumentation.uiAutomation.rootInActiveWindow)
                assertTrue("Missing $case feedback", visible.any { it.text?.toString() == expected })
                if (case.endsWith("loading")) assertTrue("Missing progress", visible.any { it.className == "android.widget.ProgressBar" })
                if (case == "messages-error" || case == "messages-empty") {
                    val label = if (case == "messages-error") "Thử lại" else "Khám phá tài sản"
                    click(label)
                    instrumentation.waitForIdleSync()
                    assertEquals(if (case == "messages-error") 1 else 0, retries)
                    assertEquals(if (case == "messages-empty") 1 else 0, explores)
                }
                if (case == "notification-detail" || case == "notification-source") {
                    val label = if (case == "notification-detail") "Đánh dấu đã đọc" else "Xem nội dung liên quan"
                    click(label)
                    instrumentation.waitForIdleSync()
                    assertEquals(notification.notificationId, if (case == "notification-detail") marked else source)
                    if (case == "notification-detail") assertFalse(visible.any { it.text?.toString() == "Xem nội dung liên quan" })
                }
                Thread.sleep(500)
                val bitmap = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
                File(directory, "$case-320-font1.3-${if (dark) "dark" else "light"}.png").outputStream().use {
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                }
                bitmap.recycle()
            }
        }
    }
}
