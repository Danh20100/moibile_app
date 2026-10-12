package com.trooi.app.features.ledger

import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*

@Composable
fun LedgerScreen(
    state: TroOiUiState,
    onExplore: () -> Unit,
    onFinance: (String) -> Unit,
    onOperations: () -> Unit,
    onSaveAsset: suspend (LocalRentalAsset, Boolean, Boolean) -> Result<Unit> = { _, _, _ -> Result.failure(IllegalStateException("Tính năng đang được phát triển.")) },
    onPurchaseCapacity: suspend (String) -> Result<Unit> = { Result.failure(IllegalStateException("Tính năng đang được phát triển.")) },
    onArchiveAsset: suspend (String) -> Result<Unit> = { Result.failure(IllegalStateException("Tính năng đang được phát triển.")) },
    onRetryRead: () -> Unit = {},
) {
    if ((state.runtimeLoading || state.authorizedReadFailed) && state.read.tenancies.isEmpty() && state.read.localManagement == null &&
        (state.access.linkedTenancyIds.isNotEmpty() || state.access.operatedOrganizationIds.isNotEmpty())) {
        Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            TroOiPageHeader("Sổ", "Sổ vận hành thuê trọ")
            if (state.runtimeLoading) TroOiStateMessage(TroOiStateKind.LOADING, "Đang tải Sổ…")
            else TroOiStateMessage(TroOiStateKind.ERROR, "Chưa tải được Sổ. Kiểm tra kết nối rồi thử lại.",
                actionText = "Thử lại", onAction = onRetryRead, actionModifier = Modifier.testTag("ledger-read-retry"))
        }
        return
    }
    val owner = ledgerPresentation(state).defaultMode == LedgerMode.OWNER
    var selectedId by remember(state.backendUserId, state.isAuthenticated) { mutableStateOf<String?>(null) }
    var wizardOpen by remember(state.backendUserId) { mutableStateOf(false) }
    var editAsset by remember(state.backendUserId) { mutableStateOf<LocalRentalAsset?>(null) }
    var detailId by remember(state.backendUserId) { mutableStateOf<String?>(null) }
    val catalog = state.read.localManagement
    val assets = ledgerTenancies(state)
    val selected = selectedLedgerTenancy(assets, selectedId)
    LazyColumn(
        Modifier.fillMaxSize().testTag("ledger-screen"),
        contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        item { TroOiPageHeader("Sổ", if (owner) "Quản lý tài sản cho thuê" else "Sổ vận hành thuê trọ") }
        if (state.authorizedReadFailed) item {
            Text("Chưa cập nhật được Sổ. Thông tin bên dưới là lần tải gần nhất.", style = MaterialTheme.typography.bodyMedium)
            TroOiButton("Thử lại", onRetryRead, enabled = !state.runtimeLoading, style = TroOiButtonStyle.SECONDARY)
        }
        if (!owner && selected == null) item {
            TroOiStateMessage(TroOiStateKind.EMPTY,
                "Sổ theo dõi tiền thuê / khoản cần thanh toán, tiền cọc, xác nhận thanh toán, sự cố / yêu cầu sửa chữa và lịch sử thuê.",
                title = "Bạn chưa có tài sản thuê nào được liên kết.", actionText = "Khám phá", onAction = onExplore,
                actionModifier = Modifier.testTag("ledger-empty-explore"))
        }
        if (!owner && selected != null) {
            if (assets.size > 1) item {
                LedgerSectionTitle("Tổng quan", "${assets.size} tài sản thuê được liên kết")
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    assets.forEach { asset ->
                        FilterChip(selected.tenancyId == asset.tenancyId, { selectedId = asset.tenancyId }, { Text(asset.label) },
                            Modifier.heightIn(min = 48.dp).testTag("ledger-asset-${asset.tenancyId}"))
                    }
                }
            }
            item {
                LedgerSectionTitle(if (selected.lifecycle.isCurrentRental()) "Tài sản đang thuê" else "Tài sản thuê được liên kết")
                Spacer(Modifier.height(12.dp))
                LedgerAssetCard(selected.label, state.read.rentalAssetPresentationByRoom[selected.roomId],
                    selected.terms ?: "Thông tin thuê đang được cập nhật", rentalLifecycleLabel(selected.lifecycle))
            }
            val finance = state.read.tenantFinanceByTenancy[selected.tenancyId]?.takeIf { it.tenancyId == selected.tenancyId }
            item {
                LedgerSectionTitle("Khoản cần thanh toán", "Khoản phải trả theo tài sản đã chọn")
                if (finance == null) Text("Chưa có dữ liệu khoản cần thanh toán.")
                else if (finance.charges.isEmpty()) Text("Chưa có khoản phải trả được ghi nhận.")
                finance?.charges?.forEach { charge ->
                    TroOiInformationRow(charge.label, charge.outstandingLabel ?: charge.amountLabel)
                    if (charge.outstandingLabel == null) Text("Chưa có dữ liệu phân bổ", style = MaterialTheme.typography.bodySmall)
                }
                if (selected.lifecycle != null && finance != null) TroOiButton("Thanh toán", { onFinance(selected.tenancyId) }, modifier = Modifier.testTag("ledger-payment-entry"))
            }
            item {
                LedgerDivider()
                LedgerSectionTitle("Tiền cọc")
                val deposits = finance?.deposits.orEmpty().filter { it.tenancyId == selected.tenancyId }
                if (deposits.isEmpty()) Text("Chưa có thông tin ghi nhận tiền cọc.")
                deposits.forEach {
                    TroOiInformationRow("Cọc yêu cầu", it.requiredLabel ?: "Chưa có dữ liệu")
                    TroOiInformationRow("Đã ghi nhận vào cọc", it.fundedLabel ?: "Chưa có dữ liệu")
                    TroOiInformationRow("Đang giữ", it.heldLabel ?: "Chưa có dữ liệu")
                    it.settlementLabel?.let { value -> TroOiInformationRow("Xử lý cọc", value) }
                }
                Text("Ghi nhận tiền cọc và biên nhận được theo dõi riêng.", style = MaterialTheme.typography.bodySmall)
            }
            item {
                LedgerDivider()
                LedgerSectionTitle("Thanh toán / xác nhận")
                if (finance?.payments.isNullOrEmpty()) Text("Chưa có thanh toán được xác nhận.")
                finance?.payments?.forEach { TroOiInformationRow("Thanh toán đã được xác nhận", "${it.amountLabel} · ${it.confirmationLabel ?: "Đã ghi nhận thanh toán"}") }
                Text("Việc ghi nhận thanh toán không xác định khoản phải trả đã được phân bổ đầy đủ.", style = MaterialTheme.typography.bodySmall)
                finance?.receipts?.forEach { TroOiInformationRow("Biên nhận ${it.receiptId}", it.issuedAtLabel) }
            }
            item {
                LedgerDivider()
                LedgerSectionTitle("Sự cố")
                val incidents = state.read.incidents.filter { selected.roomId != null && it.roomId == selected.roomId }
                if (incidents.isEmpty()) Text("Chưa có sự cố được tải cho tài sản này.")
                incidents.forEach { TroOiInformationRow(it.title, incidentLabel(it.lifecycle)) }
            }
            item {
                LedgerDivider()
                LedgerSectionTitle("Lịch sử")
                val notices = state.read.noticesByTenancy[selected.tenancyId].orEmpty().filter { it.tenancyId == selected.tenancyId }
                if (notices.isEmpty()) Text("Chưa có lịch sử thuê được tải.")
                notices.forEach { TroOiInformationRow(it.content, it.issuedAtLabel) }
            }
        }
        if (owner) {
            val rooms = accessibleRooms(state.read, state.access)
            val finance = state.access.operatedOrganizationIds.mapNotNull { state.read.operatorFinanceByOrganization[it] }
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Tài sản của tôi", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(if (catalog != null) "${catalog.used} / ${catalog.capacity()} đang quản lý" else "${rooms.count { it.lifecycle == RecordLifecycle.ACTIVE && it.operationalState != RoomOperationalState.INACTIVE }} tài sản đang quản lý",
                            modifier = Modifier.testTag("ledger-capacity"), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TroOiButton("+ Thêm tài sản", { if (catalog != null) { editAsset = null; wizardOpen = true } else onOperations() },
                        modifier = Modifier.testTag("ledger-add-asset"), style = TroOiButtonStyle.SECONDARY)
                }
            }
            if (rooms.isEmpty()) item { Text("Chưa có tài sản. Thêm phòng trọ hoặc căn hộ đầu tiên của bạn.") }
            if (catalog != null) catalog.assets.forEach { asset -> item(key = asset.id) {
                Column(Modifier.fillMaxWidth().clickable(role = Role.Button) { detailId = asset.id }.testTag("owner-asset-${asset.id}"), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (asset.photoUris.isNotEmpty() || asset.photoResources.isNotEmpty()) com.trooi.app.ui.components.LocalRentalPhoto(asset.photoUris.firstOrNull(), asset.photoResources.firstOrNull(), asset.name,
                        Modifier.fillMaxWidth().height(176.dp).clip(RoundedCornerShape(16.dp)))
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(asset.name, Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                        Text(when (asset.status) { ManagedAssetStatus.DRAFT -> "Bản nháp"; ManagedAssetStatus.ARCHIVED -> "Ngừng quản lý"; else -> if (asset.occupied) "Có người thuê" else "Còn trống" }, style = MaterialTheme.typography.labelMedium)
                    }
                    Text("${asset.type} · ${asset.publicArea}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (asset.monthlyRent.isNotBlank()) Text("${com.trooi.app.features.discovery.rentalPriceLabel(asset.monthlyRent)}/tháng", fontWeight = FontWeight.SemiBold)
                    Text(if (asset.listingStatus == ListingVisibility.PUBLISHED) "Tin đăng đang hiển thị" else "Tin đăng chưa công khai", style = MaterialTheme.typography.bodySmall)
                    state.read.tenancies.firstOrNull { it.roomId == asset.id && it.lifecycle.isCurrentRental() }?.let {
                        Text("${it.primaryTenantName ?: "Người thuê"} · ${it.termsVersionLabel.orEmpty()}", style = MaterialTheme.typography.bodySmall)
                    }
                    val charges = state.read.operatorFinanceByRoom[asset.id]?.charges
                    if (charges != null) {
                        Text(if (charges.isEmpty()) "Chưa có khoản phải thu" else charges.joinToString(" · ") { "${it.label}: ${it.outstandingLabel ?: it.amountLabel}" }, style = MaterialTheme.typography.bodySmall)
                        if (charges.any { it.outstandingLabel == null }) Text("Các khoản đã ghi nhận đang chờ đối chiếu.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    state.read.incidents.firstOrNull { it.roomId == asset.id && it.lifecycle == IncidentLifecycle.IN_PROGRESS }?.let { Text("Đang xử lý: ${it.title}", style = MaterialTheme.typography.bodySmall) }
                }
            } } else rooms.forEach { room -> item {
                val presentation = state.read.rentalAssetPresentationByRoom[room.roomId]
                LedgerAssetCard(room.label, presentation, presentation?.type ?: "Tài sản cho thuê",
                    if (room.operationalState == RoomOperationalState.OCCUPIED) "Có người thuê" else "Sẵn sàng cho thuê", onOperations)
                val tenancy = state.read.tenancies.firstOrNull { it.roomId == room.roomId && it.lifecycle.isCurrentRental() }
                if (tenancy != null) Text(tenancy.termsVersionLabel ?: "Đang có lượt thuê", style = MaterialTheme.typography.bodySmall)
            } }
            item {
                LedgerSectionTitle("Tổng quan vận hành")
                val summary = state.access.operatedOrganizationIds.mapNotNull { state.read.dashboardByOrganization[it] }.firstOrNull()
                TroOiInformationRow("Công nợ / khoản phải thu", summary?.outstandingReceivableLabel ?: if (finance.any { it.charges.isNotEmpty() }) "Đang chờ đối chiếu" else "Chưa có khoản phải thu")
                TroOiInformationRow("Thanh toán đã được xác nhận", summary?.confirmedPaymentTotalLabel ?: if (finance.any { it.confirmedPayments.isNotEmpty() }) "Xem các khoản đã nhận bên dưới" else "Chưa có thanh toán")
            }
            item {
                LedgerDivider()
                LedgerSectionTitle("Người thuê")
                val tenants = state.read.tenancies.filter { rental -> rooms.any { it.roomId == rental.roomId } }
                if (tenants.isEmpty()) Text("Chưa có người thuê được liên kết.")
                tenants.forEach {
                    TroOiInformationRow(it.primaryTenantName ?: it.roomLabel, "${it.roomLabel} · ${it.termsVersionLabel ?: "Chưa có điều khoản"}")
                }
            }
            item {
                LedgerSectionTitle("Công nợ / khoản phải thu")
                if (finance.all { it.charges.isEmpty() }) Text("Chưa có khoản phải thu.")
                finance.flatMap { it.charges }.forEach { TroOiInformationRow(it.label, it.outstandingLabel ?: "${it.amountLabel} · Chờ đối chiếu") }
                LedgerSectionTitle("Thanh toán / xác nhận")
                if (finance.all { it.confirmedPayments.isEmpty() }) Text("Chưa có thanh toán được xác nhận.")
                finance.flatMap { it.confirmedPayments }.forEach { TroOiInformationRow(it.amountLabel, it.confirmationLabel ?: "Đã ghi nhận") }
            }
            item {
                LedgerDivider()
                LedgerSectionTitle("Sự cố")
                val incidents = accessibleIncidents(state.read, state.access)
                if (incidents.isEmpty()) Text("Không có sự cố đang xử lý.")
                incidents.forEach { TroOiInformationRow(it.title, incidentLabel(it.lifecycle)) }
            }
            item {
                LedgerSectionTitle("Hoạt động gần đây")
                val ownedTenancyIds = state.read.tenancies.filter { tenancy -> rooms.any { it.roomId == tenancy.roomId } }.map { it.tenancyId }.toSet()
                val notices = state.read.noticesByTenancy.filterKeys { it in ownedTenancyIds }.values.flatten()
                if (notices.isEmpty()) Text("Chưa có hoạt động quản lý được ghi nhận.")
                notices.forEach { TroOiInformationRow(it.content, it.issuedAtLabel) }
            }
        }
    }
    if (owner && wizardOpen && catalog != null) AssetWizard(editAsset, catalog, state.displayName, { wizardOpen = false }, onSaveAsset, onPurchaseCapacity)
    if (owner && detailId != null && catalog != null) {
        catalog.assets.firstOrNull { it.id == detailId }?.let { asset ->
            OwnerAssetDetail(state, asset, { detailId = null }, { editAsset = asset; detailId = null; wizardOpen = true }, onArchiveAsset)
        }
    }
}

