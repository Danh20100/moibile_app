package com.trooi.app.ui

import androidx.compose.runtime.Composable

/** No test-control functionality is included in the release build. */
@Composable
internal fun DebugTestBridge(
    @Suppress("UNUSED_PARAMETER") viewModel: TroOiViewModel,
    @Suppress("UNUSED_PARAMETER") command: DebugTestCommand?,
) = Unit
