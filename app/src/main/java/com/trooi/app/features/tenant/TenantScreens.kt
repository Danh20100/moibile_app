package com.trooi.app.features.tenant

import androidx.compose.foundation.BorderStroke
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.*

private enum class HomeSheet { SEARCH, FILTER, LOCATION, NOTIFICATIONS }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TenantHomeScreen(
    state: TroOiUiState,
    onOpenRoom: (Int) -> Unit,
    onToggleSaved: (Int) -> Unit,
) {
    var sheet by remember { mutableStateOf<HomeSheet?>(null) }
    val discoverable = state.rooms.filter { it.discoverable }
    val hero = discoverable.firstOrNull()

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-home-list"),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 26.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { sheet = HomeSheet.LOCATION }, contentPadding = PaddingValues(0.dp)) {
                    Icon(Icons.Rounded.LocationOn, null, tint = TroOiGreen, modifier = Modifier.size(18.dp))
                    Text("TP. Hồ Chí Minh", color = TroOiText, style = MaterialTheme.typography.labelLarge)
                    Icon(Icons.Rounded.KeyboardArrowDown, null, tint = TroOiMuted)
                }
                Spacer(Modifier.weight(1f))
                CircleIconButton(Icons.Rounded.NotificationsNone, "Thông báo", { sheet = HomeSheet.NOTIFICATIONS })
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(
                    modifier = Modifier.weight(1f).height(48.dp).clickable { sheet = HomeSheet.SEARCH },
                    shape = RoundedCornerShape(999.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, TroOiLine),
                ) {
                    Row(Modifier.padding(horizontal = 15.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Search, null, tint = TroOiMuted, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(9.dp))
                        Text("Tìm phòng theo khu vực, tên tòa nhà...", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                FilledIconButton(
                    onClick = { sheet = HomeSheet.FILTER },
                    modifier = Modifier.size(48.dp),
                    colors = IconButtonDefaults.filledIconButtonColors(containerColor = TroOiGreen),
                ) {
                    Icon(Icons.Rounded.Tune, "Bộ lọc", tint = Color.White)
                }
            }
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(listOf("Giá: 2 - 6 triệu", "Khu vực", "Tiện ích", "Đã xác minh")) { label ->
                    FilterChip(
                        selected = label.startsWith("Giá"),
                        onClick = { sheet = HomeSheet.FILTER },
                        label = { Text(label) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = TroOiGreenSoft, selectedLabelColor = TroOiGreen),
                    )
                }
            }
        }

        item { DiscoveryMap(onOpenRoom = onOpenRoom) }

        hero?.let { room ->
            item {
                HeroRoomCard(room, room.id in state.savedRoomIds, onOpenRoom, onToggleSaved)
            }
        }

        item { SectionTitle("Phòng gợi ý cho bạn") }

        items(discoverable.drop(1), key = { it.id }) { room ->
            RoomCard(
                room = room,
                saved = room.id in state.savedRoomIds,
                onOpen = { onOpenRoom(room.id) },
                onToggleSaved = { onToggleSaved(room.id) },
            )
        }
    }

    sheet?.let { active ->
        ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = Color.White) {
            when (active) {
                HomeSheet.SEARCH -> SearchSheet { sheet = null }
                HomeSheet.FILTER -> FilterSheet { sheet = null }
                HomeSheet.LOCATION -> LocationSheet { sheet = null }
                HomeSheet.NOTIFICATIONS -> NotificationSheet(state) { sheet = null }
            }
        }
    }
}

