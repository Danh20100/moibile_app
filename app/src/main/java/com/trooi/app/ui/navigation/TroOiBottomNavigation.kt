package com.trooi.app.ui.navigation

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.trooi.app.core.model.AppPage
import com.trooi.app.core.model.accountTabSelected
import kotlin.math.roundToInt

/**
 * Isolated identity definition for the core workspace destination tab.
 * Allows easy renaming and icon changes without impacting architecture.
 */
object CoreTabIdentity {
    const val TEMPORARY_LABEL = "Sổ"
    val icon = Icons.Rounded.Book
}

private data class NavDestinationItem(
    val page: AppPage,
    val label: String,
    val activeIcon: ImageVector,
    val inactiveIcon: ImageVector,
    val testTag: String,
)

private val Destinations = listOf(
    NavDestinationItem(
        page = AppPage.Discovery,
        label = "Khám phá",
        activeIcon = Icons.Rounded.Search,
        inactiveIcon = Icons.Rounded.Search,
        testTag = "nav-tab-discovery",
    ),
    NavDestinationItem(
        page = AppPage.CoreWorkspace,
        label = CoreTabIdentity.TEMPORARY_LABEL,
        activeIcon = CoreTabIdentity.icon,
        inactiveIcon = CoreTabIdentity.icon,
        testTag = "nav-tab-core",
    ),
    NavDestinationItem(
        page = AppPage.Messages,
        label = "Tin nhắn",
        activeIcon = Icons.Rounded.ChatBubble,
        inactiveIcon = Icons.Rounded.ChatBubbleOutline,
        testTag = "nav-tab-messages",
    ),
    NavDestinationItem(
        page = AppPage.Account,
        label = "Hồ sơ",
        activeIcon = Icons.Rounded.Person,
        inactiveIcon = Icons.Rounded.PersonOutline,
        testTag = "nav-tab-profile",
    ),
)

/**
 * Animated notch bottom navigation bar implemented natively in Jetpack Compose.
 *
 * Visual hierarchy & behavior:
 * - 4 equal destinations: Khám phá (0) / Sổ (1) / Tin nhắn (2) / Hồ sơ (3)
 * - The selected notch travels smoothly to the selected tab.
 * - The active elevated circular item travels locked with the notch.
 * - The active icon remains centered in the circle.
 * - Positions are calculated dynamically from measured nav width (no hardcoding).
 * - Sổ is at index 1 and travels dynamically, not a permanently centered/elevated tab.
 * - Inactive items remain on baseline and fade when their slot becomes active.
 * - Outer bar is a rounded floating pill with left/right margins and bottom gap.
 * - Monotonic C1-continuous bezier geometry guarantees zero clipping, kinks, or teleporting.
 */
