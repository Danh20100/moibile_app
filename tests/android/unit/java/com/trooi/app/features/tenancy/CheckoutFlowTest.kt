package com.trooi.app.features.tenancy

import com.trooi.app.support.JsonFixtures
import com.trooi.app.core.auth.PendingCheckoutHint
import com.trooi.app.features.shared.GatewayCheckout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckoutFlowTest {
    private val fixture = JsonFixtures.load("tenancy/checkout-flow")
    private fun value(key: String) = fixture.get(key).asString
    private val intent = CheckoutIntent(value("tenancyId"), value("amount"), value("idempotencyKey"))

    @Test
    fun doubleTapReusesTheSameIdempotencyKey() {
        val first = rememberCheckoutBeforePost(value("tenancyId"), value("amount"), null) { value("firstKey") }
        val second = rememberCheckoutBeforePost(value("tenancyId"), value("amount"), first) { value("secondKey") }
        assertEquals(value("firstKey"), first.idempotencyKey)
        assertEquals(value("firstKey"), second.idempotencyKey)
        assertEquals(first.idempotencyKey, second.idempotencyKey)
    }

    @Test
    fun confirmedCheckoutReusesTheSameObligation() {
        val paid = checkout(value("succeededStatus"), resultingPaymentId = value("paymentId"))
        val held = intent.copy(checkoutId = value("checkoutId"))
        val next = rememberCheckoutBeforePost(value("tenancyId"), value("amount"), held, paid) { value("newKey") }
        assertEquals(held.idempotencyKey, next.idempotencyKey)
        assertEquals(value("checkoutId"), next.checkoutId)
        assertFalse(shouldStartFreshCheckout(paid))
        assertFalse(shouldStartFreshCheckout(checkout(value("createdStatus"))))
        assertTrue(shouldStartFreshCheckout(checkout(value("failedStatus"))))
        val retry = rememberCheckoutBeforePost(value("tenancyId"), value("amount"), held, checkout(value("failedStatus"))) { value("retryKey") }
        assertEquals(value("retryKey"), retry.idempotencyKey)
        assertNull(retry.checkoutId)
    }

    @Test
    fun differentAmountAfterPaymentStartsANewCheckout() {
        val paid = checkout(value("succeededStatus"), resultingPaymentId = value("paymentId"))
        val next = rememberCheckoutBeforePost(value("tenancyId"), value("changedAmount"), intent.copy(checkoutId = value("checkoutId")), paid) { value("newKey") }
        assertEquals(value("newKey"), next.idempotencyKey)
        assertNull(next.checkoutId)
    }

    @Test
    fun lostCreateResponseReplaysTheSamePostKey() {
        val remembered = rememberCheckoutBeforePost(value("tenancyId"), value("amount"), intent) { value("otherKey") }
        assertEquals(intent.idempotencyKey, remembered.idempotencyKey)
        assertNull(remembered.checkoutId)
    }

    @Test
    fun pendingCheckoutDoesNotCreatePayment() {
        val created = checkout(value("createdStatus"), resultingPaymentId = null)
        assertFalse(isConfirmedGatewayPayment(created))
        val afterId = rememberCheckoutId(intent, created.id)
        assertEquals(value("checkoutId"), afterId.checkoutId)
        assertFalse(isConfirmedGatewayPayment(created))
    }

    @Test
    fun providerDisabledExposesManualFlow() {
        assertTrue(manualCheckoutAvailable(null, createFailed = true))
        assertTrue(
            manualCheckoutAvailable(
                checkout(value("failedStatus"), replayBlockedReason = value("providerDisabledReason")),
                createFailed = false,
            ),
        )
        assertFalse(manualCheckoutAvailable(checkout(value("createdStatus")), createFailed = false))
    }

    @Test
    fun forgedReturnResultCodeZeroDoesNotMarkPaid() {
        val action = interpretPaymentReturn(
            PaymentReturnUri("trooi", "payment", "/momo", mapOf("resultCode" to value("resultCode"), "orderId" to value("forgedId"))),
            PendingCheckoutHint(value("tenancyId"), value("amount"), intent.idempotencyKey, value("checkoutId")),
        )
        assertTrue(action is PaymentReturnAction.RefreshCheckout)
        assertFalse(isConfirmedGatewayPayment(checkout(value("createdStatus"), resultingPaymentId = null)))
        assertSame(PaymentReturnAction.SafeRecovery, interpretPaymentReturn(
            PaymentReturnUri("https", value("evilHost"), "/", mapOf("resultCode" to value("resultCode"))),
            PendingCheckoutHint(value("tenancyId"), value("amount"), intent.idempotencyKey, value("checkoutId")),
        ))
    }

    @Test
    fun returnBeforeOrAfterIpnOnlyRefreshesAuthorizedCheckout() {
        val before = interpretPaymentReturn(
            PaymentReturnUri("trooi", "payment", "/momo", mapOf("resultCode" to value("resultCode"))),
            PendingCheckoutHint(value("tenancyId"), value("amount"), intent.idempotencyKey, value("checkoutId")),
        )
        val afterIpn = isConfirmedGatewayPayment(checkout(value("succeededStatus"), resultingPaymentId = value("paymentId")))
        assertEquals(PaymentReturnAction.RefreshCheckout(value("checkoutId")), before)
        assertTrue(afterIpn)
        assertFalse(isConfirmedGatewayPayment(checkout(value("createdStatus"), resultingPaymentId = value("paymentId"))))
        assertEquals(
            PaymentReturnAction.RefreshCheckout(value("checkoutId")),
            interpretPaymentReturn(
                PaymentReturnUri("trooi", "payment", "/sepay"),
                PendingCheckoutHint(value("tenancyId"), value("amount"), intent.idempotencyKey, value("checkoutId")),
            ),
        )
    }

    @Test
    fun logoutClearsLocalPendingButLeavesDurableIntent() {
        val local = pendingHint(rememberCheckoutId(intent, value("checkoutId")))
        val cleared: PendingCheckoutHint? = null
        assertEquals(PaymentReturnAction.SafeRecovery, interpretPaymentReturn(
            PaymentReturnUri("trooi", "payment", "/momo", emptyMap()),
            cleared,
        ))
        assertEquals(value("checkoutId"), local.checkoutId)
    }

    @Test
    fun onlySignedHttpsPayUrlIsLaunchable() {
        assertEquals(
            value("momoPayUrl"),
            launchableHttpsPayUrl(value("momoPayUrl")),
        )
        assertNull(launchableHttpsPayUrl(value("appPayUrl")))
        assertNull(launchableHttpsPayUrl(value("evilPayUrl")))
        assertNull(launchableHttpsPayUrl(value("httpPayUrl")))
        val handoff = value("handoffUrl")
        assertEquals(handoff, launchableHttpsPayUrl(handoff, paymentPublicOrigin = value("paymentOrigin")))
        assertNull(launchableHttpsPayUrl(value("evilPayUrl"), paymentPublicOrigin = value("paymentOrigin")))
        val tunnel = value("tunnelOrigin")
        assertEquals(value("rejectedOrigin"), releasePaymentPublicOrigin(tunnel))
        assertEquals(value("rejectedOrigin"), releasePaymentPublicOrigin(value("emulatorOrigin")))
        assertEquals(value("rejectedOrigin"), releasePaymentPublicOrigin(value("localhostOrigin")))
        assertEquals(value("paymentOrigin"), releasePaymentPublicOrigin(value("trailingSlashOrigin")))
        assertNull(launchableHttpsPayUrl(handoff, paymentPublicOrigin = releasePaymentPublicOrigin(tunnel)))
    }

    @Test fun localDemoHandoffAndReturnRequireExplicitOptInAndNeverTrustQuerySuccess() {
        val url = value("demoPayUrl")
        assertNull(launchableHttpsPayUrl(url))
        assertEquals(url, launchableHttpsPayUrl(url, allowLocalHttp = true))
        fixture.getAsJsonArray("invalidDemoUrls").map { it.asString }.forEach {
            assertNull(it, launchableHttpsPayUrl(it, allowLocalHttp = true))
        }
        val uri = PaymentReturnUri("trooi", "payment", "/demo", mapOf("status" to value("succeededStatus"), "checkoutId" to value("forgedId")))
        val local = PendingCheckoutHint(value("tenancyId"), value("wholeAmount"), intent.idempotencyKey, value("checkoutId"))
        assertSame(PaymentReturnAction.SafeRecovery, interpretPaymentReturn(uri, local))
        assertEquals(PaymentReturnAction.RefreshCheckout(value("checkoutId")), interpretPaymentReturn(uri, local, allowDemo = true))
        assertFalse(isConfirmedGatewayPayment(checkout(value("createdStatus"))))
    }

    @Test
    fun formerTenancyCannotCreateCheckout() {
        assertTrue(canCreateGatewayCheckout(value("activeTenancyStatus")))
        assertTrue(canCreateGatewayCheckout(value("endingTenancyStatus")))
        assertFalse(canCreateGatewayCheckout(value("endedTenancyStatus")))
        assertFalse(canCreateGatewayCheckout(value("cancelledTenancyStatus")))
        assertFalse(validGatewayAmount(value("fractionalAmount")))
        assertTrue(validGatewayAmount(value("minimumAmount")))
    }

    private fun checkout(
        status: String,
        resultingPaymentId: String? = null,
        replayBlockedReason: String? = null,
    ) = GatewayCheckout(
        id = value("checkoutId"),
        tenancyId = value("tenancyId"),
        amount = value("amount"),
        referenceCode = value("referenceCode"),
        provider = value("provider"),
        status = status,
        createdAt = value("createdAt"),
        replayAllowed = status == value("createdStatus") || status == value("initiatedStatus") || status == value("unknownStatus"),
        resultingPaymentId = resultingPaymentId,
        replayBlockedReason = replayBlockedReason,
    )
}
