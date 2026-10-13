package com.trooi.app.features.tenant

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*

private fun linkedRentals(state: TroOiUiState): List<TenancyCard> =
    scopedTenancies(state.read, state.access, state.selectedContext)

private fun TenancyLifecycle.label(): String = when (this) {
    TenancyLifecycle.DRAFT -> "Lượt thuê đang chuẩn bị"
    TenancyLifecycle.ACTIVE -> "Lượt thuê đang hoạt động"
    TenancyLifecycle.ENDING -> "Lượt thuê đang kết thúc"
    TenancyLifecycle.ENDED -> "Lượt thuê đã kết thúc"
    TenancyLifecycle.CANCELLED -> "Lượt thuê đã hủy"
}

@Composable
fun V1TenantHomeScreen(
    state: TroOiUiState,
    onRental: () -> Unit,
    onFinance: () -> Unit,
    onIncidents: () -> Unit,
    onContextSwitcher: () -> Unit,
    onOpenSource: (SourceTarget) -> Unit = {},
) {
    val rentals = linkedRentals(state)
    val current = rentals.singleOrNull()
    val finance = current?.let { state.read.tenantFinanceByTenancy[it.tenancyId] }
    val roomIds = rentals.mapTo(mutableSetOf()) { it.roomId }
    val incidents = state.read.incidents.filter { it.roomId in roomIds }
    val notices = current?.let { state.read.noticesByTenancy[it.tenancyId].orEmpty() }.orEmpty()
    val outstanding = finance?.charges?.firstOrNull()?.outstandingLabel
        ?: finance?.charges?.firstOrNull()?.amountLabel
    val paidUp = outstanding == "0.00" || outstanding == "0"

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-pov-home"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { TroOiPageHeader("Nhà của tôi", current?.roomLabel ?: "Không gian người thuê") }
        item {
            TroOiButton(
                "Chuyển không gian",
                onContextSwitcher,
                modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
        }
        if (current == null) {
            item {
                TroOiCard("Chưa có lượt thuê") {
                    TroOiFeedback("Tài khoản chưa có lượt thuê nào.")
                }
            }
        } else {
            item {
                RoomLedgerPlate(
                    roomLabel = current.roomLabel,
                    contextLabel = "Nhà của tôi",
                    stateLabel = current.lifecycle.label(),
                )
            }
            item {
                LedgerSectionTitle("Hôm nay cần chú ý")
                Spacer(Modifier.height(10.dp))
                LedgerMoney(
                    amount = outstanding ?: "Chưa có khoản phải thu",
                    context = if (finance?.charges.isNullOrEmpty()) {
                        "Chưa có khoản phải thu cho lượt thuê này."
                    } else if (paidUp) {
                        "Đã thanh toán đủ khoản hiện tại."
                    } else {
                        "Khoản cần thanh toán hiện tại."
                    },
                    tone = when {
                        outstanding == null -> LedgerTone.Neutral
                        paidUp -> LedgerTone.Success
                        else -> LedgerTone.Warning
                    },
                )
                Spacer(Modifier.height(10.dp))
                TroOiButton("Xem thanh toán", onFinance, modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
            }
            if (incidents.isNotEmpty()) {
                item {
                    LedgerDivider()
                    LedgerAttentionRow(
                        title = incidents.first().title,
                        supporting = "Sự cố · ${incidents.first().lifecycle.name}",
                        tone = LedgerTone.Warning,
                        onClick = {
                            val incident = incidents.first()
                            onOpenSource(
                                SourceTarget(
                                    "INCIDENT",
                                    incident.incidentId,
                                    tenancyId = current.tenancyId,
                                    roomId = incident.roomId,
                                ),
                            )
                        },
                    )
                    TroOiButton("Theo dõi sự cố", onIncidents, modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
                }
            }
            if (notices.isNotEmpty()) {
                item {
                    LedgerDivider()
                    LedgerAttentionRow(
                        title = notices.first().type,
                        supporting = notices.first().content,
                        tone = if (notices.first().acknowledgedAtLabel == null) LedgerTone.Clay else LedgerTone.Neutral,
                    )
                }
            }
            item {
                LedgerDivider()
                LedgerSectionTitle("Thanh toán gần nhất")
                Spacer(Modifier.height(8.dp))
                val payment = finance?.payments?.firstOrNull()
                if (payment == null) {
                    TroOiFeedback("Chưa có khoản thanh toán nào được ghi nhận.")
                } else {
                    LedgerAttentionRow(
                        title = payment.amountLabel,
                        supporting = payment.confirmationLabel ?: "Chưa có trạng thái xác nhận",
                        tone = LedgerTone.Success,
                        onClick = {
                            onOpenSource(SourceTarget("PAYMENT", payment.paymentId, tenancyId = current.tenancyId))
                        },
                    )
                }
            }
            item {
                TroOiButton("Mở hồ sơ Nhà tôi", onRental, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
fun V1TenantFinanceScreen(
    state: TroOiUiState,
    onRental: () -> Unit,
    onOpenSource: (SourceTarget) -> Unit = {},
) {
    val rentals = linkedRentals(state)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-pov-finance"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            TroOiPageHeader(
                "Thanh toán",
                "Theo dõi khoản phải thu, tiền đã nhận, tiền cọc và biên nhận.",
            )
        }
        if (rentals.isEmpty()) {
            item { TroOiCard("Chưa có dữ liệu") { TroOiFeedback("Tài khoản chưa có lượt thuê.") } }
        }
        items(rentals, key = { "tenant-finance-" + it.tenancyId }) { tenancy ->
            val finance = state.read.tenantFinanceByTenancy[tenancy.tenancyId]
            val primaryCharge = finance?.charges?.firstOrNull()
            val remaining = primaryCharge?.outstandingLabel ?: primaryCharge?.amountLabel
            val paidUp = remaining == "0.00" || remaining == "0"
            RoomLedgerPlate(
                roomLabel = tenancy.roomLabel,
                contextLabel = "Thanh toán",
                stateLabel = tenancy.lifecycle.label(),
            )
            Spacer(Modifier.height(12.dp))
            LedgerMoney(
                amount = remaining ?: "Chưa có khoản phải thu",
                context = if (paidUp) "Đã thanh toán đủ khoản hiện tại" else "Khoản cần thanh toán hiện tại",
                tone = when {
                    primaryCharge == null -> LedgerTone.Neutral
                    paidUp -> LedgerTone.Success
                    else -> LedgerTone.Warning
                },
            )
            Spacer(Modifier.height(12.dp))
            LedgerSectionTitle("Các khoản trong kỳ")
            if (finance?.charges.isNullOrEmpty()) {
                TroOiFeedback("Chưa có khoản phải thu.")
            } else {
                finance!!.charges.forEach { charge ->
                    LedgerAttentionRow(
                        title = charge.label,
                        supporting = charge.outstandingLabel ?: "Chưa có số tiền còn phải trả",
                        amount = charge.amountLabel,
                        tone = LedgerTone.Warning,
                        onClick = {
                            onOpenSource(SourceTarget("CHARGE", charge.chargeId, tenancyId = tenancy.tenancyId))
                        },
                    )
                }
            }
            LedgerDivider()
            LedgerSectionTitle("Tiền đã nhận")
            if (finance?.payments.isNullOrEmpty()) {
                TroOiFeedback("Chưa có khoản thanh toán được xác nhận.")
            } else {
                finance!!.payments.forEach { payment ->
                    LedgerAttentionRow(
                        title = payment.amountLabel,
                        supporting = payment.confirmationLabel ?: "Đã ghi nhận thanh toán",
                        tone = LedgerTone.Success,
                        onClick = {
                            onOpenSource(SourceTarget("PAYMENT", payment.paymentId, tenancyId = tenancy.tenancyId))
                        },
                    )
                }
            }
            LedgerDivider()
            LedgerSectionTitle("Tiền cọc")
            val deposit = finance?.deposits?.firstOrNull()
            if (deposit == null) {
                TroOiFeedback("Chưa có thông tin tiền cọc.")
            } else {
                TroOiInformationRow("Mức cọc yêu cầu", deposit.requiredLabel ?: "Chưa có")
                TroOiInformationRow("Đã nộp", deposit.fundedLabel ?: "Chưa có")
                TroOiInformationRow("Đang được giữ", deposit.heldLabel ?: "Chưa có")
                LedgerStateLabel(deposit.state ?: "Chưa có trạng thái", LedgerTone.Neutral)
            }
            LedgerDivider()
            LedgerSectionTitle("Biên nhận")
            if (finance?.receipts.isNullOrEmpty()) {
                TroOiFeedback("Chưa có biên nhận.")
            } else {
                finance!!.receipts.forEach { receipt ->
                    LedgerAttentionRow(
                        title = "Biên nhận ${receipt.receiptId}",
                        supporting = receipt.issuedAtLabel,
                        tone = LedgerTone.Neutral,
                        onClick = {
                            onOpenSource(SourceTarget("RECEIPT", receipt.receiptId, tenancyId = tenancy.tenancyId))
                        },
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            TroOiButton("Mở hồ sơ Nhà tôi", onRental, modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
        }
    }
}

@Composable
fun V1TenantIncidentsScreen(
    state: TroOiUiState,
    onRental: () -> Unit,
    onOpenSource: (SourceTarget) -> Unit = {},
) {
    val rentals = linkedRentals(state)
    val roomIds = rentals.mapTo(mutableSetOf()) { it.roomId }
    val incidents = state.read.incidents.filter { it.roomId in roomIds }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-pov-incidents"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { TroOiPageHeader("Sự cố", "Theo dõi trạng thái và lịch sử xử lý") }
        if (incidents.isEmpty()) {
            item { TroOiCard("Không có sự cố") { TroOiFeedback("Chưa có sự cố trong phòng của bạn.") } }
        } else {
            items(incidents, key = { "tenant-incident-" + it.incidentId }) { incident ->
                LedgerAttentionRow(
                    title = incident.title,
                    supporting = incident.lifecycle.name,
                    tone = LedgerTone.Warning,
                    onClick = {
                        val tenancyId = rentals.firstOrNull { it.roomId == incident.roomId }?.tenancyId
                        onOpenSource(SourceTarget("INCIDENT", incident.incidentId, tenancyId = tenancyId, roomId = incident.roomId))
                    },
                )
                LedgerStateLabel(
                    incident.lifecycle.name,
                    tone = if (incident.lifecycle == IncidentLifecycle.RESOLVED || incident.lifecycle == IncidentLifecycle.CLOSED) {
                        LedgerTone.Success
                    } else {
                        LedgerTone.Warning
                    },
                )
                Spacer(Modifier.height(8.dp))
                if (incident.timeline.isEmpty()) {
                    TroOiFeedback("Chưa có cập nhật xử lý.")
                } else {
                    incident.timeline.forEach { event ->
                        LedgerHistoryEvent(
                            source = "Sự cố",
                            title = event.description,
                            occurredAt = event.occurredAtLabel,
                        )
                    }
                }
                LedgerDivider()
            }
        }
        item {
            TroOiCard("Báo hoặc xem chi tiết") {
                TroOiFeedback(
                    "Mở Nhà tôi để xem chi tiết hoặc gửi cập nhật.",
                )
                TroOiButton("Mở Nhà tôi", onRental, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}