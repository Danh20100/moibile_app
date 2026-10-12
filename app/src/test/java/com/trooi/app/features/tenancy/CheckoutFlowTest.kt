package com.trooi.app.features.tenancy

import com.trooi.app.core.auth.PendingCheckoutHint
import com.trooi.app.features.shared.GatewayCheckout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckoutFlowTest {
    private val intent = CheckoutIntent("t-1", "50000.00", "11111111-1111-4111-8111-111111111111")

    @Test
    fun doubleTapReusesTheSameIdempotencyKey() {
        val first = rememberCheckoutBeforePost("t-1", "50000.00", null) { "key-a" }
        val second = rememberCheckoutBeforePost("t-1", "50000.00", first) { "key-b" }
        assertEquals("key-a", first.idempotencyKey)
        assertEquals("key-a", second.idempotencyKey)
        assertEquals(first.idempotencyKey, second.idempotencyKey)
    }

    @Test
    fun paidCheckoutStartsANewInvoiceForTheSameAmount() {
        val paid = checkout("SUCCEEDED", resultingPaymentId = "pay-1")
        val next = rememberCheckoutBeforePost("t-1", "50000.00", intent, paid) { "key-new" }
        assertEquals("key-new", next.idempotencyKey)
        assertNull(next.checkoutId)
        assertTrue(shouldStartFreshCheckout(paid))
        assertFalse(shouldStartFreshCheckout(checkout("CREATED")))
    }

    @Test
    fun lostCreateResponseReplaysTheSamePostKey() {
        val remembered = rememberCheckoutBeforePost("t-1", "50000.00", intent) { "other" }
        assertEquals(intent.idempotencyKey, remembered.idempotencyKey)
        assertNull(remembered.checkoutId)
    }

    @Test
    fun pendingCheckoutDoesNotCreatePayment() {
        val created = checkout("CREATED", resultingPaymentId = null)
        assertFalse(isConfirmedGatewayPayment(created))
        val afterId = rememberCheckoutId(intent, created.id)
        assertEquals("chk-1", afterId.checkoutId)
        assertFalse(isConfirmedGatewayPayment(created))
    }

    @Test
    fun providerDisabledExposesManualFlow() {
        assertTrue(manualCheckoutAvailable(null, createFailed = true))
        assertTrue(
            manualCheckoutAvailable(
                checkout("FAILED", replayBlockedReason = "PROVIDER_DISABLED"),
                createFailed = false,
            ),
        )
        assertFalse(manualCheckoutAvailable(checkout("CREATED"), createFailed = false))
    }

    @Test
    fun forgedReturnResultCodeZeroDoesNotMarkPaid() {
        val action = interpretPaymentReturn(
            PaymentReturnUri("trooi", "payment", "/momo", mapOf("resultCode" to "0", "orderId" to "forged")),
            PendingCheckoutHint("t-1", "50000.00", intent.idempotencyKey, "chk-1"),
        )
        assertTrue(action is PaymentReturnAction.RefreshCheckout)
        assertFalse(isConfirmedGatewayPayment(checkout("CREATED", resultingPaymentId = null)))
        assertSame(PaymentReturnAction.SafeRecovery, interpretPaymentReturn(
            PaymentReturnUri("https", "evil.example", "/", mapOf("resultCode" to "0")),
            PendingCheckoutHint("t-1", "50000.00", intent.idempotencyKey, "chk-1"),
        ))
    }

    @Test
    fun returnBeforeOrAfterIpnOnlyRefreshesAuthorizedCheckout() {
        val before = interpretPaymentReturn(
            PaymentReturnUri("trooi", "payment", "/momo", mapOf("resultCode" to "0")),
            PendingCheckoutHint("t-1", "50000.00", intent.idempotencyKey, "chk-1"),
        )
        val afterIpn = isConfirmedGatewayPayment(checkout("SUCCEEDED", resultingPaymentId = "pay-1"))
        assertEquals(PaymentReturnAction.RefreshCheckout("chk-1"), before)
        assertTrue(afterIpn)
        assertFalse(isConfirmedGatewayPayment(checkout("CREATED", resultingPaymentId = "pay-1")))
        assertEquals(
            PaymentReturnAction.RefreshCheckout("chk-1"),
            interpretPaymentReturn(
                PaymentReturnUri("trooi", "payment", "/sepay"),
                PendingCheckoutHint("t-1", "50000.00", intent.idempotencyKey, "chk-1"),
            ),
        )
    }

    @Test
    fun logoutClearsLocalPendingButLeavesDurableIntent() {
        val local = pendingHint(rememberCheckoutId(intent, "chk-1"))
        val cleared: PendingCheckoutHint? = null
        assertEquals(PaymentReturnAction.SafeRecovery, interpretPaymentReturn(
            PaymentReturnUri("trooi", "payment", "/momo", emptyMap()),
            cleared,
        ))
        assertEquals("chk-1", local.checkoutId)
    }

    @Test
    fun onlySignedHttpsPayUrlIsLaunchable() {
        assertEquals(
            "https://test-payment.momo.vn/pay",
            launchableHttpsPayUrl("https://test-payment.momo.vn/pay"),
        )
        assertNull(launchableHttpsPayUrl("momo://app?token=abc"))
        assertNull(launchableHttpsPayUrl("https://evil.example/pay"))
        assertNull(launchableHttpsPayUrl("http://test-payment.momo.vn/pay"))
        val handoff = "https://pay.example/api/v1/finance/checkouts/sepay/handoff?token=abc"
        assertEquals(handoff, launchableHttpsPayUrl(handoff, paymentPublicOrigin = "https://pay.example"))
        assertNull(launchableHttpsPayUrl("https://evil.example/pay", paymentPublicOrigin = "https://pay.example"))
    }

    @Test
    fun formerTenancyCannotCreateCheckout() {
        assertTrue(canCreateGatewayCheckout("active"))
        assertTrue(canCreateGatewayCheckout("ENDING"))
        assertFalse(canCreateGatewayCheckout("ended"))
        assertFalse(canCreateGatewayCheckout("cancelled"))
        assertFalse(validGatewayAmount("1000.50"))
        assertTrue(validGatewayAmount("1000.00"))
    }

    private fun checkout(
        status: String,
        resultingPaymentId: String? = null,
        replayBlockedReason: String? = null,
    ) = GatewayCheckout(
        id = "chk-1",
        tenancyId = "t-1",
        amount = "50000.00",
        referenceCode = "ref-1",
        provider = "MOMO",
        status = status,
        createdAt = "2026-10-05T00:00:00Z",
        replayAllowed = status == "CREATED" || status == "INITIATED" || status == "UNKNOWN",
        resultingPaymentId = resultingPaymentId,
        replayBlockedReason = replayBlockedReason,
    )
}