@Composable
private fun DiscoveryMap(onOpenRoom: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f)) {
                Text("Phòng quanh vị trí của bạn", style = MaterialTheme.typography.titleMedium)
                Text("3 phòng phù hợp trong bán kính 2 km", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
            }
            Text("Xem toàn bản đồ", style = MaterialTheme.typography.labelMedium, color = TroOiGreen)
        }
        Box(
            modifier = Modifier.fillMaxWidth().height(230.dp).clip(RoundedCornerShape(22.dp)).background(Color(0xFFDCEADF)),
        ) {
            repeat(5) { index ->
                Box(
                    Modifier
                        .offset(x = (18 + index * 58).dp, y = (22 + (index % 3) * 56).dp)
                        .size(width = 70.dp, height = 42.dp)
                        .clip(RoundedCornerShape(9.dp))
                        .background(Color(0xFFC9D9C5)),
                )
            }
            Box(
                Modifier.align(Alignment.Center).size(150.dp).clip(CircleShape).background(TroOiGreen.copy(alpha = .10f)),
            )
            Icon(Icons.Rounded.LocationOn, null, tint = TroOiGreen, modifier = Modifier.align(Alignment.Center).size(34.dp))
            MapPrice("3,8 triệu", Modifier.offset(26.dp, 86.dp), true) { onOpenRoom(5) }
            MapPrice("4,2 triệu", Modifier.align(Alignment.TopEnd).offset((-24).dp, 92.dp), false) { onOpenRoom(4) }
            MapPrice("5,1 triệu", Modifier.align(Alignment.BottomCenter).offset(y = (-20).dp), false) { onOpenRoom(3) }
        }
    }
}

@Composable
private fun MapPrice(text: String, modifier: Modifier, active: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        color = if (active) TroOiGreen else Color.White,
        contentColor = if (active) Color.White else TroOiText,
        shape = RoundedCornerShape(10.dp),
        shadowElevation = 4.dp,
    ) {
        Text(text, Modifier.padding(horizontal = 9.dp, vertical = 7.dp), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun HeroRoomCard(room: RoomUi, saved: Boolean, onOpen: (Int) -> Unit, onToggleSaved: (Int) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onOpen(room.id) },
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFAF3)),
        elevation = CardDefaults.cardElevation(4.dp),
    ) {
        Box(Modifier.fillMaxWidth().height(224.dp)) {
            RoomArt(Modifier.fillMaxSize(), large = true)
            Column(Modifier.padding(16.dp).widthIn(max = 210.dp)) {
                StatusPill("PHÒNG NỔI BẬT", StatusKind.SUCCESS)
                Spacer(Modifier.height(10.dp))
                Text(room.name, style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.height(5.dp))
                Text(room.area, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                Spacer(Modifier.height(10.dp))
                Text("${formatVnd(room.price)} / tháng", style = MaterialTheme.typography.titleLarge, color = TroOiGreen)
                room.scarcity?.let {
                    Spacer(Modifier.height(7.dp))
                    StatusPill(it, StatusKind.DANGER)
                }
            }
            FilledIconButton(
                onClick = { onToggleSaved(room.id) },
                modifier = Modifier.align(Alignment.TopEnd).padding(12.dp),
                colors = IconButtonDefaults.filledIconButtonColors(containerColor = if (saved) TroOiRed else Color.White),
            ) {
                Icon(if (saved) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder, "Yêu thích", tint = if (saved) Color.White else TroOiText)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TenantRoomDetailScreen(
    room: RoomUi,
    saved: Boolean,
    onBack: () -> Unit,
    onToggleSaved: () -> Unit,
    onBook: (String, String) -> Unit,
    onMessage: () -> Unit,
) {
    BackHandler(onBack = onBack)
    var bookingOpen by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircleIconButton(Icons.Rounded.ArrowBack, "Quay lại", onBack)
                    Spacer(Modifier.width(10.dp))
                    Text("Chi tiết phòng", style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.weight(1f))
                    CircleIconButton(if (saved) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder, "Yêu thích", onToggleSaved, tint = if (saved) TroOiRed else TroOiText)
                }
            }
            item { RoomArt(Modifier.fillMaxWidth(), large = true) }
            item {
                TroOiCard(Modifier.fillMaxWidth()) {
                    Row {
                        Column(Modifier.weight(1f)) {
                            Text(room.name, style = MaterialTheme.typography.headlineMedium)
                            Spacer(Modifier.height(5.dp))
                            Text("${room.area} · ${room.distance}", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                            Spacer(Modifier.height(8.dp))
                            StatusPill(room.verification, StatusKind.SUCCESS)
                        }
                        Text("${formatVnd(room.price)}\n/ tháng", style = MaterialTheme.typography.titleMedium, color = TroOiGreen)
                    }
                    Spacer(Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MiniMetric("Đặt cọc", formatVnd(room.deposit), Modifier.weight(1f))
                        MiniMetric("Điện", room.electric, Modifier.weight(1f))
                        MiniMetric("Wifi", room.wifi, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(12.dp))
                    Surface(shape = RoundedCornerShape(17.dp), color = TroOiGreenSoft) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.VerifiedUser, null, tint = TroOiGreen)
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text("Listing Accuracy Score", style = MaterialTheme.typography.labelLarge)
                                Text("Độ tin cậy cao · thông tin đã xác minh", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                            }
                            Text("${room.score}/5", style = MaterialTheme.typography.titleLarge, color = TroOiGreen)
                        }
                    }
                }
            }
            item {
                TroOiCard(Modifier.fillMaxWidth()) {
                    Text("Tiện ích", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        room.amenities.take(4).forEach { amenity ->
                            Surface(Modifier.weight(1f), shape = RoundedCornerShape(14.dp), color = Color(0xFFF8F5EF)) {
                                Column(Modifier.padding(vertical = 10.dp, horizontal = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Rounded.CheckCircleOutline, null, tint = TroOiGreen, modifier = Modifier.size(20.dp))
                                    Spacer(Modifier.height(5.dp))
                                    Text(amenity, style = MaterialTheme.typography.labelMedium, maxLines = 2)
                                }
                            }
                        }
                    }
                }
            }
            item {
                TroOiCard(Modifier.fillMaxWidth()) {
                    Text("Chi phí minh bạch", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(10.dp))
                    CostRow("Điện", room.electric)
                    CostRow("Nước", room.water)
                    CostRow("Phí dịch vụ", room.serviceFee)
                    CostRow("Giữ xe", "100.000đ/xe")
                }
            }
            item {
                TroOiCard(Modifier.fillMaxWidth()) {
                    Text("Đánh giá từ người thuê trước", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("${room.score}/5", style = MaterialTheme.typography.headlineMedium, color = TroOiGreen)
                        Spacer(Modifier.width(8.dp))
                        repeat(5) { Icon(Icons.Rounded.Star, null, tint = TroOiAmber, modifier = Modifier.size(17.dp)) }
                    }
                    Spacer(Modifier.height(7.dp))
                    Text("“Phòng giống ảnh, chủ nhà đúng hẹn, chi phí điện nước rõ ràng.”", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                }
            }
        }

        Surface(
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth(),
            color = TroOiBackground.copy(alpha = .96f),
            shadowElevation = 8.dp,
        ) {
            Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SecondaryButton("Nhắn chủ trọ", onMessage, Modifier.weight(1f))
                PrimaryButton("Đặt lịch xem phòng", { bookingOpen = true }, Modifier.weight(1.25f))
            }
        }
    }

    if (bookingOpen) {
        ModalBottomSheet(onDismissRequest = { bookingOpen = false }, containerColor = Color.White) {
            BookingSheet(room) { date, time ->
                bookingOpen = false
                onBook(date, time)
            }
        }
    }
}

