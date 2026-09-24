package com.trooi.app.features.tenant.home.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.components.TroOiBrand
import com.trooi.app.ui.components.TroOiCard
import com.trooi.app.ui.components.TroOiChip
import com.trooi.app.ui.components.TroOiEmptyState
import com.trooi.app.ui.components.TroOiSectionHeader
import com.trooi.app.ui.theme.TroOiLime

data class TenantHomeUiState(
    val locationLabel: String = "Khu vực của bạn",
    val hasRooms: Boolean = false,
    val hasUpcomingBookings: Boolean = false,
)

@Composable
fun TenantHomeScreen(
    state: TenantHomeUiState = TenantHomeUiState(),
    modifier: Modifier = Modifier,
) {
    val categories = listOf("Gần bạn", "Có máy lạnh", "Có gác", "Cho nuôi thú cưng")

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
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                TroOiBrand()
                Text(
                    text = state.locationLabel,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item {
            TroOiCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(22.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text(
                        text = "Tìm một nơi\nmình thuộc về.",
                        style = MaterialTheme.typography.headlineLarge,
                    )
                    Text(
                        text = "Khám phá phòng, xem thông tin rõ ràng và đặt lịch ghé thăm.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(TroOiLime)
                            .padding(horizontal = 18.dp, vertical = 16.dp),
                    ) {
                        Text(
                            text = "Tìm khu vực, đường hoặc tên phòng",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(categories) { label ->
                    TroOiChip(text = label, selected = label == categories.first())
                }
            }
        }

        item {
            TroOiSectionHeader(
                title = "Phòng phù hợp với bạn",
                action = "Xem tất cả",
            )
        }

        if (!state.hasRooms) {
            item {
                TroOiEmptyState(
                    title = "Chưa có phòng để hiển thị",
                    description = "Danh sách sẽ xuất hiện khi dữ liệu phòng được tải từ hệ thống.",
                )
            }
        }

        item {
            Spacer(Modifier.height(4.dp))
            TroOiSectionHeader(title = "Lịch sắp tới")
        }

        if (!state.hasUpcomingBookings) {
            item {
                TroOiEmptyState(
                    title = "Chưa có lịch xem phòng",
                    description = "Các lịch đã xác nhận sẽ được hiển thị tại đây.",
                )
            }
        }
    }
}
