package com.trooi.app.features.tenant

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.tenancy.V1RentalWorkspace
import com.trooi.app.ui.components.*

/** Only Backend-session-linked Tenancy IDs are browsable, including former rental history. */
@Composable
fun V1TenantFlow(state: TroOiUiState, onFindRooms: () -> Unit, onUnauthorized: () -> Unit) {
    var openedId by remember(state.displayName, state.access.linkedTenancyIds) { mutableStateOf<String?>(null) }
    val owned = state.access.linkedTenancyIds.sorted()
    if (openedId != null) {
        V1RentalWorkspace(
            roomId = "",
            linkedTenancyId = openedId,
            onExit = { openedId = null },
            onUnauthorized = onUnauthorized,
        )
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("tenant-home"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { V1PageTitle("My Rental", "Chọn lượt thuê đã được Backend liên kết với tài khoản") }
        if (state.runtimeLoading) item { V1Panel("Đang tải") { V1Pending("Đồng bộ projection theo quan hệ thật.") } }
        if (owned.isEmpty()) item { V1Panel("Chưa có lượt thuê") { V1Pending("Không thể xem dữ liệu thuê khi chưa được Backend cấp quan hệ.") } }
        items(owned, key = { "tenant-linked-" + it }) { id ->
            val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == id }
            V1Panel(tenancy?.roomLabel ?: "Tenancy · " + id) {
                Text(tenancy?.lifecycle?.name ?: "Đang chờ chi tiết từ Backend")
                V1Action("Xem chi tiết", { openedId = id }, modifier = Modifier.fillMaxWidth())
            }
        }
        item {
            V1Panel("Mỗi chức năng có màn hình riêng") {
                V1Pending("Trong chi tiết: Terms, Billing, Payment, Receipts, Notices, Incidents, Move-out. Deposit settlement/Payment Claim/History vẫn chờ hợp đồng Backend hoặc policy.")
                V1Action("Tìm phòng khác", onFindRooms)
            }
        }
    }
}
