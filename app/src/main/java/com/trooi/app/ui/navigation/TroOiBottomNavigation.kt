package com.trooi.app.ui.navigation

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.interaction.collectIsFocusedAsState
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
import androidx.compose.ui.geometry.Rect
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
 * - Circular cradle follows the active pod; labels stay visible below it.
 * - Touch semantics belong to the four stable destination slots.
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

    val fontScale = LocalDensity.current.fontScale
    val barHeight = if (fontScale <= 1f) 64.dp else (40f + 32f * fontScale).dp
    val elevationOverhang = 26.dp
    val containerHeight = barHeight + elevationOverhang
    val podSize = 48.dp
    val podRadius = 24.dp

    Box(
        modifier = modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .navigationBarsPadding()
            .padding(start = 16.dp, end = 16.dp, bottom = 6.dp),
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
            val targetCenterFraction = (selectedIndex + 0.5f) / slotCount

            val animatedCenterFraction by animateFloatAsState(
                targetValue = targetCenterFraction,
                animationSpec = tween(
                    durationMillis = 220,
                    easing = FastOutSlowInEasing,
                ),
                label = "notch_center_x",
            )
            // Fractional animation keeps the pod and cradle inside the new width during resize.
            val animatedCenterX = animatedCenterFraction * navWidthPx

            // 1. Floating Bar Surface with Animated Notch Cradle
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(barHeight)
                    .align(Alignment.BottomCenter)

            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val w = size.width
                    val h = size.height
                    val cx = animatedCenterX

                    val cradleRadius = 30.dp.toPx()
                    val topCornerRadius = minOf(14.dp.toPx(), (slotWidthPx / 2f - cradleRadius - 4.dp.toPx()).coerceAtLeast(2.dp.toPx()))
                    val bottomCornerRadius = 24.dp.toPx()
                    val kTop = 0.55228475f * topCornerRadius
                    val kBottom = 0.55228475f * bottomCornerRadius

                    val cradleDepth = 28.dp.toPx()
                    val shoulderWidth = 12.dp.toPx()

                    val rawLeft = cx - cradleRadius - shoulderWidth
                    val rawRight = cx + cradleRadius + shoulderWidth

                    val notchLeft = rawLeft.coerceIn(topCornerRadius, cx - cradleRadius * 0.25f)
                    val notchRight = rawRight.coerceIn(cx + cradleRadius * 0.25f, w - topCornerRadius)


                    val barPath = Path().apply {
                        moveTo(topCornerRadius, 0f)

                        if (notchLeft > topCornerRadius) {
                            lineTo(notchLeft, 0f)
                        }

                        // Circular lower arc with tangent shoulders: 6dp clearance around the active pod.
                        val arcX = cradleRadius * 0.9797959f
                        val arcY = 4.dp.toPx()
                        cubicTo((notchLeft + cx - arcX) / 2f, 0f,
                            cx - arcX - 1.2.dp.toPx(), -2.dp.toPx(), cx - arcX, arcY)
                        arcTo(Rect(cx - cradleRadius, -32.dp.toPx(), cx + cradleRadius, cradleDepth),
                            168.463f, -156.926f, false)
                        cubicTo(cx + arcX + 1.2.dp.toPx(), -2.dp.toPx(),
                            (notchRight + cx + arcX) / 2f, 0f, notchRight, 0f)

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
                    .background(primaryColor),

                contentAlignment = Alignment.Center,
            ) {
                Crossfade(
                    targetState = selectedIndex,
                    animationSpec = tween(180),
                    label = "active_pod_icon",
                ) { index ->
                    Icon(
                        imageVector = Destinations[index].activeIcon,
                        contentDescription = null,
                        tint = onPrimaryColor,
                        modifier = Modifier.size(28.dp),
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
    val unselectedColor = MaterialTheme.colorScheme.onSurfaceVariant
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val focused by interaction.collectIsFocusedAsState()
    val highlighted = pressed || focused

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
                interactionSource = interaction,
                indication = null,
                role = Role.Tab,
                onClick = onClick,
            ),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Bottom,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (highlighted) MaterialTheme.colorScheme.primary else unselectedColor,
            modifier = Modifier.size(28.dp).graphicsLayer { this.alpha = alpha },
        )
        Spacer(Modifier.height(3.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 13.sp,
                fontWeight = if (selected || highlighted) FontWeight.SemiBold else FontWeight.Normal,
            ),
            color = if (selected || highlighted) MaterialTheme.colorScheme.primary else unselectedColor,
            maxLines = 2,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
    }
}
