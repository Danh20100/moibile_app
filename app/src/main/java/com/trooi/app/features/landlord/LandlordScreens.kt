package com.trooi.app.features.landlord

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*

@Composable
fun V1OwnerDashboardScreen(state: TroOiUiState) {
    val organizations = state.read.organizations.filter { it.organizationId in state.access.operatedOrganizationIds }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-dashboard"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Tổng quan", "Không gian vận hành · source-backed dashboard") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (organizations.isEmpty()) {
            item { V1Panel("Không gian vận hành") { V1Pending("Tài khoản chưa được liên kết với Organization.") } }
        }
        items(organizations, key = { it.organizationId }) { org ->
            val projection = state.read.dashboardByOrganization[org.organizationId]
            val orgPropertyIds = state.read.properties.filter { it.organizationId == org.organizationId }.mapTo(mutableSetOf()) { it.propertyId }
            val orgRoomIds = state.read.operationalRooms.filter { it.propertyId in orgPropertyIds }.mapTo(mutableSetOf()) { it.roomId }
            val orgIncidents = state.read.incidents.filter { it.roomId in orgRoomIds }
            LedgerSectionTitle(org.displayName, "Dashboard không sở hữu business mutation")
            if (projection == null) {
                V1Panel("Dashboard") { V1Pending("Chưa có Dashboard projection từ Backend cho Organization này.") }
            } else {
                val attentionCount = (projection.openIncidentCount ?: 0) +
                    if (projection.outstandingReceivableLabel != null) 1 else 0
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    LedgerSectionTitle(
                        if (attentionCount == 0) "Không có việc nổi bật" else "$attentionCount việc cần chú ý",
                        "Chỉ tổng hợp source facts Backend đã trả",
                    )
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.primaryContainer,
                    ) {
                        Text(
                            attentionCount.toString(),
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                projection.outstandingReceivableLabel?.let { amount ->
                    LedgerAttentionRow(
                        title = "Khoản cần thu",
                        supporting = "Outstanding receivable · nguồn Dashboard projection",
                        amount = amount,
                        tone = LedgerTone.Warning,
                    )
                }
                projection.openIncidentCount?.takeIf { it > 0 }?.let { count ->
                    LedgerAttentionRow(
                        title = "$count sự cố đang mở",
                        supporting = "Mở bảng sự cố để xem source record",
                        tone = LedgerTone.Clay,
                    )
                }
                LedgerDivider()
                LedgerSectionTitle("Phòng đang vận hành")
                RoomSummaryGrid(projection.roomsByState)
                projection.activeTenancyCount?.let {
                    V1Metric("Lượt thuê đang hoạt động", it.toString())
                }
                projection.confirmedPaymentTotalLabel?.let {
                    V1Metric("Payment đã xác nhận", it)
                }
                if (orgIncidents.isNotEmpty()) {
                    LedgerDivider()
                    LedgerSectionTitle("Mới nhất")
                    val recent = orgIncidents.first()
                    val event = recent.timeline.firstOrNull()
                    LedgerHistoryEvent(
                        source = "Sự cố",
                        title = recent.title,
                        occurredAt = event?.occurredAtLabel ?: "Backend chưa trả thời điểm sự kiện",
                        supporting = event?.description ?: recent.lifecycle.name,
                    )
                }
            }
            LedgerDivider()
        }
    }
}

