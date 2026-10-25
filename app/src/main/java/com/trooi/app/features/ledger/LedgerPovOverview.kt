package com.trooi.app.features.ledger

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*

/**
 * Release-first implementation of the selected Landlord L-A and Tenant T-A overview designs.
 * All quantities and status labels are projected from authorized records, never fixtures.
 */
@Composable
internal fun LedgerOwnerOverview(state: TroOiUiState, onOpenRooms: () -> Unit, onOpenIncidents: () -> Unit) {
    val organizations = state.read.organizations.filter { it.organizationId in state.access.operatedOrganizationIds }
    val rooms = accessibleRooms(state.read, state.access)
    val pending = accessibleIncidents(state.read, state.access)
        .filter { it.lifecycle in setOf(IncidentLifecycle.REPORTED, IncidentLifecycle.ACKNOWLEDGED, IncidentLifecycle.IN_PROGRESS) }
    val byRoom = rooms.associateBy { it.roomId }
    val workspace = when (organizations.size) {
        0 -> "Không gian vận hành được cấp quyền"
        1 -> organizations.single().displayName
        else -> "${organizations.size} tổ chức đang quản lý"
    }

    TroOiCard("Sổ vận hành") {
        Text(workspace, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.testTag("ledger-owner-context"))
        Text("Theo dõi việc cần xử lý và phòng thuộc quyền quản lý của bạn.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }

    TroOiCard("Cần chú ý") {
        if (pending.isEmpty()) {
            Text("Không có sự cố đang xử lý trong dữ liệu đã tải.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            pending.take(3).forEach { incident ->
                val room = byRoom[incident.roomId]?.label ?: "Phòng chưa có thông tin"
                LedgerAttentionRow(
                    title = "$room · ${incident.title}",
                    supporting = incidentLabel(incident.lifecycle),
                    tone = LedgerTone.Warning,
                )
            }
            if (pending.size > 3) Text("Còn ${pending.size - 3} sự cố khác trong bản ghi quản lý.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            TroOiButton("Xem sự cố cần xử lý", onOpenIncidents,
                style = TroOiButtonStyle.SECONDARY,
                modifier = Modifier.fillMaxWidth().testTag("ledger-owner-incidents"))
        }
    }

    TroOiCard("Phòng đang quản lý") {
        if (rooms.isEmpty()) {
            Text("Chưa có dữ liệu phòng được liên kết với tổ chức này.",
                style = MaterialTheme.typography.bodyMedium)
        } else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LedgerCountTile("Có người thuê", rooms.count {
                    it.lifecycle == RecordLifecycle.ACTIVE && it.operationalState == RoomOperationalState.OCCUPIED
                }, Modifier.weight(1f))
                LedgerCountTile("Trống", rooms.count {
                    it.lifecycle == RecordLifecycle.ACTIVE && it.operationalState == RoomOperationalState.VACANT
                }, Modifier.weight(1f))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LedgerCountTile("Bảo trì", rooms.count {
                    it.lifecycle == RecordLifecycle.ACTIVE && it.operationalState == RoomOperationalState.MAINTENANCE
                }, Modifier.weight(1f))
                LedgerCountTile("Ngừng sử dụng", rooms.count {
                    it.lifecycle != RecordLifecycle.ACTIVE || it.operationalState == RoomOperationalState.INACTIVE
                }, Modifier.weight(1f))
            }
        }
        TroOiButton("Xem danh sách phòng", onOpenRooms, style = TroOiButtonStyle.SECONDARY,
            modifier = Modifier.fillMaxWidth().testTag("ledger-owner-room-register"))
    }
}

@Composable
private fun LedgerCountTile(label: String, count: Int, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceVariant) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(count.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
internal fun LedgerTenantOverview(
    state: TroOiUiState,
    selected: LedgerTenantAsset,
    onFinance: (String) -> Unit,
    onOpenRoom: () -> Unit,
) {
    val finance = state.read.tenantFinanceByTenancy[selected.tenancyId]
        ?.takeIf { it.tenancyId == selected.tenancyId }
    val room = selected.roomId?.let(state.read.rentalAssetPresentationByRoom::get)

    TroOiCard("Nhà của tôi") {
        Text(selected.label, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(rentalLifecycleLabel(selected.lifecycle), color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelLarge)
        room?.let { Text("${it.type} · ${it.publicArea}",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        selected.terms?.let { Text("Điều khoản: $it", style = MaterialTheme.typography.bodySmall) }
        TroOiButton("Xem chi tiết phòng", onOpenRoom,
            style = TroOiButtonStyle.SECONDARY,
            modifier = Modifier.fillMaxWidth().testTag("ledger-tenant-room-detail-entry"))
    }

    TroOiCard("Kỳ thanh toán hiện tại") {
        if (finance == null || finance.charges.isEmpty()) {
            Text("Chưa đủ dữ liệu để xác định khoản còn phải trả.",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("ledger-tenant-finance-unavailable"))
            Text("Không có khoản phải thu được tải cho lượt thuê này; đây không phải trạng thái đã thanh toán.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            Text("Các khoản được backend ghi nhận cho lượt thuê đã chọn:",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            finance.charges.take(3).forEach { charge ->
                TroOiInformationRow(charge.label, charge.outstandingLabel ?: "${charge.amountLabel} · Chưa có dữ liệu phân bổ")
            }
            if (finance.charges.size > 3) Text("Xem đầy đủ ${finance.charges.size} khoản tại chi tiết thanh toán.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (selected.lifecycle.isCurrentRental() && finance != null && finance.charges.isNotEmpty()) {
            TroOiButton("Xem thanh toán", { onFinance(selected.tenancyId) },
                modifier = Modifier.fillMaxWidth().testTag("ledger-payment-entry"))
        }
    }
}
