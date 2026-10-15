package com.trooi.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics

/** Fullscreen canvas; cards and action dialogs retain the separate surface role. */
@Composable
fun TroOiPage(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val view = LocalView.current
    val lightCanvas = MaterialTheme.colorScheme.background.luminance() > 0.5f
    SideEffect {
        (view.parent as? DialogWindowProvider)?.window?.let { window ->
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = lightCanvas
                isAppearanceLightNavigationBars = lightCanvas
            }
        }
    }
    // Paint outside content padding too, so fullscreen dialogs do not expose a dimmed inset.
    Surface(Modifier.background(MaterialTheme.colorScheme.background).then(modifier), color = MaterialTheme.colorScheme.background,
        contentColor = MaterialTheme.colorScheme.onBackground, content = content)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TroOiPageTopAppBar(title: @Composable () -> Unit, navigationIcon: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {}) {
    TopAppBar(title = { Box(Modifier.semantics { heading() }) { title() } }, navigationIcon = navigationIcon, actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background,
            scrolledContainerColor = MaterialTheme.colorScheme.background))
}

/** Nested shell. The outer app/dialog owns safeDrawing/IME; opt in explicitly for standalone windows. */
@Composable
fun TroOiScreenScaffold(modifier: Modifier = Modifier, contentWindowInsets: WindowInsets = WindowInsets(0, 0, 0, 0),
    topBar: @Composable () -> Unit = {}, snackbarHost: @Composable () -> Unit = {},
    bottomBar: @Composable () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit) {
    TroOiPage(modifier) {
        Scaffold(containerColor = MaterialTheme.colorScheme.background, contentWindowInsets = contentWindowInsets,
            topBar = topBar, snackbarHost = snackbarHost, bottomBar = bottomBar, content = content)
    }
}
