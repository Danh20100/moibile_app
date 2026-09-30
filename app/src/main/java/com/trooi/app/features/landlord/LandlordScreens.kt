package com.trooi.app.features.landlord

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.*

@Composable
fun LandlordDashboardScreen(
    state: TroOiUiState,
    onOpenRooms: () -> Unit,
    onOpenFinance: () -> Unit,
    onOpenTickets: () -> Unit,
    onOpenSubscription: () -> Unit,
) {
    val rented = state.rooms.count { it.rented }
    val empty = state.rooms.size - rented
    val openTickets = state.tickets.filter { it.status != "Hoàn tất" }
    val highTickets = openTickets.count { it.priority == "Ưu tiên cao" }
    val totalDebt = state.rooms.sumOf { it.debt }
    val expected = state.rooms.filter { it.rented }.sumOf { it.price }
    val collected = (expected - totalDebt).coerceAtLeast(0)
    val rate = if (expected == 0L) 0 else ((collected * 100) / expected).toInt()

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("landlord-dashboard-list"),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 26.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("GREEN HOUSE  /  QUẢN LÝ", style = MaterialTheme.typography.labelLarge, color = TroOiGreen)
                    Text("Tổng quan khu trọ", style = MaterialTheme.typography.titleLarge)
                }
                CircleIconButton(Icons.Rounded.NotificationsNone, "Thông báo", {})
            }
        }
        item {
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(
                    Brush.linearGradient(listOf(Color(0xFF0F2B22), Color(0xFF123F2C), Color(0xFF0B1720))),
                ).clickable(onClick = onOpenFinance).padding(16.dp),
            ) {
                Column(Modifier.fillMaxWidth()) {
                    Row {
                        Column(Modifier.weight(1f)) {
                            Text("HIỆU SUẤT THÁNG NÀY", style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = .78f))
                            Spacer(Modifier.height(6.dp))
                            Text("Quản lý rõ ràng.\nVận hành dễ dàng.", style = MaterialTheme.typography.headlineMedium, color = Color.White)
                            Spacer(Modifier.height(5.dp))
                            Text("$rented/${state.rooms.size} phòng đang thuê · ${openTickets.size} yêu cầu đang mở", style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = .72f))
                        }
                        Surface(shape = RoundedCornerShape(22.dp), color = Color.White.copy(alpha = .12f), border = BorderStroke(1.dp, Color.White.copy(alpha = .18f))) {
                            Column(Modifier.padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("$rate%", style = MaterialTheme.typography.titleLarge, color = Color(0xFF86EFAC))
                                Text("thu tiền", style = MaterialTheme.typography.labelMedium, color = Color.White)
                            }
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    LinearProgressIndicator(
                        progress = rate / 100f,
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(999.dp)),
                        color = Color(0xFF86EFAC),
                        trackColor = Color.White.copy(alpha = .14f),
                    )
                }
            }
        }
        item {
            val label = when (state.subscription.plan) {
                SubscriptionPlan.FREE -> "Free"
                SubscriptionPlan.TRIAL -> "Plus · Dùng thử"
                SubscriptionPlan.PLUS -> "Plus"
            }
            TroOiCard(Modifier.fillMaxWidth(), onClick = onOpenSubscription) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("GÓI ĐANG SỬ DỤNG", style = MaterialTheme.typography.labelMedium, color = TroOiGreen)
                        Text("$label · ${state.rooms.size}/${subscriptionCapacity(state.subscription)} phòng", style = MaterialTheme.typography.titleMedium)
                        Text("${state.subscription.addBlocks} Add block · ${if (state.subscription.autoRenew) "Đang bật gia hạn tự động" else "Đã tắt gia hạn"}", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                    }
                    Surface(shape = CircleShape, color = TroOiGreen, modifier = Modifier.size(34.dp)) {
                        Box(contentAlignment = Alignment.Center) { Icon(Icons.Rounded.ChevronRight, null, tint = Color.White) }
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard("Đã thu tháng này", formatVnd(collected), "Dự kiến ${formatVnd(expected)}", Modifier.weight(1f))
                KpiCard("Công nợ", formatVnd(totalDebt), "${state.rooms.count { it.debt > 0 }} phòng cần nhắc", Modifier.weight(1f), TroOiRed)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard("Ticket quá hạn", highTickets.toString(), "${openTickets.size} yêu cầu đang mở", Modifier.weight(1f), if (highTickets > 0) TroOiRed else TroOiText)
                KpiCard("Phòng trống", empty.toString(), "Cần đăng lại / chia sẻ", Modifier.weight(1f))
            }
        }
        item { SectionTitle("Việc cần làm hôm nay", "Xem tất cả", onOpenTickets) }
        items(state.rooms.filter { it.debt > 0 }.take(2), key = { LazyItemKeys.dashboardDebt(it.id) }) { room ->
            TodoRow(Icons.Rounded.Payments, "Nhắc thanh toán ${room.tenant.orEmpty()}", "Còn nợ ${formatVnd(room.debt)}", StatusKind.DANGER)
        }
        items(openTickets.take(2), key = { LazyItemKeys.dashboardTicket(it.id) }) { ticket ->
            TodoRow(Icons.Rounded.Build, ticket.title, "${roomCode(ticket.roomId)} · ${ticket.priority}", if (ticket.priority == "Ưu tiên cao") StatusKind.DANGER else StatusKind.WARNING)
        }
        item {
            SectionTitle("Thao tác nhanh")
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickAction(Icons.Rounded.ReceiptLong, "Tạo hóa đơn", onOpenFinance, Modifier.weight(1f))
                    QuickAction(Icons.Rounded.Payments, "Nhắc nợ", onOpenFinance, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickAction(Icons.Rounded.Build, "Tạo ticket", onOpenTickets, Modifier.weight(1f))
                    QuickAction(Icons.Rounded.AddBox, "Thêm phòng", onOpenRooms, Modifier.weight(1f))
                }
            }
        }
        item { SectionTitle("Phòng cần chú ý", "Xem tất cả", onOpenRooms) }
        items(state.rooms.filter { it.debt > 0 || !it.rented }.take(3), key = { LazyItemKeys.dashboardAttention(it.id) }) { room ->
            LandlordRoomCard(room = room, ticketCount = state.tickets.count { it.roomId == room.id && it.status != "Hoàn tất" }, onClick = onOpenRooms)
        }
    }
}

