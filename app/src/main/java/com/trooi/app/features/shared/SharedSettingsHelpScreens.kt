package com.trooi.app.features.shared

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.ui.components.V1Action
import com.trooi.app.ui.components.V1PageTitle
import com.trooi.app.ui.components.V1Panel
import com.trooi.app.ui.components.V1Pending

@Composable
fun SettingsScreen(
    state: TroOiUiState,
    restoreEnabled: Boolean,
    onBack: () -> Unit,
    onContext: () -> Unit,
    onLogout: () -> Unit,
) {
    BackHandler(onBack = onBack)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("settings-screen"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { TextButton(onClick = onBack) { Text("Quay lại") } }
        item { V1PageTitle("Cài đặt", "Phiên hiện tại") }
        item {
            V1Panel("Khôi phục phiên") {
                V1Pending(
                    if (restoreEnabled) "Khôi phục phiên đang bật cho tài khoản này."
                    else "Khôi phục phiên chưa bật.",
                )
            }
        }
        if (state.isAuthenticated) {
            item {
                V1Action("Chuyển không gian", onContext, modifier = Modifier.fillMaxWidth())
                V1Action("Đăng xuất", onLogout, modifier = Modifier.fillMaxWidth().testTag("settings-logout"))
            }
        }
    }
}

@Composable
fun HelpScreen(onBack: () -> Unit) {
    BackHandler(onBack = onBack)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("help-screen"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { TextButton(onClick = onBack) { Text("Quay lại") } }
        item { V1PageTitle("Trợ giúp", "Những việc ứng dụng đang làm được") }
        item {
            V1Panel("Đường đã hỗ trợ") {
                Text("Tìm tin đăng công khai và gửi yêu cầu liên hệ sau khi đăng nhập.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Báo cáo một tin đăng công khai. Biên nhận chỉ của báo cáo vừa gửi.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Xem lượt thuê, khoản phải thu, payment đã xác nhận và biên nhận.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("MoMo là kênh tuỳ chọn. Liên kết quay về không phải bằng chứng đã trả.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                V1Pending("Chưa có kênh gửi yêu cầu hỗ trợ.")
            }
        }
    }
}
