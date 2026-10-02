package com.trooi.app.features.shared

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.core.network.dto.ErrorKind
import com.trooi.app.core.network.dto.TransportOutcome
import java.time.Instant
import javax.inject.Inject

data class RentalTenancy(val id: String, val roomId: String, val status: String, val startedAt: String?, val endedAt: String?)
data class RentalParticipant(val id: String, val tenancyId: String, val role: String, val userId: String?, val leftAt: String?)
data class RentalTerms(val id: String, val tenancyId: String, val version: Int, val rentAmount: String, val depositRequirement: String, val termStart: String, val termEnd: String, val effectiveFrom: String)
data class RentalNotice(val id: String, val tenancyId: String, val type: String, val content: String, val issuedAt: String, val acknowledgedAt: String?)
data class RentalCharge(val id: String, val type: String, val amount: String)
data class RentalBilling(val id: String, val tenancyId: String, val termsId: String, val from: String, val to: String, val charges: List<RentalCharge>)
data class RentalPayment(val id: String, val tenancyId: String, val amount: String, val source: String, val verification: String, val confirmedAt: String)
data class RentalReceipt(val id: String, val paymentId: String, val status: String, val issuedAt: String, val voidedAt: String?)
data class RentalIncident(val id: String, val roomId: String, val category: String, val status: String, val createdAt: String, val closureReason: String?)

/** Server-only business transitions. No optimistic Room, Tenancy, Payment or Incident mutation. */
class V1RentalGateway @Inject constructor(private val client: BackendClient) {
    suspend fun tenancies(roomId: String): List<RentalTenancy> =
        list(client.get("tenancies", true, mapOf("roomId" to roomId)), ::tenancy)
    suspend fun tenancy(id: String): RentalTenancy = read(client.get("tenancies/${segment(id)}", true), ::tenancy)
    suspend fun createTenancy(roomId: String): RentalTenancy =
        read(client.postJson("tenancies", obj("roomId" to roomId).toString(), true), ::tenancy)
    suspend fun cancelDraft(id: String): RentalTenancy =
        read(client.postEmpty("tenancies/${segment(id)}/cancel"), ::tenancy)
    suspend fun startEnding(id: String): RentalTenancy =
        read(client.postEmpty("tenancies/${segment(id)}/start-ending"), ::tenancy)
    suspend fun resume(id: String): RentalTenancy =
        read(client.postEmpty("tenancies/${segment(id)}/resume"), ::tenancy)
    suspend fun checkout(id: String, endReason: String, at: String = Instant.now().toString()): RentalTenancy {
        require(endReason in CHECKOUT_REASONS) { "Lý do kết thúc chưa được contract hỗ trợ" }
        return read(client.postJson("tenancies/${segment(id)}/checkout",
            obj("endReason" to endReason, "occurredAt" to at).toString(), true), ::tenancy)
    }

    suspend fun participants(id: String): List<RentalParticipant> =
        list(client.get("tenancies/${segment(id)}/participants", true), ::participant)
    suspend fun addParticipant(id: String, role: String, joinedAt: String = Instant.now().toString()): RentalParticipant {
        require(role in setOf("PRIMARY", "OCCUPANT")) { "Participant role không hợp lệ" }
        return read(client.postJson("tenancies/${segment(id)}/participants",
            obj("role" to role, "joinedAt" to joinedAt).toString(), true), ::participant)
    }
    suspend fun leaveOccupant(id: String, participantId: String, at: String = Instant.now().toString()): RentalParticipant =
        read(client.postJson("tenancies/${segment(id)}/participants/${segment(participantId)}/leave",
            obj("occurredAt" to at).toString(), true), ::participant)
    suspend fun linkParticipant(id: String, participantId: String, targetUserId: String): RentalParticipant =
        read(client.postJson("tenancies/${segment(id)}/participants/${segment(participantId)}/link-user",
            obj("userId" to targetUserId).toString(), true), ::participant)

    suspend fun terms(id: String): List<RentalTerms> =
        list(client.get("tenancies/${segment(id)}/terms", true), ::terms)
    suspend fun termsDetail(id: String, termId: String): RentalTerms =
        read(client.get("tenancies/${segment(id)}/terms/${segment(termId)}", true), ::terms)
    suspend fun notices(id: String): List<RentalNotice> =
        list(client.get("tenancies/${segment(id)}/notices", true), ::notice)

