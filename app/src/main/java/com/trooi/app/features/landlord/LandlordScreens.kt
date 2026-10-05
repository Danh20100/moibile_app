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
    val organizations = scopedOrganizations(state.read, state.access, state.selectedContext)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-dashboard"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Tổng quan", "Tình hình vận hành hôm nay") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (organizations.isEmpty()) {
            item { V1Panel("Không gian vận hành") { V1Pending("Tài khoản chưa được cấp quyền quản lý khu trọ nào.") } }
        }
        items(organizations, key = { it.organizationId }) { org ->
            val projection = state.read.dashboardByOrganization[org.organizationId]
            val orgPropertyIds = state.read.properties.filter { it.organizationId == org.organizationId }.mapTo(mutableSetOf()) { it.propertyId }
            val orgRoomIds = state.read.operationalRooms.filter { it.propertyId in orgPropertyIds }.mapTo(mutableSetOf()) { it.roomId }
            val orgIncidents = state.read.incidents.filter { it.roomId in orgRoomIds }
            LedgerSectionTitle(org.displayName, "Tổng quan vận hành")
            if (projection == null) {
                V1Panel("Tổng quan") { V1Pending("Chưa có dữ liệu tổng quan cho khu trọ này.") }
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
                        "Các mục đang cần bạn chú ý",
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
                        supporting = "Khoản còn cần thu",
                        amount = amount,
                        tone = LedgerTone.Warning,
                    )
                }
                projection.openIncidentCount?.takeIf { it > 0 }?.let { count ->
                    LedgerAttentionRow(
                        title = "$count sự cố đang mở",
                        supporting = "Mở mục Sự cố để xem chi tiết",
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
                    V1Metric("Tiền đã nhận", it)
                }
                if (orgIncidents.isNotEmpty()) {
                    LedgerDivider()
                    LedgerSectionTitle("Mới nhất")
                    val recent = orgIncidents.first()
                    val event = recent.timeline.firstOrNull()
                    LedgerHistoryEvent(
                        source = "Sự cố",
                        title = recent.title,
                        occurredAt = event?.occurredAtLabel ?: "Chưa có thời điểm cập nhật",
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
    val organizations = scopedOrganizations(state.read, state.access, state.selectedContext)
    val orgIds = organizations.map { it.organizationId }.toSet()
    val properties = accessibleProperties(state.read, state.access).filter { it.organizationId in orgIds }
    val rooms = accessibleRooms(state.read, state.access).filter { room ->
        properties.any { it.propertyId == room.propertyId }
    }
    val operatorListings = accessibleOperatorListings(state.read, state.access).filter { listing ->
        rooms.any { it.roomId == listing.roomId }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-properties"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Phòng", "Quản lý khu trọ, phòng và tin đăng") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (organizations.isEmpty()) item { V1Panel("Khu trọ") { V1Pending("Chưa có khu trọ được cấp quyền quản lý.") } }
        items(organizations, key = { it.organizationId }) { org ->
            LedgerSectionTitle(org.displayName, "Sổ phòng theo quyền vận hành")
            val owned = properties.filter { it.organizationId == org.organizationId }
            if (owned.isEmpty()) {
                V1Pending("Chưa có khu nhà nào trong khu trọ này.")
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
                            listing?.let { append(" · Tin đăng ${it.visibility.name}") }
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
    val organizations = scopedOrganizations(state.read, state.access, state.selectedContext)
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
            LedgerSectionTitle(org.displayName, "Tổng hợp tài chính")
            val finance = state.read.operatorFinanceByOrganization[org.organizationId]
            if (finance == null) {
                V1Panel("Tài chính") { V1Pending("Chưa có dữ liệu tài chính cho khu trọ này.") }
            } else {
                FinanceLane(
                    title = "Khoản cần thu",
                    subtitle = "Các khoản phải thu",
                    values = finance.charges.map { it.label to it.amountLabel },
                    tone = LedgerTone.Warning,
                )
                FinanceLane(
                    title = "Tiền đã nhận",
                    subtitle = "Các khoản đã nhận",
                    values = finance.confirmedPayments.map { "Thanh toán" to it.amountLabel },
                    tone = LedgerTone.Success,
                )
                FinanceLane(
                    title = "Tiền cọc",
                    subtitle = "Tiền cọc đang quản lý",
                    values = finance.deposits.map { "Tiền cọc" to (it.heldLabel ?: it.fundedLabel ?: "Chưa có số liệu") },
                    tone = LedgerTone.Clay,
                )
                FinanceLane(
                    title = "Biên nhận",
                    subtitle = "Biên nhận đã phát hành",
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
    val incidents = scopedOperatorIncidents(state.read, state.access, state.selectedContext)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-owner-incidents"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Sự cố cần xử lý", "Theo dõi trạng thái và lịch sử xử lý") }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (incidents.isEmpty()) item { V1Panel("Danh sách sự cố") { V1Pending() } }
        items(incidents, key = { it.incidentId }) { incident ->
            LedgerSectionTitle(incident.title, "Phòng ${incident.roomId}")
            LedgerStateLabel(
                incident.lifecycle.name,
                tone = if (incident.lifecycle == IncidentLifecycle.RESOLVED || incident.lifecycle == IncidentLifecycle.CLOSED) {
                    LedgerTone.Success
                } else LedgerTone.Warning,
            )
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
}