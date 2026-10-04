package com.trooi.app.features.tenant

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.publicDiscoveryFeed
import com.trooi.app.ui.components.*

@Composable
fun V1GuestMapScreen(
    state: TroOiUiState,
    onOpenListing: (String) -> Unit,
) {
    val listings = publicDiscoveryFeed(state.read.publicListings)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("guest-map"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            V1PageTitle(
                "Bản đồ",
                "Chỉ dùng public location projection; không lộ địa chỉ vận hành.",
            )
        }
        item {
            LedgerMediaPlaceholder(
                title = "Bản đồ công khai",
                subtitle = if (listings.isEmpty()) {
                    "Chưa có Listing PUBLISHED để đặt marker."
                } else {
                    "${listings.count { it.publicGeoPoint != null }} vị trí công khai sẵn sàng cho map provider."
                },
                modifier = Modifier.height(230.dp),
            )
        }
        item {
            V1Panel("Map provider") {
                V1Pending(
                    "Native map provider chưa được nối trong nhánh này. " +
                        "Không thay thế bằng operational address hoặc tọa độ nhập tay.",
                )
            }
        }
        if (listings.isNotEmpty()) {
            item { LedgerSectionTitle("Phòng trên bản đồ", "Danh sách dùng cùng public projection với Discovery") }
            items(listings, key = { "map-listing-" + it.listingId }) { listing ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenListing(listing.listingId) }
                        .padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Rounded.LocationOn, null, tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.weight(1f)) {
                        Text(listing.title, style = MaterialTheme.typography.titleSmall)
                        Text(
                            listing.publicAreaLabel,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        listing.askingPriceLabel ?: "Chưa công khai",
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
                LedgerDivider()
            }
        }
    }
}

@Composable
fun V1GuestActivityScreen(state: TroOiUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("guest-activity"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Hoạt động", "Các lần liên hệ với tin đăng công khai") }
        item {
            V1Panel("Yêu cầu liên hệ") {
                V1Pending(
                    "Inquiry submit đã dùng Backend thật, nhưng danh sách lịch sử Inquiry của Guest " +
                        "chưa có read adapter trong FrontendReadSnapshot. Không dựng activity giả ở client.",
                )
            }
        }
        if (state.isAuthenticated && state.read.notifications.isNotEmpty()) {
            item {
                LedgerSectionTitle(
                    "Thông báo liên quan",
                    "Notification vẫn là projection; mở source không làm thay đổi business state.",
                )
            }
            items(state.read.notifications.take(5), key = { "guest-activity-notification-" + it.notificationId }) { row ->
                LedgerAttentionRow(
                    title = row.category,
                    supporting = row.message,
                    tone = if (row.readAtLabel == null) LedgerTone.Clay else LedgerTone.Neutral,
                )
                LedgerDivider()
            }
        }
    }
}