@Composable
private fun TodoRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, status: StatusKind) {
    TroOiCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = CircleShape, color = TroOiGreenSoft, modifier = Modifier.size(34.dp)) {
                Box(contentAlignment = Alignment.Center) { Icon(icon, null, tint = TroOiGreen, modifier = Modifier.size(18.dp)) }
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.labelLarge)
                Text(subtitle, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
            }
            StatusPill(if (status == StatusKind.DANGER) "Ưu tiên" else "Đang mở", status)
        }
    }
}

@Composable
private fun QuickAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(modifier = modifier.clickable(onClick = onClick), shape = RoundedCornerShape(16.dp), color = Color.White, border = BorderStroke(1.dp, TroOiLine)) {
        Column(Modifier.padding(vertical = 10.dp, horizontal = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(shape = RoundedCornerShape(11.dp), color = TroOiGreenSoft, modifier = Modifier.size(32.dp)) {
                Box(contentAlignment = Alignment.Center) { Icon(icon, null, tint = TroOiGreen, modifier = Modifier.size(18.dp)) }
            }
            Spacer(Modifier.height(6.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, maxLines = 1)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LandlordRoomsScreen(state: TroOiUiState) {
    var filter by remember { mutableStateOf("all") }
    var selectedRoom by remember { mutableStateOf<RoomUi?>(null) }
    val rooms = state.rooms.filter { filter == "all" || (filter == "rented" && it.rented) || (filter == "empty" && !it.rented) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("landlord-rooms-list"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Danh sách phòng", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
                CircleIconButton(Icons.Rounded.Add, "Thêm phòng", {})
            }
        }
        item {
            Surface(Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(999.dp), color = Color.White, border = BorderStroke(1.dp, TroOiLine)) {
                Row(Modifier.padding(horizontal = 15.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Search, null, tint = TroOiMuted)
                    Spacer(Modifier.width(8.dp))
                    Text("Tìm phòng, khách thuê, công nợ...", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                }
            }
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(filter == "all", { filter = "all" }, { Text("Tất cả ${state.rooms.size}") }) }
                item { FilterChip(filter == "rented", { filter = "rented" }, { Text("Đang thuê ${state.rooms.count { it.rented }}") }) }
                item { FilterChip(filter == "empty", { filter = "empty" }, { Text("Trống ${state.rooms.count { !it.rented }}") }) }
            }
        }
        items(rooms, key = { it.id }) { room ->
            LandlordRoomCard(room, state.tickets.count { it.roomId == room.id && it.status != "Hoàn tất" }) { selectedRoom = room }
        }
    }

    selectedRoom?.let { room ->
        ModalBottomSheet(onDismissRequest = { selectedRoom = null }, containerColor = Color.White) {
            RoomLedgerSheet(room, state.tickets.filter { it.roomId == room.id && it.status != "Hoàn tất" })
        }
    }
}

@Composable
private fun LandlordRoomCard(room: RoomUi, ticketCount: Int, onClick: () -> Unit) {
    TroOiCard(Modifier.fillMaxWidth(), onClick = onClick) {
        Row {
            Column(Modifier.weight(1f)) {
                Text(roomCode(room.id), style = MaterialTheme.typography.titleLarge)
                Text(if (room.rented) room.tenant.orEmpty() else "Chưa có người thuê", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
            }
            StatusPill(if (room.rented) if (room.debt > 0) "Cần nhắc nợ" else "Đang thuê" else "Phòng trống", if (room.rented) if (room.debt > 0) StatusKind.WARNING else StatusKind.SUCCESS else StatusKind.INFO)
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MiniLandlordMetric("Tiền thuê", formatVnd(room.price), Modifier.weight(1f), room.debt > 0)
            MiniLandlordMetric("Ticket mở", ticketCount.toString(), Modifier.weight(1f))
            MiniLandlordMetric("Biên nhận", if (room.debt > 0) "Chờ xác nhận" else if (room.rented) "Đã nhận" else "—", Modifier.weight(1f))
        }
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(if (room.debt > 0) "Nợ ${formatVnd(room.debt)}" else if (room.rented) "Đã thanh toán" else "Sẵn sàng cho thuê", style = MaterialTheme.typography.labelMedium, color = if (room.debt > 0) TroOiRed else TroOiGreen)
            Spacer(Modifier.weight(1f))
            Icon(Icons.Rounded.ChevronRight, null, tint = TroOiMuted)
        }
    }
}

@Composable
private fun MiniLandlordMetric(label: String, value: String, modifier: Modifier, danger: Boolean = false) {
    Surface(modifier, shape = RoundedCornerShape(13.dp), color = Color(0xFFFFFDF8), border = BorderStroke(1.dp, TroOiLine)) {
        Column(Modifier.padding(8.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.labelLarge, color = if (danger) TroOiRed else TroOiText, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun RoomLedgerSheet(room: RoomUi, tickets: List<TicketUi>) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(roomCode(room.id), style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
            StatusPill(if (room.rented) "Đang thuê" else "Phòng trống", if (room.rented) StatusKind.SUCCESS else StatusKind.INFO)
        }
        LedgerSection("Thông tin thuê", listOf(
            "Người thuê" to (room.tenant ?: "Chưa có"),
            "SĐT" to (room.tenantPhone ?: "—"),
            "Tiền thuê" to "${formatVnd(room.price)} / tháng",
            "Tiền cọc" to formatVnd(room.deposit),
        ))
        LedgerSection("Công nợ", listOf(
            "Tổng nợ" to if (room.debt > 0) formatVnd(room.debt) else "0đ",
            "Trạng thái" to if (room.debt > 0) "Cần đối chiếu" else "Đã thanh toán",
        ))
        LedgerSection("Ticket đang mở", if (tickets.isEmpty()) listOf("Trạng thái" to "Không có sự cố đang mở") else tickets.map { "#${it.id}" to it.title })
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SecondaryButton("Nhắc thanh toán", {}, Modifier.weight(1f))
            PrimaryButton("Tạo hóa đơn", {}, Modifier.weight(1f))
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun LedgerSection(title: String, rows: List<Pair<String, String>>) {
    TroOiCard(Modifier.fillMaxWidth()) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
        Spacer(Modifier.height(6.dp))
        rows.forEachIndexed { index, pair ->
            Row(Modifier.fillMaxWidth().padding(vertical = 7.dp)) {
                Text(pair.first, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                Text(pair.second, style = MaterialTheme.typography.labelLarge)
            }
            if (index != rows.lastIndex) HorizontalDivider(color = TroOiLine.copy(alpha = .7f))
        }
    }
}

@Composable
fun LandlordFinanceScreen(state: TroOiUiState) {
    val expected = state.rooms.filter { it.rented }.sumOf { it.price }
    val totalDebt = state.rooms.sumOf { it.debt }
    val collected = (expected - totalDebt).coerceAtLeast(0)
    val rate = if (expected == 0L) 0 else ((collected * 100) / expected).toInt()
    val debtRooms = state.rooms.filter { it.debt > 0 }

    LazyColumn(Modifier.fillMaxSize().testTag("landlord-finance-list"), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Tài chính", style = MaterialTheme.typography.headlineMedium) }
        item {
            TroOiCard(Modifier.fillMaxWidth()) {
                Text("TIẾN ĐỘ THU TIỀN THÁNG NÀY", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("$rate%", style = MaterialTheme.typography.headlineLarge)
                    Spacer(Modifier.weight(1f))
                    Text("Đã thu\n${formatVnd(collected)}", style = MaterialTheme.typography.labelLarge, color = TroOiGreen)
                }
                Spacer(Modifier.height(10.dp))
                LinearProgressIndicator(progress = rate / 100f, modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(999.dp)), color = TroOiGreen, trackColor = TroOiGreenSoft)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard("Đã thu", state.rooms.count { it.rented && it.debt == 0L }.toString(), formatVnd(collected), Modifier.weight(1f), TroOiGreen)
                KpiCard("Chưa thu", debtRooms.size.toString(), formatVnd(totalDebt), Modifier.weight(1f), TroOiAmber)
            }
        }
        item { SectionTitle("Danh sách công nợ", "Nhắc tất cả") }
        if (debtRooms.isEmpty()) {
            item { EmptyState(Icons.Rounded.CheckCircle, "Không còn công nợ", "Tất cả phòng đã được ghi nhận thanh toán.") }
        } else {
            items(debtRooms, key = { LazyItemKeys.financeDebt(it.id) }) { room ->
                TroOiCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("${roomCode(room.id)} · ${room.tenant.orEmpty()}", style = MaterialTheme.typography.titleMedium)
                            Text("${room.name} · cần đối chiếu", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(formatVnd(room.debt), style = MaterialTheme.typography.labelLarge, color = TroOiRed)
                            TextButton(onClick = {}) { Text("Nhắc nợ", color = TroOiGreen) }
                        }
                    }
                }
            }
        }
        item { SectionTitle("Lịch sử giao dịch", "Xuất") }
        items(state.finance, key = { LazyItemKeys.financeEntry(it.id) }) { entry ->
            TroOiCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(shape = CircleShape, color = if (entry.incoming) TroOiGreenSoft else Color(0xFFFFF0EE), modifier = Modifier.size(44.dp)) {
                        Box(contentAlignment = Alignment.Center) { Icon(if (entry.incoming) Icons.Rounded.South else Icons.Rounded.North, null, tint = if (entry.incoming) TroOiGreen else TroOiRed) }
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(entry.label, style = MaterialTheme.typography.titleMedium)
                        Text(entry.note, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text((if (entry.incoming) "+" else "-") + formatVnd(entry.amount), style = MaterialTheme.typography.labelLarge, color = if (entry.incoming) TroOiGreen else TroOiText)
                        Text(entry.time, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LandlordTicketsScreen(state: TroOiUiState, onComplete: (String) -> Unit) {
    var selected by remember { mutableStateOf<TicketUi?>(null) }
    val open = state.tickets.filter { it.status != "Hoàn tất" }
    LazyColumn(Modifier.fillMaxSize().testTag("landlord-tickets-list"), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
        item { Text("Yêu cầu sự cố", style = MaterialTheme.typography.headlineMedium) }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(true, {}, { Text("Tất cả ${state.tickets.size}") }) }
                item { FilterChip(false, {}, { Text("Chờ xử lý ${open.size}") }) }
                item { FilterChip(false, {}, { Text("Hoàn tất ${state.tickets.size - open.size}") }) }
            }
        }
        if (open.isEmpty()) {
            item { EmptyState(Icons.Rounded.Celebration, "Tuyệt vời!", "Không còn sự cố nào tồn đọng.") }
        } else {
            items(open, key = { it.id }) { ticket ->
                TroOiCard(Modifier.fillMaxWidth(), onClick = { selected = ticket }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("#${ticket.id} · ${roomCode(ticket.roomId)}", style = MaterialTheme.typography.labelMedium, color = TroOiMuted, modifier = Modifier.weight(1f))
                        StatusPill(ticket.status, if (ticket.priority == "Ưu tiên cao") StatusKind.DANGER else StatusKind.WARNING)
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(ticket.title, style = MaterialTheme.typography.titleMedium)
                    Text("Người xử lý: ${ticket.assignee} · ${ticket.priority}", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                }
            }
        }
    }

    selected?.let { ticket ->
        ModalBottomSheet(onDismissRequest = { selected = null }, containerColor = Color.White) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${roomCode(ticket.roomId)} · ${ticket.id}", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
                    StatusPill(ticket.priority, if (ticket.priority == "Ưu tiên cao") StatusKind.DANGER else StatusKind.WARNING)
                }
                LedgerSection("Thông tin sự cố", listOf("Mô tả" to ticket.title, "Phòng" to roomCode(ticket.roomId), "Người xử lý" to ticket.assignee, "Trạng thái" to ticket.status))
                TroOiCard(Modifier.fillMaxWidth()) {
                    Text("Lịch sử xử lý".uppercase(), style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                    ticket.timeline.forEach { step ->
                        Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(10.dp).clip(CircleShape).background(TroOiGreen))
                            Spacer(Modifier.width(9.dp))
                            Text(step, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                PrimaryButton("Cập nhật / Hoàn tất", { selected = null; onComplete(ticket.id) }, Modifier.fillMaxWidth())
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun LandlordProfileScreen(state: TroOiUiState, onSubscription: () -> Unit, onSwitchRole: () -> Unit, onLogout: () -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Hệ thống Chủ Trọ", style = MaterialTheme.typography.headlineMedium) }
        item {
            TroOiCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(shape = CircleShape, color = TroOiSlate, modifier = Modifier.size(60.dp)) {
                        Box(contentAlignment = Alignment.Center) { Text("M", color = Color.White, style = MaterialTheme.typography.titleLarge) }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(state.displayName.ifBlank { "Chủ trọ TrọƠi" }, style = MaterialTheme.typography.titleLarge)
                        StatusPill(if (state.subscription.plan == SubscriptionPlan.FREE) "Free" else "Plus · ${subscriptionCapacity(state.subscription)} phòng", StatusKind.SUCCESS)
                    }
                }
            }
        }
        item { LandlordProfileRow(Icons.Rounded.Payments, "Gói & thanh toán", "Quản lý subscription, capacity và billing", onSubscription) }
        item { LandlordProfileRow(Icons.Rounded.Build, "Quản lý sự cố", "Ticket, SLA và phân công xử lý", {}) }
        item { LandlordProfileRow(Icons.Rounded.Apartment, "Cấu hình tòa nhà & phòng", "Thông tin vận hành và hồ sơ phòng", {}) }
        item { LandlordProfileRow(Icons.Rounded.Cloud, "Đồng bộ Cloud Backup", "Dữ liệu được đồng bộ qua backend", {}) }
        item { PrimaryButton("Chuyển vai trò Người Thuê", onSwitchRole, Modifier.fillMaxWidth()) }
        item {
            OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(15.dp), border = BorderStroke(1.dp, TroOiRed)) {
                Icon(Icons.Rounded.Logout, null, tint = TroOiRed)
                Spacer(Modifier.width(8.dp))
                Text("Đăng xuất", color = TroOiRed)
            }
        }
    }
}

@Composable
private fun LandlordProfileRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    TroOiCard(Modifier.fillMaxWidth(), onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = CircleShape, color = Color(0xFFF3F4F6), modifier = Modifier.size(44.dp)) {
                Box(contentAlignment = Alignment.Center) { Icon(icon, null, tint = TroOiText) }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
            }
            Icon(Icons.Rounded.ChevronRight, null, tint = TroOiMuted)
        }
    }
}

@Composable
fun LandlordSubscriptionScreen(state: TroOiUiState, onBack: () -> Unit, onActivatePlus: () -> Unit) {
    BackHandler(onBack = onBack)
    val sub = state.subscription
    val capacity = subscriptionCapacity(sub)
    val usage = if (capacity == 0) 0f else (state.rooms.size.toFloat() / capacity).coerceIn(0f, 1f)
    val label = when (sub.plan) {
        SubscriptionPlan.FREE -> "Free"
        SubscriptionPlan.TRIAL -> "Plus"
        SubscriptionPlan.PLUS -> "Plus"
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(Icons.Rounded.ArrowBack, "Quay lại", onBack)
                Spacer(Modifier.width(10.dp))
                Text("Gói & thanh toán", style = MaterialTheme.typography.headlineMedium)
            }
        }
        item {
            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(TroOiSlate).padding(15.dp)) {
                Row {
                    Column(Modifier.weight(1f)) {
                        Text("GÓI HIỆN TẠI", style = MaterialTheme.typography.labelMedium, color = Color(0xFFA7CBB7))
                        Text(label, style = MaterialTheme.typography.headlineMedium, color = Color.White)
                        Text(when (sub.plan) {
                            SubscriptionPlan.TRIAL -> "Đang dùng thử Plus · hết hạn ${sub.trialExpiry}"
                            SubscriptionPlan.PLUS -> "Đang active · hết hạn ${sub.plusExpiry}"
                            SubscriptionPlan.FREE -> "Gói miễn phí"
                        }, style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = .72f))
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(if (sub.plan == SubscriptionPlan.TRIAL) "0đ" else if (sub.plan == SubscriptionPlan.PLUS) "5.988.000đ" else "Miễn phí", style = MaterialTheme.typography.titleLarge, color = Color(0xFF86EFAC))
                        Text(if (sub.plan == SubscriptionPlan.PLUS) "/ năm" else "", style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = .68f))
                    }
                }
            }
        }
        item {
            TroOiCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Phòng đã tạo trong hệ thống", Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                    Text("${state.rooms.size}/$capacity", style = MaterialTheme.typography.titleLarge)
                }
                Spacer(Modifier.height(10.dp))
                LinearProgressIndicator(progress = usage, modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(999.dp)), color = TroOiGreen, trackColor = TroOiGreenSoft)
                Spacer(Modifier.height(6.dp))
                Text("${sub.addBlocks} Add block · còn ${(capacity - state.rooms.size).coerceAtLeast(0)} chỗ trống", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
            }
        }
        item { SectionTitle("Gói subscription") }
        item {
            PlanCard("Free", "Miễn phí · 3 phòng", listOf("Hồ sơ phòng cơ bản", "Quản lý tối đa 3 phòng", "Giới hạn tính năng vận hành"), current = sub.plan == SubscriptionPlan.FREE)
        }
        item {
            PlanCard("Plus", "5.988.000đ / năm", listOf("10 phòng cơ bản", "Công nợ, biên nhận, ticket", "Dashboard, import và vận hành"), current = sub.plan != SubscriptionPlan.FREE)
            if (sub.plan != SubscriptionPlan.PLUS) {
                Spacer(Modifier.height(8.dp))
                PrimaryButton("Đăng ký Plus (debug)", onActivatePlus, Modifier.fillMaxWidth())
            }
        }
        item {
            TroOiCard(Modifier.fillMaxWidth()) {
                Text("Add block", style = MaterialTheme.typography.titleMedium)
                Text("+5 phòng / block · chỉ mở khi Plus active", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                Spacer(Modifier.height(8.dp))
                StatusPill(if (sub.plan == SubscriptionPlan.PLUS) "${sub.addBlocks} đang dùng" else "Cần Plus active", if (sub.plan == SubscriptionPlan.PLUS) StatusKind.WARNING else StatusKind.NEUTRAL)
            }
        }
    }
}

