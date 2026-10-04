package com.trooi.app.features.tenancy

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trooi.app.features.shared.*
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface RentalRoute {
    data object Tenancies : RentalRoute
    data class Tenancy(val id: String) : RentalRoute
    data class Participants(val id: String) : RentalRoute
    data class Terms(val id: String) : RentalRoute
    data class Notices(val id: String) : RentalRoute
    data class Billing(val id: String) : RentalRoute
    data class Payment(val id: String) : RentalRoute
    data class Receipts(val id: String) : RentalRoute
    data class Incidents(val roomId: String) : RentalRoute
    data class Incident(val id: String, val roomId: String) : RentalRoute
}

data class RentalUiState(
    val roomId: String = "",
    val tenantMode: Boolean = false,
    val stack: List<RentalRoute> = listOf(RentalRoute.Tenancies),
    val busy: Boolean = false,
    val error: String? = null,
    val errorKind: String? = null,
    val success: String? = null,
    val tenancies: List<RentalTenancy> = emptyList(),
    val tenancy: RentalTenancy? = null,
    val participants: List<RentalParticipant> = emptyList(),
    val terms: List<RentalTerms> = emptyList(),
    val notices: List<RentalNotice> = emptyList(),
    val billing: List<RentalBilling> = emptyList(),
    val payments: List<RentalPayment> = emptyList(),
    val payment: RentalPayment? = null,
    val checkout: GatewayCheckout? = null,
    val pendingDeeplink: String? = null,
    val receipts: List<RentalReceipt> = emptyList(),
    val incidents: List<RentalIncident> = emptyList(),
    val incident: RentalIncident? = null,
    val roomAfterCheckout: V1Room? = null,
) {
    val route: RentalRoute get() = stack.last()
}

