package com.trooi.app.features.shared

import androidx.compose.runtime.*
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.profile.AccountSettingsFlow
import com.trooi.app.features.profile.LandlordOnboardingScreen
import com.trooi.app.core.model.LocalLandlordApplication
import com.trooi.app.core.data.RuntimeDataSource
import com.trooi.app.core.network.dto.SessionContextTransport

@Composable
fun SettingsScreen(
    state: TroOiUiState,
    onBack: () -> Unit,
    onSaveDisplayName: suspend (String) -> Result<Unit> = {
        Result.failure(IllegalStateException("Cập nhật hồ sơ chưa khả dụng."))
    },
    onSessionUpdated: suspend (SessionContextTransport) -> Result<Unit> = {
        Result.failure(IllegalStateException("Không thể đồng bộ phiên tài khoản."))
    },
    onOpenWorkspace: () -> Unit = {},
    onCompleteLandlord: suspend (LocalLandlordApplication) -> Result<Unit> = {
        Result.failure(IllegalStateException("Chưa thể hoàn tất hồ sơ chủ trọ."))
    },
) {
    var onboarding by remember(state.backendUserId) { mutableStateOf(false) }
    AccountSettingsFlow(state, onBack, state.settingsEntry, onSaveDisplayName = onSaveDisplayName, onSessionUpdated = onSessionUpdated,
        onOpenOperatorWorkspace = onOpenWorkspace, onStartLandlordOnboarding = { onboarding = true })
    if (onboarding) LandlordOnboardingScreen(state.displayName, { onboarding = false }, {
        onboarding = false
        onOpenWorkspace()
    }, onCompleteLandlord, backendVerification = RuntimeDataSource.isBackendBacked())
}

@Composable
fun HelpScreen(
    state: TroOiUiState,
    onBack: () -> Unit,
    onSessionUpdated: suspend (SessionContextTransport) -> Result<Unit> = {
        Result.failure(IllegalStateException("Không thể đồng bộ phiên tài khoản."))
    },
) {
    AccountSettingsFlow(state, onBack, "help", onSessionUpdated = onSessionUpdated)
}
