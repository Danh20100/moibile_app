package com.trooi.app.features.landlord.dashboard.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.components.TroOiBrand
import com.trooi.app.ui.components.TroOiCard
import com.trooi.app.ui.components.TroOiEmptyState
import com.trooi.app.ui.components.TroOiSectionHeader

data class LandlordDashboardUiState(
    val occupancy: String = "—",
    val revenue: String = "—",
    val outstandingDebt: String = "—",
    val openIncidents: String = "—",
    val hasTodo: Boolean = false,
)

@Composable
fun LandlordDashboardScreen(
    state: LandlordDashboardUiState = LandlordDashboardUiState(),
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .statusBarsPadding(),
        contentPadding = PaddingValues(
            start = 20.dp,
            end = 20.dp,
            top = 18.dp,
            bottom = 40.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                TroOiBrand()
                Text(
                    text = "Tổng quan",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "Chào bạn.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "Nhà trọ hôm nay.",
                    style = MaterialTheme.typography.headlineLarge,
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                DashboardMetric("Lấp đầy", state.occupancy, Modifier.weight(1f))
                DashboardMetric("Doanh thu", state.revenue, Modifier.weight(1f))
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                DashboardMetric("Công nợ", state.outstandingDebt, Modifier.weight(1f))
                DashboardMetric("Sự cố mở", state.openIncidents, Modifier.weight(1f))
            }
        }

        item {
            TroOiSectionHeader(title = "Việc cần làm")
        }

        if (!state.hasTodo) {
            item {
                TroOiEmptyState(
                    title = "Không có việc đang chờ",
                    description = "Công việc từ phòng, công nợ và bảo trì sẽ xuất hiện tại đây.",
                )
            }
        }

        item {
            TroOiSectionHeader(title = "Tình trạng vận hành")
        }

        item {
            TroOiCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(22.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = "Property health",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = "Chỉ số vận hành sẽ được tổng hợp từ dữ liệu backend.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun DashboardMetric(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    TroOiCard(modifier = modifier) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
            )
        }
    }
}
