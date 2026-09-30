package com.trooi.app.ui

import android.os.SystemClock
import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.core.model.*
import com.trooi.app.features.auth.*
import com.trooi.app.features.landlord.*
import com.trooi.app.features.tenant.*
import com.trooi.app.ui.components.LandlordBottomBar
import com.trooi.app.ui.components.TenantBottomBar
import com.trooi.app.ui.theme.TroOiTheme
import kotlinx.coroutines.launch

@Composable
fun TroOiApp(viewModel: TroOiViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val activity = LocalActivity.current
    var lastExitBackAt by remember { mutableLongStateOf(0L) }

    LaunchedEffect(state.page) { lastExitBackAt = 0L }
    // On gesture-navigation phones a diagonal scroll from the edge can register as Back.
    // Inner detail/chat sheets own their BackHandler; protect only the five main tabs.
    val mainTab = state.page is AppPage.Tenant || state.page is AppPage.Landlord
    BackHandler(enabled = state.isAuthenticated && mainTab) {
        val page = state.page
        when {
            page is AppPage.Tenant && page.tab != TenantTab.HOME -> viewModel.openTenantTab(TenantTab.HOME)
            page is AppPage.Landlord && page.tab != LandlordTab.DASHBOARD -> viewModel.openLandlordTab(LandlordTab.DASHBOARD)
            else -> {
                val now = SystemClock.elapsedRealtime()
                if (now - lastExitBackAt <= 2400L) {
                    activity?.finish()
                } else {
                    lastExitBackAt = now
                    scope.launch {
                        snackbar.currentSnackbarData?.dismiss()
                        snackbar.showSnackbar("Nhấn quay lại lần nữa để thoát")
                    }
                }
            }
        }
    }

    LaunchedEffect(state.snackbarMessage) {
        state.snackbarMessage?.let {
            snackbar.showSnackbar(it)
            viewModel.clearSnackbar()
        }
    }

    TroOiTheme {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            containerColor = com.trooi.app.ui.theme.TroOiBackground,
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = {
                when (val page = state.page) {
                    is AppPage.Tenant -> TenantBottomBar(page.tab, viewModel::openTenantTab)
                    is AppPage.Landlord -> LandlordBottomBar(page.tab, viewModel::openLandlordTab)
                    else -> Unit
                }
            },
        ) { innerPadding ->
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
            ) {
                when (val page = state.page) {
                    AppPage.AuthWelcome -> AuthWelcomeScreen(
                        onLogin = viewModel::openLogin,
                        onSignUp = viewModel::openSignUp,
                    )

                    AppPage.AuthLogin -> LoginScreen(
                        onBack = viewModel::goBack,
                        onSignUp = viewModel::openSignUp,
                        onForgotPassword = viewModel::openForgotPassword,
                        onLogin = viewModel::login,
                    )

                    AppPage.AuthForgotPassword -> ForgotPasswordScreen(
                        onBack = viewModel::goBack,
                        onSubmit = viewModel::requestPasswordReset,
                    )

                    AppPage.AuthSignUp -> SignUpScreen(
                        onBack = viewModel::goBack,
                        onLogin = viewModel::openLogin,
                        onSignUp = { name, phone, email, password -> viewModel.signUp(name, phone, email, password) },
                    )

                    is AppPage.Tenant -> when (page.tab) {
                        TenantTab.HOME -> TenantHomeScreen(state, viewModel::openRoom, viewModel::toggleSaved)
                        TenantTab.SAVED -> TenantSavedScreen(state, viewModel::openRoom, viewModel::toggleSaved)
                        TenantTab.SCHEDULE -> TenantScheduleScreen(
                            state = state,
                            onOpenMessages = { viewModel.openTenantTab(TenantTab.MESSAGES) },
                            onConfirm = viewModel::confirmBooking,
                            onCancel = viewModel::cancelBooking,
                        )
                        TenantTab.MESSAGES -> TenantMessagesScreen(state, viewModel::openChat)
                        TenantTab.PROFILE -> TenantProfileScreen(state, viewModel::openOperations, viewModel::logout)
                    }

                    is AppPage.TenantRoomDetail -> {
                        val room = state.rooms.firstOrNull { it.id == page.roomId }
                        if (room != null) {
                            TenantRoomDetailScreen(
                                room = room,
                                saved = room.id in state.savedRoomIds,
                                onBack = viewModel::goBack,
                                onToggleSaved = { viewModel.toggleSaved(room.id) },
                                onBook = { date, time -> viewModel.createBooking(room.id, date, time) },
                                onMessage = { viewModel.openRoomConversation(room.id) },
                            )
                        }
                    }

                    is AppPage.TenantChat -> TenantChatScreen(
                        state = state,
                        conversationId = page.conversationId,
                        onBack = viewModel::goBack,
                        onSend = { viewModel.sendMessage(page.conversationId, it) },
                    )

                    is AppPage.Landlord -> when (page.tab) {
                        LandlordTab.DASHBOARD -> LandlordDashboardScreen(
                            state = state,
                            onOpenRooms = { viewModel.openLandlordTab(LandlordTab.ROOMS) },
                            onOpenFinance = { viewModel.openLandlordTab(LandlordTab.FINANCE) },
                            onOpenTickets = { viewModel.openLandlordTab(LandlordTab.TICKETS) },
                        )
                        LandlordTab.ROOMS -> LandlordRoomsScreen(state)
                        LandlordTab.FINANCE -> LandlordFinanceScreen(state)
                        LandlordTab.TICKETS -> LandlordTicketsScreen(state, viewModel::completeTicket)
                        LandlordTab.PROFILE -> LandlordProfileScreen(state, viewModel::openDiscovery, viewModel::logout)
                    }

                }
            }
        }
    }
}
