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
    onOwnerFinance: () -> Unit = onOperations,
    onSaveAsset: suspend (LocalRentalAsset, Boolean, Boolean) -> Result<Unit> = { _, _, _ -> Result.failure(IllegalStateException("Tính năng đang được phát triển.")) },
    onPurchaseCapacity: suspend (String) -> Result<Unit> = { Result.failure(IllegalStateException("Tính năng đang được phát triển.")) },
    onArchiveAsset: suspend (String) -> Result<Unit> = { Result.failure(IllegalStateException("Tính năng đang được phát triển.")) },
    onMessageContext: (String, String) -> Unit = { _, _ -> },
    onRetryRead: () -> Unit = {},
    onTenantIncidents: () -> Unit = {},
    onOwnerIncidents: () -> Unit = {},
    onNotifications: () -> Unit = {},
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
    var tenantDetailOpen by remember(state.backendUserId) { mutableStateOf(false) }
    val catalog = state.read.localManagement
    val assets = ledgerTenancies(state)
    val selected = selectedLedgerTenancy(assets, selectedId)
    if (owner) {
        OwnerLedgerDashboard(
            state = state,
            onAddRoom = {
                if (!state.demoPreview || catalog == null) onOperations()
                else { editAsset = null; wizardOpen = true }
            },
            onOpenOperations = onOperations,
            onOpenFinance = onOwnerFinance,
            onOpenIncidents = onOwnerIncidents,
            onNotifications = onNotifications,
            onRetryRead = onRetryRead,
            onPurchaseSlot = onPurchaseCapacity,
        )
        if (wizardOpen && catalog != null) AssetWizard(editAsset, catalog, state.displayName,
            { wizardOpen = false }, onSaveAsset, onPurchaseCapacity)
        return
    }
    // A newly created Organization without properties, rooms or ledger records
    // needs the same illustrated first-use experience as an empty tenant Sổ.
    // Never obscure loading, errors, or an operator's real data.
    if (owner && !state.runtimeLoading && !state.authorizedReadFailed &&
        state.read.recoverableReadErrors.isEmpty() && !ownerLedgerHasOperationalContent(state)) {
        val hasProperty = accessibleProperties(state.read, state.access).isNotEmpty()
        Column(Modifier.fillMaxSize().testTag("ledger-screen").padding(20.dp)) {
            TroOiPageHeader("Sổ vận hành", "Công việc, phòng và bản ghi thuộc quyền quản lý")
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                IllustratedEmptyState(
                    scene = EmptyStateScene.RENTAL_NOTEBOOK,
                    title = "Chưa có tài sản quản lý",
                    description = if (hasProperty) "Khu trọ đã sẵn sàng. Thêm phòng đầu tiên để bắt đầu quản lý."
                        else "Tạo khu trọ và thêm phòng đầu tiên để bắt đầu theo dõi hoạt động.",
                    actionText = if (hasProperty) "Thêm phòng" else "Tạo khu trọ",
                    onAction = onOperations,
                    actionTag = "ledger-owner-empty-create",
                )
            }
        }
        return
    }
    if (!owner && selected == null && !state.authorizedReadFailed &&
        state.read.recoverableReadErrors.isEmpty()) {
        Column(Modifier.fillMaxSize().testTag("ledger-screen").padding(20.dp)) {
            TroOiPageHeader("Sổ thuê của tôi", "Phòng đang thuê, khoản cần trả và lịch sử thuê")
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                IllustratedEmptyState(
                    scene = EmptyStateScene.RENTAL_NOTEBOOK,
                    title = "Chưa có lượt thuê",
                    description = "Khi chủ trọ liên kết lượt thuê, thông tin phòng và thanh toán sẽ xuất hiện tại đây.",
                    actionText = "Khám phá phòng thuê",
                    onAction = onExplore,
                    actionTag = "ledger-empty-explore",
                )
            }
        }
        return
    }
    LazyColumn(
        Modifier.fillMaxSize().testTag("ledger-screen"),
        contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        item { TroOiPageHeader(if (owner) "Sổ vận hành" else "Sổ thuê của tôi",
            if (owner) "Công việc, phòng và bản ghi thuộc quyền quản lý" else "Phòng đang thuê, khoản cần trả và lịch sử thuê") }
        if (state.authorizedReadFailed) item {
            Text("Chưa cập nhật được Sổ. Thông tin bên dưới là lần tải gần nhất.", style = MaterialTheme.typography.bodyMedium)
            TroOiButton("Thử lại", onRetryRead, enabled = !state.runtimeLoading, style = TroOiButtonStyle.SECONDARY)
        }
        if (state.read.recoverableReadErrors.isNotEmpty()) item {
            Text(
                "Một số dữ liệu tài chính chưa tải được. Các khoản tiền có thể chưa đầy đủ; hãy thử tải lại.",
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.testTag("ledger-finance-partial-error"),
            )
            TroOiButton("Tải lại dữ liệu", onRetryRead, enabled = !state.runtimeLoading, style = TroOiButtonStyle.SECONDARY)
        }
        if (!owner && selected == null) item {
            TroOiCard("Sổ thuê của tôi") {
                Text("Chưa có lượt thuê được liên kết với tài khoản.",
                    style = MaterialTheme.typography.titleMedium)
                Text("Khi chủ trọ liên kết lượt thuê, thông tin phòng, các kỳ thanh toán, tiền cọc và sự cố sẽ xuất hiện ở đây.",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TroOiButton("Khám phá phòng thuê", onExplore,
                    modifier = Modifier.fillMaxWidth().testTag("ledger-empty-explore"))
            }
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
            item { LedgerTenantOverview(state, selected, onFinance) { tenantDetailOpen = true } }
            val finance = state.read.tenantFinanceByTenancy[selected.tenancyId]?.takeIf { it.tenancyId == selected.tenancyId }
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
                TroOiButton("Nhắn chủ trọ", { onMessageContext("tenancy", selected.tenancyId) },
                    modifier = Modifier.testTag("ledger-tenant-message"), style = TroOiButtonStyle.SECONDARY)
            }
        }
        if (owner) {
            val rooms = accessibleRooms(state.read, state.access)
            val finance = state.access.operatedOrganizationIds.mapNotNull { state.read.operatorFinanceByOrganization[it] }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    LedgerOwnerOverview(state, onOperations, onOwnerIncidents)
                }
            }
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
                        Modifier.size(76.dp).clip(RoundedCornerShape(12.dp)))
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
            OwnerAssetDetail(state, asset, { detailId = null }, { editAsset = asset; detailId = null; wizardOpen = true }, onArchiveAsset, onMessageContext)
        }
    }
    if (!owner && selected != null && tenantDetailOpen) {
        TenantRoomDetail(
            state, selected,
            onClose = { tenantDetailOpen = false },
            onFinance = { tenancyId -> tenantDetailOpen = false; onFinance(tenancyId) },
            onMessages = { tenantDetailOpen = false; onMessageContext("tenancy", selected.tenancyId) },
            onIncidents = { tenantDetailOpen = false; onTenantIncidents() },
            onNotifications = { tenantDetailOpen = false; onNotifications() },
        )
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
            Modifier.size(76.dp).clip(RoundedCornerShape(12.dp)))
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
