package com.trooi.app.features.tenancy

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.features.shared.*
import com.trooi.app.ui.components.*

/** Separate rental feature with dedicated route/state; backend is the sole business authority. */
@Composable
fun V1RentalWorkspace(
    roomId: String,
    linkedTenancyId: String? = null,
    entry: RentalRoute? = null,
    focusId: String? = null,
    onExit: () -> Unit,
    onUnauthorized: () -> Unit,
    model: RentalViewModel = hiltViewModel(),
) {
    val state by model.ui.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(roomId, linkedTenancyId, entry, focusId) { model.start(roomId, linkedTenancyId, entry, focusId) }
    DisposableEffect(Unit) { onDispose { model.reset() } }
    BackHandler(enabled = state.stack.size > 1) { model.back() }
    LaunchedEffect(state.errorKind) { if (state.errorKind == "AUTH_EXPIRED") onUnauthorized() }
    LaunchedEffect(state.checkoutLaunchUrl) {
        val url = state.checkoutLaunchUrl ?: return@LaunchedEffect
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        model.consumeLaunchUrl()
    }
    var name by remember(state.route) { mutableStateOf("") }
    var extra by remember(state.route) { mutableStateOf("") }
    var extra2 by remember(state.route) { mutableStateOf("") }
    var choice by remember(state.route) { mutableStateOf("") }
    var selected by remember(state.route) { mutableStateOf("") }
    var price by remember(state.route) {
        mutableStateOf(
            if (state.route is RentalRoute.Payment) state.checkoutIntent?.amount.orEmpty() else "",
        )
    }
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
            TroOiPageHeader(
                when (route) {
                    RentalRoute.Tenancies -> "Lượt thuê của phòng"
                    is RentalRoute.Tenancy -> "Chi tiết lượt thuê"
                    is RentalRoute.Participants -> "Người tham gia thuê"
                    is RentalRoute.Terms -> "Điều khoản theo phiên bản"
                    is RentalRoute.Notices -> "Thông báo theo lượt thuê đang chọn"
                    is RentalRoute.Billing -> "Kỳ tính tiền"
                    is RentalRoute.BillingDetail -> "Chi tiết kỳ tính tiền"
                    is RentalRoute.Payment -> "Khoản tiền đã nhận"
                    is RentalRoute.Deposit -> "Tiền cọc"
                    is RentalRoute.Receipts -> "Biên nhận"
                    is RentalRoute.ReceiptDetail -> "Chi tiết biên nhận"
                    is RentalRoute.History -> "Lịch sử lượt thuê"
                    is RentalRoute.Incidents -> "Sự cố"
                    is RentalRoute.Incident -> "Chi tiết sự cố"
                },
                if (state.tenantMode) "Thông tin về lượt thuê của bạn" else "Quản lý lượt thuê và các khoản liên quan",
            )
        }
        item {
            TroOiButton("← Quay lại", onClick = {
                if (!model.back()) onExit()
            }, style = TroOiButtonStyle.TERTIARY)
        }
        if (state.busy) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth().testTag("rental-loading")) }
        if (state.error != null) item {
            TroOiCard("Không thể hoàn thành yêu cầu") {
                Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("rental-error"))
                TroOiButton("Tải lại", model::load, enabled = !state.busy)
            }
        }
        if (state.success != null) item { TroOiCard("Đã xác nhận") { Text(state.success.orEmpty(), modifier = Modifier.testTag("rental-success")) } }
        when (route) {
            RentalRoute.Tenancies -> {
                if (!state.busy && state.tenancies.isEmpty()) item { TroOiCard("Chưa có lượt thuê") { TroOiFeedback("Đang chờ dữ liệu có phân quyền từ Backend.") } }
                items(state.tenancies, key = { it.id }) { tenancy ->
                    TroOiListRow(tenancy.id, tenancy.status, action = "Mở →", modifier = Modifier.testTag("tenancy-" + tenancy.id), onClick = {
                        model.open(RentalRoute.Tenancy(tenancy.id))
                    })
                }
                if (!state.tenantMode) item {
                    TroOiCard("Tạo lượt thuê mới") {
                        TroOiFeedback("Chỉ có thể tạo khi phòng chưa có lượt thuê đang hoạt động.")
                        TroOiButton("Tạo lượt thuê", { model.createTenancy(state.roomId) }, enabled = !state.busy)
                    }
                }
            }
            is RentalRoute.Tenancy -> {
                state.tenancy?.takeIf { it.id == route.id }?.let { tenancy ->
                    item {
                        TroOiCard("Lượt thuê") {
                            TroOiInformationRow("Trạng thái", tenancyStatusLabel(tenancy.status))
                            if (tenancy.startedAt != null) TroOiInformationRow("Bắt đầu", tenancy.startedAt)
                            if (tenancy.endedAt != null) TroOiInformationRow("Kết thúc", tenancy.endedAt)
                            if (!state.tenantMode && tenancy.status.equals("draft", true)) {
                                TroOiButton("Kích hoạt lượt thuê", { model.transitionTenancy(route.id, "activate") }, enabled = !state.busy)
                                TroOiButton("Huỷ bản nháp", { model.transitionTenancy(route.id, "cancel") }, enabled = !state.busy)
                            }
                            if (tenancy.status.equals("active", true))
                                TroOiButton(if (state.tenantMode) "Yêu cầu bắt đầu trả phòng" else "Bắt đầu kết thúc lượt thuê",
                                    { model.transitionTenancy(route.id, "ending") }, enabled = !state.busy)
                            if (!state.tenantMode && tenancy.status.equals("ending", true)) {
                                TroOiButton("Khôi phục lượt thuê", { model.transitionTenancy(route.id, "resume") }, enabled = !state.busy)
                                TroOiFeedback("Chỉ xác nhận trả phòng sau khi lượt thuê đã chuyển sang giai đoạn kết thúc.")
                                RentalChoice(V1RentalGateway.CHECKOUT_REASONS.toList(), selected, { selected = it }, "Lý do kết thúc")
                                TroOiButton("Xác nhận trả phòng", {
                                    model.transitionTenancy(route.id, "checkout", selected)
                                }, enabled = !state.busy && selected.isNotBlank())
                            }
                            state.roomAfterCheckout?.let { room ->
                                TroOiInformationRow("Trạng thái phòng sau trả phòng", roomStateLabel(room.state))
                            }
                            if (!state.tenantMode) TroOiButton("Người tham gia", { model.open(RentalRoute.Participants(route.id)) })
                            TroOiButton("Điều khoản", { model.open(RentalRoute.Terms(route.id)) })
                            TroOiButton("Thông báo", { model.open(RentalRoute.Notices(route.id)) })
                            TroOiButton("Khoản phải thu", { model.open(RentalRoute.Billing(route.id)) })
                            TroOiButton("Thanh toán", { model.open(RentalRoute.Payment(route.id)) })
                            TroOiButton("Tiền cọc", { model.open(RentalRoute.Deposit(route.id)) })
                            TroOiButton("Biên nhận", { model.open(RentalRoute.Receipts(route.id)) })
                            TroOiButton("Lịch sử", { model.open(RentalRoute.History(route.id)) })
                            TroOiButton("Sự cố", { model.open(RentalRoute.Incidents(tenancy.roomId)) })
                            if (tenancy.status.equals("ended", true)) TroOiFeedback("Lượt thuê đã kết thúc: bạn vẫn có thể xem lịch sử.")
                        }
                    }
                }
            }
            is RentalRoute.Participants -> {
                items(state.participants, key = { it.id }) { participant ->
                    TroOiCard(participant.role + " · " + participant.id) {
                        TroOiInformationRow("Tài khoản liên kết", participant.userId ?: "Chưa liên kết")
                        TroOiInformationRow("Trạng thái", if (participant.leftAt == null) "Đang tham gia" else "Đã rời")
                        if (!state.tenantMode && participant.leftAt == null && participant.role == "OCCUPANT")
                            TroOiButton("Ghi nhận người ở cùng đã rời", { model.leaveParticipant(route.id, participant) }, enabled = !state.busy)
                        if (!state.tenantMode && participant.userId == null && participant.leftAt == null) {
                            TroOiFormField(name, { name = it }, label = { Text("Mã tài khoản cần liên kết") }, modifier = Modifier.fillMaxWidth().testTag("participant-target-user"), singleLine = true)
                            TroOiButton("Liên kết tài khoản", {
                                model.linkParticipant(route.id, participant.id, name)
                            }, enabled = !state.busy && name.isNotBlank())
                        }
                    }
                }
                if (state.participants.isEmpty()) item { TroOiCard("Người tham gia") { TroOiFeedback("Chưa có người tham gia.") } }
                if (!state.tenantMode) item {
                    TroOiCard("Thêm người tham gia") {
                        RentalChoice(listOf("PRIMARY", "OCCUPANT"), choice, { choice = it }, "Vai trò")
                        TroOiButton("Thêm", { model.addParticipant(route.id, choice) }, enabled = !state.busy && choice.isNotBlank())
                        TroOiFeedback("Người thuê chính hiện tại không bị thay đổi tự động.")
                    }
                }
            }
            is RentalRoute.Terms -> {
                if (state.terms.isEmpty() && !state.busy) item { TroOiCard("Điều khoản") { TroOiFeedback("Chưa có điều khoản.") } }
                items(state.terms, key = { it.id }) { terms ->
                    TroOiCard("Điều khoản v" + terms.version) {
                        TroOiInformationRow("Tiền thuê", terms.rentAmount)
                        TroOiInformationRow("Mức cọc yêu cầu", terms.depositRequirement)
                        TroOiInformationRow("Hiệu lực", terms.effectiveFrom)
                        Text("Từ ${terms.termStart} đến ${terms.termEnd}")
                        val activeParticipants = state.participants.filter { it.leftAt == null }
                        if (tenantReadOnly) {
                            TroOiFeedback("Lượt thuê đã kết thúc: điều khoản chỉ có thể xem lại.")
                        } else if (activeParticipants.isNotEmpty()) {
                            RentalChoice(
                                activeParticipants.map { it.id },
                                selected,
                                { selected = it },
                                "Người xác nhận",
                            )
                            TroOiButton(
                                "Xác nhận điều khoản v${terms.version}",
                                { model.acknowledgeTerms(route.id, terms.id, selected) },
                                enabled = !state.busy && selected in activeParticipants.map { it.id },
                            )
                        } else {
                            TroOiFeedback("Chưa có người đang tham gia để xác nhận điều khoản.")
                        }
                    }
                }
                item {
                    TroOiCard("Chỉnh sửa điều khoản") {
                        TroOiFeedback("Tạo điều khoản mới chưa khả dụng ở phiên bản này.")
                    }
                }
            }
            is RentalRoute.Notices -> {
                if (state.notices.isEmpty() && !state.busy) item {
                    TroOiCard("Thông báo theo lượt thuê đang chọn") { TroOiFeedback("Chưa có thông báo cho lượt thuê đang chọn.") }
                }
                items(state.notices, key = { it.id }) { notice ->
                    TroOiCard(notice.type) {
                        Text(notice.content)
                        TroOiInformationRow("Đã phát", notice.issuedAt)
                        TroOiInformationRow("Xác nhận xem", notice.acknowledgedAt ?: "Chưa xác nhận")
                        if (notice.acknowledgedAt == null && !tenantReadOnly) {
                            TroOiButton(
                                "Xác nhận đã xem",
                                { model.acknowledgeNotice(route.id, notice.id) },
                                enabled = !state.busy,
                            )
                        }
                    }
                }
                if (!state.tenantMode) item {
                    TroOiCard("Tạo thông báo") {
                        TroOiFormField(name, { name = it }, label = { Text("Loại thông báo") }, modifier = Modifier.fillMaxWidth().testTag("notice-type"), singleLine = true)
                        TroOiFormField(extra, { extra = it }, label = { Text("Nội dung") }, modifier = Modifier.fillMaxWidth().testTag("notice-content"), singleLine = true)
                        TroOiButton(
                            "Phát hành thông báo",
                            { model.issueNotice(route.id, name, extra) },
                            enabled = !state.busy && name.isNotBlank() && extra.isNotBlank(),
                        )
                        TroOiFeedback("Backend tự xác định người phát hành; client không gửi issuedByUserId.")
                    }
                }
            }
            is RentalRoute.Billing, is RentalRoute.BillingDetail -> {
                if (state.billing.isEmpty() && !state.busy) {
                    item { TroOiCard("Kỳ thanh toán") { TroOiFeedback("Chưa có Billing Cycle.") } }
                }
                items(state.billing, key = { it.id }) { cycle ->
                    LedgerSectionTitle("Kỳ thanh toán", "${cycle.from} → ${cycle.to}")
                    LedgerStateLabel("Billing source · ${cycle.id}", LedgerTone.Warning)
                    Spacer(Modifier.height(8.dp))
                    TroOiInformationRow("Điều khoản áp dụng", cycle.termsId)
                    Spacer(Modifier.height(8.dp))
                    LedgerSectionTitle("Các khoản trong kỳ")
                    if (cycle.charges.isEmpty()) {
                        TroOiFeedback("Billing Cycle chưa có Charge.")
                    } else {
                        cycle.charges.forEach { charge ->
                            LedgerAttentionRow(
                                title = charge.type,
                                supporting = "Charge · ${charge.id}",
                                amount = charge.amount,
                                tone = if (charge.id == state.focusedChargeId) LedgerTone.Clay else LedgerTone.Warning,
                            )
                        }
                    }
                    LedgerDivider()
                }
                if (!state.tenantMode) item {
                    TroOiCard("Tạo Billing Cycle") {
                        TroOiFormField(name, { name = it }, label = { Text("Terms ID") }, modifier = Modifier.fillMaxWidth().testTag("billing-terms-id"), singleLine = true)
                        TroOiFormField(extra, { extra = it }, label = { Text("Kỳ bắt đầu (ISO)") }, modifier = Modifier.fillMaxWidth().testTag("billing-from"), singleLine = true)
                        TroOiFormField(extra2, { extra2 = it }, label = { Text("Kỳ kết thúc (ISO)") }, modifier = Modifier.fillMaxWidth().testTag("billing-to"), singleLine = true)
                        RentalChoice(V1RentalGateway.CHARGE_TYPES.toList(), choice, { choice = it }, "Loại Charge")
                        TroOiFormField(price, { price = it }, label = { Text("Amount") }, modifier = Modifier.fillMaxWidth().testTag("billing-amount"), singleLine = true)
                        TroOiButton("Tạo Billing Cycle", {
                            val tenancyId = (route as? RentalRoute.Billing)?.id
                                ?: (route as? RentalRoute.BillingDetail)?.tenancyId.orEmpty()
                            model.createBilling(tenancyId, name, extra, extra2, choice, price)
                        }, enabled = !state.busy && name.isNotBlank() && extra.isNotBlank() && extra2.isNotBlank() &&
                            choice.isNotBlank() && price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")))
                        TroOiFeedback("Backend duy trì nghĩa vụ phải thu; UI không tự tính aggregate/outstanding.")
                    }
                }
            }
            is RentalRoute.Payment -> {
                if (state.payments.isEmpty() && !state.busy) {
                    item { TroOiCard("Payments") { TroOiFeedback("Chưa có Payment theo Tenancy.") } }
                }
                items(state.payments, key = { "payment-" + it.id }) { pay ->
                    TroOiListRow(
                        "Payment · " + pay.id,
                        "${pay.amount} · ${pay.verification}",
                        action = "Mở →", modifier = Modifier.testTag("payment-" + pay.id),
                        onClick = { model.lookupPayment(pay.id) },
                    )
                }
                state.payment?.takeIf { it.tenancyId == route.id }?.let { pay ->
                    item {
                        TroOiCard("Payment · " + pay.id) {
                            TroOiInformationRow("Confirmed amount", pay.amount)
                            TroOiInformationRow("Source", pay.source)
                            TroOiInformationRow("Verification", pay.verification)
                            TroOiInformationRow("Confirmed at", pay.confirmedAt)
                            if (!state.tenantMode) {
                                TroOiFormField(extra, { extra = it }, label = { Text("Charge ID") }, modifier = Modifier.fillMaxWidth().testTag("allocation-charge-id"), singleLine = true)
                                TroOiFormField(extra2, { extra2 = it }, label = { Text("Amount phân bổ") }, modifier = Modifier.fillMaxWidth().testTag("allocation-amount"), singleLine = true)
                                TroOiButton("Phân bổ vào Charge", {
                                    model.allocate(pay.id, extra, extra2)
                                }, enabled = !state.busy && extra.isNotBlank() && extra2.isNotBlank())
                                TroOiButton("Phát hành Receipt", { model.issueReceipt(pay.id) }, enabled = !state.busy)
                                val deposit = state.deposit?.takeIf { it.tenancyId == pay.tenancyId }
                                var applyAmount by remember(pay.id) { mutableStateOf("") }
                                if (deposit == null) {
                                    TroOiFeedback("Chưa có Deposit của lượt thuê này để gán tiền.")
                                } else {
                                    TroOiInformationRow("Deposit của lượt thuê", deposit.id)
                                    TroOiFormField(applyAmount, { applyAmount = it }, label = { Text("Amount gán vào cọc") }, modifier = Modifier.fillMaxWidth().testTag("deposit-application-amount"), singleLine = true)
                                    TroOiButton(
                                        "Gán vào tiền cọc",
                                        { model.applyPaymentToDeposit(pay.id, deposit.id, applyAmount) },
                                        enabled = !state.busy && applyAmount.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")),
                                        modifier = Modifier.testTag("deposit-application-submit"),
                                    )
                                }
                            }
                        }
                    }
                }
                if (!state.tenantMode) item {
                    TroOiCard("Ghi nhận tiền đã nhận") {
                        TroOiFeedback("Chỉ dùng khi tiền thực tế đã nhận; nhấn nút không phải gateway payment.")
                        TroOiFormField(price, { price = it }, label = { Text("Amount đã thực nhận") }, modifier = Modifier.fillMaxWidth().testTag("payment-received-amount"), singleLine = true)
                        RentalChoice(listOf("MANUAL_CASH", "MANUAL_TRANSFER"), choice, { choice = it }, "Nguồn tiền")
                        TroOiButton("Xác nhận đã nhận tiền", {
                            model.recordPayment(route.id, price, choice)
                        }, enabled = !state.busy && price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")) && choice.isNotBlank())
                    }
                }
                if (state.tenantMode) item {
                    val tenancyStatus = state.linkedTenancyStatus ?: state.tenancy?.status
                    val checkout = state.gatewayCheckout
                    TroOiCard("Thanh toán MoMo (tuỳ chọn)") {
                        TroOiFeedback("Chỉ mở HTTPS payUrl đã được Backend xác minh. Liên kết quay về không phải bằng chứng đã trả.")
                        TroOiFormField(price, { price = it }, label = { Text("Amount VND (số nguyên .00)") }, modifier = Modifier.fillMaxWidth().testTag("gateway-checkout-amount"), singleLine = true)
                        TroOiButton(
                            "Tạo hoặc tiếp tục checkout",
                            { model.beginCheckout(route.id, price) },
                            enabled = !state.busy && validGatewayAmount(price.removeSuffix(".00") + ".00") &&
                                (canCreateGatewayCheckout(tenancyStatus) || state.checkoutIntent != null),
                        )
                        checkout?.let { chk ->
                            TroOiInformationRow("Checkout", chk.id)
                            TroOiInformationRow("Status", chk.status)
                            TroOiInformationRow(
                                "Replay",
                                if (chk.replayAllowed) "Được phép" else chk.replayBlockedReason ?: "Không được replay",
                            )
                            if (isConfirmedGatewayPayment(chk)) {
                                if (state.payments.any { it.id == chk.resultingPaymentId }) {
                                    TroOiFeedback("Payment ${chk.resultingPaymentId} đã có trong danh sách Backend.")
                                } else {
                                    TroOiFeedback("Checkout SUCCEEDED; Payment chỉ hiện khi Backend xác nhận trong danh sách.")
                                }
                            } else {
                                TroOiFeedback("Checkout chưa phải Payment. Không dùng resultCode trên URI.")
                            }
                            if (chk.replayAllowed) {
                                TroOiButton("Replay cùng Idempotency-Key", { model.replayCheckout() }, enabled = !state.busy)
                            }
                            TroOiButton("Làm mới từ Backend", { model.refreshGatewayCheckout() }, enabled = !state.busy)
                        }
                        if (manualCheckoutAvailable(checkout, state.checkoutCreateFailed)) {
                            TroOiFeedback("Kênh MoMo không khả dụng. Liên hệ người quản lý để ghi nhận tiền thủ công.")
                        }
                    }
                }
            }
            is RentalRoute.Deposit -> {
                val deposit = state.deposit
                if (deposit == null && !state.busy) {
                    item {
                        TroOiCard("Deposit") {
                            TroOiFeedback("Chưa có Deposit projection cho Tenancy này.")
                            if (!state.tenantMode) {
                                TroOiButton("Tạo Deposit", { model.createDeposit(route.id) }, enabled = !state.busy)
                            }
                        }
                    }
                }
                deposit?.let { value ->
                    item {
                        TroOiCard("Deposit · " + value.id) {
                            TroOiInformationRow("Yêu cầu theo Terms", value.requirementAmount ?: "Chưa có")
                            TroOiInformationRow("Funded", value.fundedAmount)
                            TroOiInformationRow("Settled", value.settledAmount)
                            TroOiInformationRow("Held", value.heldAmount)
                            TroOiInformationRow("State", value.state ?: "Chưa có")
                            TroOiInformationRow("Policy", if (value.blockedByOpenPolicy) "Settlement đang bị chặn" else "Có thể yêu cầu settlement")
                        }
                    }
                    if (state.depositEvents.isEmpty() && !state.busy) {
                        item { TroOiCard("Deposit events") { TroOiFeedback("Chưa có Deposit Event.") } }
                    }
                    items(state.depositEvents, key = { "deposit-event-" + it.id }) { event ->
                        TroOiCard(event.eventType) {
                            TroOiInformationRow("Amount", event.amount)
                            TroOiInformationRow("Occurred at", event.occurredAt)
                        }
                    }
                    if (!state.tenantMode) item {
                        TroOiCard("Deposit settlement") {
                            if (value.blockedByOpenPolicy) {
                                TroOiFeedback("Backend trả blockedByOpenPolicy=true; client không cho phép settlement.")
                            } else {
                                TroOiFormField(price, { price = it }, label = { Text("Refunded amount") }, modifier = Modifier.fillMaxWidth().testTag("deposit-refunded"), singleLine = true)
                                TroOiFormField(extra, { extra = it }, label = { Text("Retained amount") }, modifier = Modifier.fillMaxWidth().testTag("deposit-retained"), singleLine = true)
                                TroOiFormField(extra2, { extra2 = it }, label = { Text("Lý do / ghi chú") }, modifier = Modifier.fillMaxWidth().testTag("deposit-settlement-reason"), singleLine = true)
                                TroOiButton(
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
            is RentalRoute.Receipts, is RentalRoute.ReceiptDetail -> {
                if (state.receipts.isEmpty() && !state.busy) item { TroOiCard("Receipts") { TroOiFeedback("Chưa có Receipt được Backend cấp quyền.") } }
                items(state.receipts, key = { it.id }) { receipt ->
                    TroOiCard("Receipt · " + receipt.id) {
                        TroOiInformationRow("Payment ID", receipt.paymentId)
                        TroOiInformationRow("Trạng thái", receipt.status)
                        TroOiInformationRow("Issued at", receipt.issuedAt)
                        if (receipt.voidedAt != null) TroOiInformationRow("Voided at", receipt.voidedAt)
                        if (!state.tenantMode && receipt.status == "ISSUED")
                            TroOiButton("Void Receipt", { model.voidReceipt(receipt.id) }, enabled = !state.busy)
                    }
                }
            }
            is RentalRoute.History -> {
                state.history?.takeIf { it.tenancy.id == route.id }?.let { history ->
                    item {
                        TroOiCard("Tenancy · " + history.tenancy.id) {
                            TroOiInformationRow("Status", history.tenancy.status)
                            history.tenancy.startedAt?.let { TroOiInformationRow("Started", it) }
                            history.tenancy.endedAt?.let { TroOiInformationRow("Ended", it) }
                        }
                    }
                    if (history.terms.isNotEmpty()) item {
                        TroOiCard("Terms history") {
                            history.terms.forEach { term ->
                                TroOiInformationRow("v" + term.version, "${term.rentAmount} · ${term.effectiveFrom}")
                            }
                        }
                    }
                    if (history.payments.isNotEmpty()) item {
                        TroOiCard("Payment / Receipt history") {
                            history.payments.forEach { entry ->
                                TroOiInformationRow("Payment " + entry.payment.id, "${entry.payment.amount} · ${entry.payment.confirmedAt}")
                                entry.receipts.forEach { receipt ->
                                    Text("Receipt ${receipt.id} · ${receipt.status} · ${receipt.issuedAt}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    if (history.notices.isNotEmpty()) item {
                        TroOiCard("Notice history") {
                            history.notices.forEach { notice ->
                                TroOiInformationRow(notice.type, notice.issuedAt)
                            }
                        }
                    }
                    if (history.incidents.isNotEmpty()) item {
                        TroOiCard("Incident history") {
                            history.incidents.forEach { entry ->
                                TroOiInformationRow(entry.incident.category, entry.incident.status)
                                entry.events.forEach { event ->
                                    Text("${event.eventType} · ${event.occurredAt}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    history.deposit?.let { depositHistory ->
                        item {
                            TroOiCard("Deposit history") {
                                TroOiInformationRow("Funded", depositHistory.projection.fundedAmount)
                                TroOiInformationRow("Settled", depositHistory.projection.settledAmount)
                                TroOiInformationRow("Held", depositHistory.projection.heldAmount)
                                depositHistory.events.forEach { event ->
                                    Text("${event.eventType} · ${event.amount} · ${event.occurredAt}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    if (history.terms.isEmpty() && history.payments.isEmpty() && history.notices.isEmpty() &&
                        history.incidents.isEmpty() && history.deposit == null
                    ) {
                        item { TroOiCard("History") { TroOiFeedback("Backend chưa trả thêm sự kiện lịch sử cho Tenancy này.") } }
                    }
                }
            }
            is RentalRoute.Incidents -> {
                if (state.incidents.isEmpty() && !state.busy) item { TroOiCard("Incidents") { TroOiFeedback("Chưa có Incident.") } }
                items(state.incidents, key = { it.id }) { incident ->
                    TroOiListRow(incident.category, incident.status, action = "Mở →", modifier = Modifier.testTag("incident-" + incident.id), onClick = {
                        model.open(RentalRoute.Incident(incident.id, route.roomId))
                    })
                }
                if (!tenantReadOnly) item {
                    TroOiCard("Báo Incident") {
                        RentalChoice(V1RentalGateway.INCIDENT_CATEGORIES.toList(), choice, { choice = it }, "Danh mục")
                        TroOiButton("Gửi Incident", { model.reportIncident(route.roomId, choice) }, enabled = !state.busy && choice.isNotBlank())
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
                        TroOiInformationRow("Tạo lúc", incident.createdAt)
                        incident.closureReason?.let { TroOiInformationRow("Lý do đóng", it) }
                    }
                    item {
                        LedgerSectionTitle("Tiến trình xử lý", "IncidentEvent append-only từ Backend")
                        Spacer(Modifier.height(8.dp))
                        if (state.incidentEvents.isEmpty()) {
                            TroOiFeedback("Chưa có Incident Event.")
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
                                TroOiCard("Cập nhật xử lý") {
                                    RentalChoice(targets, choice, { choice = it }, "Transition Backend cho phép")
                                    TroOiFormField(extra, { extra = it }, label = { Text("Ghi chú operator (optional)") }, modifier = Modifier.fillMaxWidth().testTag("incident-note"), singleLine = true)
                                    if (choice == "CLOSED") {
                                        TroOiFormField(extra2, { extra2 = it }, label = { Text("Lý do đóng") }, modifier = Modifier.fillMaxWidth().testTag("incident-closure"), singleLine = true)
                                    }
                                    TroOiButton("Gửi cập nhật", {
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

@Composable private fun RentalChoice(values: List<String>, chosen: String, set: (String) -> Unit, title: String) {
    Text(title)
    Column(Modifier.selectableGroup()) {
        values.sorted().forEach { item ->
            Row(Modifier.fillMaxWidth().selectable(selected = chosen == item, role = Role.RadioButton, onClick = { set(item) })
                .heightIn(min = 48.dp).padding(6.dp), verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = chosen == item, onClick = null)
                Spacer(Modifier.width(6.dp))
                Text(item, modifier = Modifier.weight(1f))
            }
        }
    }
}


private fun tenancyStatusLabel(status: String): String = when (status.lowercase()) {
    "draft" -> "Bản nháp"
    "active" -> "Đang thuê"
    "ending" -> "Đang kết thúc"
    "ended" -> "Đã kết thúc"
    "cancelled" -> "Đã huỷ"
    else -> status
}

private fun roomStateLabel(state: String): String = when (state.lowercase()) {
    "occupied" -> "Có người thuê"
    "vacant" -> "Phòng trống"
    "maintenance" -> "Đang bảo trì"
    "inactive" -> "Ngừng sử dụng"
    else -> state
}
