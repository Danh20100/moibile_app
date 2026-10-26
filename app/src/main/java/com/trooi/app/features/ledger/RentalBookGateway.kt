package com.trooi.app.features.ledger

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.core.network.dto.TransportOutcome
import javax.inject.Inject

data class RoomJoinInvitation(val token: String, val expiresAt: String, val room: String, val property: String) {
    val url: String get() = "trooi://join?token=$token"
}

data class RoomJoinPreview(val room: String, val property: String, val expiresAt: String)

class RentalBookGateway @Inject constructor(private val backend: BackendClient) {
    private fun parse(result: TransportOutcome): JsonElement {
        return when (result) {
            is TransportOutcome.Success -> JsonParser.parseString(BackendJsonCodec.unwrapResponseData(result.document.rawBody))
            is TransportOutcome.Failure -> throw IllegalStateException("Máy chủ chưa xử lý được yêu cầu: ${result.httpStatus ?: result.kind}")
        }
    }

    private fun payload(vararg fields: Pair<String, String>): String = JsonObject().apply {
        fields.forEach { (key, value) -> addProperty(key, value) }
    }.toString()

    private fun segment(value: String): String {
        require(value.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "Mã bản ghi không hợp lệ" }
        return value
    }

    suspend fun get(path: String, query: Map<String, String> = emptyMap()): JsonElement =
        parse(backend.get(path, true, query))

    suspend fun post(path: String, vararg fields: Pair<String, String>): JsonElement =
        parse(backend.postJson(path, payload(*fields), true))

    suspend fun patch(path: String, vararg fields: Pair<String, String>): JsonElement =
        parse(backend.patchJson(path, payload(*fields), true))

    suspend fun issueInvitation(tenancyId: String): RoomJoinInvitation {
        val value = post("tenancy-join/tenancies/${segment(tenancyId)}/invitations").asJsonObject
        return RoomJoinInvitation(value.required("token"), value.required("expiresAt"), value.required("room"), value.required("property"))
    }

    suspend fun previewInvitation(token: String): RoomJoinPreview {
        val value = post("tenancy-join/preview", "token" to token).asJsonObject
        return RoomJoinPreview(value.required("room"), value.required("property"), value.required("expiresAt"))
    }

    suspend fun acceptInvitation(token: String): String =
        post("tenancy-join/accept", "token" to token).asJsonObject.required("tenancyId")

    suspend fun detail(kind: String, id: String): JsonObject {
        val route = when (kind) {
            "property" -> "properties/${segment(id)}"
            "room" -> "rooms/${segment(id)}"
            "tenancy" -> "tenancies/${segment(id)}"
            "listing" -> "listings/${segment(id)}"
            "incident" -> "incidents/${segment(id)}"
            "receipt" -> "receipts/${segment(id)}"
            "payment" -> "finance/payments/${segment(id)}"
            "cycle" -> "finance/cycles/${segment(id)}"
            else -> throw IllegalArgumentException("Loại bản ghi chưa hỗ trợ")
        }
        return get(route).asJsonObject
    }

    suspend fun cycles(tenancyId: String): JsonArray = get("finance/cycles", mapOf("tenancyId" to tenancyId)).asJsonArray
    suspend fun payments(tenancyId: String): JsonArray = get("finance/payments", mapOf("tenancyId" to tenancyId)).asJsonArray
    suspend fun receipts(tenancyId: String): JsonArray = get("receipts", mapOf("tenancyId" to tenancyId)).asJsonArray
    suspend fun incidentEvents(incidentId: String): JsonArray = get("incidents/${segment(incidentId)}/events").asJsonArray
    suspend fun participants(tenancyId: String): JsonArray = get("tenancies/${segment(tenancyId)}/participants").asJsonArray

    suspend fun recordPayment(tenancyId: String, amount: String, source: String): JsonObject =
        post("finance/payments", "tenancyId" to tenancyId, "amount" to amount, "source" to source,
            "confirmedAt" to java.time.Instant.now().toString()).asJsonObject

    suspend fun allocatePayment(paymentId: String, chargeId: String, amount: String) =
        post("finance/payments/${segment(paymentId)}/allocations", "targetId" to chargeId, "amount" to amount)

    suspend fun updateIncident(id: String, status: String, note: String): JsonObject =
        patch("incidents/${segment(id)}/status", "status" to status, "note" to note).asJsonObject

    suspend fun createIncident(roomId: String, category: String) =
        post("incidents", "roomId" to roomId, "category" to category)

    suspend fun createTenancy(roomId: String): JsonObject =
        post("tenancies", "roomId" to roomId).asJsonObject

    suspend fun updateRoom(roomId: String, status: String) =
        patch("rooms/${segment(roomId)}", "operationalState" to status)

    suspend fun updateListing(listingId: String, title: String, description: String, price: String): JsonObject {
        val json = JsonObject().apply {
            addProperty("publicTitle", title)
            addProperty("publicDescription", description)
            addProperty("publicPriceProjection", price)
        }
        return parse(backend.patchJson("listings/${segment(listingId)}", json.toString(), true)).asJsonObject
    }

    suspend fun listingAction(listingId: String, action: String) =
        post(if (action == "publish") "listings/${segment(listingId)}/publish" else "listings/${segment(listingId)}/${segment(action)}")

    private fun JsonObject.required(key: String): String =
        get(key)?.takeUnless { it.isJsonNull }?.asString ?: throw IllegalStateException("Thiếu dữ liệu $key")
}

fun JsonObject.string(key: String): String? =
    get(key)?.takeUnless { it.isJsonNull }?.let { if (it.isJsonPrimitive) it.asString else it.toString() }
