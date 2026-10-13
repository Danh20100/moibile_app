package com.trooi.app.features

import android.graphics.Bitmap
import android.content.ContentValues
import android.provider.MediaStore
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.MainActivity
import org.junit.Rule
import org.junit.Test

/** Exercises the actual app/repository/session flow, rather than a preview composable. */
class SeededAccountFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    private fun waitFor(tag: String) = compose.waitUntil(20000) {
        compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    }
    private fun screenshot(name: String) {
        compose.waitForIdle()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.waitForIdleSync()
        android.os.SystemClock.sleep(750) // Let native IME/window transitions finish before capture.
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
    private fun login(email: String, capture: String) {
        compose.waitUntil(20000) { compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty() }
        compose.onAllNodesWithText("Đăng nhập").onFirst().performClick()
        screenshot(capture)
        compose.onAllNodes(hasSetTextAction())[0].performTextReplacement(email)
        compose.onAllNodes(hasSetTextAction())[1].performTextReplacement("TroOi2026!")
        compose.onNodeWithText("Đăng nhập").performClick()
        waitFor("ledger-screen")
    }

    @Test fun separateAccountsOpenCorrectLedgerAndPublicPhotosWithoutPovSwitch() {
        compose.waitUntil(20000) {
            compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty() ||
                compose.onAllNodesWithText("Đăng nhập").fetchSemanticsNodes().isNotEmpty()
        }
        if (compose.onAllNodesWithTag("nav-tab-profile").fetchSemanticsNodes().isNotEmpty()) logout()
        login("tenant@trooi.local", "tenant-login")
        compose.onNodeWithText("Tài sản đang thuê").assertExists()
        compose.onNodeWithText("Căn hộ A02").assertExists()
        compose.onNodeWithTag("ledger-mode-owner").assertDoesNotExist()
        screenshot("tenant-ledger")
        compose.onNodeWithTag("nav-tab-discovery").performClick()
        compose.onNodeWithTag("explore-card-demo-studio").assertExists()
        screenshot("explore")
        compose.onNodeWithTag("explore-card-demo-studio").performClick()
        compose.onNodeWithText("Căn hộ An Nhiên").assertExists()
        screenshot("listing-detail-top")
        compose.onNodeWithTag("listing-detail-demo-studio").performScrollToNode(hasText("Điều cần biết"))
        screenshot("listing-detail-lower")
        compose.onNodeWithTag("listing-detail-demo-studio").performScrollToIndex(0)
        compose.onNodeWithTag("listing-back").performClick()
        compose.onNodeWithTag("nav-tab-profile").performClick()
        compose.onNodeWithText("Nguyễn Ngọc Lan").assertExists()
        compose.onNodeWithTag("profile-mode-operator").assertDoesNotExist()
        screenshot("tenant-profile")
        compose.onNodeWithTag("profile-history").performClick()
        compose.onNodeWithText("Phòng B03").assertExists()
        screenshot("rental-history")
        compose.onNodeWithContentDescription("Quay lại").performClick()
        logout()
        login("owner@trooi.local", "owner-login")
        compose.onNodeWithText("Tài sản của tôi").assertExists()
        compose.onNodeWithTag("ledger-mode-tenant").assertDoesNotExist()
        screenshot("owner-ledger")
        compose.onNodeWithTag("nav-tab-profile").performClick()
        compose.onNodeWithText("Trần Thu Hà").assertExists()
        compose.onNodeWithText("Chủ trọ").assertExists()
        compose.onNodeWithTag("profile-mode-tenant").assertDoesNotExist()
        screenshot("owner-profile")
    }
}
