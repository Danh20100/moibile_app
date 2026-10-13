package com.trooi.app.features

import com.trooi.app.core.model.*
import com.trooi.app.features.notifications.notificationMessage
import com.trooi.app.features.notifications.notificationSourceLabel
import com.trooi.app.features.notifications.notificationTitle
import org.junit.Assert.*
import org.junit.Test

class RentalPresentationTest {
    @Test fun moneyKeepsExactAmountsAndDoesNotInventInvalidValues() {
        assertEquals("1.000 ₫", rentalMoney("1000.00"))
        assertEquals("1.234,5 ₫", rentalMoney("1234.50"))
        assertEquals("9.999.999.999.999.999,99 ₫", rentalMoney("9999999999999999.99"))
        assertEquals("Chưa có", rentalMoney("Chưa có"))
    }

    @Test fun datesFollowVietnamDayBoundaryAndRetainUnparseableSource() {
        assertEquals("14/10/2026", rentalDate("2026-10-13T18:00:00Z"))
        assertEquals("01:00, 14/10/2026", rentalDate("2026-10-13T18:00:00Z", true))
        assertEquals("13/10/2026", rentalDate("2026-10-13"))
        assertEquals("Chưa xác định", rentalDate("Chưa xác định"))
    }

    @Test fun pendingOrUnknownCheckoutNeverClaimsConfirmedMoney() {
        for (status in listOf("INITIATED", "CREATED", "UNKNOWN", "FAILED", "NEW_STATUS")) {
            assertFalse(gatewayStatusLabel(status).contains("Đã ghi nhận"))
        }
        assertEquals("Đã ghi nhận thanh toán", gatewayStatusLabel("SUCCEEDED"))
        assertFalse(paymentVerificationLabel("NEW_VERIFICATION").contains("đã"))
    }

    @Test fun notificationReferencesBecomeCopyWithoutLeakingIdsOrClaimingDebtIsPaid() {
        val note = notification("PAYMENT_CONFIRMED", "payment:payment-qa-1")
        val body = notificationMessage(note)
        assertEquals("Đã ghi nhận thanh toán", notificationTitle(note.category))
        assertFalse(body.contains("payment-qa-1"))
        assertFalse(body.contains("tất toán"))
        assertEquals("Xem thanh toán", notificationSourceLabel(note.sourceType))
        assertEquals("Có khoản cần thanh toán", notificationTitle("PAYMENT_DUE"))
    }

    @Test fun realNotificationMessageIsPreservedAndUnknownReferencesStayNeutral() {
        assertEquals("Điện sẽ tạm ngắt lúc 9 giờ.", notificationMessage(notification("TENANCY_NOTICE", "Điện sẽ tạm ngắt lúc 9 giờ.")))
        val unknown = notification("NEW_CATEGORY", "unknown:private-id")
        assertEquals("Thông báo mới", notificationTitle(unknown.category))
        assertFalse(notificationMessage(unknown).contains("private-id"))
        assertFalse(notificationMessage(unknown).contains("thanh toán"))
        assertFalse(notificationMessage(notification("PAYMENT_CONFIRMED", "{\"internal\":\"data\"}")).contains("internal"))
    }

    private fun notification(category: String, message: String) = NotificationCard(
        notificationId = "notice-qa", category = category, message = message,
        deliveryStatus = "PENDING", createdAtLabel = "2026-10-13T00:00:00Z",
        sourceType = "PAYMENT", sourceId = "payment-qa-1",
    )
}
