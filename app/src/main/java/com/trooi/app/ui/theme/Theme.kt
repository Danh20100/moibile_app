package com.trooi.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

private val LightScheme = lightColorScheme(
    primary = TroOiPrimary,
    onPrimary = TroOiOnPrimary,
    primaryContainer = TroOiSelected,
    onPrimaryContainer = TroOiPrimary,
    secondary = TroOiClay,
    onSecondary = TroOiOnPrimary,
    secondaryContainer = TroOiClaySoft,
    background = TroOiCanvas,
    onBackground = TroOiInk,
    surface = TroOiPaper,
    onSurface = TroOiInk,
    surfaceVariant = TroOiSurface,
    onSurfaceVariant = TroOiMuted,
    outline = TroOiLine,
    error = TroOiError,
    errorContainer = TroOiErrorSoft,
)

private val DarkScheme = darkColorScheme(
    primary = TroOiDarkPrimary,
    onPrimary = TroOiDarkOnPrimary,
    primaryContainer = TroOiDarkSelected,
    onPrimaryContainer = TroOiDarkPrimary,
    secondary = TroOiDarkClay,
    secondaryContainer = TroOiDarkClaySoft,
    onSecondaryContainer = TroOiDarkClay,
    background = TroOiDarkCanvas,
    onBackground = TroOiDarkInk,
    surface = TroOiDarkPaper,
    onSurface = TroOiDarkInk,
    surfaceVariant = TroOiDarkSurface,
    onSurfaceVariant = TroOiDarkMuted,
    outline = TroOiDarkLine,
    error = TroOiDarkError,
)

private val RoomLedgerShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(10.dp),
    large = RoundedCornerShape(12.dp),
    extraLarge = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
)

@Composable
fun TroOiTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkScheme else LightScheme,
        typography = TroOiTypography,
        shapes = RoomLedgerShapes,
        content = content,
    )
}