@Composable
private fun PlanCard(title: String, price: String, features: List<String>, current: Boolean) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = if (current) Color(0xFFFBFFFC) else Color.White,
        border = BorderStroke(if (current) 2.dp else 1.dp, if (current) TroOiGreen else TroOiLine),
    ) {
        Column(Modifier.padding(13.dp)) {
            Row {
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(title, style = MaterialTheme.typography.titleMedium)
                        if (current) { Spacer(Modifier.width(8.dp)); StatusPill("Đang dùng", StatusKind.SUCCESS) }
                    }
                    Text("Gói dành cho chủ trọ/operator", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                }
                Text(price, style = MaterialTheme.typography.labelLarge, color = TroOiGreen)
            }
            Spacer(Modifier.height(10.dp))
            features.forEach { feature ->
                Row(Modifier.padding(vertical = 3.dp)) {
                    Icon(Icons.Rounded.Check, null, tint = TroOiGreen, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(feature, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                }
            }
        }
    }
}

private fun roomCode(roomId: Int): String = "P.${100 + roomId}"
private fun subscriptionCapacity(subscription: SubscriptionUi): Int = when (subscription.plan) {
    SubscriptionPlan.FREE -> 3
    SubscriptionPlan.TRIAL -> 10
    SubscriptionPlan.PLUS -> 10 + subscription.addBlocks * 5
}
