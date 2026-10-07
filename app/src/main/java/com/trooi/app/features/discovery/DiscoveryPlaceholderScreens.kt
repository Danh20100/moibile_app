package com.trooi.app.features.discovery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.trooi.app.core.model.ClientArea
import com.trooi.app.core.model.SelectedContext
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.ui.components.TroOiPrimaryButton
import com.trooi.app.ui.navigation.CoreTabIdentity

/**
 * Placeholder shell for Favorites destination.
 */
@Composable
fun FavoritesPlaceholderScreen(
    onExplore: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .padding(24.dp)
            .testTag("favorites-placeholder-screen"),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
                modifier = Modifier.size(72.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Rounded.FavoriteBorder,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(36.dp),
                    )
                }
            }
            Spacer(Modifier.height(18.dp))
            Text(
                text = "Danh sách yêu thích",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                ),
                color = MaterialTheme.colorScheme.onBackground,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Danh sách phòng đã lưu đang được chuẩn bị. Bạn có thể tiếp tục khám phá các phòng cho thuê.",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 14.sp,
                    lineHeight = 21.sp,
                ),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Spacer(Modifier.height(24.dp))
            TroOiPrimaryButton(
                text = "Khám phá phòng ngay",
                onClick = onExplore,
                modifier = Modifier.fillMaxWidth(0.7f),
            )
        }
    }
}

/**
 * Placeholder shell for Center Core tab destination ("Sổ").
 * Wires to tenant operations workspace if available; otherwise presents clean workspace destination.
 */
@Composable
fun CoreWorkspacePlaceholderScreen(
    state: TroOiUiState,
    onOpenTenantRental: () -> Unit,
    onExplore: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val hasTenantAccess = state.access.allows(ClientArea.TENANT_PORTAL) || state.selectedContext is SelectedContext.Tenant

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .padding(24.dp)
            .testTag("core-workspace-placeholder-screen"),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
                modifier = Modifier.size(72.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = CoreTabIdentity.icon,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(36.dp),
                    )
                }
            }
            Spacer(Modifier.height(18.dp))
            Text(
                text = CoreTabIdentity.TEMPORARY_LABEL,
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                ),
                color = MaterialTheme.colorScheme.onBackground,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = if (hasTenantAccess) {
                    "Xem thông tin hợp đồng thuê, hóa đơn và các yêu cầu vận hành đang diễn ra."
                } else {
                    "Khu vực quản lý hợp đồng, hóa đơn và sự cố khi bạn bắt đầu thuê phòng tại TrọƠi."
                },
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 14.sp,
                    lineHeight = 21.sp,
                ),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Spacer(Modifier.height(24.dp))
            if (hasTenantAccess) {
                TroOiPrimaryButton(
                    text = "Chọn nơi đang thuê",
                    onClick = onOpenTenantRental,
                    modifier = Modifier.fillMaxWidth(0.7f),
                )
            } else {
                TroOiPrimaryButton(
                    text = "Khám phá phòng ngay",
                    onClick = onExplore,
                    modifier = Modifier.fillMaxWidth(0.7f),
                )
            }
        }
    }
}

/**
 * Placeholder shell for Messages destination.
 */
@Composable
fun MessagesPlaceholderScreen(
    onExplore: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .padding(24.dp)
            .testTag("messages-placeholder-screen"),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
                modifier = Modifier.size(72.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Rounded.ChatBubbleOutline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(36.dp),
                    )
                }
            }
            Spacer(Modifier.height(18.dp))
            Text(
                text = "Tin nhắn & Liên hệ",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                ),
                color = MaterialTheme.colorScheme.onBackground,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Trò chuyện trực tiếp với chủ trọ và nhận thông tin xác nhận thuê phòng tại đây.",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 14.sp,
                    lineHeight = 21.sp,
                ),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Spacer(Modifier.height(24.dp))
            TroOiPrimaryButton(
                text = "Khám phá phòng ngay",
                onClick = onExplore,
                modifier = Modifier.fillMaxWidth(0.7f),
            )
        }
    }
}