@Composable
private fun RoomSummaryGrid(values: Map<RoomOperationalState, Int>) {
    val rows = listOf(
        RoomOperationalState.OCCUPIED to "Có người thuê",
        RoomOperationalState.VACANT to "Trống",
        RoomOperationalState.MAINTENANCE to "Bảo trì",
        RoomOperationalState.INACTIVE to "Ngừng sử dụng",
    )
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        rows.chunked(2).forEach { pair ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                pair.forEach { (state, label) ->
                    Surface(
                        modifier = Modifier.weight(1f),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text((values[state] ?: 0).toString(), style = MaterialTheme.typography.titleLarge)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun V1OwnerPropertiesScreen(state: TroOiUiState) {
    val organizations = state.read.organizations.filter { it.organizationId in state.access.operatedOrganizationIds }
    val properties = accessibleProperties(state.read, state.access)
    val rooms = accessibleRooms(state.read, state.access)
    val operatorListings = accessibleOperatorListings(state.read, state.access)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-properties"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Phòng", "Organization → Property → Room → Listing") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (organizations.isEmpty()) item { V1Panel("Organization") { V1Pending() } }
        items(organizations, key = { it.organizationId }) { org ->
            LedgerSectionTitle(org.displayName, "Sổ phòng theo quyền vận hành")
            val owned = properties.filter { it.organizationId == org.organizationId }
            if (owned.isEmpty()) {
                V1Pending("Không có Property trong quyền truy cập hiện tại.")
            }
            owned.forEach { property ->
                Text(property.displayName, style = MaterialTheme.typography.titleMedium)
                val units = rooms.filter { it.propertyId == property.propertyId }
                units.forEach { room ->
                    val listing = operatorListings.firstOrNull { it.roomId == room.roomId }
                    LedgerAttentionRow(
                        title = room.label,
                        supporting = buildString {
                            append(room.operationalState.name)
                            listing?.let { append(" · Listing ${it.visibility.name}") }
                        },
                        tone = when (room.operationalState) {
                            RoomOperationalState.OCCUPIED -> LedgerTone.Success
                            RoomOperationalState.MAINTENANCE -> LedgerTone.Warning
                            RoomOperationalState.INACTIVE -> LedgerTone.Neutral
                            RoomOperationalState.VACANT -> LedgerTone.Clay
                        },
                    )
                }
                LedgerDivider()
            }
        }
    }
}

@Composable
fun V1OwnerFinanceScreen(state: TroOiUiState) {
    val organizations = state.read.organizations.filter { it.organizationId in state.access.operatedOrganizationIds }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-finance"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            V1PageTitle(
                "Tài chính",
                "Khoản phải thu, tiền đã nhận, tiền cọc và biên nhận là các nguồn riêng.",
            )
        }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (organizations.isEmpty()) item { V1Panel("Không gian vận hành") { V1Pending() } }
        items(organizations, key = { it.organizationId }) { org ->
            LedgerSectionTitle(org.displayName, "Finance source records")
            val finance = state.read.operatorFinanceByOrganization[org.organizationId]
            if (finance == null) {
                V1Panel("Tài chính") { V1Pending("Đang chờ projection tài chính theo Organization từ Backend.") }
            } else {
                FinanceLane(
                    title = "Khoản cần thu",
                    subtitle = "Billing / Charge",
                    values = finance.charges.map { it.label to it.amountLabel },
                    tone = LedgerTone.Warning,
                )
                FinanceLane(
                    title = "Tiền đã nhận",
                    subtitle = "Confirmed Payment",
                    values = finance.confirmedPayments.map { "Payment" to it.amountLabel },
                    tone = LedgerTone.Success,
                )
                FinanceLane(
                    title = "Tiền cọc",
                    subtitle = "Deposit projection",
                    values = finance.deposits.map { "Deposit" to (it.heldLabel ?: it.fundedLabel ?: "Chưa có số liệu") },
                    tone = LedgerTone.Clay,
                )
                FinanceLane(
                    title = "Biên nhận",
                    subtitle = "Evidence từ confirmed Payment",
                    values = finance.receipts.map { it.receiptId to it.issuedAtLabel },
                    tone = LedgerTone.Neutral,
                )
            }
            LedgerDivider()
        }
    }
}

@Composable
private fun FinanceLane(
    title: String,
    subtitle: String,
    values: List<Pair<String, String>>,
    tone: LedgerTone,
) {
    LedgerSectionTitle(title, subtitle)
    if (values.isEmpty()) {
        V1Pending("Chưa có dữ liệu.")
    } else {
        values.forEach { (label, value) ->
            LedgerAttentionRow(label, subtitle, amount = value, tone = tone)
        }
    }
    LedgerDivider()
}

@Composable
fun V1OwnerIncidentsScreen(state: TroOiUiState) {
    val incidents = accessibleIncidents(state.read, state.access)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-incidents"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Sự cố cần xử lý", "Incident lifecycle và event history từ Backend") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (incidents.isEmpty()) item { V1Panel("Danh sách sự cố") { V1Pending() } }
        items(incidents, key = { it.incidentId }) { incident ->
            LedgerSectionTitle(incident.title, "Room ${incident.roomId}")
            LedgerStateLabel(
                incident.lifecycle.name,
                tone = if (incident.lifecycle == IncidentLifecycle.RESOLVED || incident.lifecycle == IncidentLifecycle.CLOSED) {
                    LedgerTone.Success
                } else LedgerTone.Warning,
            )
            if (incident.timeline.isEmpty()) {
                V1Pending("Chưa có Incident Event.")
            } else {
                incident.timeline.forEach { event ->
                    LedgerHistoryEvent(
                        source = "Sự cố",
                        title = event.description,
                        occurredAt = event.occurredAtLabel,
                    )
                }
            }
            if (incident.serverActions.isNotEmpty()) {
                V1Pending("Action Backend cho phép: ${incident.serverActions.joinToString()}")
            }
            LedgerDivider()
        }
    }
}