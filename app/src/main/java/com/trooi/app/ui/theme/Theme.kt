package com.trooi.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LocalRippleConfiguration
import androidx.compose.material3.RippleConfiguration
import androidx.compose.runtime.CompositionLocalProvider
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
    outlineVariant = TroOiSurface,
    surfaceContainer = TroOiSurface,
    surfaceContainerHigh = TroOiSelected,
    surfaceContainerHighest = TroOiSurface,
    surfaceContainerLowest = TroOiPaper,
    surfaceBright = TroOiPaper,
    surfaceDim = TroOiSurface,
    tertiary = TroOiWarning,
    onTertiary = TroOiOnPrimary,
    tertiaryContainer = TroOiWarningSoft,
    onTertiaryContainer = TroOiWarning,
    onError = TroOiOnPrimary,
    onErrorContainer = TroOiError,
    surfaceContainerLow = TroOiCanvas,
    onSecondaryContainer = TroOiInk,
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
    outlineVariant = TroOiDarkLine,
    surfaceContainer = TroOiDarkSurface,
    surfaceContainerHigh = TroOiDarkSelected,
    surfaceContainerHighest = TroOiDarkSurface,
    surfaceContainerLowest = TroOiDarkCanvas,
    surfaceBright = TroOiDarkSurface,
    surfaceDim = TroOiDarkCanvas,
    tertiary = TroOiDarkWarning,
    onTertiary = TroOiDarkOnPrimary,
    tertiaryContainer = TroOiDarkWarningSoft,
    onTertiaryContainer = TroOiDarkWarning,
    errorContainer = TroOiDarkErrorSoft,
    onErrorContainer = TroOiDarkError,
    surfaceContainerLow = TroOiDarkCanvas,
    error = TroOiDarkError,
)

private val RoomLedgerShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(10.dp),
    large = RoundedCornerShape(12.dp),
    extraLarge = RoundedCornerShape(20.dp),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TroOiTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val scheme = if (darkTheme) DarkScheme else LightScheme
    CompositionLocalProvider(LocalRippleConfiguration provides RippleConfiguration(color = scheme.primary)) {
    MaterialTheme(
        colorScheme = scheme,
        typography = TroOiTypography,
        shapes = RoomLedgerShapes,
        content = content,
    )
    }
}
