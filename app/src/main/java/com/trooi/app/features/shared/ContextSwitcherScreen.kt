package com.trooi.app.features.shared

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.*

@Composable
fun V1ContextSwitcherScreen(
    state: TroOiUiState,
    onDiscovery: () -> Unit,
    onTenant: () -> Unit,
    onOperations: () -> Unit,
    onBack: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            TextButton(onClick = onBack) { Text("← Quay lại") }
            V1PageTitle(
                "Chọn không gian",
                "Một tài khoản có thể có nhiều context; đây không phải USER.role.",
            )
        }
        item {
            V1Panel("Khám phá") {
                V1Pending("Tìm Listing công khai và gửi Inquiry.")
                V1Action("Vào Trang chủ tìm trọ", onDiscovery, modifier = Modifier.fillMaxWidth())
            }
        }
        if (state.access.allows(ClientArea.TENANT_PORTAL)) {
            item {
                V1Panel("Nhà của tôi") {
                    V1Pending("${state.access.linkedTenancyIds.size} quan hệ Tenancy được Backend cấp.")
                    V1Action("Vào Trang chủ người thuê", onTenant, modifier = Modifier.fillMaxWidth())
                }
            }
        }
        if (state.access.allows(ClientArea.OPERATIONS)) {
            item {
                V1Panel("Vận hành") {
                    V1Pending("${state.access.operatedOrganizationIds.size} Organization được Backend cấp quyền.")
                    V1Action("Vào Dashboard vận hành", onOperations, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}
