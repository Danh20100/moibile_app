package com.trooi.app.features.notifications

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.NotificationCard
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.ui.components.*

@Composable
fun V1NotificationCenterScreen(
    state: TroOiUiState,
    onOpen: (String) -> Unit,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("notification-center"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { TroOiPageHeader("Thông báo", "Các cập nhật mới nhất cho tài khoản của bạn", onBack) }
        if (state.runtimeLoading && state.read.notifications.isEmpty()) {
            item { TroOiStateMessage(TroOiStateKind.LOADING, "") }
        } else if (state.read.notifications.isEmpty()) {
            item { TroOiCard("Không có thông báo") { TroOiStateMessage(TroOiStateKind.EMPTY, "Bạn chưa có thông báo nào.") } }
        } else {
            items(state.read.notifications, key = { "notification-" + it.notificationId }) { notification ->
                NotificationRow(notification, onOpen)
            }
        }
    }
}

@Composable
private fun NotificationRow(notification: NotificationCard, onOpen: (String) -> Unit) {
    TroOiCard(
        notification.category,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("notification-" + notification.notificationId)
            .clickable(role = Role.Button) { onOpen(notification.notificationId) },
    ) {
        Text(notification.message)
        Text(notification.createdAtLabel, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(if (notification.readAtLabel == null) "Chưa đọc" else "Đã đọc", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun V1NotificationDetailScreen(
    state: TroOiUiState,
    notificationId: String,
    onBack: () -> Unit,
    onMarkRead: (String) -> Unit,
    onOpenSource: (String) -> Unit,
) {
    BackHandler(onBack = onBack)
    val notification = state.read.notifications.firstOrNull { it.notificationId == notificationId }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("notification-detail"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { TroOiPageHeader("Thông báo", onBack = onBack) }
        if (state.runtimeLoading && notification == null) {
            item { TroOiStateMessage(TroOiStateKind.LOADING, "") }
        } else if (notification == null) {
            item { TroOiCard("Thông báo không khả dụng") { TroOiStateMessage(TroOiStateKind.UNAVAILABLE, "Không tìm thấy thông báo này.") } }
        } else {
            item {
                TroOiCard(notification.category) {
                    Text(notification.message)
                    TroOiInformationRow("Trạng thái gửi", notification.deliveryStatus)
                    TroOiInformationRow("Tạo lúc", notification.createdAtLabel)
                    TroOiInformationRow("Đọc lúc", notification.readAtLabel ?: "Chưa đọc")
                    if (notification.readAtLabel == null) {
                        TroOiButton("Đánh dấu đã đọc", { onMarkRead(notification.notificationId) })
                    }
                    if (!notification.sourceType.isNullOrBlank() && !notification.sourceId.isNullOrBlank()) {
                        TroOiButton("Xem nội dung liên quan", { onOpenSource(notification.notificationId) })
                    } else {
                        TroOiStateMessage(TroOiStateKind.UNAVAILABLE, "Notification không có sourceId để mở bản ghi nguồn.")
                    }
                }
            }
        }
    }
}
