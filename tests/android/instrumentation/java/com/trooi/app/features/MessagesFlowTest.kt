package com.trooi.app.features

import android.content.Intent
import android.graphics.Bitmap
import android.content.ContentValues
import android.provider.MediaStore
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.MainActivity
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class MessagesFlowTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(tag: String) = compose.waitUntil(30000) { runCatching {
        compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    }.getOrDefault(false) }
    private fun screenshot(name: String) {
        compose.waitForIdle()
        android.os.SystemClock.sleep(700)
        val bitmap = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
        val resolver = instrumentation.targetContext.contentResolver
        val uri = requireNotNull(resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "$name-${System.currentTimeMillis()}.png")
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/TroOiRuntime")
        }))
        requireNotNull(resolver.openOutputStream(uri)).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
    }
    private fun logout() {
        compose.onNodeWithTag("nav-tab-profile").performClick()
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("account-logout"))
        compose.onNodeWithTag("account-logout").performClick()
    }
    private fun login(identifier: String) {
        compose.waitUntil(30000) { compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }
        compose.onAllNodesWithText("Đăng nhập").onFirst().performClick()
        compose.onAllNodes(hasSetTextAction())[0].performTextReplacement(identifier)
        compose.onAllNodes(hasSetTextAction())[1].performTextReplacement("TroOi2026!")
        compose.onNodeWithText("Đăng nhập").performClick()
        waitFor("ledger-screen")
    }
    @Test fun localConversationFlowPersistsAndSeparatesAccounts() {
        instrumentation.targetContext.startActivity(Intent(instrumentation.targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        compose.waitUntil(30000) { runCatching { compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty() ||
            compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }.getOrDefault(false) }
        if (compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty()) logout()
        login("tenant@trooi.local")
        compose.onNodeWithTag("nav-tab-messages").performClick()
        waitFor("conversation-conversation-a02")
        compose.onNodeWithTag("conversation-conversation-an-nhien").assertExists()
        screenshot("messages-tenant-list")
        compose.onNodeWithTag("messages-search").performTextReplacement("Không có tài sản này")
        compose.onNodeWithText("Không tìm thấy cuộc trò chuyện phù hợp.").assertExists()
        compose.onNodeWithTag("messages-search").performTextClearance()
        compose.onNodeWithTag("conversation-conversation-a02").performClick()
        waitFor("conversation-detail")
        screenshot("messages-tenant-chat")
        val note = "Em đã lưu lịch sửa vòi nước ngày 09/10, lúc ${java.time.LocalTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss"))}."
        compose.onNodeWithTag("message-composer").performTextReplacement("x".repeat(501))
        compose.onNodeWithTag("message-save").assertIsNotEnabled()
        compose.onNodeWithTag("message-composer").performTextReplacement(note)
        screenshot("messages-composer-keyboard")
        compose.onNodeWithTag("message-save").performClick()
        compose.waitUntil(20000) { compose.onAllNodesWithText(note).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("conversation-messages").performScrollToNode(hasText(note))
        compose.onAllNodesWithTag("message-local-only").onLast().assertExists()
        screenshot("messages-local-note")
        instrumentation.uiAutomation.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)
        if (compose.onAllNodesWithTag("conversation-detail").fetchSemanticsNodes().isNotEmpty()) compose.onNodeWithContentDescription("Quay lại Tin nhắn").performClick()
        logout()
        login("tenant@trooi.local")
        compose.onNodeWithTag("nav-tab-messages").performClick()
        waitFor("conversation-conversation-a02")
        compose.onNodeWithTag("conversation-conversation-a02").performClick()
        waitFor("conversation-detail")
        compose.onNodeWithTag("conversation-messages").performScrollToNode(hasText(note))
        compose.onNodeWithText(note).assertExists()
        try {
            android.os.ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("cmd uimode night yes")).use { it.readBytes() }
            android.os.SystemClock.sleep(700)
            waitFor("nav-tab-messages")
            compose.onNodeWithTag("nav-tab-messages").performClick()
            if (compose.onAllNodesWithTag("conversation-detail").fetchSemanticsNodes().isNotEmpty()) compose.onNodeWithContentDescription("Quay lại Tin nhắn").performClick()
            waitFor("conversation-conversation-a02")
            screenshot("messages-dark-list")
            compose.onNodeWithTag("conversation-conversation-a02").performClick()
            waitFor("conversation-detail")
            compose.onNodeWithTag("conversation-messages").performScrollToNode(hasText(note))
            screenshot("messages-dark-chat")
        } finally {
            android.os.ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("cmd uimode night no")).use { it.readBytes() }
            android.os.SystemClock.sleep(700)
        }
        waitFor("nav-tab-profile")
        logout()
        login("owner@trooi.local")
        compose.onNodeWithTag("nav-tab-messages").performClick()
        waitFor("conversation-conversation-a02")
        compose.onAllNodesWithText("Nguyễn Ngọc Lan").onFirst().assertExists()
        screenshot("messages-owner-list")
        compose.onNodeWithTag("conversation-conversation-a02").performClick()
        waitFor("conversation-detail")
        compose.onNodeWithText(note).assertDoesNotExist()
        screenshot("messages-owner-chat")
        logout()
        login("onboarding@trooi.local")
        compose.onNodeWithTag("nav-tab-messages").performClick()
        waitFor("messages-empty-explore")
        screenshot("messages-empty")
        compose.onNodeWithTag("messages-empty-explore").performClick()
        compose.onNodeWithTag("explore-card-demo-studio").assertExists()
    }
}