    suspend fun billingCycles(id: String): List<RentalBilling> =
        list(client.get("finance/cycles", true, mapOf("tenancyId" to id)), ::billing)
    suspend fun billingCycle(id: String): RentalBilling = read(client.get("finance/cycles/${segment(id)}", true), ::billing)
    suspend fun createBilling(
        tenancyId: String, termsId: String, from: String, to: String, charges: List<Pair<String, String>>,
    ): RentalBilling {
        require(charges.isNotEmpty() && charges.all { it.first in CHARGE_TYPES && validMoney(it.second) }) { "Charge chỉ cho phép RENT/ELECTRICITY/WATER và amount hợp lệ" }
        val body = obj("tenancyId" to tenancyId, "tenancyTermsId" to termsId,
            "periodStart" to from, "periodEnd" to to).apply {
            add("charges", JsonArray().also { values ->
                charges.forEach { (type, amount) -> values.add(obj("type" to type, "amount" to amount)) }
            })
        }
        return read(client.postJson("finance/cycles", body.toString(), true), ::billing)
    }

    suspend fun payment(id: String): RentalPayment = read(client.get("finance/payments/${segment(id)}", true), ::payment)
    suspend fun recordPayment(tenancyId: String, amount: String, source: String, at: String = Instant.now().toString()): RentalPayment {
        require(source in setOf("MANUAL_CASH", "MANUAL_TRANSFER") && validMoney(amount)) { "Chỉ ghi nhận tiền đã thực nhận từ nguồn manual" }
        return read(client.postJson("finance/payments",
            obj("tenancyId" to tenancyId, "amount" to amount, "source" to source,
                "verification" to "USER_RECORDED", "confirmedAt" to at).toString(), true), ::payment)
    }
    suspend fun allocate(paymentId: String, chargeId: String, amount: String) : JsonObject {
        require(validMoney(amount)) { "Amount không hợp lệ" }
        return read(client.postJson("finance/payments/${segment(paymentId)}/allocations",
            obj("amount" to amount, "targetId" to chargeId).toString(), true), ::identity)
    }

    suspend fun receipts(paymentId: String? = null): List<RentalReceipt> =
        list(client.get("receipts", true, paymentId?.let { mapOf("paymentId" to it) } ?: emptyMap()), ::receipt)
    suspend fun receipt(id: String): RentalReceipt = read(client.get("receipts/${segment(id)}", true), ::receipt)
    suspend fun issueReceipt(paymentId: String): RentalReceipt =
        read(client.postJson("receipts", obj("paymentId" to paymentId).toString(), true), ::receipt)
    suspend fun voidReceipt(id: String): RentalReceipt =
        read(client.postEmpty("receipts/${segment(id)}/void"), ::receipt)

    suspend fun incidents(roomId: String): List<RentalIncident> =
        list(client.get("incidents", true, mapOf("roomId" to roomId)), ::incident)
    suspend fun incident(id: String): RentalIncident = read(client.get("incidents/${segment(id)}", true), ::incident)
    suspend fun reportIncident(roomId: String, category: String): RentalIncident {
        require(category in INCIDENT_CATEGORIES) { "Incident category không hợp lệ" }
        // reportedByUserId is deliberately omitted; server must authorize/derive identity.
        return read(client.postJson("incidents", obj("roomId" to roomId, "category" to category).toString(), true), ::incident)
    }
    suspend fun transitionIncident(id: String, target: String, note: String?, closureReason: String?): RentalIncident {
        val detail = incident(id) // Fresh server state before presenting any transition.
        require(target in INCIDENT_TRANSITIONS[detail.status].orEmpty()) { "Transition không phù hợp lifecycle hiện tại" }
        require(target != "CLOSED" || (detail.status == "REPORTED" || detail.status == "IN_PROGRESS") &&
            !closureReason.isNullOrBlank() || target == "CLOSED" && detail.status == "RESOLVED") {
            "Cần closure reason khi đóng trực tiếp từ Reported hoặc In Progress"
        }
        val data = obj("status" to target).apply {
            note?.takeIf { it.isNotBlank() }?.let { addProperty("note", it) }
            closureReason?.takeIf { it.isNotBlank() }?.let { addProperty("closureReason", it) }
        }
        return read(client.patchJson("incidents/${segment(id)}/status", data.toString()), ::incident)
    }

