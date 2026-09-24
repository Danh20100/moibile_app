package com.trooi.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val TroOiColorScheme = lightColorScheme(
    primary = TroOiInk,
    onPrimary = TroOiBackground,
    primaryContainer = TroOiLime,
    onPrimaryContainer = TroOiInk,
    secondary = TroOiAccent,
    onSecondary = TroOiSurface,
    background = TroOiBackground,
    onBackground = TroOiInk,
    surface = TroOiSurface,
    onSurface = TroOiInk,
    surfaceVariant = TroOiBackground,
    onSurfaceVariant = TroOiInkMuted,
    outline = TroOiBorder,
    error = TroOiDanger,
)

@Composable
fun TroOiTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TroOiColorScheme,
        typography = TroOiTypography,
        content = content,
    )
}
