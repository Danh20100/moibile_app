package com.trooi.app.core.demo

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.trooi.app.core.model.*
import com.trooi.app.core.network.*
import com.trooi.app.core.network.dto.*
import com.trooi.app.features.shared.V1PaymentGateway
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.math.BigDecimal
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Debug-only bridge to the isolated loopback API. Bearers exist only for one serialized operation. */
class DemoPaymentClient internal constructor(private val baseUrl: String = "http://localhost:3001/api/v1") {
    private val requests = Mutex()

    private suspend fun <T> authorized(userId: String, operation: suspend (BackendClient) -> T): T = requests.withLock {
        val index = DemoData.accounts.indexOfFirst { it.userId == userId }
        require(index in 0..1) { "Thanh toán chưa khả dụng cho tài khoản này." }
        val tokens = InMemoryAuthTokenProvider()
        val client = BackendClient(baseUrl, tokens, allowLocalHttp = true)
        try {
            val login = document(client.postJson("demo/login", JsonObject().apply {
                addProperty("identifier", DebugFixtureCatalog.current.accounts[index].email)
                addProperty("password", "TroOi2026!")
            }.toString()))
            val expectedUser = "e0080000-0000-4000-8000-" + (index + 1).toString().padStart(12, '0')
            check(login.get("userId").asString == expectedUser)
            tokens.setToken(login.get("token").asString)
            val session = document(client.get("demo/session", authenticated = true))
            check(session.get("userId").asString == expectedUser)
            val tenancies = session.getAsJsonArray("linkedTenancyIds").map { it.asString }.toSet()
            val organizations = session.getAsJsonArray("operatedOrganizationIds").map { it.asString }.toSet()
            check(if (index == 0) tenancies == setOf(DemoData.TENANCY) && organizations.isEmpty()
                else organizations == setOf(DemoData.ORGANIZATION) && tenancies.isEmpty())
            operation(client)
        } finally { tokens.clear() }
    }

    suspend fun create(userId: String, tenancyId: String, amount: String, key: String) = authorized(userId) {
        V1PaymentGateway(it).create(tenancyId, amount, key, provider = "DEMO")
    }
    suspend fun get(userId: String, id: String) = authorized(userId) { V1PaymentGateway(it).get(id) }

    suspend fun finance(userId: String): TenantFinanceProjection = authorized(userId) { client ->
        val api = OkHttpBackendApi(client)
        val cycles = api.getBillingCycles(DemoData.TENANCY).required()
        val payments = api.getPayments(DemoData.TENANCY).required()
        val deposit = api.getDeposit(DemoData.TENANCY).required()
        check(cycles.all { it.tenancyId == DemoData.TENANCY } && payments.all { it.tenancyId == DemoData.TENANCY } && deposit.tenancyId == DemoData.TENANCY)
        TenantFinanceProjection(DemoData.TENANCY,
            charges = cycles.sortedByDescending { it.periodStart }.flatMap { cycle -> cycle.charges.map { charge ->
                check(charge.billingCycleId == cycle.id)
                val label = when (charge.type) { "RENT" -> "Tiền thuê"; "ELECTRICITY" -> "Điện"; "WATER" -> "Nước"; else -> error("Khoản thu không hợp lệ.") }
                ChargeCard(charge.id, "$label · ${cycle.periodStart.substring(5, 7)}/${cycle.periodStart.take(4)}", money(charge.amount), null)
            } },
            payments = payments.filter { it.voidedOrReversedAt == null }.sortedByDescending { it.confirmedAt }.map { payment ->
                check((payment.source == "GATEWAY" && payment.verification == "PROVIDER_VERIFIED") ||
                    (payment.source in setOf("MANUAL_CASH", "MANUAL_TRANSFER") && payment.verification == "USER_RECORDED"))
                val method = when (payment.source) { "GATEWAY" -> "Đã xác nhận thanh toán"; "MANUAL_CASH" -> "Tiền mặt"; else -> "Chuyển khoản" }
                val date = Instant.parse(payment.confirmedAt).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(DateTimeFormatter.ofPattern("dd/MM/yyyy · HH:mm"))
                PaymentCard(payment.id, money(payment.amount), "$method · $date")
            },
            deposits = listOf(DepositCard(DemoData.TENANCY, deposit.requirementAmount?.let(::money), money(deposit.fundedAmount),
                money(deposit.settledAmount), deposit.id, money(deposit.heldAmount), deposit.state, deposit.blockedByOpenPolicy)),
        )
    }

    private fun document(outcome: TransportOutcome): JsonObject = when (outcome) {
        is TransportOutcome.Success -> JsonParser.parseString(BackendJsonCodec.unwrapResponseData(outcome.document.rawBody)).asJsonObject
        is TransportOutcome.Failure -> error("Chưa kết nối được dịch vụ thanh toán. Vui lòng thử lại.")
    }
    private fun <T> ApiOutcome<T>.required(): T = when (this) {
        is ApiOutcome.Data -> value
        is ApiOutcome.Failure -> error("Chưa tải được thông tin thanh toán. Vui lòng thử lại.")
    }
    private fun money(raw: String): String {
        val amount = BigDecimal(raw)
        require(amount.signum() >= 0 && amount.stripTrailingZeros().scale() <= 0)
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(amount) + "đ"
    }
}
