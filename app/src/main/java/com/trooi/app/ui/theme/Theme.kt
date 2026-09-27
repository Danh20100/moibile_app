package com.trooi.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val Scheme = lightColorScheme(
    primary = TroOiGreen,
    onPrimary = TroOiPanel,
    primaryContainer = TroOiGreenSoft,
    onPrimaryContainer = TroOiGreen,
    secondary = TroOiGreenAlt,
    background = TroOiBackground,
    onBackground = TroOiText,
    surface = TroOiPanel,
    onSurface = TroOiText,
    surfaceVariant = TroOiBackground,
    onSurfaceVariant = TroOiMuted,
    outline = TroOiLine,
    error = TroOiRed,
)

@Composable
fun TroOiTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = Scheme,
        typography = TroOiTypography,
        content = content,
    )
}