@Composable
private fun MiniMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(10.dp), border = BorderStroke(1.dp, TroOiLine), color = Color.White) {
        Column(Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
            Text(value, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun CostRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 7.dp)) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
        Text(value, style = MaterialTheme.typography.labelLarge)
    }
    HorizontalDivider(color = TroOiLine.copy(alpha = .7f))
}

@Composable
private fun BookingSheet(room: RoomUi, onConfirm: (String, String) -> Unit) {
    var date by remember { mutableStateOf("27/07/2026") }
    var time by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Đặt lịch xem phòng", style = MaterialTheme.typography.titleLarge)
        TroOiCard(Modifier.fillMaxWidth()) {
            Text(room.name, style = MaterialTheme.typography.titleMedium)
            Text("${room.area} · ${formatVnd(room.price)}/tháng", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
        }
        OutlinedTextField(date, { date = it }, Modifier.fillMaxWidth(), label = { Text("Ngày xem phòng") }, singleLine = true)
        Text("Chọn giờ", style = MaterialTheme.typography.labelLarge)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(listOf("09:00", "10:30", "14:00", "16:00", "18:00")) { slot ->
                FilterChip(selected = time == slot, onClick = { time = slot }, label = { Text(slot) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = TroOiGreen, selectedLabelColor = Color.White))
            }
        }
        Surface(shape = RoundedCornerShape(16.dp), color = TroOiGreenSoft) {
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Lock, null, tint = TroOiGreen)
                Spacer(Modifier.width(8.dp))
                Text("Lưu giá niêm yết tại thời điểm đặt lịch", style = MaterialTheme.typography.labelLarge, color = TroOiGreen)
            }
        }
        PrimaryButton("Xác nhận đặt lịch", { time?.let { onConfirm(date, it) } }, Modifier.fillMaxWidth(), enabled = date.isNotBlank() && time != null)
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
fun TenantSavedScreen(state: TroOiUiState, onOpenRoom: (Int) -> Unit, onToggleSaved: (Int) -> Unit) {
    val saved = state.rooms.filter { it.id in state.savedRoomIds && it.discoverable }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Text("Phòng yêu thích", style = MaterialTheme.typography.headlineMedium) }
        if (saved.isEmpty()) {
            item { EmptyState(Icons.Rounded.FavoriteBorder, "Chưa có phòng yêu thích", "Bấm trái tim ở phòng bạn thích để lưu lại.") }
        } else {
            items(saved, key = { it.id }) { room ->
                RoomCard(room, true, { onOpenRoom(room.id) }, { onToggleSaved(room.id) })
            }
        }
    }
}