    private fun tenancy(x: JsonObject) = RentalTenancy(x.req("id"), x.req("roomId"), x.req("status"), x.opt("startedAt"), x.opt("endedAt"))
    private fun participant(x: JsonObject) = RentalParticipant(x.req("id"), x.req("tenancyId"), x.req("role"), x.opt("userId"), x.opt("leftAt"))
    private fun terms(x: JsonObject) = RentalTerms(x.req("id"), x.req("tenancyId"), x.get("version").asInt, x.req("rentAmount"),
        x.req("agreedDepositRequirement"), x.req("termStart"), x.req("termEnd"), x.req("effectiveFromCycleBoundary"))
    private fun notice(x: JsonObject) = RentalNotice(x.req("id"), x.req("tenancyId"), x.req("noticeType"), x.req("contentOrNote"),
        x.req("issuedAt"), x.opt("acknowledgedAt"))
    private fun charge(x: JsonObject) = RentalCharge(x.req("id"), x.req("type"), x.req("amount"))
    private fun billing(x: JsonObject) = RentalBilling(x.req("id"), x.req("tenancyId"), x.req("tenancyTermsId"),
        x.req("periodStart"), x.req("periodEnd"), x.getAsJsonArray("charges").map { charge(it.asJsonObject) })
    private fun payment(x: JsonObject) = RentalPayment(x.req("id"), x.req("tenancyId"), x.req("amount"), x.req("source"),
        x.req("verification"), x.req("confirmedAt"))
    private fun receipt(x: JsonObject) = RentalReceipt(x.req("id"), x.req("paymentId"), x.req("status"), x.req("issuedAt"), x.opt("voidedAt"))
    private fun incident(x: JsonObject) = RentalIncident(x.req("id"), x.req("roomId"), x.req("category"), x.req("status"),
        x.req("createdAt"), x.opt("closureReason"))
    private fun identity(x: JsonObject) = x
    private fun obj(vararg props: Pair<String, String>) = JsonObject().apply { props.forEach { addProperty(it.first, it.second) } }
    private fun JsonObject.req(name: String): String =
        get(name)?.takeUnless { it.isJsonNull }?.asString ?: throw V1RequestException(ErrorKind.INVALID_RESPONSE)
    private fun JsonObject.opt(name: String): String? = get(name)?.takeUnless { it.isJsonNull }?.asString
    private fun segment(id: String): String {
        require(id.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "ID không hợp lệ" }
        return id
    }
    private fun validMoney(value: String) = value.matches(Regex("\\d{1,16}(\\.\\d{1,2})?"))
    private fun <T> read(outcome: TransportOutcome, parse: (JsonObject) -> T): T =
        parse(JsonParser.parseString(body(outcome)).asJsonObject)
    private fun <T> list(outcome: TransportOutcome, parse: (JsonObject) -> T): List<T> =
        JsonParser.parseString(body(outcome)).asJsonArray.map { parse(it.asJsonObject) }
    private fun body(x: TransportOutcome): String = when (x) {
        is TransportOutcome.Failure -> throw V1RequestException(x.kind, x.httpStatus)
        is TransportOutcome.Success -> BackendJsonCodec.unwrapResponseData(x.document.rawBody)
    }

    companion object {
        val CHECKOUT_REASONS = setOf("TERM_ENDED", "TENANT_INITIATED", "OPERATOR_INITIATED", "MUTUAL", "OTHER")
        val CHARGE_TYPES = setOf("RENT", "ELECTRICITY", "WATER")
        val INCIDENT_CATEGORIES = setOf("ELECTRICAL", "PLUMBING", "ACCESS_SECURITY", "ROOM_FACILITY", "APPLIANCE", "OTHER")
        val INCIDENT_TRANSITIONS = mapOf(
            "REPORTED" to setOf("ACKNOWLEDGED", "REJECTED", "CLOSED"),
            "ACKNOWLEDGED" to setOf("IN_PROGRESS", "REJECTED"),
            "IN_PROGRESS" to setOf("RESOLVED", "CLOSED"),
            "RESOLVED" to setOf("CLOSED", "IN_PROGRESS"),
        )
    }
}
