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
data class RentalDeposit(
    val id: String,
    val tenancyId: String,
    val requirementAmount: String?,
    val fundedAmount: String,
    val settledAmount: String,
    val heldAmount: String,
    val state: String?,
    val blockedByOpenPolicy: Boolean,
)
data class RentalDepositEvent(
    val id: String,
    val depositId: String,
    val eventType: String,
    val amount: String,
    val occurredAt: String,
)
data class RentalDepositApplication(
    val id: String,
    val paymentId: String,
    val depositId: String,
    val appliedAmount: String,
    val appliedAt: String,
)

/** Operator-only, and only when Payment and Deposit belong to one tenancy. */
fun depositApplicationAllowed(tenantMode: Boolean, paymentTenancyId: String, depositTenancyId: String): Boolean =
    !tenantMode && paymentTenancyId.isNotBlank() && paymentTenancyId == depositTenancyId

data class RentalDepositSettlement(
    val id: String,
    val depositId: String,
    val refundedAmount: String,
    val retainedAmount: String,
    val reasonOrNote: String,
    val settledAt: String,
)
data class RentalIncidentEvent(
    val id: String,
    val incidentId: String,
    val eventType: String,
    val note: String?,
    val fromStatus: String?,
    val toStatus: String?,
    val occurredAt: String,
)
data class RentalPaymentHistory(
    val payment: RentalPayment,
    val receipts: List<RentalReceipt>,
)
data class RentalIncidentHistory(
    val incident: RentalIncident,
    val events: List<RentalIncidentEvent>,
)
data class RentalDepositHistory(
    val projection: RentalDeposit,
    val events: List<RentalDepositEvent>,
)
data class RentalHistory(
    val tenancy: RentalTenancy,
    val terms: List<RentalTerms>,
    val payments: List<RentalPaymentHistory>,
    val notices: List<RentalNotice>,
    val incidents: List<RentalIncidentHistory>,
    val deposit: RentalDepositHistory?,
)

/** Server-only business transitions. No optimistic Room, Tenancy, Payment or Incident mutation. */
class V1RentalGateway @Inject constructor(private val client: BackendClient) {
    suspend fun tenancies(roomId: String): List<RentalTenancy> =
        list(client.get("tenancies", true, mapOf("roomId" to roomId)), ::tenancy)
    suspend fun tenancy(id: String): RentalTenancy = read(client.get("tenancies/${segment(id)}", true), ::tenancy)
    suspend fun history(id: String): RentalHistory =
        read(client.get("tenancies/${segment(id)}/history", true), ::rentalHistory)
    suspend fun createTenancy(roomId: String): RentalTenancy =
        read(client.postJson("tenancies", obj("roomId" to roomId).toString(), true), ::tenancy)
    suspend fun activateTenancy(id: String, at: String = Instant.now().toString()): RentalTenancy =
        read(client.postJson("tenancies/${segment(id)}/activate", obj("occurredAt" to at).toString(), true), ::tenancy)
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
    suspend fun acknowledgeTerms(
        tenancyId: String,
        termsId: String,
        participantId: String,
        at: String = Instant.now().toString(),
    ): JsonObject = read(
        client.postJson(
            "tenancies/${segment(tenancyId)}/terms/${segment(termsId)}/acknowledgements",
            obj("tenancyParticipantId" to participantId, "acknowledgedAt" to at).toString(),
            true,
        ),
        ::identity,
    )
    suspend fun notices(id: String): List<RentalNotice> =
        list(client.get("tenancies/${segment(id)}/notices", true), ::notice)
    suspend fun issueNotice(
        tenancyId: String,
        type: String,
        content: String,
        at: String = Instant.now().toString(),
    ): RentalNotice = read(
        client.postJson(
            "tenancies/${segment(tenancyId)}/notices",
            obj("noticeType" to type, "contentOrNote" to content, "issuedAt" to at).toString(),
            true,
        ),
        ::notice,
    )
    suspend fun acknowledgeNotice(
        tenancyId: String,
        noticeId: String,
        at: String = Instant.now().toString(),
    ): RentalNotice = read(
        client.postJson(
            "tenancies/${segment(tenancyId)}/notices/${segment(noticeId)}/acknowledge",
            obj("occurredAt" to at).toString(),
            true,
        ),
        ::notice,
    )

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

    suspend fun payments(tenancyId: String): List<RentalPayment> =
        list(client.get("finance/payments", true, mapOf("tenancyId" to tenancyId)), ::payment)
    suspend fun payment(id: String): RentalPayment = read(client.get("finance/payments/${segment(id)}", true), ::payment)
    suspend fun recordPayment(tenancyId: String, amount: String, source: String, at: String = Instant.now().toString()): RentalPayment {
        require(source in setOf("MANUAL_CASH", "MANUAL_TRANSFER") && validMoney(amount)) { "Chỉ ghi nhận tiền đã thực nhận từ nguồn manual" }
        return read(client.postJson("finance/payments",
            obj("tenancyId" to tenancyId, "amount" to amount, "source" to source,
                "confirmedAt" to at).toString(), true), ::payment)
    }
    suspend fun allocate(paymentId: String, chargeId: String, amount: String) : JsonObject {
        require(validMoney(amount)) { "Amount không hợp lệ" }
        return read(client.postJson("finance/payments/${segment(paymentId)}/allocations",
            obj("amount" to amount, "targetId" to chargeId).toString(), true), ::identity)
    }
    suspend fun applyPaymentToDeposit(paymentId: String, depositId: String, amount: String): RentalDepositApplication {
        require(validMoney(amount)) { "Amount không hợp lệ" }
        val applied = read(
            client.postJson(
                "finance/payments/${segment(paymentId)}/deposit-applications",
                obj("targetId" to depositId, "amount" to amount).toString(),
                true,
            ),
            ::depositApplication,
        )
        if (applied.paymentId != paymentId || applied.depositId != depositId) {
            throw V1RequestException(ErrorKind.INVALID_RESPONSE)
        }
        return applied
    }

