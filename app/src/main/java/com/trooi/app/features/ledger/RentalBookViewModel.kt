package com.trooi.app.features.ledger

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.trooi.app.features.shared.V1PaymentGateway
import com.trooi.app.features.tenancy.validGatewayAmount
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.launch

@HiltViewModel
class RentalBookViewModel @Inject constructor(
    private val gateway: RentalBookGateway,
    private val paymentGateway: V1PaymentGateway,
) : ViewModel() {
    var busy by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var feedback by mutableStateOf<String?>(null)
        private set
    var detail by mutableStateOf<JsonObject?>(null)
        private set
    var cycles by mutableStateOf<JsonArray?>(null)
        private set
    var payments by mutableStateOf<JsonArray?>(null)
        private set
    var paymentScopeId by mutableStateOf<String?>(null)
        private set
    var incidents by mutableStateOf<JsonArray?>(null)
        private set
    var invitation by mutableStateOf<RoomJoinInvitation?>(null)
        private set
    var preview by mutableStateOf<RoomJoinPreview?>(null)
        private set
    var receiptPayment by mutableStateOf<JsonObject?>(null)
        private set
    var joinToken by mutableStateOf("")
    private var requestSequence = 0

    fun clearMessage() {
        error = null
        feedback = null
    }

    fun load(kind: String, id: String) {
        if (id.isBlank()) return
        val request = ++requestSequence
        detail = null
        clearMessage()
        busy = true
        viewModelScope.launch {
            runCatching { gateway.detail(kind, id) }
                .onSuccess { if (request == requestSequence) detail = it }
                .onFailure { if (request == requestSequence) error = it.message ?: "Không thể tải chi tiết" }
            if (request == requestSequence) busy = false
        }
    }

    fun loadCycles(tenancyId: String? = null) {
        clearMessage()
        viewModelScope.launch {
            runCatching {
                gateway.get("finance/cycles", tenancyId?.let { mapOf("tenancyId" to it) } ?: emptyMap()).asJsonArray
            }.onSuccess { cycles = it }.onFailure { error = it.message ?: "Không thể tải kỳ thu" }
        }
    }

    fun loadPayments(tenancyId: String) {
        paymentScopeId = tenancyId
        payments = null
        viewModelScope.launch {
            runCatching { gateway.payments(tenancyId) }
                .onSuccess { if (paymentScopeId == tenancyId) payments = it }
                .onFailure { if (paymentScopeId == tenancyId) error = it.message ?: "Không thể tải thanh toán" }
        }
    }

    fun loadIncidentEvents(id: String) {
        viewModelScope.launch {
            runCatching { gateway.incidentEvents(id) }
                .onSuccess { incidents = it }
                .onFailure { error = it.message ?: "Không thể tải lịch sử" }
        }
    }

    fun clearInvitation() {
        invitation = null
    }

    fun loadReceiptPayment(id: String) {
        receiptPayment = null
        viewModelScope.launch {
            runCatching { gateway.detail("payment", id) }
                .onSuccess { receiptPayment = it }
                .onFailure { error = it.message ?: "Không thể tải thanh toán liên quan" }
        }
    }

    fun createInvitation(tenancyId: String) {
        invitation = null
        runAction("Đã tạo link liên kết") { gateway.issueInvitation(tenancyId).also { invitation = it } }
    }

    fun prepareJoin(token: String) {
        joinToken = token.trim().let {
            if (it.startsWith("trooi://join")) android.net.Uri.parse(it).getQueryParameter("token").orEmpty()
            else it.substringAfter("token=",it).substringBefore("&")
        }.trim()
        preview = null
        if (joinToken.isBlank()) {
            error = "Hãy nhập mã hoặc mở link phòng"
            return
        }
        runAction(null) { preview = gateway.previewInvitation(joinToken) }
    }

    fun acceptJoin(onLinked: () -> Unit) {
        runAction("Đã liên kết phòng thuê") {
            gateway.acceptInvitation(joinToken)
            invitation = null
            preview = null
            joinToken = ""
            onLinked()
        }
    }

    fun createPaymentQr(tenancyId: String, rawAmount: String, onReady: (String) -> Unit) {
        val normalized = rawAmount.removeSuffix(".00") + ".00"
        if (!validGatewayAmount(normalized)) {
            error = "Nhập số tiền từ 1.000 đến 50.000.000 đồng, không có phần lẻ."
            feedback = null
            return
        }
        runAction("Đã tạo QR. Mở trang thanh toán chưa có nghĩa là đã trả tiền.") {
            val created = paymentGateway.create(tenancyId, normalized, UUID.randomUUID().toString())
            onReady(created.payUrl ?: throw IllegalStateException("Chưa mở được trang thanh toán."))
        }
    }

    fun confirmPayment(tenancyId: String, amount: String, method: String, onSaved: (String) -> Unit) {
        runAction("Đã ghi nhận khoản tiền thực nhận") {
            val payment = gateway.recordPayment(tenancyId, amount, method)
            payment.string("id")?.let(onSaved)
        }
    }

    fun allocate(paymentId: String, chargeId: String, amount: String, onSaved: () -> Unit) {
        runAction("Đã phân bổ thanh toán") {
            gateway.allocatePayment(paymentId, chargeId, amount)
            onSaved()
        }
    }

    fun updateIncident(id: String, status: String, note: String, onSaved: () -> Unit) {
        runAction("Đã cập nhật sự cố") {
            gateway.updateIncident(id, status, note)
            onSaved()
        }
    }

    fun createIncident(roomId: String, category: String, onSaved: () -> Unit) {
        runAction("Đã báo sự cố") {
            gateway.createIncident(roomId, category)
            onSaved()
        }
    }

    fun createTenancy(roomId: String, onSaved: () -> Unit) {
        runAction("Đã tạo bản nháp lượt thuê") {
            gateway.createTenancy(roomId)
            onSaved()
        }
    }

    fun changeRoom(roomId: String, status: String, onSaved: () -> Unit) {
        runAction("Đã đổi trạng thái phòng") {
            gateway.updateRoom(roomId, status)
            onSaved()
        }
    }

    fun editListing(id: String, title: String, description: String, price: String, onSaved: () -> Unit) {
        runAction("Đã lưu tin đăng") {
            gateway.updateListing(id, title, description, price)
            onSaved()
        }
    }

    fun changeListing(id: String, action: String, onSaved: () -> Unit) {
        runAction("Đã cập nhật tin đăng") {
            gateway.listingAction(id, action)
            onSaved()
        }
    }

    private fun runAction(message: String?, block: suspend () -> Unit) {
        if (busy) return
        clearMessage()
        busy = true
        viewModelScope.launch {
            try {
                block()
                feedback = message
            } catch (failure: Exception) {
                error = failure.message ?: "Yêu cầu không thành công"
            } finally {
                busy = false
            }
        }
    }
}