@Composable
fun TenantScheduleScreen(
    state: TroOiUiState,
    onOpenMessages: () -> Unit,
    onConfirm: (Long) -> Unit,
    onCancel: (Long) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Text("Lịch xem phòng", style = MaterialTheme.typography.headlineMedium) }
        if (state.bookings.isEmpty()) {
            item { EmptyState(Icons.Rounded.CalendarMonth, "Chưa có lịch hẹn", "Đặt lịch xem phòng để lưu thời gian và trao đổi với chủ trọ.") }
        } else {
            items(state.bookings, key = { it.id }) { booking ->
                val room = state.rooms.firstOrNull { it.id == booking.roomId }
                if (room != null) {
                    TroOiCard(Modifier.fillMaxWidth()) {
                        Row {
                            Column(Modifier.weight(1f)) {
                                Text(room.name, style = MaterialTheme.typography.titleMedium)
                                Text("${booking.date} · ${booking.time}\n${room.address}", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                            }
                            StatusPill(
                                when (booking.status) {
                                    BookingStatus.CONFIRMED -> "Đã xác nhận"
                                    BookingStatus.PENDING -> "Chờ xác nhận"
                                    BookingStatus.CANCELLED -> "Đã hủy"
                                },
                                when (booking.status) {
                                    BookingStatus.CONFIRMED -> StatusKind.SUCCESS
                                    BookingStatus.PENDING -> StatusKind.WARNING
                                    BookingStatus.CANCELLED -> StatusKind.NEUTRAL
                                },
                            )
                        }
                        if (booking.status == BookingStatus.PENDING) {
                            Spacer(Modifier.height(10.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                SecondaryButton("Nhắn chủ trọ", onOpenMessages, Modifier.weight(1f))
                                TextButton(onClick = { onConfirm(booking.id) }) { Text("Xác nhận") }
                                TextButton(onClick = { onCancel(booking.id) }) { Text("Hủy", color = TroOiRed) }
                            }
                        }
                    }
                }
            }
        }
        item {
            TroOiCard(Modifier.fillMaxWidth()) {
                Text("Quyền lợi khi đặt lịch qua TrọƠi", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(10.dp))
                Benefit("Lưu đầy đủ lịch hẹn", "Thời gian, địa điểm và phòng cần xem được lưu trong ứng dụng.")
                Benefit("Xác nhận trực tiếp với chủ trọ", "Hai bên có thể xác nhận hoặc đề xuất lại thời gian qua tin nhắn.")
                Benefit("Có dữ liệu để đối chiếu", "Thông tin phòng và nội dung trao đổi được lưu trước khi đi xem.")
            }
        }
    }
}

@Composable
private fun Benefit(title: String, description: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(shape = RoundedCornerShape(11.dp), color = TroOiGreenSoft, modifier = Modifier.size(34.dp)) {
            Box(contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Check, null, tint = TroOiGreen, modifier = Modifier.size(18.dp)) }
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.labelLarge)
            Text(description, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
        }
    }
}

