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
    fun confirmedCheckoutReusesTheSameObligation() {
        val paid = checkout("SUCCEEDED", resultingPaymentId = "pay-1")
        val held = intent.copy(checkoutId = "chk-1")
        val next = rememberCheckoutBeforePost("t-1", "50000.00", held, paid) { "key-new" }
        assertEquals(held.idempotencyKey, next.idempotencyKey)
        assertEquals("chk-1", next.checkoutId)
        assertFalse(shouldStartFreshCheckout(paid))
        assertFalse(shouldStartFreshCheckout(checkout("CREATED")))
        assertTrue(shouldStartFreshCheckout(checkout("FAILED")))
        val retry = rememberCheckoutBeforePost("t-1", "50000.00", held, checkout("FAILED")) { "key-retry" }
        assertEquals("key-retry", retry.idempotencyKey)
        assertNull(retry.checkoutId)
    }

    @Test
    fun differentAmountAfterPaymentStartsANewCheckout() {
        val paid = checkout("SUCCEEDED", resultingPaymentId = "pay-1")
        val next = rememberCheckoutBeforePost("t-1", "40000.00", intent.copy(checkoutId = "chk-1"), paid) { "key-new" }
        assertEquals("key-new", next.idempotencyKey)
        assertNull(next.checkoutId)
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
        val tunnel = "https://satisfy-hawaii-availability-wrist.trycloudflare.com"
        assertEquals("", releasePaymentPublicOrigin(tunnel))
        assertEquals("", releasePaymentPublicOrigin("http://10.0.2.2:3000"))
        assertEquals("", releasePaymentPublicOrigin("https://localhost"))
        assertEquals("https://pay.example", releasePaymentPublicOrigin("https://pay.example/"))
        assertNull(launchableHttpsPayUrl(handoff, paymentPublicOrigin = releasePaymentPublicOrigin(tunnel)))
    }

    @Test fun localDemoHandoffAndReturnRequireExplicitOptInAndNeverTrustQuerySuccess() {
        val url = "http://localhost:3001/api/v1/finance/checkouts/demo/pay/signed.capability"
        assertNull(launchableHttpsPayUrl(url))
        assertEquals(url, launchableHttpsPayUrl(url, allowLocalHttp = true))
        listOf("http://localhost:3001/other", url + "?status=SUCCEEDED", url.replace("localhost", "evil.example"), url.replace("localhost", "user@localhost")).forEach {
            assertNull(it, launchableHttpsPayUrl(it, allowLocalHttp = true))
        }
        val uri = PaymentReturnUri("trooi", "payment", "/demo", mapOf("status" to "SUCCEEDED", "checkoutId" to "forged"))
        val local = PendingCheckoutHint("t-1", "50000", intent.idempotencyKey, "chk-1")
        assertSame(PaymentReturnAction.SafeRecovery, interpretPaymentReturn(uri, local))
        assertEquals(PaymentReturnAction.RefreshCheckout("chk-1"), interpretPaymentReturn(uri, local, allowDemo = true))
        assertFalse(isConfirmedGatewayPayment(checkout("CREATED")))
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
