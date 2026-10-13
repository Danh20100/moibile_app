package com.trooi.app.features

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.trooi.app.core.model.FrontendReadSnapshot
import com.trooi.app.core.model.NotificationCard
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.notifications.V1NotificationCenterScreen
import com.trooi.app.ui.components.TroOiInformationRow
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PaymentPresentationSmokeTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun longPaymentReferenceLeavesBothColumnsReadableAtLargeFont() {
        val reference = "95e18db8-f8e9-4708-838a-328fceb219e2"
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 2f)) {
                TroOiTheme {
                    Box(Modifier.width(280.dp).testTag("metric-container")) {
                        TroOiInformationRow("Mã giao dịch", reference)
                    }
                }
            }
        }
        val container = compose.onNodeWithTag("metric-container").fetchSemanticsNode().boundsInRoot
        val label = compose.onNodeWithText("Mã giao dịch").assertIsDisplayed().fetchSemanticsNode().boundsInRoot
        val value = compose.onNodeWithText(reference).assertIsDisplayed().fetchSemanticsNode().boundsInRoot
        assertTrue("Reference must leave room for its label", label.width >= container.width * .3f)
        assertTrue("Label and value must not overlap", label.bottom <= value.top || label.right <= value.left)
        assertTrue("Reference must stay inside its container", value.width <= container.width)
        assertTrue(value.right <= container.right + 1f)
    }

    @Test
    fun paymentNotificationShowsUsefulCopyAndOpensTheSameRecord() {
        var opened = ""
        val notification = NotificationCard(
            notificationId = "payment-notice-qa",
            category = "PAYMENT_CONFIRMED",
            message = "payment:95e18db8-f8e9-4708-838a-328fceb219e2",
            deliveryStatus = "PENDING",
            createdAtLabel = "2026-10-13T02:00:00.000Z",
            sourceType = "PAYMENT",
            sourceId = "95e18db8-f8e9-4708-838a-328fceb219e2",
        )
        compose.setContent {
            TroOiTheme {
                V1NotificationCenterScreen(
                    state = TroOiUiState(read = FrontendReadSnapshot(notifications = listOf(notification))),
                    onOpen = { opened = it },
                    onBack = {},
                )
            }
        }
        compose.onNodeWithText("Đã ghi nhận thanh toán").assertIsDisplayed()
        compose.onNodeWithTag("notification-payment-notice-qa").performClick()
        assertEquals(notification.notificationId, opened)
    }
}
