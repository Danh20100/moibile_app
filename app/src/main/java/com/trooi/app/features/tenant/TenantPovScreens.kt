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
    state.read.tenancies.filter { it.tenancyId in state.access.linkedTenancyIds }

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
) {
    val rentals = linkedRentals(state)
    val current = rentals.firstOrNull {
        it.lifecycle == TenancyLifecycle.ACTIVE || it.lifecycle == TenancyLifecycle.ENDING
    } ?: rentals.firstOrNull()
    val finance = current?.let { state.read.tenantFinanceByTenancy[it.tenancyId] }
    val roomIds = rentals.mapTo(mutableSetOf()) { it.roomId }
    val incidents = state.read.incidents.filter { it.roomId in roomIds }
    val notices = current?.let { state.read.noticesByTenancy[it.tenancyId].orEmpty() }.orEmpty()
    val outstanding = finance?.charges?.firstOrNull()?.outstandingLabel
        ?: finance?.charges?.firstOrNull()?.amountLabel

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-pov-home"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Nhà của tôi", current?.roomLabel ?: "Không gian người thuê") }
        item {
            V1SecondaryAction(
                "Chuyển không gian",
                onContextSwitcher,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (current == null) {
            item {
                V1Panel("Chưa có lượt thuê") {
                    V1Pending("Tài khoản chưa có lượt thuê nào.")
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
                    } else {
                        "Khoản cần thanh toán hiện tại."
                    },
                    tone = if (outstanding == null) LedgerTone.Neutral else LedgerTone.Warning,
                )
                Spacer(Modifier.height(10.dp))
                V1SecondaryAction("Xem thanh toán", onFinance, modifier = Modifier.fillMaxWidth())
            }
            if (incidents.isNotEmpty()) {
                item {
                    LedgerDivider()
                    LedgerAttentionRow(
                        title = incidents.first().title,
                        supporting = "Sự cố · ${incidents.first().lifecycle.name}",
                        tone = LedgerTone.Warning,
                    )
                    V1SecondaryAction("Theo dõi sự cố", onIncidents, modifier = Modifier.fillMaxWidth())
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
                    V1Pending("Chưa có khoản thanh toán nào được ghi nhận.")
                } else {
                    LedgerAttentionRow(
                        title = payment.amountLabel,
                        supporting = payment.confirmationLabel ?: "Chưa có trạng thái xác nhận",
                        tone = LedgerTone.Success,
                    )
                }
            }
            item {
                V1Action("Mở hồ sơ Nhà tôi", onRental, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
fun V1TenantFinanceScreen(state: TroOiUiState, onRental: () -> Unit) {
    val rentals = linkedRentals(state)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-pov-finance"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            V1PageTitle(
                "Thanh toán",
                "Theo dõi khoản phải thu, tiền đã nhận, tiền cọc và biên nhận.",
            )
        }
        if (rentals.isEmpty()) {
            item { V1Panel("Chưa có dữ liệu") { V1Pending("Tài khoản chưa có lượt thuê.") } }
        }
        items(rentals, key = { "tenant-finance-" + it.tenancyId }) { tenancy ->
            val finance = state.read.tenantFinanceByTenancy[tenancy.tenancyId]
            val primaryCharge = finance?.charges?.firstOrNull()
            RoomLedgerPlate(
                roomLabel = tenancy.roomLabel,
                contextLabel = "Thanh toán",
                stateLabel = tenancy.lifecycle.label(),
            )
            Spacer(Modifier.height(12.dp))
            LedgerMoney(
                amount = primaryCharge?.outstandingLabel ?: primaryCharge?.amountLabel ?: "Chưa có khoản phải thu",
                context = "Khoản cần thanh toán hiện tại",
                tone = if (primaryCharge == null) LedgerTone.Neutral else LedgerTone.Warning,
            )
            Spacer(Modifier.height(12.dp))
            LedgerSectionTitle("Các khoản trong kỳ")
            if (finance?.charges.isNullOrEmpty()) {
                V1Pending("Chưa có khoản phải thu.")
            } else {
                finance!!.charges.forEach { charge ->
                    LedgerAttentionRow(
                        title = charge.label,
                        supporting = charge.outstandingLabel ?: "Chưa có số tiền còn phải trả",
                        amount = charge.amountLabel,
                        tone = LedgerTone.Warning,
                    )
                }
            }
            LedgerDivider()
            LedgerSectionTitle("Tiền đã nhận")
            if (finance?.payments.isNullOrEmpty()) {
                V1Pending("Chưa có khoản thanh toán được xác nhận.")
            } else {
                finance!!.payments.forEach { payment ->
                    LedgerAttentionRow(
                        title = payment.amountLabel,
                        supporting = payment.confirmationLabel ?: "Đã ghi nhận thanh toán",
                        tone = LedgerTone.Success,
                    )
                }
            }
            LedgerDivider()
            LedgerSectionTitle("Tiền cọc")
            val deposit = finance?.deposits?.firstOrNull()
            if (deposit == null) {
                V1Pending("Chưa có thông tin tiền cọc.")
            } else {
                V1Metric("Mức cọc yêu cầu", deposit.requiredLabel ?: "Chưa có")
                V1Metric("Đã nộp", deposit.fundedLabel ?: "Chưa có")
                V1Metric("Đang được giữ", deposit.heldLabel ?: "Chưa có")
                LedgerStateLabel(deposit.state ?: "Chưa có trạng thái", LedgerTone.Neutral)
            }
            LedgerDivider()
            LedgerSectionTitle("Biên nhận")
            if (finance?.receipts.isNullOrEmpty()) {
                V1Pending("Chưa có biên nhận.")
            } else {
                finance!!.receipts.forEach { receipt ->
                    LedgerAttentionRow(
                        title = "Biên nhận ${receipt.receiptId}",
                        supporting = receipt.issuedAtLabel,
                        tone = LedgerTone.Neutral,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            V1SecondaryAction("Mở hồ sơ Nhà tôi", onRental, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
fun V1TenantIncidentsScreen(state: TroOiUiState, onRental: () -> Unit) {
    val rentals = linkedRentals(state)
    val roomIds = rentals.mapTo(mutableSetOf()) { it.roomId }
    val incidents = state.read.incidents.filter { it.roomId in roomIds }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-pov-incidents"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Sự cố", "Theo dõi trạng thái và lịch sử xử lý") }
        if (incidents.isEmpty()) {
            item { V1Panel("Không có sự cố") { V1Pending("Chưa có sự cố trong phòng của bạn.") } }
        } else {
            items(incidents, key = { "tenant-incident-" + it.incidentId }) { incident ->
                LedgerSectionTitle(incident.title)
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
                    V1Pending("Chưa có cập nhật xử lý.")
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
            V1Panel("Báo hoặc xem chi tiết") {
                V1Pending(
                    "Mở Nhà tôi để xem chi tiết hoặc gửi cập nhật.",
                )
                V1Action("Mở Nhà tôi", onRental, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}