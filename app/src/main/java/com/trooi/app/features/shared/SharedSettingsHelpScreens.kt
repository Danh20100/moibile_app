package com.trooi.app.features.shared

import androidx.compose.runtime.Composable
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.profile.AccountSettingsFlow

@Composable
fun SettingsScreen(state: TroOiUiState, onBack: () -> Unit) {
    AccountSettingsFlow(state, onBack, state.settingsEntry)
}

@Composable
fun HelpScreen(state: TroOiUiState, onBack: () -> Unit) {
    AccountSettingsFlow(state, onBack, "help")
}
