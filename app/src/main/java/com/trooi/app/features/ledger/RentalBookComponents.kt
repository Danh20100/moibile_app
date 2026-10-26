package com.trooi.app.features.ledger

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import com.trooi.app.ui.components.TroOiPageHeader
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.components.TroOiFormField
import com.trooi.app.ui.theme.TroOiDimens

@Composable
internal fun BookCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Column(Modifier.fillMaxWidth().padding(TroOiDimens.panelPadding),
            verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}

@Composable
internal fun BookHeading(text: String, icon: ImageVector? = null) {
    Row(Modifier.fillMaxWidth().semantics { heading() }, verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (icon != null) Icon(icon, null, Modifier.size(22.dp), tint = MaterialTheme.colorScheme.primary)
        Text(text, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
internal fun BookRow(label: String, detail: String?, icon: ImageVector, onClick: () -> Unit) {
    Surface(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.heightIn(min = 64.dp).padding(vertical = 10.dp, horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                Box(Modifier.size(42.dp), contentAlignment = Alignment.Center) {
                    Icon(icon, null, Modifier.size(23.dp), tint = MaterialTheme.colorScheme.primary)
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(label, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                if (!detail.isNullOrBlank()) Text(detail, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.Rounded.ChevronRight, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
internal fun BookPair(label: String, value: String?) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value ?: "Chưa có dữ liệu", style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
internal fun BookStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
internal fun BookSummary(title: String, icon: ImageVector, first: Pair<String, String>, second: Pair<String, String>) {
    BookCard {
        BookHeading(title, icon)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            BookStat(first.first, first.second, Modifier.weight(1f))
            BookStat(second.first, second.second, Modifier.weight(1f))
        }
    }
}

@Composable
internal fun BookSearch(value: String, onValue: (String) -> Unit, label: String) {
    TroOiFormField(value, onValue, modifier = Modifier.fillMaxWidth(), singleLine = true,
        label = { Text(label) }, leadingIcon = { Icon(Icons.Rounded.Search, null) })
}

@Composable
internal fun BookFilters(selected: String, options: List<Pair<String, String>>, onSelect: (String) -> Unit) {
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            options.forEach { (id, label) ->
                FilterChip(selected == id, { onSelect(id) }, label = { Text(label) },
                    shape = RoundedCornerShape(8.dp), border = null)
            }
        }
    }
}

@Composable
internal fun BookSelect(label: String, selected: String, options: List<Pair<String, String>>,
    onSelect: (String) -> Unit, icon: ImageVector = Icons.Rounded.Apartment) {
    var expanded by remember { mutableStateOf(false) }
    var search by remember { mutableStateOf("") }
    var anchorWidth by remember { mutableIntStateOf(0) }
    val density = LocalDensity.current
    Box(Modifier.fillMaxWidth()) {
        Surface(onClick = { expanded = true }, enabled = options.isNotEmpty(),
            modifier = Modifier.fillMaxWidth().onSizeChanged { anchorWidth = it.width }, shape = RoundedCornerShape(18.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
            Row(Modifier.heightIn(min = 52.dp).padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(icon, null, Modifier.size(21.dp), tint = MaterialTheme.colorScheme.primary)
                Text(options.find { it.first == selected }?.second ?: if (options.isEmpty()) "$label · Chưa có lựa chọn" else label, Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Icon(Icons.Rounded.ExpandMore, null, Modifier.size(20.dp))
            }
        }
        DropdownMenu(expanded, { expanded = false; search = "" }, modifier = Modifier.width(with(density) { anchorWidth.toDp() }).heightIn(max = 360.dp),
            shape = RoundedCornerShape(18.dp), containerColor = MaterialTheme.colorScheme.surface) {
            if (options.size > 7) BookSearch(search, { search = it }, "Tìm lựa chọn")
            options.filter { it.second.contains(search, true) }.forEach { (id, text) ->
                DropdownMenuItem(text = { Text(text) },
                    leadingIcon = { Icon(if (selected == id) Icons.Rounded.CheckCircle else icon, null,
                        tint = MaterialTheme.colorScheme.primary) },
                    onClick = { onSelect(id); expanded = false; search = "" })
            }
        }
    }
}

@Composable
internal fun BookIllustration(icon: ImageVector, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Surface(modifier.fillMaxWidth().height(101.dp), shape = RoundedCornerShape(14.dp),
        color = colors.primaryContainer.copy(alpha = .3f)) {
        Box(contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val center = Offset(size.width * .5f, size.height * .48f)
                drawOval(colors.primary.copy(alpha = .08f), Offset(center.x - 55.dp.toPx(), center.y - 41.dp.toPx()), Size(110.dp.toPx(), 82.dp.toPx()))
                drawCircle(colors.primary.copy(alpha = .06f), 29.dp.toPx(), Offset(center.x - 64.dp.toPx(), center.y + 13.dp.toPx()))
                drawCircle(colors.primary.copy(alpha = .2f), 5.dp.toPx(), Offset(center.x + 66.dp.toPx(), 32.dp.toPx()))
                val paper = colors.surface.copy(alpha = .9f)
                val ink = colors.primary.copy(alpha = .35f)
                val x = center.x
                val y = center.y
                when (icon) {
                    Icons.Rounded.ReceiptLong, Icons.Rounded.MenuBook, Icons.Rounded.History -> {
                        drawRoundRect(ink.copy(alpha = .12f), Offset(x - 18.dp.toPx(), y - 29.dp.toPx()), Size(49.dp.toPx(), 65.dp.toPx()), CornerRadius(6.dp.toPx()))
                        drawRoundRect(paper, Offset(x - 28.dp.toPx(), y - 34.dp.toPx()), Size(49.dp.toPx(), 65.dp.toPx()), CornerRadius(6.dp.toPx()))
                        drawRoundRect(ink, Offset(x - 28.dp.toPx(), y - 34.dp.toPx()), Size(49.dp.toPx(), 65.dp.toPx()), CornerRadius(6.dp.toPx()), style = Stroke(1.dp.toPx()))
                        repeat(3) { index -> drawLine(ink, Offset(x - 18.dp.toPx(), y + (index * 9 - 5).dp.toPx()), Offset(x + 11.dp.toPx(), y + (index * 9 - 5).dp.toPx()), 2.dp.toPx()) }
                    }
                    Icons.Rounded.Apartment, Icons.Rounded.MeetingRoom -> {
                        drawRoundRect(paper, Offset(x - 33.dp.toPx(), y - 29.dp.toPx()), Size(66.dp.toPx(), 66.dp.toPx()), CornerRadius(7.dp.toPx()))
                        repeat(3) { row -> repeat(2) { column ->
                            drawRoundRect(ink, Offset(x + (column * 27 - 22).dp.toPx(), y + (row * 17 - 18).dp.toPx()), Size(13.dp.toPx(), 9.dp.toPx()), CornerRadius(2.dp.toPx()))
                        } }
                    }
                    Icons.Rounded.People, Icons.Rounded.Person -> {
                        drawCircle(paper, 15.dp.toPx(), Offset(x - 8.dp.toPx(), y - 14.dp.toPx()))
                        drawRoundRect(paper, Offset(x - 32.dp.toPx(), y + 5.dp.toPx()), Size(51.dp.toPx(), 30.dp.toPx()), CornerRadius(15.dp.toPx()))
                        drawCircle(ink, 11.dp.toPx(), Offset(x + 28.dp.toPx(), y - 5.dp.toPx()))
                        drawRoundRect(ink, Offset(x + 14.dp.toPx(), y + 10.dp.toPx()), Size(28.dp.toPx(), 24.dp.toPx()), CornerRadius(12.dp.toPx()))
                    }
                    else -> drawRoundRect(paper, Offset(x - 39.dp.toPx(), y - 9.dp.toPx()), Size(78.dp.toPx(), 39.dp.toPx()), CornerRadius(8.dp.toPx()))
                }
            }
            if (icon !in listOf(Icons.Rounded.Apartment, Icons.Rounded.MeetingRoom, Icons.Rounded.People, Icons.Rounded.Person)) {
                Icon(icon, null, Modifier.size(32.dp).offset(y = 8.dp), tint = colors.primary.copy(alpha = .65f))
            }
        }
    }
}

@Composable
internal fun BookEmpty(icon: ImageVector, title: String, description: String,
    action: String? = null, onAction: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(11.dp)) {
        BookIllustration(icon)
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(description, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (action != null && onAction != null) BookOutlinedButton(onAction, Modifier.fillMaxWidth()) {
            Icon(Icons.Rounded.ChevronRight, null, Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(action)
        }
    }
}

@Composable
internal fun BookTiles(entries: List<Triple<String, ImageVector, () -> Unit>>) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        entries.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { (label, icon, action) ->
                    Surface(onClick = action, modifier = Modifier.weight(1f).heightIn(min = 99.dp),
                        shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
                        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Icon(icon, null, Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary)
                            Text(label, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

internal fun bookLabel(value: String?): String = when (value) {
    null, "" -> "Chưa có dữ liệu"
    "VACANT" -> "Còn trống"
    "OCCUPIED" -> "Có người thuê"
    "MAINTENANCE" -> "Đang bảo trì"
    "INACTIVE" -> "Ngừng sử dụng"
    "ACTIVE" -> "Đang hoạt động"
    "ENDING" -> "Sắp kết thúc"
    "ENDED" -> "Đã kết thúc"
    "DRAFT" -> "Bản nháp"
    "ARCHIVED" -> "Đã lưu trữ"
    "PUBLISHED" -> "Đang đăng"
    "UNPUBLISHED" -> "Đã ẩn"
    "ISSUED" -> "Đã phát hành"
    "VOIDED" -> "Đã hủy"
    "REPORTED" -> "Mới báo"
    "ACKNOWLEDGED" -> "Đã tiếp nhận"
    "IN_PROGRESS" -> "Đang xử lý"
    "RESOLVED" -> "Đã xử lý, chờ kết thúc"
    "CLOSED" -> "Đã kết thúc"
    "REJECTED" -> "Đã từ chối"
    "ELECTRICAL", "ELECTRICITY" -> "Điện"
    "PLUMBING", "WATER" -> "Nước"
    "ACCESS_SECURITY" -> "An ninh, ra vào"
    "ROOM_FACILITY" -> "Cơ sở vật chất"
    "APPLIANCE" -> "Thiết bị"
    "OTHER" -> "Khác"
    "RENT" -> "Tiền phòng"
    "MANUAL_CASH" -> "Tiền mặt"
    "MANUAL_TRANSFER" -> "Chuyển khoản"
    "CONFIRMED" -> "Đã xác nhận"
    "CREATED" -> "Đã tạo"
    "STATUS_CHANGED" -> "Đổi trạng thái"
    "NOTE_ADDED" -> "Thêm ghi chú"
    else -> if (value.matches(Regex("[A-Z][A-Z_]+"))) "Đang cập nhật" else value
}

@Composable
internal fun BookPageHeader(title: String, subtitle: String, onBack: (() -> Unit)?,
    actions: @Composable RowScope.() -> Unit) {
    if (onBack != null) {
        TroOiPageHeader(title = title, subtitle = subtitle, onBack = onBack, actions = actions)
    } else {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Rounded.MenuBook, null, Modifier.size(28.dp), tint = MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
                    modifier = Modifier.semantics { heading() })
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(content = actions)
        }
    }
}
