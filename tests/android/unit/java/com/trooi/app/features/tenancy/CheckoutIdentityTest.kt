package com.trooi.app.features.tenancy

import com.trooi.app.core.auth.PendingCheckoutHint
import com.trooi.app.features.shared.GatewayCheckout
import org.junit.Assert.*
import org.junit.Test

class CheckoutIdentityTest {
    @Test fun confirmationMustMatchRememberedIdentityProviderAndAmount() {
        val hint = PendingCheckoutHint("tenancy-1", "1000", "key-1", "checkout-1")
        val checkout = GatewayCheckout("checkout-1", "tenancy-1", "1000.00", "ref", "DEMO", "SUCCEEDED", "2026-10-08", false, resultingPaymentId = "payment-1")
        assertTrue(checkoutMatchesIntent(checkout, hint, "DEMO"))
        listOf(checkout.copy(id = "other"), checkout.copy(tenancyId = "other"), checkout.copy(amount = "1001"), checkout.copy(provider = "MOMO"), checkout.copy(amount = "invalid"))
            .forEach { assertFalse(checkoutMatchesIntent(it, hint, "DEMO")) }
        assertFalse(isConfirmedGatewayPayment(checkout.copy(resultingPaymentId = null)))
        assertFalse(isConfirmedGatewayPayment(checkout.copy(status = "CREATED")))
    }
}
