package com.trooi.app.features.ledger

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import com.trooi.app.core.data.SlotCheckoutPending
import kotlinx.coroutines.launch
import java.util.UUID
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*
import java.util.Locale

/**
 * Low-tech owner Sổ: all six sections are always visible, even at zero rooms.
 * Counts and attention items are scoped to authorized backend projections.
 * Subscription quota must NOT be inferred from room count when no entitlement is supplied.
 */
internal enum class OwnerSection(val label: String) {
    ROOMS("Phòng / căn"), TENANTS("Người thuê"), MONEY("Tiền thuê"),
    INCIDENTS("Sự cố"), LISTINGS("Tin đăng"), RECEIPTS("Biên nhận"),
}

internal enum class AttentionType { INCIDENT, CHARGE }

internal data class OwnerAttention(
    val type: AttentionType,
    val id: String,
    val title: String,
    val detail: String,
)

internal data class OwnerHomeSummary(
    val roomCount: Int,
    val tenantCount: Int,
    val chargeCount: Int,
    val incidentCount: Int,
    val listingCount: Int,
    val receiptCount: Int,
    val pending: List<OwnerAttention>,
)

/** Values are records, not inferred invoices, "overdue" claims, or synthetic tasks. */
internal fun summarizeOwnerHome(state: TroOiUiState): OwnerHomeSummary {
    val read = state.read
    val access = state.access
    val rooms = accessibleRooms(read, access)
    val roomIds = rooms.map { it.roomId }.toSet()
    val allTenancies = read.tenancies.filter { it.roomId in roomIds && it.lifecycle.isCurrentRental() }
    val issues = accessibleIncidents(read, access)
    val finance = access.operatedOrganizationIds.mapNotNull(read.operatorFinanceByOrganization::get)
    val charges = finance.flatMap { it.charges }.distinctBy { it.chargeId }
    val receipts = finance.flatMap { it.receipts }.distinctBy { it.receiptId }
    val openCharges = charges.filter(::hasOutstandingBalance)

    val attention = buildList {
        issues.filter { it.lifecycle in setOf(
            IncidentLifecycle.REPORTED, IncidentLifecycle.ACKNOWLEDGED, IncidentLifecycle.IN_PROGRESS,
        ) }.forEach {
            val roomName = rooms.firstOrNull { room -> room.roomId == it.roomId }?.label ?: "Phòng cần kiểm tra"
            add(OwnerAttention(AttentionType.INCIDENT, it.incidentId,
                "$roomName · ${it.title}", incidentLabel(it.lifecycle)))
        }
        openCharges.forEach {
            add(OwnerAttention(AttentionType.CHARGE, it.chargeId,
                it.label, "Cần thu: ${it.outstandingLabel}"))
        }
    }
    return OwnerHomeSummary(
        roomCount = rooms.count { it.lifecycle == RecordLifecycle.ACTIVE && it.operationalState != RoomOperationalState.INACTIVE },
        tenantCount = allTenancies.distinctBy { it.tenancyId }.size,
        chargeCount = charges.size,
        incidentCount = issues.count { it.lifecycle in setOf(IncidentLifecycle.REPORTED, IncidentLifecycle.ACKNOWLEDGED, IncidentLifecycle.IN_PROGRESS) },
        listingCount = accessibleOperatorListings(read, access).size,
        receiptCount = receipts.size,
        pending = attention,
    )
}

/** Missing/outdated allocation is unknown, not proof of a debt. */
private fun hasOutstandingBalance(charge: ChargeCard): Boolean {
    val value = charge.outstandingLabel?.trim()?.lowercase(Locale.ROOT) ?: return false
    if (value.isEmpty()) return false
    val numeric = value.replace(Regex("[^0-9]"), "").trimStart('0')
    return numeric.isNotEmpty()
}

private fun OwnerSection.icon(): ImageVector = when (this) {
    OwnerSection.ROOMS -> Icons.Rounded.MeetingRoom
    OwnerSection.TENANTS -> Icons.Rounded.People
    OwnerSection.MONEY -> Icons.Rounded.AccountBalanceWallet
    OwnerSection.INCIDENTS -> Icons.Rounded.Build
    OwnerSection.LISTINGS -> Icons.Rounded.Campaign
    OwnerSection.RECEIPTS -> Icons.Rounded.ReceiptLong
}