@Composable
fun TroOiBottomNavigation(
    currentPage: AppPage,
    onNavigate: (AppPage) -> Unit,
    modifier: Modifier = Modifier,
) {
    val selectedIndex = when {
        currentPage == AppPage.Discovery -> 0
        currentPage == AppPage.CoreWorkspace -> 1
        currentPage == AppPage.Messages -> 2
        accountTabSelected(currentPage) -> 3
        else -> 0
    }

    val navSurfaceColor = MaterialTheme.colorScheme.surface
    val navBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f)
    val primaryColor = MaterialTheme.colorScheme.primary
    val onPrimaryColor = MaterialTheme.colorScheme.onPrimary

    val barHeight = 64.dp
    val elevationOverhang = 28.dp
    val containerHeight = barHeight + elevationOverhang
    val podSize = 48.dp
    val podRadius = 24.dp

    Box(
        modifier = modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .navigationBarsPadding()
            .padding(start = 16.dp, end = 16.dp, bottom = 10.dp),
        contentAlignment = Alignment.BottomCenter,
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .height(containerHeight),
        ) {
            val density = LocalDensity.current
            val navWidthPx = constraints.maxWidth.toFloat()
            val slotCount = Destinations.size
            val slotWidthPx = navWidthPx / slotCount.toFloat()
            val targetCenterX = slotWidthPx * (selectedIndex + 0.5f)

            val animatedCenterX by animateFloatAsState(
                targetValue = targetCenterX,
                animationSpec = tween(
                    durationMillis = 320,
                    easing = FastOutSlowInEasing,
                ),
                label = "notch_center_x",
            )

            // 1. Floating Bar Surface with Animated Notch Cradle
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(barHeight)
                    .align(Alignment.BottomCenter)
                    .shadow(
                        elevation = 8.dp,
                        shape = RoundedCornerShape(
                            topStart = 14.dp,
                            topEnd = 14.dp,
                            bottomStart = 24.dp,
                            bottomEnd = 24.dp,
                        ),
                        ambientColor = Color.Black.copy(alpha = 0.08f),
                        spotColor = Color.Black.copy(alpha = 0.14f),
                    ),
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val w = size.width
                    val h = size.height
                    val cx = animatedCenterX

                    val topCornerRadius = 14.dp.toPx()
                    val bottomCornerRadius = 24.dp.toPx()
                    val kTop = 0.55228475f * topCornerRadius
                    val kBottom = 0.55228475f * bottomCornerRadius

                    val cradleRadius = 30.dp.toPx()
                    val cradleDepth = 28.dp.toPx()
                    val shoulderWidth = 12.dp.toPx()

                    val rawLeft = cx - cradleRadius - shoulderWidth
                    val rawRight = cx + cradleRadius + shoulderWidth

                    val notchLeft = rawLeft.coerceIn(topCornerRadius, cx - cradleRadius * 0.25f)
                    val notchRight = rawRight.coerceIn(cx + cradleRadius * 0.25f, w - topCornerRadius)

                    val dxLeft = cx - notchLeft
                    val dxRight = notchRight - cx

                    val barPath = Path().apply {
                        moveTo(topCornerRadius, 0f)

                        if (notchLeft > topCornerRadius) {
                            lineTo(notchLeft, 0f)
                        }

                        // Smooth left descent into notch cradle
                        cubicTo(
                            notchLeft + dxLeft * 0.38f, 0f,
                            cx - dxLeft * 0.38f, cradleDepth,
                            cx, cradleDepth,
                        )

                        // Smooth right ascent out of notch cradle
                        cubicTo(
                            cx + dxRight * 0.38f, cradleDepth,
                            notchRight - dxRight * 0.38f, 0f,
                            notchRight, 0f,
                        )

                        if (notchRight < w - topCornerRadius) {
                            lineTo(w - topCornerRadius, 0f)
                        }

                        // Top-right corner
                        cubicTo(
                            w - topCornerRadius + kTop, 0f,
                            w, topCornerRadius - kTop,
                            w, topCornerRadius,
                        )

                        // Right edge
                        lineTo(w, h - bottomCornerRadius)

                        // Bottom-right corner
                        cubicTo(
                            w, h - bottomCornerRadius + kBottom,
                            w - bottomCornerRadius + kBottom, h,
                            w - bottomCornerRadius, h,
                        )

                        // Bottom edge
                        lineTo(bottomCornerRadius, h)

                        // Bottom-left corner
                        cubicTo(
                            bottomCornerRadius - kBottom, h,
                            0f, h - bottomCornerRadius + kBottom,
                            0f, h - bottomCornerRadius,
                        )

                        // Left edge
                        lineTo(0f, topCornerRadius)

                        // Top-left corner
                        cubicTo(
                            0f, topCornerRadius - kTop,
                            topCornerRadius - kTop, 0f,
                            topCornerRadius, 0f,
                        )

                        close()
                    }

                    drawPath(path = barPath, color = navSurfaceColor)
                    drawPath(
                        path = barPath,
                        color = navBorderColor,
                        style = Stroke(width = 1.dp.toPx()),
                    )
                }

                // Inactive items row along the baseline
                Row(
                    modifier = Modifier.fillMaxSize(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Destinations.forEachIndexed { index, dest ->
                        val isSelected = index == selectedIndex
                        val itemAlpha by animateFloatAsState(
                            targetValue = if (isSelected) 0f else 1f,
                            animationSpec = tween(160),
                            label = "tab_alpha_$index",
                        )

                        BottomNavItem(
                            label = dest.label,
                            icon = if (isSelected) dest.activeIcon else dest.inactiveIcon,
                            selected = isSelected,
                            alpha = itemAlpha,
                            onClick = { onNavigate(dest.page) },
                            testTag = dest.testTag,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            // 2. Elevated Floating Circular Pod locked to animatedCenterX
            val podRadiusPx = with(density) { podRadius.toPx() }
            val podLeftPx = animatedCenterX - podRadiusPx
            val podTopDp = elevationOverhang - 2.dp - podRadius

            Box(
                modifier = Modifier
                    .offset {
                        IntOffset(
                            x = podLeftPx.roundToInt(),
                            y = with(density) { podTopDp.roundToPx() },
                        )
                    }
                    .size(podSize)
                    .shadow(
                        elevation = 6.dp,
                        shape = CircleShape,
                        ambientColor = Color.Black.copy(alpha = 0.16f),
                        spotColor = Color.Black.copy(alpha = 0.24f),
                    )
                    .clip(CircleShape)
                    .background(primaryColor)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        role = Role.Tab,
                        onClick = { onNavigate(Destinations[selectedIndex].page) },
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Crossfade(
                    targetState = selectedIndex,
                    animationSpec = tween(180),
                    label = "active_pod_icon",
                ) { index ->
                    Icon(
                        imageVector = Destinations[index].activeIcon,
                        contentDescription = Destinations[index].label,
                        tint = onPrimaryColor,
                        modifier = Modifier.size(24.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun BottomNavItem(
    label: String,
    icon: ImageVector,
    selected: Boolean,
    alpha: Float,
    onClick: () -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    val unselectedColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)

    Column(
        modifier = modifier
            .fillMaxHeight()
            .testTag(testTag)
            .semantics {
                this.selected = selected
                this.role = Role.Tab
            }
            .clip(MaterialTheme.shapes.small)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                role = Role.Tab,
                onClick = onClick,
            )
            .graphicsLayer { this.alpha = alpha },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = unselectedColor,
            modifier = Modifier.size(24.dp),
        )
        Spacer(Modifier.height(3.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 11.sp,
                fontWeight = FontWeight.Normal,
            ),
            color = unselectedColor,
            maxLines = 1,
        )
    }
}
