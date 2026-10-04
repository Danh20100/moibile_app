package com.trooi.app.features.tenancy

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
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
    val route = state.route
    val tenantReadOnly = state.tenantMode && state.linkedTenancyStatus?.lowercase().let {
        it == "ended" || it == "cancelled"
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
                    is RentalRoute.Deposit -> "Tiền cọc"
                    is RentalRoute.Receipts -> "Biên nhận"
                    is RentalRoute.History -> "Lịch sử lượt thuê"
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
                            if (!state.tenantMode && tenancy.status.equals("draft", true)) {
                                V1Action("Kích hoạt Tenancy", { model.transitionTenancy(route.id, "activate") }, enabled = !state.busy)
                                V1Action("Huỷ DRAFT", { model.transitionTenancy(route.id, "cancel") }, enabled = !state.busy)
                            }
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
                            V1Action("Deposit", { model.open(RentalRoute.Deposit(route.id)) })
                            V1Action("Receipts", { model.open(RentalRoute.Receipts(route.id)) })
                            V1Action("History", { model.open(RentalRoute.History(route.id)) })
                            V1Action("Incidents / Tickets", { model.open(RentalRoute.Incidents(tenancy.roomId)) })
                            if (tenancy.status.equals("ended", true)) V1Pending("Tenancy đã kết thúc: chỉ đọc lịch sử, không ghi lifecycle mới.")
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
                        val activeParticipants = state.participants.filter { it.leftAt == null }
                        if (tenantReadOnly) {
                            V1Pending("Lượt thuê đã kết thúc: Terms chỉ đọc, không gửi acknowledgement mới.")
                        } else if (activeParticipants.isNotEmpty()) {
                            V1Choice(
                                activeParticipants.map { it.id },
                                selected,
                                { selected = it },
                                "Tenancy Participant xác nhận",
                            )
                            V1Action(
                                "Xác nhận Terms v${terms.version}",
                                { model.acknowledgeTerms(route.id, terms.id, selected) },
                                enabled = !state.busy && selected in activeParticipants.map { it.id },
                            )
                        } else {
                            V1Pending("Chưa có Tenancy Participant đang hoạt động để xác nhận Terms.")
                        }
                    }
                }
                item {
                    V1Panel("Terms editor") {
                        V1Pending("Create Terms vẫn chờ schema rule objects đầy đủ; không tự dựng điều khoản ở client.")
                    }
                }
            }
            is RentalRoute.Notices -> {
                if (state.notices.isEmpty() && !state.busy) item { V1Panel("Notices") { V1Pending() } }
                items(state.notices, key = { it.id }) { notice ->
                    V1Panel(notice.type) {
                        Text(notice.content)
                        V1Metric("Đã phát", notice.issuedAt)
                        V1Metric("Xác nhận xem", notice.acknowledgedAt ?: "Chưa xác nhận")
                        if (notice.acknowledgedAt == null && !tenantReadOnly) {
                            V1Action(
                                "Xác nhận đã xem",
                                { model.acknowledgeNotice(route.id, notice.id) },
                                enabled = !state.busy,
                            )
                        }
                    }
                }
                if (!state.tenantMode) item {
                    V1Panel("Phát hành Notice") {
                        V1Input(name, { name = it }, "Notice type theo contract", "notice-type")
                        V1Input(extra, { extra = it }, "Nội dung Notice", "notice-content")
                        V1Action(
                            "Phát hành Notice",
                            { model.issueNotice(route.id, name, extra) },
                            enabled = !state.busy && name.isNotBlank() && extra.isNotBlank(),
                        )
                        V1Pending("Backend tự xác định người phát hành; client không gửi issuedByUserId.")
                    }
                }
            }
            is RentalRoute.Billing -> {
                if (state.billing.isEmpty() && !state.busy) {
                    item { V1Panel("Kỳ thanh toán") { V1Pending("Chưa có Billing Cycle.") } }
                }
                items(state.billing, key = { it.id }) { cycle ->
                    LedgerSectionTitle("Kỳ thanh toán", "${cycle.from} → ${cycle.to}")
                    LedgerStateLabel("Billing source · ${cycle.id}", LedgerTone.Warning)
                    Spacer(Modifier.height(8.dp))
                    V1Metric("Điều khoản áp dụng", cycle.termsId)
                    Spacer(Modifier.height(8.dp))
                    LedgerSectionTitle("Các khoản trong kỳ")
                    if (cycle.charges.isEmpty()) {
                        V1Pending("Billing Cycle chưa có Charge.")
                    } else {
                        cycle.charges.forEach { charge ->
                            LedgerAttentionRow(
                                title = charge.type,
                                supporting = "Charge · ${charge.id}",
                                amount = charge.amount,
                                tone = LedgerTone.Warning,
                            )
                        }
                    }
                    LedgerDivider()
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
                        V1Pending("Backend duy trì nghĩa vụ phải thu; UI không tự tính aggregate/outstanding.")
                    }
                }
            }
            is RentalRoute.Payment -> {
                if (state.payments.isEmpty() && !state.busy) {
                    item { V1Panel("Payments") { V1Pending("Chưa có Payment theo Tenancy.") } }
                }
                items(state.payments, key = { "payment-" + it.id }) { pay ->
                    V1Link(
                        "Payment · " + pay.id,
                        "${pay.amount} · ${pay.verification}",
                        "payment-" + pay.id,
                    ) { model.lookupPayment(pay.id) }
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
                        }
                    }
                }
                if (!state.tenantMode) item {
                    V1Panel("Ghi nhận tiền đã nhận") {
                        V1Pending("Chỉ dùng khi tiền thực tế đã nhận; nhấn nút không phải gateway payment.")
                        V1Input(price, { price = it }, "Amount đã thực nhận", "payment-received-amount")
                        V1Choice(listOf("MANUAL_CASH", "MANUAL_TRANSFER"), choice, { choice = it }, "Nguồn tiền")
                        V1Action("Xác nhận đã nhận tiền", {
                            model.recordPayment(route.id, price, choice)
                        }, enabled = !state.busy && price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")) && choice.isNotBlank())
                    }
                }
            }
            is RentalRoute.Deposit -> {
                val deposit = state.deposit
                if (deposit == null && !state.busy) {
                    item {
                        V1Panel("Deposit") {
                            V1Pending("Chưa có Deposit projection cho Tenancy này.")
                            if (!state.tenantMode) {
                                V1Action("Tạo Deposit", { model.createDeposit(route.id) }, enabled = !state.busy)
                            }
                        }
                    }
                }
                deposit?.let { value ->
                    item {
                        V1Panel("Deposit · " + value.id) {
                            V1Metric("Yêu cầu theo Terms", value.requirementAmount ?: "Chưa có")
                            V1Metric("Funded", value.fundedAmount)
                            V1Metric("Settled", value.settledAmount)
                            V1Metric("Held", value.heldAmount)
                            V1Metric("State", value.state ?: "Chưa có")
                            V1Metric("Policy", if (value.blockedByOpenPolicy) "Settlement đang bị chặn" else "Có thể yêu cầu settlement")
                        }
                    }
                    if (state.depositEvents.isEmpty() && !state.busy) {
                        item { V1Panel("Deposit events") { V1Pending("Chưa có Deposit Event.") } }
                    }
                    items(state.depositEvents, key = { "deposit-event-" + it.id }) { event ->
                        V1Panel(event.eventType) {
                            V1Metric("Amount", event.amount)
                            V1Metric("Occurred at", event.occurredAt)
                        }
                    }
                    if (!state.tenantMode) item {
                        V1Panel("Deposit settlement") {
                            if (value.blockedByOpenPolicy) {
                                V1Pending("Backend trả blockedByOpenPolicy=true; client không cho phép settlement.")
                            } else {
                                V1Input(price, { price = it }, "Refunded amount", "deposit-refunded")
                                V1Input(extra, { extra = it }, "Retained amount", "deposit-retained")
                                V1Input(extra2, { extra2 = it }, "Lý do / ghi chú", "deposit-settlement-reason")
                                V1Action(
                                    "Gửi settlement",
                                    { model.settleDeposit(route.id, price, extra, extra2) },
                                    enabled = !state.busy &&
                                        price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")) &&
                                        extra.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")) &&
                                        extra2.isNotBlank(),
                                )
                            }
                        }
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
            is RentalRoute.History -> {
                state.history?.takeIf { it.tenancy.id == route.id }?.let { history ->
                    item {
                        V1Panel("Tenancy · " + history.tenancy.id) {
                            V1Metric("Status", history.tenancy.status)
                            history.tenancy.startedAt?.let { V1Metric("Started", it) }
                            history.tenancy.endedAt?.let { V1Metric("Ended", it) }
                        }
                    }
                    if (history.terms.isNotEmpty()) item {
                        V1Panel("Terms history") {
                            history.terms.forEach { term ->
                                V1Metric("v" + term.version, "${term.rentAmount} · ${term.effectiveFrom}")
                            }
                        }
                    }
                    if (history.payments.isNotEmpty()) item {
                        V1Panel("Payment / Receipt history") {
                            history.payments.forEach { entry ->
                                V1Metric("Payment " + entry.payment.id, "${entry.payment.amount} · ${entry.payment.confirmedAt}")
                                entry.receipts.forEach { receipt ->
                                    Text("Receipt ${receipt.id} · ${receipt.status} · ${receipt.issuedAt}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    if (history.notices.isNotEmpty()) item {
                        V1Panel("Notice history") {
                            history.notices.forEach { notice ->
                                V1Metric(notice.type, notice.issuedAt)
                            }
                        }
                    }
                    if (history.incidents.isNotEmpty()) item {
                        V1Panel("Incident history") {
                            history.incidents.forEach { entry ->
                                V1Metric(entry.incident.category, entry.incident.status)
                                entry.events.forEach { event ->
                                    Text("${event.eventType} · ${event.occurredAt}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    history.deposit?.let { depositHistory ->
                        item {
                            V1Panel("Deposit history") {
                                V1Metric("Funded", depositHistory.projection.fundedAmount)
                                V1Metric("Settled", depositHistory.projection.settledAmount)
                                V1Metric("Held", depositHistory.projection.heldAmount)
                                depositHistory.events.forEach { event ->
                                    Text("${event.eventType} · ${event.amount} · ${event.occurredAt}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    if (history.terms.isEmpty() && history.payments.isEmpty() && history.notices.isEmpty() &&
                        history.incidents.isEmpty() && history.deposit == null
                    ) {
                        item { V1Panel("History") { V1Pending("Backend chưa trả thêm sự kiện lịch sử cho Tenancy này.") } }
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
                if (!tenantReadOnly) item {
                    V1Panel("Báo Incident") {
                        V1Choice(V1RentalGateway.INCIDENT_CATEGORIES.toList(), choice, { choice = it }, "Danh mục")
                        V1Action("Gửi Incident", { model.reportIncident(route.roomId, choice) }, enabled = !state.busy && choice.isNotBlank())
                    }
                }
            }
            is RentalRoute.Incident -> {
                state.incident?.takeIf { it.id == route.id && it.roomId == route.roomId }?.let { incident ->
                    item {
                        LedgerSectionTitle(incident.category, "Incident · ${incident.id}")
                        Spacer(Modifier.height(8.dp))
                        LedgerStateLabel(
                            incident.status,
                            tone = if (incident.status == "RESOLVED" || incident.status == "CLOSED") {
                                LedgerTone.Success
                            } else {
                                LedgerTone.Warning
                            },
                        )
                        Spacer(Modifier.height(8.dp))
                        V1Metric("Tạo lúc", incident.createdAt)
                        incident.closureReason?.let { V1Metric("Lý do đóng", it) }
                    }
                    item {
                        LedgerSectionTitle("Tiến trình xử lý", "IncidentEvent append-only từ Backend")
                        Spacer(Modifier.height(8.dp))
                        if (state.incidentEvents.isEmpty()) {
                            V1Pending("Chưa có Incident Event.")
                        } else {
                            state.incidentEvents.forEach { event ->
                                val transition = if (event.fromStatus != null || event.toStatus != null) {
                                    "${event.fromStatus ?: "-"} → ${event.toStatus ?: "-"}"
                                } else {
                                    event.eventType
                                }
                                LedgerHistoryEvent(
                                    source = "Sự cố",
                                    title = transition,
                                    occurredAt = event.occurredAt,
                                    supporting = event.note?.takeIf { it.isNotBlank() },
                                )
                            }
                        }
                    }
                    if (!state.tenantMode) {
                        item {
                            val targets = V1RentalGateway.INCIDENT_TRANSITIONS[incident.status].orEmpty().toList()
                            if (targets.isNotEmpty()) {
                                V1Panel("Cập nhật xử lý") {
                                    V1Choice(targets, choice, { choice = it }, "Transition Backend cho phép")
                                    V1Input(extra, { extra = it }, "Ghi chú operator (optional)", "incident-note")
                                    if (choice == "CLOSED") {
                                        V1Input(extra2, { extra2 = it }, "Lý do đóng", "incident-closure")
                                    }
                                    V1Action("Gửi cập nhật", {
                                        model.transitionIncident(incident.id, choice, extra, extra2)
                                    }, enabled = !state.busy && choice.isNotBlank() &&
                                        (choice != "CLOSED" || incident.status == "RESOLVED" || extra2.isNotBlank()))
                                }
                            }
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
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Mở →")
    }
}
