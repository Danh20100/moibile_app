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
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.NotificationCard
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.TroOiMuted

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
    ) {        item { V1PageTitle("Thông báo", "Notification Center từ Backend") }
        item { TextButton(onClick = onBack) { Text("← Quay lại") } }
        if (state.runtimeLoading && state.read.notifications.isEmpty()) {
            item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        } else if (state.read.notifications.isEmpty()) {
            item { V1Panel("Không có thông báo") { Text("Backend chưa trả Notification nào.", color = MaterialTheme.colorScheme.onSurfaceVariant) } }
        } else {
            items(state.read.notifications, key = { "notification-" + it.notificationId }) { notification ->
                NotificationRow(notification, onOpen)
            }
        }
    }
}

@Composable
private fun NotificationRow(notification: NotificationCard, onOpen: (String) -> Unit) {
    V1Panel(
        notification.category,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("notification-" + notification.notificationId)
            .clickable { onOpen(notification.notificationId) },
    ) {
        Text(notification.message)
        Text(notification.createdAtLabel, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(if (notification.readAtLabel == null) "Chưa đọc" else "Đã đọc", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}@Composable
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
        item { TextButton(onClick = onBack) { Text("← Quay lại") } }
        if (state.runtimeLoading && notification == null) {
            item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        } else if (notification == null) {
            item { V1Panel("Thông báo không khả dụng") { Text("Không tìm thấy Notification được Backend cấp quyền.") } }
        } else {
            item {
                V1Panel(notification.category) {
                    Text(notification.message)
                    V1Metric("Delivery status", notification.deliveryStatus)
                    V1Metric("Created at", notification.createdAtLabel)
                    V1Metric("Read at", notification.readAtLabel ?: "Chưa đọc")
                    V1Metric("Source type", notification.sourceType ?: "Không có")
                    V1Metric("Source ID", notification.sourceId ?: "Không có")
                    if (notification.readAtLabel == null) {
                        V1Action("Đánh dấu đã đọc", { onMarkRead(notification.notificationId) })
                    }
                    if (!notification.sourceType.isNullOrBlank() && !notification.sourceId.isNullOrBlank()) {
                        V1Action("Mở nguồn liên quan", { onOpenSource(notification.notificationId) })
                    }
                }
            }
        }
    }
}
