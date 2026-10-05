package com.trooi.app.features.tenancy

import com.trooi.app.core.auth.PendingCheckoutHint
import com.trooi.app.features.shared.GatewayCheckout

data class CheckoutIntent(
    val tenancyId: String,
    val amount: String,
    val idempotencyKey: String,
    val checkoutId: String? = null,
)

data class PaymentReturnUri(
    val scheme: String?,
    val host: String?,
    val path: String?,
    val query: Map<String, String> = emptyMap(),
)

sealed interface PaymentReturnAction {
    data class RefreshCheckout(val checkoutId: String) : PaymentReturnAction
    data class ReplayCreate(val hint: PendingCheckoutHint) : PaymentReturnAction
    data object SafeRecovery : PaymentReturnAction
}

fun rememberCheckoutBeforePost(
    tenancyId: String,
    amount: String,
    existing: CheckoutIntent?,
    newKey: () -> String,
): CheckoutIntent {
    val reuse = existing?.takeIf { it.tenancyId == tenancyId && it.amount == amount }
    return CheckoutIntent(
        tenancyId = tenancyId,
        amount = amount,
        idempotencyKey = reuse?.idempotencyKey ?: newKey(),
        checkoutId = reuse?.checkoutId,
    )
}

fun rememberCheckoutId(intent: CheckoutIntent, checkoutId: String): CheckoutIntent =
    intent.copy(checkoutId = checkoutId)

fun validGatewayAmount(amount: String): Boolean {
    val whole = amount.removeSuffix(".00")
    if (whole != amount && !amount.endsWith(".00")) return false
    if (!whole.matches(Regex("[1-9]\\d{0,7}"))) return false
    val vnd = whole.toLongOrNull() ?: return false
    return vnd in 1_000L..50_000_000L
}

fun canCreateGatewayCheckout(tenancyStatus: String?): Boolean =
    tenancyStatus?.lowercase() in setOf("active", "ending")

fun launchableHttpsPayUrl(payUrl: String?, allowLocalHttp: Boolean = false): String? {
    if (payUrl.isNullOrBlank()) return null
    val match = Regex("^https://([^/]+)(/.*)?$", RegexOption.IGNORE_CASE).matchEntire(payUrl.trim())
        ?: return null
    val host = match.groupValues[1].substringBefore(":").lowercase()
    val allowed = host in setOf("test-payment.momo.vn", "payment.momo.vn") ||
        (allowLocalHttp && host in setOf("127.0.0.1", "localhost"))
    return payUrl.trim().takeIf { allowed }
}

fun isConfirmedGatewayPayment(checkout: GatewayCheckout?): Boolean =
    checkout?.status == "SUCCEEDED" && !checkout.resultingPaymentId.isNullOrBlank()

fun manualCheckoutAvailable(checkout: GatewayCheckout?, createFailed: Boolean): Boolean {
    if (createFailed) return true
    val reason = checkout?.replayBlockedReason.orEmpty().lowercase()
    return checkout?.status == "FAILED" && (reason.contains("disabled") || reason.contains("config") || reason.contains("provider"))
}

fun interpretPaymentReturn(uri: PaymentReturnUri, local: PendingCheckoutHint?): PaymentReturnAction {
    val recognized = uri.scheme == "trooi" && uri.host == "payment" &&
        (uri.path == "/momo" || uri.path?.startsWith("/momo") == true)
    if (!recognized || local == null) return PaymentReturnAction.SafeRecovery
    val checkoutId = local.checkoutId
    return if (!checkoutId.isNullOrBlank()) {
        PaymentReturnAction.RefreshCheckout(checkoutId)
    } else {
        PaymentReturnAction.ReplayCreate(local)
    }
}

fun pendingHint(intent: CheckoutIntent) = PendingCheckoutHint(
    tenancyId = intent.tenancyId,
    amount = intent.amount,
    idempotencyKey = intent.idempotencyKey,
    checkoutId = intent.checkoutId,
)