@HiltViewModel
class RentalViewModel @Inject constructor(
    private val api: V1RentalGateway,
    private val operator: V1ContractGateway,
) : ViewModel() {
    private val _ui = MutableStateFlow(RentalUiState())
    val ui: StateFlow<RentalUiState> = _ui.asStateFlow()
    private var startedKey = ""
    private var revision = 0

    fun start(roomId: String, linkedTenancyId: String? = null) {
        val key = roomId + ":" + (linkedTenancyId ?: "")
        if (key == startedKey) return
        startedKey = key
        val root = linkedTenancyId?.let(RentalRoute::Tenancy) ?: RentalRoute.Tenancies
        _ui.value = RentalUiState(roomId = roomId, tenantMode = linkedTenancyId != null, stack = listOf(root))
        load()
    }

    fun reset() {
        revision++
        startedKey = ""
        _ui.value = RentalUiState()
    }

    fun open(route: RentalRoute) {
        val u = _ui.value
        if (u.tenantMode) {
            val linked = (u.stack.first() as? RentalRoute.Tenancy)?.id
            val target = when (route) {
                is RentalRoute.Tenancy -> route.id
                is RentalRoute.Participants -> route.id
                is RentalRoute.Terms -> route.id
                is RentalRoute.Notices -> route.id
                is RentalRoute.Billing -> route.id
                is RentalRoute.Payment -> route.id
                is RentalRoute.Receipts -> route.id
                else -> linked
            }
            if (linked != target) {
                _ui.update { it.copy(error = "Không được mở Tenancy khác.", errorKind = "FORBIDDEN") }
                return
            }
        }
        _ui.update { it.copy(stack = it.stack + route, error = null, errorKind = null, success = null,
            tenancies = emptyList(), tenancy = null, participants = emptyList(), terms = emptyList(),
            notices = emptyList(), billing = emptyList(), payments = emptyList(), payment = null, checkout = null,
            pendingDeeplink = null, receipts = emptyList(), incidents = emptyList(), incident = null) }
        load()
    }

    fun back(): Boolean {
        if (_ui.value.stack.size <= 1) return false
        revision++
        _ui.update { it.copy(stack = it.stack.dropLast(1), error = null, errorKind = null, success = null) }
        load()
        return true
    }

    fun load() {
        val u = _ui.value
        val current = ++revision
        _ui.update { it.copy(busy = true, error = null, errorKind = null) }
        viewModelScope.launch {
            try {
                val route = u.route
                when (route) {
                    RentalRoute.Tenancies -> publish(current) { it.copy(tenancies = api.tenancies(u.roomId).filter { t -> t.roomId == u.roomId }) }
                    is RentalRoute.Tenancy -> publish(current) {
                        val t = api.tenancy(route.id)
                        require(u.roomId.isBlank() || t.roomId == u.roomId) { "Tenancy không thuộc Room được chọn." }
                        it.copy(tenancy = t, roomId = t.roomId)
                    }
                    is RentalRoute.Participants -> publish(current) { it.copy(participants = api.participants(route.id)) }
                    is RentalRoute.Terms -> publish(current) { it.copy(terms = api.terms(route.id)) }
                    is RentalRoute.Notices -> publish(current) { it.copy(notices = api.notices(route.id)) }
                    is RentalRoute.Billing -> publish(current) { it.copy(billing = api.billingCycles(route.id).filter { b -> b.tenancyId == route.id }) }
                    is RentalRoute.Payment -> publish(current) {
                        it.copy(
                            billing = api.billingCycles(route.id).filter { cycle -> cycle.tenancyId == route.id },
                            payments = api.payments(route.id).filter { pay -> pay.tenancyId == route.id },
                            payment = null,
                        )
                    }
                    is RentalRoute.Receipts -> publish(current) {
                        val scoped = api.receipts().filter { receipt ->
                            api.payment(receipt.paymentId).tenancyId == route.id
                        }
                        it.copy(receipts = scoped)
                    }
                    is RentalRoute.Incidents -> publish(current) { it.copy(incidents = api.incidents(route.roomId).filter { b -> b.roomId == route.roomId }) }
                    is RentalRoute.Incident -> publish(current) {
                        val incident = api.incident(route.id)
                        require(incident.roomId == route.roomId) { "Incident không thuộc Room được chọn." }
                        it.copy(incident = incident)
                    }
                }
            } catch (error: Exception) { fail(current, error) }
        }
    }

    fun createTenancy(roomId: String) = write {
        require(!_ui.value.tenantMode) { "Người thuê không thể tự tạo Tenancy." }
        val created = api.createTenancy(roomId)
        val verified = api.tenancy(created.id)
        require(verified.roomId == roomId) { "Backend trả Tenancy sai Room." }
        _ui.update { it.copy(tenancy = verified, stack = it.stack + RentalRoute.Tenancy(verified.id)) }
    }

    fun transitionTenancy(id: String, action: String, reason: String = "") = write {
        val old = api.tenancy(id)
        val tenant = _ui.value.tenantMode
        val updated = when (action) {
            "cancel" -> { require(!tenant && old.status.equals("draft", true)); api.cancelDraft(id) }
            "ending" -> { require(old.status.equals("active", true)); api.startEnding(id) }
            "resume" -> { require(!tenant && old.status.equals("ending", true)); api.resume(id) }
            "checkout" -> { require(!tenant && old.status.equals("ending", true)); api.checkout(id, reason) }
            else -> error("Không có action Tenancy phù hợp")
        }
        val fresh = api.tenancy(updated.id)
        val room = if (action == "checkout" && fresh.status.equals("ended", true)) operator.room(fresh.roomId) else null
        _ui.update { it.copy(tenancy = fresh, roomAfterCheckout = room) }
    }

    fun addParticipant(id: String, role: String) = write {
        require(!_ui.value.tenantMode) { "Operator mới có quyền thêm Participant." }
        api.addParticipant(id, role)
        _ui.update { it.copy(participants = api.participants(id)) }
    }

    fun leaveParticipant(id: String, part: RentalParticipant) = write {
        require(!_ui.value.tenantMode && part.role == "OCCUPANT" && part.leftAt == null) { "Không tự thay PRIMARY policy." }
        api.leaveOccupant(id, part.id)
        _ui.update { it.copy(participants = api.participants(id)) }
    }

    fun linkParticipant(id: String, participantId: String, userId: String) = write {
        require(!_ui.value.tenantMode && userId.isNotBlank())
        api.linkParticipant(id, participantId, userId)
        _ui.update { it.copy(participants = api.participants(id)) }
    }

    fun createBilling(id: String, termsId: String, from: String, to: String, type: String, amount: String) = write {
        require(!_ui.value.tenantMode) { "Tenant có quyền xem, không tự tạo Billing." }
        api.createBilling(id, termsId, from, to, listOf(type to amount))
        _ui.update { it.copy(billing = api.billingCycles(id)) }
    }

    fun recordPayment(id: String, amount: String, source: String) = write {
        require(!_ui.value.tenantMode) { "Chỉ Operator ghi nhận tiền đã thực nhận." }
        val recorded = api.recordPayment(id, amount, source)
        _ui.update { it.copy(payment = api.payment(recorded.id)) }
    }

    fun createMomoCheckout(tenancyId: String, amount: String) = write {
        val created = api.createGatewayCheckout(tenancyId, amount)
        _ui.update {
            it.copy(
                checkout = created,
                pendingDeeplink = created.deeplink ?: created.payUrl,
                payments = api.payments(tenancyId),
            )
        }
    }

    fun refreshCheckout() = write {
        val current = _ui.value.checkout ?: throw IllegalArgumentException("Chưa có phiên MoMo")
        val route = _ui.value.route as? RentalRoute.Payment
            ?: throw IllegalArgumentException("Chưa mở trang Payment")
        _ui.update {
            it.copy(
                checkout = api.gatewayCheckout(current.id),
                payments = api.payments(route.id),
                pendingDeeplink = null,
            )
        }
    }

    fun consumeDeeplink() {
        _ui.update { it.copy(pendingDeeplink = null) }
    }

    fun lookupPayment(id: String) = write {
        val pay = api.payment(id)
        val route = _ui.value.route as? RentalRoute.Payment
            ?: throw IllegalArgumentException("Chưa mở trang Payment")
        require(pay.tenancyId == route.id) { "Payment không thuộc Tenancy hiện tại" }
        _ui.update { it.copy(payment = pay) }
    }

    fun allocate(paymentId: String, chargeId: String, amount: String) = write {
        require(!_ui.value.tenantMode && _ui.value.payment?.id == paymentId) { "Payment chưa được Backend xác minh." }
        api.allocate(paymentId, chargeId, amount)
        _ui.update { it.copy(payment = api.payment(paymentId)) }
    }

    fun issueReceipt(paymentId: String) = write {
        require(!_ui.value.tenantMode && _ui.value.payment?.id == paymentId) { "Cần Payment đã xác minh." }
        api.issueReceipt(paymentId)
        _ui.update { it.copy(receipts = api.receipts(paymentId)) }
    }

    fun voidReceipt(id: String) = write {
        require(!_ui.value.tenantMode) { "Tenant không thể void Receipt." }
        api.voidReceipt(id)
        _ui.update { it.copy(receipts = api.receipts()) }
    }

    fun reportIncident(roomId: String, category: String) = write {
        api.reportIncident(roomId, category)
        _ui.update { it.copy(incidents = api.incidents(roomId)) }
    }

    fun transitionIncident(id: String, status: String, note: String?, closure: String?) = write {
        require(!_ui.value.tenantMode) { "Tenant không cập nhật Incident status." }
        val fresh = api.transitionIncident(id, status, note, closure)
        _ui.update { it.copy(incident = api.incident(fresh.id)) }
    }

    private fun write(block: suspend () -> Unit) {
        if (_ui.value.busy) return
        val current = ++revision
        _ui.update { it.copy(busy = true, success = null, error = null, errorKind = null) }
        viewModelScope.launch {
            try {
                block()
                if (revision == current) _ui.update { it.copy(busy = false, success = "Backend xác nhận thành công.") }
            } catch (error: Exception) { fail(current, error) }
        }
    }

    private suspend fun publish(token: Int, compute: suspend (RentalUiState) -> RentalUiState) {
        if (token != revision) return
        val refreshed = compute(_ui.value)
        if (token == revision) _ui.value = refreshed.copy(busy = false)
    }

    private fun fail(token: Int, error: Exception) {
        if (token != revision) return
        val kind = (error as? V1RequestException)?.kind?.name ?: "VALIDATION_OR_RESPONSE"
        val status = (error as? V1RequestException)?.status
        val description = when (status) {
            403 -> "Backend từ chối truy cập."
            404 -> "Không tìm thấy đối tượng."
            409 -> "Backend từ chối do xung đột lifecycle, thử tải lại."
            else -> error.message ?: "Không thể tải hoặc ghi dữ liệu."
        }
        _ui.update { it.copy(busy = false, error = description, errorKind = kind) }
    }
}