    suspend fun deposit(tenancyId: String): RentalDeposit? {
        val outcome = client.get("finance/deposits", true, mapOf("tenancyId" to tenancyId))
        if (outcome is TransportOutcome.Failure && outcome.httpStatus == 404) return null
        return read(outcome, ::deposit)
    }
    suspend fun createDeposit(tenancyId: String): RentalDeposit =
        read(client.postJson("finance/deposits", obj("tenancyId" to tenancyId).toString(), true), ::deposit)
    suspend fun depositEvents(depositId: String): List<RentalDepositEvent> =
        list(client.get("finance/deposits/${segment(depositId)}/events", true), ::depositEvent)
    suspend fun settleDeposit(
        depositId: String,
        refundedAmount: String,
        retainedAmount: String,
        reason: String,
        at: String = Instant.now().toString(),
    ): RentalDepositSettlement {
        require(validMoney(refundedAmount) && validMoney(retainedAmount) && reason.isNotBlank()) {
            "Settlement cần refunded/retained amount hợp lệ và lý do"
        }
        return read(
            client.postJson(
                "finance/deposits/${segment(depositId)}/settlements",
                obj(
                    "refundedAmount" to refundedAmount,
                    "retainedAmount" to retainedAmount,
                    "reasonOrNote" to reason,
                    "settledAt" to at,
                ).toString(),
                true,
            ),
            ::depositSettlement,
        )
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
    suspend fun incidentEvents(id: String): List<RentalIncidentEvent> =
        list(client.get("incidents/${segment(id)}/events", true), ::incidentEvent)
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
    private fun deposit(x: JsonObject) = RentalDeposit(
        id = x.req("id"),
        tenancyId = x.req("tenancyId"),
        requirementAmount = x.opt("requirementAmount"),
        fundedAmount = x.req("fundedAmount"),
        settledAmount = x.req("settledAmount"),
        heldAmount = x.req("heldAmount"),
        state = x.opt("state"),
        blockedByOpenPolicy = x.get("blockedByOpenPolicy")?.asBoolean
            ?: throw V1RequestException(ErrorKind.INVALID_RESPONSE),
    )
    private fun depositApplication(x: JsonObject) = RentalDepositApplication(
        x.req("id"), x.req("paymentId"), x.req("depositId"), x.req("appliedAmount"), x.req("appliedAt"),
    )
    private fun depositEvent(x: JsonObject) = RentalDepositEvent(
        x.req("id"), x.req("depositId"), x.req("eventType"), x.req("amount"), x.req("occurredAt"),
    )
    private fun depositSettlement(x: JsonObject) = RentalDepositSettlement(
        x.req("id"), x.req("depositId"), x.req("refundedAmount"), x.req("retainedAmount"),
        x.req("reasonOrNote"), x.req("settledAt"),
    )
    private fun incidentEvent(x: JsonObject) = RentalIncidentEvent(
        x.req("id"), x.req("incidentId"), x.req("eventType"), x.opt("note"),
        x.opt("fromStatus"), x.opt("toStatus"), x.req("occurredAt"),
    )
    private fun rentalHistory(x: JsonObject) = RentalHistory(
        tenancy = tenancy(x.requiredObject("tenancy")),
        terms = x.requiredArray("terms").map { terms(it.asJsonObject) },
        payments = x.requiredArray("payments").map { paymentHistory(it.asJsonObject) },
        notices = x.requiredArray("notices").map { notice(it.asJsonObject) },
        incidents = x.requiredArray("incidents").map { incidentHistory(it.asJsonObject) },
        deposit = x.get("deposit")?.takeUnless { it.isJsonNull }?.asJsonObject?.let(::depositHistory),
    )
    private fun paymentHistory(x: JsonObject) = RentalPaymentHistory(
        payment = payment(x.requiredObject("payment")),
        receipts = x.requiredArray("receipts").map { receipt(it.asJsonObject) },
    )
    private fun incidentHistory(x: JsonObject) = RentalIncidentHistory(
        incident = incident(x.requiredObject("incident")),
        events = x.requiredArray("events").map { incidentEvent(it.asJsonObject) },
    )
    private fun depositHistory(x: JsonObject) = RentalDepositHistory(
        projection = deposit(x.requiredObject("projection")),
        events = x.requiredArray("events").map { depositEvent(it.asJsonObject) },
    )
    private fun JsonObject.requiredObject(name: String): JsonObject =
        get(name)?.takeUnless { it.isJsonNull }?.asJsonObject ?: throw V1RequestException(ErrorKind.INVALID_RESPONSE)
    private fun JsonObject.requiredArray(name: String): JsonArray =
        get(name)?.takeUnless { it.isJsonNull }?.asJsonArray ?: throw V1RequestException(ErrorKind.INVALID_RESPONSE)
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