@Composable
fun TenantMessagesScreen(state: TroOiUiState, onOpenChat: (Long) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { Text("Tin nhắn", style = MaterialTheme.typography.headlineMedium) }
        if (state.conversations.isEmpty()) {
            item { EmptyState(Icons.Rounded.ChatBubbleOutline, "Chưa có cuộc trò chuyện", "Tin nhắn với chủ trọ sẽ hiển thị tại đây.") }
        } else {
            items(state.conversations, key = { it.id }) { conversation ->
                val room = state.rooms.firstOrNull { it.id == conversation.roomId }
                TroOiCard(Modifier.fillMaxWidth(), onClick = { onOpenChat(conversation.id) }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(shape = CircleShape, color = TroOiGreenSoft, modifier = Modifier.size(46.dp)) {
                            Box(contentAlignment = Alignment.Center) { Text(conversation.landlord.takeLast(1), color = TroOiGreen, fontWeight = FontWeight.Bold) }
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(room?.name ?: conversation.landlord, style = MaterialTheme.typography.titleMedium)
                            Text(conversation.messages.lastOrNull()?.text ?: "Bắt đầu trao đổi", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                        Icon(Icons.Rounded.ChevronRight, null, tint = TroOiMuted)
                    }
                }
            }
        }
    }
}

@Composable
fun TenantChatScreen(
    state: TroOiUiState,
    conversationId: Long,
    onBack: () -> Unit,
    onSend: (String) -> Unit,
) {
    BackHandler(onBack = onBack)
    val conversation = state.conversations.firstOrNull { it.id == conversationId } ?: return
    val room = state.rooms.firstOrNull { it.id == conversation.roomId }
    var input by remember { mutableStateOf("") }
    val focus = LocalFocusManager.current

    Column(Modifier.fillMaxSize().imePadding()) {
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircleIconButton(Icons.Rounded.ArrowBack, "Quay lại", onBack)
            Spacer(Modifier.width(10.dp))
            Surface(shape = CircleShape, color = TroOiGreenSoft, modifier = Modifier.size(42.dp)) {
                Box(contentAlignment = Alignment.Center) { Text(conversation.landlord.takeLast(1), color = TroOiGreen, fontWeight = FontWeight.Bold) }
            }
            Spacer(Modifier.width(9.dp))
            Column {
                Text("${conversation.landlord} · ${room?.name.orEmpty()}", style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Thường phản hồi trong 10 phút", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
            }
        }
        HorizontalDivider(color = TroOiLine)
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            itemsIndexed(conversation.messages) { _, message ->
                val align = when (message.from) {
                    MessageFrom.TENANT -> Alignment.CenterEnd
                    MessageFrom.LANDLORD -> Alignment.CenterStart
                    MessageFrom.SYSTEM -> Alignment.Center
                }
                Box(Modifier.fillMaxWidth(), contentAlignment = align) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = when (message.from) {
                            MessageFrom.TENANT -> TroOiGreen
                            MessageFrom.LANDLORD -> Color.White
                            MessageFrom.SYSTEM -> Color(0xFFF1F0EB)
                        },
                        border = if (message.from == MessageFrom.LANDLORD) BorderStroke(1.dp, TroOiLine) else null,
                    ) {
                        Text(
                            message.text,
                            modifier = Modifier.widthIn(max = 285.dp).padding(horizontal = 12.dp, vertical = 10.dp),
                            color = if (message.from == MessageFrom.TENANT) Color.White else if (message.from == MessageFrom.SYSTEM) TroOiMuted else TroOiText,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }
        Surface(color = Color.White, shadowElevation = 8.dp) {
            Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Nhập tin nhắn...") },
                    singleLine = true,
                    shape = RoundedCornerShape(999.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = {
                        onSend(input)
                        input = ""
                        focus.clearFocus()
                    }),
                )
                Spacer(Modifier.width(8.dp))
                FilledIconButton(onClick = { onSend(input); input = "" }, enabled = input.isNotBlank(), colors = IconButtonDefaults.filledIconButtonColors(containerColor = TroOiGreen)) {
                    Icon(Icons.Rounded.Send, "Gửi", tint = Color.White)
                }
            }
        }
    }
}