@Composable
internal fun OwnerLedgerDashboard(
    state: TroOiUiState,
    onAddRoom: () -> Unit,
    onOpenOperations: () -> Unit,
    onOpenFinance: () -> Unit,
    onOpenIncidents: () -> Unit,
    onNotifications: () -> Unit,
    onRetryRead: () -> Unit,
    onPurchaseSlot: suspend (String) -> Result<Unit>,
) {
    val summary = remember(state.read, state.access) { summarizeOwnerHome(state) }
    var section by remember(state.backendUserId) { mutableStateOf<OwnerSection?>(null) }
    var showPlan by remember(state.backendUserId) { mutableStateOf(false) }
    var purchaseId by rememberSaveable(state.backendUserId) { mutableStateOf(UUID.randomUUID().toString()) }
    var paymentBusy by remember { mutableStateOf(false) }
    var paymentMessage by remember { mutableStateOf<String?>(null) }
    val paymentScope = rememberCoroutineScope()
    val catalog = state.read.localManagement
    val roomNames = accessibleRooms(state.read, state.access).associateBy { it.roomId }
    val ownedRoomIds = roomNames.keys

    if (showPlan) {
        AlertDialog(
            onDismissRequest = { showPlan = false },
            title = { Text("Mở rộng chỗ quản lý") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("259.000đ / 1 năm / 1 chỗ", style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Text("Gói mở rộng chỉ tăng số phòng/căn được quản lý. Các chức năng Sổ cơ bản vẫn được sử dụng.")
                    Text("Thanh toán qua SePay khi cổng đang kết nối. Chỗ quản lý chỉ được cộng sau khi backend xác nhận đã thanh toán.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    paymentMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        paymentScope.launch {
                            paymentBusy = true
                            paymentMessage = null
                            val result = onPurchaseSlot(purchaseId)
                            result.onSuccess {
                                showPlan = false
                                purchaseId = UUID.randomUUID().toString()
                                onRetryRead()
                            }.onFailure { error ->
                                paymentMessage = if (error is SlotCheckoutPending)
                                    "Đã mở trang thanh toán. Sau khi hoàn tất, hãy tải lại Sổ."
                                else error.message ?: "Chưa mở được thanh toán. Bạn có thể thử lại."
                            }
                            paymentBusy = false
                        }
                    },
                    enabled = !paymentBusy,
                    modifier = Modifier.testTag("owner-plan-pay"),
                ) { Text(if (paymentBusy) "Đang xử lý…" else "Thanh toán 259.000đ") }
            },
            dismissButton = {
                TextButton(onClick = { showPlan = false }, modifier = Modifier.testTag("owner-plan-close")) {
                    Text("Đóng")
                }
            },
            modifier = Modifier.testTag("owner-slot-plan"),
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("ledger-screen"),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 20.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (section == null) {
            item {
                TroOiPageHeader("Sổ của tôi", "Quản lý phòng trọ thật dễ dàng", actions = {
                    IconButton(onClick = onNotifications, modifier = Modifier.size(48.dp).testTag("owner-notifications")) {
                        Icon(Icons.Rounded.NotificationsNone, contentDescription = "Thông báo")
                    }
                })
            }
            if (state.authorizedReadFailed || state.read.recoverableReadErrors.isNotEmpty()) item {
                TroOiStateMessage(
                    TroOiStateKind.ERROR,
                    "Một số thông tin chưa tải được. Các số liệu bên dưới có thể chưa đầy đủ.",
                    actionText = "Tải lại",
                    onAction = onRetryRead,
                )
            }
            item {
                Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Chỗ quản lý", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        if (catalog == null || !catalog.entitlementsLoaded) {
                            Text("Chưa tải được số chỗ quản lý. Hãy thử tải lại.",
                                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.testTag("owner-quota-unavailable"))
                            Text("Bạn vẫn có thể xem và quản lý các phòng đã được cấp quyền.",
                                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else {
                            val used = catalog.used
                            val capacity = catalog.capacity()
                            Text("$used / $capacity chỗ", style = MaterialTheme.typography.headlineSmall,
                                color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold,
                                modifier = Modifier.testTag("owner-quota-known"))
                            LinearProgressIndicator(progress = { (used.toFloat() / capacity.coerceAtLeast(1)).coerceIn(0f, 1f) },
                                modifier = Modifier.fillMaxWidth())
                            Text(if (used >= capacity) "Đã hết chỗ quản lý. Có thể lưu nháp tài sản mới."
                                else "Còn ${capacity - used} chỗ quản lý.",
                                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        TroOiButton(
                            if (catalog != null && catalog.used >= catalog.capacity()) "Xem gói mở rộng"
                            else "＋ Thêm phòng / căn",
                            {
                                if (catalog != null && catalog.used >= catalog.capacity()) showPlan = true
                                else onAddRoom()
                            },
                            modifier = Modifier.fillMaxWidth().testTag("owner-add-room-primary"),
                        )
                        TextButton(
                            onClick = { showPlan = true },
                            modifier = Modifier.align(Alignment.End).heightIn(min = 48.dp).testTag("owner-see-plan"),
                        ) { Text("Mua thêm chỗ · 259.000đ/năm") }
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Việc cần làm", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f))
                    if (summary.pending.isNotEmpty()) Text("${summary.pending.size} việc",
                        color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                }
                Spacer(Modifier.height(8.dp))
                if (summary.pending.isEmpty()) {
                    Text(
                        if (state.authorizedReadFailed || state.read.recoverableReadErrors.isNotEmpty())
                            "Chưa đủ dữ liệu để kiểm tra công việc."
                        else "Hiện không có việc cần xử lý.",
                        modifier = Modifier.testTag("owner-today-empty"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    summary.pending.take(4).forEach { task ->
                        OwnerEntryRow(task.title, task.detail,
                            if (task.type == AttentionType.INCIDENT) Icons.Rounded.Build else Icons.Rounded.AccountBalanceWallet,
                        ) {
                            if (task.type == AttentionType.INCIDENT) onOpenIncidents() else onOpenFinance()
                        }
                    }
                    if (summary.pending.size > 4) Text("Còn ${summary.pending.size - 4} việc khác",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            item {
                Text("Quản lý của tôi", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                val items = OwnerSection.entries
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items.chunked(2).forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            row.forEach { category ->
                                val count = when (category) {
                                    OwnerSection.ROOMS -> summary.roomCount
                                    OwnerSection.TENANTS -> summary.tenantCount
                                    OwnerSection.MONEY -> summary.chargeCount
                                    OwnerSection.INCIDENTS -> summary.incidentCount
                                    OwnerSection.LISTINGS -> summary.listingCount
                                    OwnerSection.RECEIPTS -> summary.receiptCount
                                }
                                OwnerHubTile(
                                    category, count, Modifier.weight(1f)
                                        .testTag("owner-section-${category.name.lowercase(Locale.ROOT)}"),
                                ) { section = category }
                            }
                            if (row.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }

        } else {
            val selected = requireNotNull(section)
            item {
                TroOiPageHeader(selected.label, "Chọn thông tin để xem", onBack = { section = null })
            }
            when (selected) {
                OwnerSection.ROOMS -> {
                    val rooms = accessibleRooms(state.read, state.access)
                    if (rooms.isEmpty()) item {
                        OwnerSectionEmpty(Icons.Rounded.MeetingRoom, "Chưa có phòng / căn",
                            "Bạn có thể thêm phòng riêng lẻ hoặc quản lý nhiều phòng cùng một khu trọ.",
                            "Thêm phòng / căn", onAddRoom)
                    } else {
                        items(rooms, key = { it.roomId }) { room ->
                            OwnerEntryRow(room.label, when (room.operationalState) {
                                RoomOperationalState.OCCUPIED -> "Đang có người thuê"
                                RoomOperationalState.VACANT -> "Còn trống"
                                RoomOperationalState.MAINTENANCE -> "Đang bảo trì"
                                RoomOperationalState.INACTIVE -> "Ngừng sử dụng"
                            }, Icons.Rounded.MeetingRoom, onOpenOperations)
                        }
                        item { TroOiButton("＋ Thêm phòng / căn", onAddRoom, modifier = Modifier.fillMaxWidth()) }
                    }
                }
                OwnerSection.TENANTS -> {
                    val tenants = state.read.tenancies.filter { it.roomId in ownedRoomIds && it.lifecycle.isCurrentRental() }
                    if (tenants.isEmpty()) item {
                        OwnerSectionEmpty(Icons.Rounded.People, "Chưa có người thuê",
                            "Thêm phòng rồi tạo lượt thuê để theo dõi người đang ở.",
                            "Quản lý phòng", onOpenOperations)
                    } else items(tenants, key = { it.tenancyId }) {
                        OwnerEntryRow(it.primaryTenantName ?: "Người thuê", it.roomLabel, Icons.Rounded.People, onOpenOperations)
                    }
                }
                OwnerSection.MONEY -> {
                    val records = state.access.operatedOrganizationIds.mapNotNull(state.read.operatorFinanceByOrganization::get)
                        .flatMap { it.charges }.distinctBy { it.chargeId }
                    if (records.isEmpty()) item {
                        OwnerSectionEmpty(Icons.Rounded.AccountBalanceWallet, "Chưa có khoản tiền thuê",
                            "Sau khi có lượt thuê và kỳ thu tiền, các khoản sẽ xuất hiện ở đây.",
                            "Xem quản lý phòng", onOpenOperations)
                    } else items(records, key = { it.chargeId }) {
                        OwnerEntryRow(it.label, it.outstandingLabel?.let { v -> "Còn phải thu: $v" }
                            ?: "Đã ghi nhận: ${it.amountLabel} · Chờ đối chiếu", Icons.Rounded.AccountBalanceWallet, onOpenFinance)
                    }
                }
                OwnerSection.INCIDENTS -> {
                    val issues = accessibleIncidents(state.read, state.access)
                    if (issues.isEmpty()) item {
                        OwnerSectionEmpty(Icons.Rounded.Build, "Chưa có sự cố",
                            "Khi người thuê báo sự cố, bạn sẽ thấy tại đây.", "Xem quản lý phòng", onOpenOperations)
                    } else items(issues, key = { it.incidentId }) {
                        OwnerEntryRow(it.title, incidentLabel(it.lifecycle), Icons.Rounded.Build, onOpenIncidents)
                    }
                }
                OwnerSection.LISTINGS -> {
                    val listings = accessibleOperatorListings(state.read, state.access)
                    if (listings.isEmpty()) item {
                        OwnerSectionEmpty(Icons.Rounded.Campaign, "Chưa có tin đăng",
                            "Tạo phòng rồi đăng tin để người thuê tìm thấy bạn.", "Quản lý phòng", onOpenOperations)
                    } else items(listings, key = { it.listingId }) {
                        OwnerEntryRow(it.title, "Trạng thái: ${it.visibility}", Icons.Rounded.Campaign, onOpenOperations)
                    }
                }
                OwnerSection.RECEIPTS -> {
                    val receipts = state.access.operatedOrganizationIds.mapNotNull(state.read.operatorFinanceByOrganization::get)
                        .flatMap { it.receipts }.distinctBy { it.receiptId }
                    if (receipts.isEmpty()) item {
                        OwnerSectionEmpty(Icons.Rounded.ReceiptLong, "Chưa có biên nhận",
                            "Biên nhận được tạo từ khoản thanh toán đã xác nhận.", "Xem tài chính", onOpenFinance)
                    } else items(receipts, key = { it.receiptId }) {
                        OwnerEntryRow("Biên nhận", it.issuedAtLabel, Icons.Rounded.ReceiptLong, onOpenFinance)
                    }
                }
            }
        }
    }
}

@Composable
private fun OwnerHubTile(section: OwnerSection, count: Int, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier.heightIn(min = 128.dp).clickable(role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Icon(section.icon(), contentDescription = null, tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(27.dp))
            Text(section.label, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("$count ${when (section) {
                OwnerSection.ROOMS -> "phòng/căn"
                OwnerSection.TENANTS -> "người"
                OwnerSection.MONEY -> "khoản"
                OwnerSection.INCIDENTS -> "sự cố"
                OwnerSection.LISTINGS -> "tin"
                OwnerSection.RECEIPTS -> "biên nhận"
            }}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun OwnerEntryRow(title: String, detail: String, icon: ImageVector, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).heightIn(min = 64.dp)
            .clickable(role = Role.Button, onClick = onClick),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(27.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.Rounded.ChevronRight, contentDescription = "Mở chi tiết",
                tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun OwnerSectionEmpty(icon: ImageVector, title: String, detail: String, actionText: String,
                              onAction: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(top = 35.dp, bottom = 25.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(15.dp),
    ) {
        Surface(shape = RoundedCornerShape(26.dp), color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(132.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, modifier = Modifier.size(64.dp),
                    tint = MaterialTheme.colorScheme.primary)
            }
        }
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(detail, style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        TroOiButton(actionText, onAction, modifier = Modifier.fillMaxWidth().testTag("owner-section-empty-action"))
    }
}
