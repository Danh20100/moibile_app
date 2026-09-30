package com.trooi.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

fun formatVnd(value: Long): String = NumberFormat.getNumberInstance(Locale("vi", "VN")).format(value) + "đ"

@Composable
fun AppSurface(content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TroOiBackground),
        content = content,
    )
}

@Composable
fun BrandMark(modifier: Modifier = Modifier, compact: Boolean = false) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(if (compact) 36.dp else 42.dp)
                .clip(RoundedCornerShape(13.dp))
                .background(TroOiGreen),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.Home, contentDescription = null, tint = Color.White)
        }
        Spacer(Modifier.width(10.dp))
        Column {
            Text("TrọƠi", style = MaterialTheme.typography.titleLarge, color = TroOiText)
            if (!compact) Text("Nền tảng thuê phòng", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
        }
    }
}

@Composable
fun CircleIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = TroOiText,
) {
    Surface(
        modifier = modifier.size(40.dp).clickable(onClick = onClick),
        shape = CircleShape,
        color = Color.White,
        border = BorderStroke(1.dp, TroOiLine),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = contentDescription, tint = tint, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
fun TroOiCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val clickModifier = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
    Card(
        modifier = modifier.then(clickModifier),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, TroOiLine.copy(alpha = .72f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

@Composable
fun SectionTitle(title: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        if (action != null) {
            TextButton(onClick = { onAction?.invoke() }, contentPadding = PaddingValues(horizontal = 4.dp)) {
                Text(action, color = TroOiGreen, style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}

@Composable
fun StatusPill(text: String, kind: StatusKind = StatusKind.NEUTRAL) {
    val pair = when (kind) {
        StatusKind.SUCCESS -> TroOiGreenSoft to TroOiGreen
        StatusKind.DANGER -> Color(0xFFFFF0EE) to TroOiRed
        StatusKind.WARNING -> Color(0xFFFFF7E6) to TroOiAmber
        StatusKind.INFO -> Color(0xFFEAF1FE) to TroOiBlue
        StatusKind.NEUTRAL -> Color(0xFFF1F0EB) to TroOiMuted
    }
    Surface(shape = RoundedCornerShape(999.dp), color = pair.first) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
            color = pair.second,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
        )
    }
}

enum class StatusKind { SUCCESS, DANGER, WARNING, INFO, NEUTRAL }

@Composable
fun RoomArt(modifier: Modifier = Modifier, large: Boolean = false) {
    val buildingWidth = if (large) 168.dp else 84.dp
    Box(
        modifier = modifier
            .height(if (large) 220.dp else 112.dp)
            .clip(RoundedCornerShape(if (large) 24.dp else 16.dp))
            .background(
                Brush.linearGradient(listOf(Color(0xFFE9DFCE), Color(0xFFDFEFE4), Color(0xFFACC9B8))),
            ),
    ) {
        Box(
            Modifier.align(Alignment.TopEnd).padding(if (large) 24.dp else 12.dp)
                .size(if (large) 58.dp else 28.dp).clip(CircleShape)
                .background(Color.White.copy(alpha = .65f)),
        )
        Box(
            Modifier.align(Alignment.BottomEnd).offset(x = 15.dp, y = 8.dp)
                .width(buildingWidth).height(if (large) 174.dp else 92.dp)
                .clip(RoundedCornerShape(topStart = 19.dp, topEnd = 19.dp))
                .background(Color(0xFF6C9880)),
        ) {
            Column(
                Modifier.fillMaxSize().padding(horizontal = if (large) 20.dp else 10.dp, vertical = if (large) 18.dp else 9.dp),
                verticalArrangement = Arrangement.spacedBy(if (large) 13.dp else 7.dp),
            ) {
                repeat(3) {
                    Row(horizontalArrangement = Arrangement.spacedBy(if (large) 12.dp else 6.dp)) {
                        repeat(2) {
                            Box(
                                Modifier.weight(1f).height(if (large) 26.dp else 13.dp)
                                    .clip(RoundedCornerShape(4.dp)).background(Color(0xFFEBF4E8)),
                            )
                        }
                    }
                }
            }
        }
        Box(
            Modifier.align(Alignment.BottomStart).offset(x = (-12).dp, y = 5.dp)
                .width(if (large) 142.dp else 70.dp).height(if (large) 83.dp else 42.dp)
                .clip(RoundedCornerShape(topStart = 17.dp, topEnd = 17.dp))
                .background(Color(0xFFFFFAF1).copy(alpha = .93f)),
        )
    }
}

@Composable
fun RoomCard(
    room: RoomUi,
    saved: Boolean,
    onOpen: () -> Unit,
    onToggleSaved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TroOiCard(modifier = modifier.fillMaxWidth(), onClick = onOpen) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(modifier = Modifier.width(112.dp)) {
                RoomArt(Modifier.fillMaxWidth())
                Surface(
                    modifier = Modifier.align(Alignment.BottomStart).padding(7.dp),
                    shape = RoundedCornerShape(999.dp),
                    color = Color.Black.copy(alpha = .55f),
                ) {
                    Text("${room.photos} ảnh", Modifier.padding(horizontal = 7.dp, vertical = 4.dp), color = Color.White, style = MaterialTheme.typography.labelMedium)
                }
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.Top) {
                    Text(room.name, modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    IconButton(onClick = onToggleSaved, modifier = Modifier.size(30.dp)) {
                        Icon(if (saved) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder, contentDescription = "Yêu thích", tint = if (saved) TroOiRed else TroOiMuted)
                    }
                }
                Text("${room.area} · ${room.distance}", style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                StatusPill(room.verification, StatusKind.SUCCESS)
                Text("${formatVnd(room.price)} / tháng", style = MaterialTheme.typography.titleMedium, color = TroOiGreen)
                Text("${room.size} · ${room.type} · ${room.electric}", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Star, null, tint = TroOiAmber, modifier = Modifier.size(16.dp))
                    Text(" ${room.score}/5 · ${room.reviews} đánh giá", style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                }
            }
        }
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, description: String) {
    TroOiCard(Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = 22.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(icon, null, tint = TroOiGreen, modifier = Modifier.size(42.dp))
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(description, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
        }
    }
}

@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        modifier = modifier.height(50.dp),
        enabled = enabled,
        shape = RoundedCornerShape(15.dp),
        colors = ButtonDefaults.buttonColors(containerColor = TroOiGreen),
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun SecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(50.dp),
        shape = RoundedCornerShape(15.dp),
        border = BorderStroke(1.dp, TroOiGreen),
    ) {
        Text(text, color = TroOiGreen, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun KpiCard(label: String, value: String, hint: String, modifier: Modifier = Modifier, valueColor: Color = TroOiText) {
    TroOiCard(modifier = modifier) {
        Text(label.uppercase(), style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
        Spacer(Modifier.height(8.dp))
        Text(value, style = MaterialTheme.typography.titleLarge, color = valueColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(4.dp))
        Text(hint, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
    }
}

@Composable
fun TenantBottomBar(selected: TenantTab, onSelect: (TenantTab) -> Unit) {
    val items = listOf(
        Triple(TenantTab.HOME, Icons.Rounded.Home, "Trang chủ"),
        Triple(TenantTab.SAVED, Icons.Rounded.FavoriteBorder, "Yêu thích"),
        Triple(TenantTab.SCHEDULE, Icons.Rounded.CalendarMonth, "Lịch hẹn"),
        Triple(TenantTab.MESSAGES, Icons.Rounded.ChatBubbleOutline, "Tin nhắn"),
        Triple(TenantTab.PROFILE, Icons.Rounded.PersonOutline, "Tài khoản"),
    )
    Surface(
        shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp),
        color = Color.White,
        shadowElevation = 9.dp,
    ) {
    NavigationBar(containerColor = Color.Transparent, tonalElevation = 0.dp) {
        items.forEach { (tab, icon, label) ->
            NavigationBarItem(
                selected = selected == tab,
                onClick = { onSelect(tab) },
                icon = { Icon(icon, label) },
                label = { Text(label, style = MaterialTheme.typography.labelMedium) },
                colors = NavigationBarItemDefaults.colors(indicatorColor = TroOiGreenSoft, selectedIconColor = TroOiGreen, selectedTextColor = TroOiGreen),
            )
        }
    }
    }
}

@Composable
fun LandlordBottomBar(selected: LandlordTab, onSelect: (LandlordTab) -> Unit) {
    val items = listOf(
        Triple(LandlordTab.DASHBOARD, Icons.Rounded.Dashboard, "Tổng quan"),
        Triple(LandlordTab.ROOMS, Icons.Rounded.MeetingRoom, "Phòng"),
        Triple(LandlordTab.FINANCE, Icons.Rounded.Payments, "Tài chính"),
        Triple(LandlordTab.TICKETS, Icons.Rounded.Build, "Yêu cầu"),
        Triple(LandlordTab.PROFILE, Icons.Rounded.Menu, "Thêm"),
    )
    Surface(
        shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp),
        color = Color.White,
        shadowElevation = 9.dp,
    ) {
    NavigationBar(containerColor = Color.Transparent, tonalElevation = 0.dp) {
        items.forEach { (tab, icon, label) ->
            NavigationBarItem(
                selected = selected == tab,
                onClick = { onSelect(tab) },
                icon = { Icon(icon, label) },
                label = { Text(label, style = MaterialTheme.typography.labelMedium) },
                colors = NavigationBarItemDefaults.colors(indicatorColor = TroOiGreenSoft, selectedIconColor = TroOiGreen, selectedTextColor = TroOiGreen),
            )
        }
    }
    }
}
