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
    val uri = runCatching { java.net.URI(payUrl.trim()) }.getOrNull() ?: return null
    if (uri.userInfo != null || uri.port !in -1..65535) return null
    val host = uri.host?.lowercase() ?: return null
    val allowed = (uri.scheme.equals("https", true) && host in setOf("test-payment.momo.vn", "payment.momo.vn")) ||
        (allowLocalHttp && uri.scheme in setOf("http", "https") && host in setOf("127.0.0.1", "localhost", "10.0.2.2") &&
            uri.rawQuery == null && uri.rawFragment == null &&
            uri.rawPath.matches(Regex("/api/v1/finance/checkouts/demo/pay/[A-Za-z0-9._-]+")))
    return payUrl.trim().takeIf { allowed }
}

fun isConfirmedGatewayPayment(checkout: GatewayCheckout?): Boolean =
    checkout?.status == "SUCCEEDED" && !checkout.resultingPaymentId.isNullOrBlank()

fun checkoutMatchesIntent(checkout: GatewayCheckout, hint: PendingCheckoutHint, provider: String): Boolean =
    checkout.tenancyId == hint.tenancyId && checkout.provider == provider &&
        runCatching { java.math.BigDecimal(checkout.amount).compareTo(java.math.BigDecimal(hint.amount)) == 0 }.getOrDefault(false) &&
        (hint.checkoutId == null || hint.checkoutId == checkout.id)

fun manualCheckoutAvailable(checkout: GatewayCheckout?, createFailed: Boolean): Boolean {
    if (createFailed) return true
    val reason = checkout?.replayBlockedReason.orEmpty().lowercase()
    return checkout?.status == "FAILED" && (reason.contains("disabled") || reason.contains("config") || reason.contains("provider"))
}

fun interpretPaymentReturn(uri: PaymentReturnUri, local: PendingCheckoutHint?, allowDemo: Boolean = false): PaymentReturnAction {
    val recognized = uri.scheme == "trooi" && uri.host == "payment" &&
        (uri.path == "/momo" || uri.path?.startsWith("/momo") == true || (allowDemo && uri.path == "/demo"))
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
