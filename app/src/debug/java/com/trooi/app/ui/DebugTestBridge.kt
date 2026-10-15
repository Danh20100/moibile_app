package com.trooi.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.core.data.AppDataSource
import com.trooi.app.core.data.RuntimeDataSource

/** Debug-only entry point: never fakes authorization or submits real transactions. */
@Composable
internal fun DebugTestBridge(viewModel: TroOiViewModel, command: DebugTestCommand?) {
    val context = LocalContext.current
    val restoring = viewModel.state.collectAsStateWithLifecycle().value.sessionRestoring
    LaunchedEffect(command?.id, restoring) {
        if (command == null || restoring) return@LaunchedEffect
        when (command.mode.lowercase()) {
            "mock" -> viewModel.switchDebugDataSource(context, AppDataSource.MOCK)
            "backend" -> viewModel.switchDebugDataSource(context, AppDataSource.BACKEND)
        }
        if (command.route.isNotEmpty()) {
            viewModel.openDebugTestScreen(command.route, command.listingId)
        }
    }
}