@Composable
fun TenantProfileScreen(state: TroOiUiState, onSwitchRole: () -> Unit, onLogout: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { Text("Tài khoản", style = MaterialTheme.typography.headlineMedium) }
        item {
            TroOiCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(shape = CircleShape, color = TroOiGreenSoft, modifier = Modifier.size(58.dp)) {
                        Box(contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = TroOiGreen, modifier = Modifier.size(30.dp)) }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(state.displayName.ifBlank { "Người dùng TrọƠi" }, style = MaterialTheme.typography.titleLarge)
                        Text("Người thuê · Đã xác minh", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                    }
                }
            }
        }
        item { ProfileRow(Icons.Rounded.PersonOutline, "Thông tin cá nhân", "Họ tên, số điện thoại, xác minh tài khoản") }
        item { ProfileRow(Icons.Rounded.ReceiptLong, "Thanh toán & Biên nhận", "Lịch sử cọc, tiền thuê, hóa đơn tháng") }
        item { ProfileRow(Icons.Rounded.VerifiedUser, "Trung tâm an toàn", "Báo lỗi thông tin và lưu dấu vết trao đổi") }
        item { PrimaryButton("Chuyển vai trò Chủ trọ", onSwitchRole, Modifier.fillMaxWidth()) }
        item {
            OutlinedButton(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(15.dp),
                border = BorderStroke(1.dp, TroOiRed),
            ) {
                Icon(Icons.Rounded.Logout, null, tint = TroOiRed)
                Spacer(Modifier.width(8.dp))
                Text("Đăng xuất", color = TroOiRed)
            }
        }
    }
}

@Composable
private fun ProfileRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String) {
    TroOiCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = CircleShape, color = TroOiGreenSoft, modifier = Modifier.size(44.dp)) {
                Box(contentAlignment = Alignment.Center) { Icon(icon, null, tint = TroOiGreen) }
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
private fun SearchSheet(onDone: () -> Unit) {
    var query by remember { mutableStateOf("") }
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Tìm phòng", style = MaterialTheme.typography.titleLarge)
        OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), label = { Text("Bạn muốn tìm ở đâu?") }, placeholder = { Text("Ví dụ: Thủ Đức, FPT, Quận 9...") })
        OutlinedTextField("2 - 6 triệu", { _ -> }, Modifier.fillMaxWidth(), label = { Text("Khoảng giá") }, readOnly = true)
        PrimaryButton("Tìm phòng ngay", onDone, Modifier.fillMaxWidth())
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun FilterSheet(onDone: () -> Unit) {
    var verifiedOnly by remember { mutableStateOf(true) }
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Bộ lọc thông minh", style = MaterialTheme.typography.titleLarge)
        Text("Khu vực", style = MaterialTheme.typography.labelLarge)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(listOf("TP. Hồ Chí Minh", "Thủ Đức", "Quận 3", "Bình Thạnh")) { item ->
                FilterChip(selected = item == "TP. Hồ Chí Minh", onClick = {}, label = { Text(item) })
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Chỉ hiện phòng đã xác minh", Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            Switch(verifiedOnly, { verifiedOnly = it }, colors = SwitchDefaults.colors(checkedTrackColor = TroOiGreen))
        }
        PrimaryButton("Áp dụng", onDone, Modifier.fillMaxWidth())
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun LocationSheet(onDone: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Chọn vị trí", style = MaterialTheme.typography.titleLarge)
        listOf("TP. Hồ Chí Minh", "Thủ Đức", "Quận 3", "Bình Thạnh", "Phú Nhuận").forEach { location ->
            ListItem(
                headlineContent = { Text(location) },
                supportingContent = { Text("Tìm phòng quanh khu vực này") },
                leadingContent = { Icon(Icons.Rounded.LocationOn, null, tint = TroOiGreen) },
                modifier = Modifier.clickable(onClick = onDone),
            )
        }
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun NotificationSheet(state: TroOiUiState, onDone: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Thông báo", style = MaterialTheme.typography.titleLarge)
        TroOiCard(Modifier.fillMaxWidth()) {
            Text("Lịch xem phòng", style = MaterialTheme.typography.titleMedium)
            Text(state.bookings.firstOrNull()?.let { "${it.date} · ${it.time}" } ?: "Chưa có lịch xem phòng", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
        }
        TroOiCard(Modifier.fillMaxWidth()) {
            Text("Smart Check hoàn tất", style = MaterialTheme.typography.titleMedium)
            Text("Các phòng đã xác minh được gắn trạng thái rõ ràng trong danh sách.", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
        }
        TextButton(onClick = onDone, modifier = Modifier.align(Alignment.End)) { Text("Đóng") }
        Spacer(Modifier.height(20.dp))
    }
}
