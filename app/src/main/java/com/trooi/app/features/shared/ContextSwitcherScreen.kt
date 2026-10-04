package com.trooi.app.features.shared

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
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
    val initial = state.displayName.trim().split(Regex("\\s+"))
        .filter { it.isNotBlank() }
        .take(2)
        .joinToString("") { it.first().uppercase() }
        .ifBlank { "TƠ" }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { TextButton(onClick = onBack) { Text("← Quay lại") } }
        item { V1PageTitle("Chọn không gian", "Chọn nơi bạn muốn sử dụng") }
        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Surface(
                    modifier = Modifier.size(48.dp),
                    shape = RoundedCornerShape(10.dp),
                    color = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(initial, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                }
                Column {
                    Text(state.displayName.ifBlank { "Tài khoản TrọƠi" }, style = MaterialTheme.typography.titleLarge)
                    Text(
                        "Các mục bên dưới dựa trên quyền truy cập của tài khoản.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        item {
            ContextWorkspaceRow(
                monogram = "⌕",
                title = "Khám phá",
                subtitle = "Tìm phòng đang công khai",
                onClick = onDiscovery,
            )
        }
        if (state.access.allows(ClientArea.TENANT_PORTAL)) {
            item { LedgerSectionTitle("Nhà của tôi") }
            item {
                ContextWorkspaceRow(
                    monogram = state.access.linkedTenancyIds.size.toString(),
                    title = "Không gian người thuê",
                    subtitle = "${state.access.linkedTenancyIds.size} lượt thuê được liên kết",
                    onClick = onTenant,
                )
            }
        }
        if (state.access.allows(ClientArea.OPERATIONS)) {
            item { LedgerSectionTitle("Không gian vận hành") }
            item {
                ContextWorkspaceRow(
                    monogram = state.access.operatedOrganizationIds.size.toString(),
                    title = "Vận hành phòng",
                    subtitle = "${state.access.operatedOrganizationIds.size} khu trọ được cấp quyền quản lý",
                    onClick = onOperations,
                )
            }
        }
    }
}

@Composable
private fun ContextWorkspaceRow(
    monogram: String,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Surface(
                modifier = Modifier.size(44.dp),
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(monogram, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text("›", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
        }
    }
}