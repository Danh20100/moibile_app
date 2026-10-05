package com.trooi.app.features.shared

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
    onSelect: (SelectedContext) -> Unit,
    onBack: () -> Unit,
) {
    val initial = state.displayName.trim().split(Regex("\\s+"))
        .filter { it.isNotBlank() }
        .take(2)
        .joinToString("") { it.first().uppercase() }
        .ifBlank { "TƠ" }
    val tenancyIds = state.access.linkedTenancyIds.sorted()
    val organizationIds = state.access.operatedOrganizationIds.sorted()

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
                onClick = { onSelect(SelectedContext.Discovery) },
            )
        }
        if (tenancyIds.isNotEmpty()) {
            item { LedgerSectionTitle("Nhà của tôi") }
            items(tenancyIds, key = { "switch-tenancy-" + it }) { id ->
                val card = state.read.tenancies.firstOrNull { it.tenancyId == id }
                val title = card?.roomLabel?.takeIf { it.isNotBlank() } ?: NEUTRAL_TENANCY_LABEL
                val subtitle = when (card?.lifecycle) {
                    TenancyLifecycle.ENDED, TenancyLifecycle.CANCELLED -> "Lịch sử lượt thuê"
                    null -> "Nguồn được cấp quyền"
                    else -> "Lượt thuê được liên kết"
                }
                ContextWorkspaceRow(
                    monogram = title.take(1).uppercase(),
                    title = title,
                    subtitle = subtitle,
                    onClick = { onSelect(SelectedContext.Tenant(id)) },
                )
            }
        }
        if (organizationIds.isNotEmpty()) {
            item { LedgerSectionTitle("Không gian vận hành") }
            items(organizationIds, key = { "switch-org-" + it }) { id ->
                val card = state.read.organizations.firstOrNull { it.organizationId == id }
                val title = card?.displayName?.takeIf { it.isNotBlank() } ?: NEUTRAL_ORGANIZATION_LABEL
                ContextWorkspaceRow(
                    monogram = title.take(1).uppercase(),
                    title = title,
                    subtitle = "Khu trọ được cấp quyền quản lý",
                    onClick = { onSelect(SelectedContext.Operations(id)) },
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
