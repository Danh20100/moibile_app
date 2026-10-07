package com.trooi.app.ui.navigation

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.trooi.app.core.model.AppPage
import com.trooi.app.core.model.accountTabSelected

/**
 * Isolated identity definition for the center core destination tab.
 * Allows easy renaming and icon changes without impacting architecture.
 */
object CoreTabIdentity {
    const val TEMPORARY_LABEL = "Sổ"
    val icon = Icons.Rounded.Book
}

/**
 * 5-destination bottom navigation shell with a physically raised / cradled center tab.
 * Visual hierarchy: Khám phá | Yêu thích | [CORE ("Sổ")] | Tin nhắn | Hồ sơ
 */
@Composable
fun TroOiBottomNavigation(
    currentPage: AppPage,
    onNavigate: (AppPage) -> Unit,
    modifier: Modifier = Modifier,
) {
    val isCoreSelected = currentPage == AppPage.CoreWorkspace
    val isDiscoverySelected = currentPage == AppPage.Discovery
    val isFavoritesSelected = currentPage == AppPage.Favorites
    val isMessagesSelected = currentPage == AppPage.Messages
    val isProfileSelected = accountTabSelected(currentPage)

    val navSurfaceColor = MaterialTheme.colorScheme.surface
    val navShadowColor = Color.Black.copy(alpha = 0.07f)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .navigationBarsPadding(),
        contentAlignment = Alignment.BottomCenter,
    ) {
        // 1. Cradled Navigation Bar Surface
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(68.dp)
                .background(Color.Transparent)
        ) {
            // Custom Cradled Path Canvas with subtle top shadow
            Canvas(
                modifier = Modifier
                    .fillMaxSize()
            ) {
                val w = size.width
                val h = size.height
                val cx = w / 2f
                val cradleRadius = 38.dp.toPx()
                val cradleDepth = 12.dp.toPx()
                val shoulderWidth = 24.dp.toPx()

                // Outline path following the smooth cradled notch around the center pod
                val cradlePath = Path().apply {
                    moveTo(0f, 0f)
                    val leftShoulder = cx - cradleRadius - shoulderWidth
                    lineTo(leftShoulder, 0f)
                    cubicTo(
                        leftShoulder + shoulderWidth * 0.5f, 0f,
                        cx - cradleRadius, cradleDepth,
                        cx, cradleDepth,
                    )
                    val rightShoulder = cx + cradleRadius + shoulderWidth
                    cubicTo(
                        cx + cradleRadius, cradleDepth,
                        rightShoulder - shoulderWidth * 0.5f, 0f,
                        rightShoulder, 0f,
                    )
                    lineTo(w, 0f)
                    lineTo(w, h)
                    lineTo(0f, h)
                    close()
                }

                // Subtle top edge shadow
                val shadowPath = Path().apply {
                    moveTo(0f, 0f)
                    val leftShoulder = cx - cradleRadius - shoulderWidth
                    lineTo(leftShoulder, 0f)
                    cubicTo(
                        leftShoulder + shoulderWidth * 0.5f, 0f,
                        cx - cradleRadius, cradleDepth,
                        cx, cradleDepth,
                    )
                    val rightShoulder = cx + cradleRadius + shoulderWidth
                    cubicTo(
                        cx + cradleRadius, cradleDepth,
                        rightShoulder - shoulderWidth * 0.5f, 0f,
                        rightShoulder, 0f,
                    )
                    lineTo(w, 0f)
                }

                // Draw background and top shadow border
                drawPath(path = cradlePath, color = navSurfaceColor)
                drawPath(
                    path = shadowPath,
                    color = navShadowColor,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.dp.toPx()),
                )
            }

            // Normal Navigation Items Row (Left 2, Center space, Right 2)
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // 1. Khám phá
                BottomNavItem(
                    label = "Khám phá",
                    icon = Icons.Rounded.Search,
                    selected = isDiscoverySelected,
                    onClick = { onNavigate(AppPage.Discovery) },
                    testTag = "nav-tab-discovery",
                    modifier = Modifier.weight(1f),
                )

                // 2. Yêu thích
                BottomNavItem(
                    label = "Yêu thích",
                    icon = if (isFavoritesSelected) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                    selected = isFavoritesSelected,
                    onClick = { onNavigate(AppPage.Favorites) },
                    testTag = "nav-tab-favorites",
                    modifier = Modifier.weight(1f),
                )

                // Center placeholder spacer for raised circular destination
                Spacer(modifier = Modifier.weight(1.15f))

                // 4. Tin nhắn
                BottomNavItem(
                    label = "Tin nhắn",
                    icon = if (isMessagesSelected) Icons.Rounded.ChatBubble else Icons.Rounded.ChatBubbleOutline,
                    selected = isMessagesSelected,
                    onClick = { onNavigate(AppPage.Messages) },
                    testTag = "nav-tab-messages",
                    modifier = Modifier.weight(1f),
                )

                // 5. Hồ sơ
                BottomNavItem(
                    label = "Hồ sơ",
                    icon = if (isProfileSelected) Icons.Rounded.Person else Icons.Rounded.PersonOutline,
                    selected = isProfileSelected,
                    onClick = { onNavigate(AppPage.Account) },
                    testTag = "nav-tab-profile",
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // 2. Physically Raised / Elevated Center Destination Pod
        // Fixed geometry: never jumps between selection states
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .offset(y = (-18).dp),
            contentAlignment = Alignment.Center,
        ) {
            val primaryColor = MaterialTheme.colorScheme.primary
            val podBackground = if (isCoreSelected) primaryColor else Color(0xFFE8F1EC)
            val iconTint = if (isCoreSelected) MaterialTheme.colorScheme.onPrimary else primaryColor

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .testTag("nav-tab-core")
                    .semantics { selected = isCoreSelected }
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        role = Role.Tab,
                        onClick = { onNavigate(AppPage.CoreWorkspace) },
                    ),
            ) {
                Surface(
                    shape = CircleShape,
                    color = podBackground,
                    shadowElevation = if (isCoreSelected) 6.dp else 3.dp,
                    modifier = Modifier.size(52.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = CoreTabIdentity.icon,
                            contentDescription = CoreTabIdentity.TEMPORARY_LABEL,
                            tint = iconTint,
                            modifier = Modifier.size(26.dp),
                        )
                    }
                }
                Spacer(Modifier.height(3.dp))
                Text(
                    text = CoreTabIdentity.TEMPORARY_LABEL,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 11.sp,
                        fontWeight = if (isCoreSelected) FontWeight.Bold else FontWeight.Medium,
                    ),
                    color = if (isCoreSelected) primaryColor else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                )
            }
        }
    }
}

@Composable
private fun BottomNavItem(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    val primaryColor = MaterialTheme.colorScheme.primary
    val unselectedColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f)
    val color = if (selected) primaryColor else unselectedColor

    Column(
        modifier = modifier
            .fillMaxHeight()
            .testTag(testTag)
            .semantics { this.selected = selected }
            .clip(MaterialTheme.shapes.small)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                role = Role.Tab,
                onClick = onClick,
            ),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = color,
            modifier = Modifier.size(24.dp),
        )
        Spacer(Modifier.height(3.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 11.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            ),
            color = color,
            maxLines = 1,
        )
    }
}
