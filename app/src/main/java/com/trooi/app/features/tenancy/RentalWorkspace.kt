package com.trooi.app.features.tenancy

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.features.shared.*
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.TroOiMuted

/** Separate rental feature with dedicated route/state; backend is the sole business authority. */
@Composable
fun V1RentalWorkspace(
    roomId: String,
    linkedTenancyId: String? = null,
    onExit: () -> Unit,
    onUnauthorized: () -> Unit,
    model: RentalViewModel = hiltViewModel(),
) {
    val state by model.ui.collectAsStateWithLifecycle()
    LaunchedEffect(roomId, linkedTenancyId) { model.start(roomId, linkedTenancyId) }
    DisposableEffect(Unit) { onDispose { model.reset() } }
    BackHandler(enabled = state.stack.size > 1) { model.back() }
    LaunchedEffect(state.errorKind) { if (state.errorKind == "AUTH_EXPIRED") onUnauthorized() }
    var name by remember(state.route) { mutableStateOf("") }
    var extra by remember(state.route) { mutableStateOf("") }
    var extra2 by remember(state.route) { mutableStateOf("") }
    var choice by remember(state.route) { mutableStateOf("") }
    var selected by remember(state.route) { mutableStateOf("") }
    var price by remember(state.route) { mutableStateOf("") }
    var received by remember(state.route) { mutableStateOf("") }
    val route = state.route
    val context = LocalContext.current
    LaunchedEffect(state.pendingDeeplink) {
        val link = state.pendingDeeplink ?: return@LaunchedEffect
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }
        model.consumeDeeplink()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-rental-workflow"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            V1PageTitle(
                when (route) {
                    RentalRoute.Tenancies -> "Lượt thuê của Room"
                    is RentalRoute.Tenancy -> "Chi tiết lượt thuê"
                    is RentalRoute.Participants -> "Người tham gia thuê"
                    is RentalRoute.Terms -> "Điều khoản theo phiên bản"
                    is RentalRoute.Notices -> "Thông báo Tenancy"
                    is RentalRoute.Billing -> "Kỳ tính tiền"
                    is RentalRoute.Payment -> "Khoản tiền đã nhận"
                    is RentalRoute.Receipts -> "Biên nhận"
                    is RentalRoute.Incidents -> "Sự cố"
                    is RentalRoute.Incident -> "Chi tiết sự cố"
                },
                if (state.tenantMode) "Dữ liệu thuộc quan hệ thuê của bạn" else "Backend xác thực mọi thao tác nghiệp vụ",
            )
        }
        item {
            TextButton(onClick = {
                if (!model.back()) onExit()
            }) { Text("← Quay lại") }
        }
        if (state.busy) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth().testTag("rental-loading")) }
        if (state.error != null) item {
            V1Panel("Backend chưa xử lý được") {
                Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("rental-error"))
                V1Action("Tải lại", model::load, enabled = !state.busy)
            }
        }
        if (state.success != null) item { V1Panel("Đã xác nhận") { Text(state.success.orEmpty(), modifier = Modifier.testTag("rental-success")) } }
        when (route) {
            RentalRoute.Tenancies -> {
                if (!state.busy && state.tenancies.isEmpty()) item { V1Panel("Chưa có lượt thuê") { V1Pending() } }
                items(state.tenancies, key = { it.id }) { tenancy ->
                    V1Link(tenancy.id, tenancy.status, "tenancy-" + tenancy.id) {
                        model.open(RentalRoute.Tenancy(tenancy.id))
                    }
                }
                if (!state.tenantMode) item {
                    V1Panel("Tạo lượt thuê DRAFT") {
                        V1Pending("Backend từ chối nếu Room đang có DRAFT/ACTIVE/ENDING Tenancy.")
                        V1Action("Tạo Tenancy", { model.createTenancy(state.roomId) }, enabled = !state.busy)
                    }
                }
            }
            is RentalRoute.Tenancy -> {
                state.tenancy?.takeIf { it.id == route.id }?.let { tenancy ->
                    item {
                        V1Panel("Tenancy · " + tenancy.id) {
                            V1Metric("Trạng thái do Backend xác nhận", tenancy.status)
                            if (tenancy.startedAt != null) V1Metric("Bắt đầu", tenancy.startedAt)
                            if (tenancy.endedAt != null) V1Metric("Kết thúc", tenancy.endedAt)
                            if (!state.tenantMode && tenancy.status.equals("draft", true))
                                V1Action("Huỷ DRAFT", { model.transitionTenancy(route.id, "cancel") }, enabled = !state.busy)
                            if (tenancy.status.equals("active", true))
                                V1Action(if (state.tenantMode) "Yêu cầu bắt đầu trả phòng" else "Bắt đầu kết thúc Tenancy",
                                    { model.transitionTenancy(route.id, "ending") }, enabled = !state.busy)
                            if (!state.tenantMode && tenancy.status.equals("ending", true)) {
                                V1Action("Khôi phục ACTIVE", { model.transitionTenancy(route.id, "resume") }, enabled = !state.busy)
                                V1Pending("Checkout không được thực hiện trực tiếp từ ACTIVE.")
                                V1Choice(V1RentalGateway.CHECKOUT_REASONS.toList(), selected, { selected = it }, "Lý do kết thúc")
                                V1Action("Xác nhận checkout", {
                                    model.transitionTenancy(route.id, "checkout", selected)
                                }, enabled = !state.busy && selected.isNotBlank())
                            }
                            state.roomAfterCheckout?.let { room ->
                                V1Metric("Room sau checkout (GET Backend)", room.state)
                            }
                            if (!state.tenantMode) V1Action("Participants", { model.open(RentalRoute.Participants(route.id)) })
                            V1Action("Terms", { model.open(RentalRoute.Terms(route.id)) })
                            V1Action("Notices", { model.open(RentalRoute.Notices(route.id)) })
                            V1Action("Billing", { model.open(RentalRoute.Billing(route.id)) })
                            V1Action("Payment", { model.open(RentalRoute.Payment(route.id)) })
                            V1Action("Receipts", { model.open(RentalRoute.Receipts(route.id)) })
                            V1Action("Incidents / Tickets", { model.open(RentalRoute.Incidents(tenancy.roomId)) })
                            if (tenancy.status.equals("ended", true)) V1Pending("Tenancy đã kết thúc: chỉ đọc lịch sử, không ghi lifecycle mới.")
                            if (!state.tenantMode) V1Pending("Activate cần command context đã thống nhất; không đoán reasonCode/trigger.")
                        }
                    }
                }
            }
            is RentalRoute.Participants -> {
                items(state.participants, key = { it.id }) { participant ->
                    V1Panel(participant.role + " · " + participant.id) {
                        V1Metric("Linked User", participant.userId ?: "Chưa liên kết User")
                        V1Metric("Trạng thái", if (participant.leftAt == null) "Đang tham gia" else "Đã rời")
                        if (!state.tenantMode && participant.leftAt == null && participant.role == "OCCUPANT")
                            V1Action("Ghi nhận OCCUPANT rời", { model.leaveParticipant(route.id, participant) }, enabled = !state.busy)
                        if (!state.tenantMode && participant.userId == null && participant.leftAt == null) {
                            V1Input(name, { name = it }, "User ID cần liên kết", "participant-target-user")
                            V1Action("Liên kết User", {
                                model.linkParticipant(route.id, participant.id, name)
                            }, enabled = !state.busy && name.isNotBlank())
                        }
                    }
                }
                if (state.participants.isEmpty()) item { V1Panel("Participants") { V1Pending() } }
                if (!state.tenantMode) item {
                    V1Panel("Thêm Participant") {
                        V1Choice(listOf("PRIMARY", "OCCUPANT"), choice, { choice = it }, "Participant role")
                        V1Action("Thêm", { model.addParticipant(route.id, choice) }, enabled = !state.busy && choice.isNotBlank())
                        V1Pending("Không tự thay PRIMARY đang có; backend kiểm tra lifecycle và multiplicity.")
                    }
                }
            }
            is RentalRoute.Terms -> {
                if (state.terms.isEmpty() && !state.busy) item { V1Panel("Terms") { V1Pending() } }
                items(state.terms, key = { it.id }) { terms ->
                    V1Panel("Terms v" + terms.version) {
                        V1Metric("Rent", terms.rentAmount)
                        V1Metric("Cọc yêu cầu theo Terms", terms.depositRequirement)
                        V1Metric("Hiệu lực", terms.effectiveFrom)
                        Text("Từ ${terms.termStart} đến ${terms.termEnd}")
                    }
                }
                item { V1Panel("Terms acknowledgement") {
                    V1Pending("GET terms version khả dụng. POST acknowledgement cần định nghĩa server-derived actor/participant; không tạo cờ termsAccepted toàn Tenancy.")
                    V1Pending("Create Terms cần schema chi tiết cho rule objects trước khi xây editor.")
                } }
            }
            is RentalRoute.Notices -> {
                if (state.notices.isEmpty() && !state.busy) item { V1Panel("Notices") { V1Pending() } }
                items(state.notices, key = { it.id }) { notice ->
                    V1Panel(notice.type) {
                        Text(notice.content)
                        V1Metric("Đã phát", notice.issuedAt)
                        V1Metric("Xác nhận xem", notice.acknowledgedAt ?: "Chưa xác nhận")
                    }
                }
                item { V1Panel("Issuing / acknowledging") {
                    V1Pending("Các command hiện yêu cầu issuedByUserId/userId từ client. Chờ Backend derive identity; không giả mạo xác nhận pháp lý.")
                } }
            }
            is RentalRoute.Billing -> {
                if (state.billing.isEmpty() && !state.busy) item { V1Panel("Billing") { V1Pending("Chưa có Billing Cycle.") } }
                items(state.billing, key = { it.id }) { cycle ->
                    V1Panel("Billing · " + cycle.id) {
                        Text("Kỳ: ${cycle.from} → ${cycle.to}")
                        V1Metric("Terms version ID", cycle.termsId)
                        cycle.charges.forEach { V1Metric(it.type + " · " + it.id, it.amount) }
                    }
                }
                if (!state.tenantMode) item {
                    V1Panel("Tạo Billing Cycle") {
                        V1Input(name, { name = it }, "Terms ID", "billing-terms-id")
                        V1Input(extra, { extra = it }, "Kỳ bắt đầu (ISO)", "billing-from")
                        V1Input(extra2, { extra2 = it }, "Kỳ kết thúc (ISO)", "billing-to")
                        V1Choice(V1RentalGateway.CHARGE_TYPES.toList(), choice, { choice = it }, "Loại Charge")
                        V1Input(price, { price = it }, "Amount", "billing-amount")
                        V1Action("Tạo Billing Cycle", {
                            model.createBilling(route.id, name, extra, extra2, choice, price)
                        }, enabled = !state.busy && name.isNotBlank() && extra.isNotBlank() && extra2.isNotBlank() &&
                            choice.isNotBlank() && price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")))
                        V1Pending("Backend duy trì số tiền phải thu; không tự tính outstanding từ UI.")
                    }
                }
            }
            is RentalRoute.Payment -> {
                item {
                    V1Panel("Khoản phải thu") {
                        if (state.billing.isEmpty()) V1Pending("Chưa có Billing Cycle RENT/ELECTRICITY/WATER.")
                        state.billing.forEach { cycle ->
                            Text("Kỳ ${cycle.from} → ${cycle.to}", color = TroOiMuted)
                            cycle.charges.forEach { V1Metric(it.type, it.amount) }
                        }
                        V1Pending("Đây là Charge/phải thu. Cọc là dòng riêng; outstanding chỉ về 0 sau Payment đã allocate.")
                    }
                }
                item {
                    V1Panel("MoMo — kênh chuyển tiền") {
                        V1Pending("Mở MoMo hoặc bấm chuyển chưa phải Confirmed Payment.")
                        V1Input(price, { price = it }, "Số tiền chuyển (VND nguyên)", "momo-amount")
                        V1Action("Mở MoMo", {
                            model.createMomoCheckout(route.id, price)
                        }, enabled = !state.busy && price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")))
                        state.checkout?.let { session ->
                            V1Metric("Checkout", session.status)
                            V1Metric("Mã tham chiếu", session.referenceCode)
                            if (session.resultingPaymentId == null) {
                                V1Pending("Đang chờ xác nhận provider. Payment Claim vẫn chờ API riêng.")
                                V1Action("Làm mới trạng thái checkout", { model.refreshCheckout() }, enabled = !state.busy)
                            }
                        }
                    }
                }
                if (state.payments.isEmpty() && state.payment == null && !state.busy) {
                    item { V1Panel("Payment đã xác nhận") { V1Pending("Chưa có Payment. Checkout CREATED không xuất hiện ở đây.") } }
                }
                items(state.payments, key = { "pay-" + it.id }) { pay ->
                    V1Panel("Payment · " + pay.id) {
                        V1Metric("Confirmed amount", pay.amount)
                        V1Metric("Source", pay.source)
                        V1Metric("Verification", pay.verification)
                        V1Metric("Confirmed at", pay.confirmedAt)
                    }
                }
                item {
                    V1Panel("Tra cứu Payment") {
                        V1Input(name, { name = it }, "Payment ID", "payment-id")
                        V1Action("Mở Payment", { model.lookupPayment(name) }, enabled = !state.busy && name.isNotBlank())
                    }
                }
                state.payment?.takeIf { it.tenancyId == route.id }?.let { pay ->
                    item {
                        V1Panel("Payment · " + pay.id) {
                            V1Metric("Confirmed amount", pay.amount)
                            V1Metric("Source", pay.source)
                            V1Metric("Verification", pay.verification)
                            V1Metric("Confirmed at", pay.confirmedAt)
                            if (!state.tenantMode) {
                                V1Input(extra, { extra = it }, "Charge ID", "allocation-charge-id")
                                V1Input(extra2, { extra2 = it }, "Amount phân bổ", "allocation-amount")
                                V1Action("Phân bổ vào Charge", {
                                    model.allocate(pay.id, extra, extra2)
                                }, enabled = !state.busy && extra.isNotBlank() && extra2.isNotBlank())
                                V1Action("Phát hành Receipt", { model.issueReceipt(pay.id) }, enabled = !state.busy)
                            }
                            V1Pending("Deposit Application cần Deposit ID được Backend trả về; không đoán ID.")
                        }
                    }
                }
                if (!state.tenantMode) item {
                    V1Panel("Ghi nhận tiền đã nhận") {
                        V1Pending("Chỉ dùng khi tiền thực tế đã nhận; nhấn nút không phải gateway payment.")
                        V1Input(received, { received = it }, "Amount đã thực nhận", "payment-received-amount")
                        V1Choice(listOf("MANUAL_CASH", "MANUAL_TRANSFER"), choice, { choice = it }, "Nguồn tiền")
                        V1Action("Xác nhận đã nhận tiền", {
                            model.recordPayment(route.id, received, choice)
                        }, enabled = !state.busy && received.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")) && choice.isNotBlank())
                    }
                }
            }
            is RentalRoute.Receipts -> {
                if (state.receipts.isEmpty() && !state.busy) item { V1Panel("Receipts") { V1Pending("Chưa có Receipt được Backend cấp quyền.") } }
                items(state.receipts, key = { it.id }) { receipt ->
                    V1Panel("Receipt · " + receipt.id) {
                        V1Metric("Payment ID", receipt.paymentId)
                        V1Metric("Trạng thái", receipt.status)
                        V1Metric("Issued at", receipt.issuedAt)
                        if (receipt.voidedAt != null) V1Metric("Voided at", receipt.voidedAt)
                        if (!state.tenantMode && receipt.status == "ISSUED")
                            V1Action("Void Receipt", { model.voidReceipt(receipt.id) }, enabled = !state.busy)
                    }
                }
            }
            is RentalRoute.Incidents -> {
                if (state.incidents.isEmpty() && !state.busy) item { V1Panel("Incidents") { V1Pending("Chưa có Incident.") } }
                items(state.incidents, key = { it.id }) { incident ->
                    V1Link(incident.category, incident.status, "incident-" + incident.id) {
                        model.open(RentalRoute.Incident(incident.id, route.roomId))
                    }
                }
                item {
                    V1Panel("Báo Incident") {
                        V1Choice(V1RentalGateway.INCIDENT_CATEGORIES.toList(), choice, { choice = it }, "Danh mục")
                        V1Action("Gửi Incident", { model.reportIncident(route.roomId, choice) }, enabled = !state.busy && choice.isNotBlank())
                    }
                }
            }
            is RentalRoute.Incident -> {
                state.incident?.takeIf { it.id == route.id && it.roomId == route.roomId }?.let { incident ->
                    item {
                        V1Panel("Incident · " + incident.id) {
                            V1Metric("Danh mục", incident.category)
                            V1Metric("Status do Backend xác nhận", incident.status)
                            V1Metric("Created", incident.createdAt)
                            if (incident.closureReason != null) V1Metric("Closure reason", incident.closureReason)
                            if (!state.tenantMode) {
                                val targets = V1RentalGateway.INCIDENT_TRANSITIONS[incident.status].orEmpty().toList()
                                if (targets.isNotEmpty()) {
                                    V1Choice(targets, choice, { choice = it }, "Transition")
                                    V1Input(extra, { extra = it }, "Operator note (optional)", "incident-note")
                                    if (choice == "CLOSED") V1Input(extra2, { extra2 = it }, "Closure reason", "incident-closure")
                                    V1Action("Gửi transition", {
                                        model.transitionIncident(incident.id, choice, extra, extra2)
                                    }, enabled = !state.busy && choice.isNotBlank() &&
                                        (choice != "CLOSED" || incident.status == "RESOLVED" || extra2.isNotBlank()))
                                }
                            }
                            V1Pending("Event timeline cần Backend Incident Event API; chỉ hiển thị status server hiện cung cấp.")
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun V1Input(value: String, set: (String) -> Unit, title: String, tag: String) {
    OutlinedTextField(value = value, onValueChange = set, label = { Text(title) },
        modifier = Modifier.fillMaxWidth().testTag(tag), singleLine = true)
}
@Composable private fun V1Choice(values: List<String>, chosen: String, set: (String) -> Unit, title: String) {
    Text(title)
    values.sorted().forEach { item ->
        Row(Modifier.fillMaxWidth().clickable { set(item) }.padding(6.dp)) {
            RadioButton(selected = chosen == item, onClick = { set(item) })
            Spacer(Modifier.width(6.dp))
            Text(item, modifier = Modifier.padding(top = 12.dp))
        }
    }
}
@Composable private fun V1Link(title: String, subtitle: String, tag: String, onClick: () -> Unit) {
    V1Panel(title, modifier = Modifier.testTag(tag).clickable(onClick = onClick)) {
        Text(subtitle, color = TroOiMuted)
        Text("Mở →")
    }
}
