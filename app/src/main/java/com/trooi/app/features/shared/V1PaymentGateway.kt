package com.trooi.app.features.shared

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.core.network.dto.ErrorKind
import com.trooi.app.core.network.dto.TransportOutcome
import javax.inject.Inject

data class GatewayCheckout(
    val id: String,
    val tenancyId: String,
    val amount: String,
    val referenceCode: String,
    val provider: String,
    val status: String,
    val createdAt: String,
    val replayAllowed: Boolean,
    val payUrl: String? = null,
    val resultingPaymentId: String? = null,
    val replayBlockedReason: String? = null,
)

class V1PaymentGateway @Inject constructor(private val client: BackendClient) {
    suspend fun create(tenancyId: String, amount: String, key: String, provider: String? = null): GatewayCheckout {
        require(tenancyId.isNotBlank() && amount.isNotBlank() && key.isNotBlank()) {
            "Checkout cần tenancy, amount và Idempotency-Key."
        }
        require(provider == null || provider in setOf("MOMO", "SEPAY", "DEMO")) { "Kênh thanh toán không hợp lệ." }
        val body = JsonObject().apply {
            addProperty("provider", "SEPAY")
            addProperty("tenancyId", tenancyId)
            addProperty("amount", amount)
            provider?.let { addProperty("provider", it) }
        }
        return read(
            client.postJson(
                "finance/checkouts",
                body.toString(),
                authenticated = true,
                headers = mapOf("Idempotency-Key" to key),
            ),
        )
    }

    suspend fun get(id: String): GatewayCheckout {
        require(id.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "Checkout ID không hợp lệ" }
        return read(client.get("finance/checkouts/$id", authenticated = true))
    }

    suspend fun reconcile(id: String): GatewayCheckout {
        require(id.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "Checkout ID không hợp lệ" }
        return read(client.postJson("finance/checkouts/$id/reconcile", "{}", authenticated = true))
    }

    private fun read(outcome: TransportOutcome): GatewayCheckout {
        val raw = when (outcome) {
            is TransportOutcome.Failure -> throw V1RequestException(outcome.kind, outcome.httpStatus)
            is TransportOutcome.Success -> BackendJsonCodec.unwrapResponseData(outcome.document.rawBody)
        }
        return checkout(JsonParser.parseString(raw).asJsonObject)
    }

    private fun checkout(x: JsonObject): GatewayCheckout {
        fun req(name: String): String =
            x.get(name)?.takeUnless { it.isJsonNull }?.asString
                ?: throw V1RequestException(ErrorKind.INVALID_RESPONSE)
        fun opt(name: String): String? = x.get(name)?.takeUnless { it.isJsonNull }?.asString
        return GatewayCheckout(
            id = req("id"),
            tenancyId = req("tenancyId"),
            amount = req("amount"),
            referenceCode = req("referenceCode"),
            provider = req("provider"),
            status = req("status"),
            createdAt = req("createdAt"),
            replayAllowed = x.get("replayAllowed")?.takeUnless { it.isJsonNull }?.asBoolean ?: false,
            payUrl = opt("payUrl"),
            resultingPaymentId = opt("resultingPaymentId"),
            replayBlockedReason = opt("replayBlockedReason"),
        )
    }
}