internal fun incidentLabel(state: IncidentLifecycle): String = when (state) {
    IncidentLifecycle.REPORTED -> "Đã gửi"
    IncidentLifecycle.ACKNOWLEDGED -> "Đã tiếp nhận"
    IncidentLifecycle.IN_PROGRESS -> "Đang xử lý"
    IncidentLifecycle.RESOLVED -> "Đã xử lý"
    IncidentLifecycle.REJECTED -> "Không tiếp nhận"
    IncidentLifecycle.CLOSED -> "Đã đóng"
}

@Composable
private fun LedgerAssetCard(name: String, metadata: RentalAssetPresentation?, detail: String, status: String, onClick: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().then(if (onClick == null) Modifier else Modifier.clickable(role = Role.Button, onClick = onClick)),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (metadata != null && (metadata.photoResources.isNotEmpty() || metadata.photoUris.isNotEmpty())) LocalRentalPhoto(metadata.photoUris.firstOrNull(), metadata.photoResources.firstOrNull(), name,
            Modifier.fillMaxWidth().height(176.dp).clip(RoundedCornerShape(16.dp)))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(name, Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(6.dp)) {
                Text(status, Modifier.padding(horizontal = 8.dp, vertical = 5.dp), style = MaterialTheme.typography.labelSmall)
            }
        }
        metadata?.let { Text(it.publicArea, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
        Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
