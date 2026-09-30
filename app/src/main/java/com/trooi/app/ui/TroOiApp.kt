package com.trooi.app.ui

import android.os.SystemClock
import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.core.model.*
import com.trooi.app.features.auth.*
import com.trooi.app.features.landlord.*
import com.trooi.app.features.tenant.*
import com.trooi.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun TroOiApp(viewModel: TroOiViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val activity = LocalActivity.current
    var lastExitAt by remember { mutableLongStateOf(0L) }
    LaunchedEffect(state.page) { lastExitAt = 0L }

    // Only root Discovery may close the app; swipes in nested screens navigate safely.
    BackHandler(enabled = state.page !is AppPage.ListingDetail) {
        if (state.page != AppPage.Discovery) {
            viewModel.goBack()
        } else {
            val now = SystemClock.elapsedRealtime()
            if (now - lastExitAt <= 2400L) activity?.finish()
            else {
                lastExitAt = now
                scope.launch { snackbar.showSnackbar("Nhấn quay lại lần nữa để thoát") }
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
            containerColor = TroOiBackground,
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = {
                when (state.page) {
                    AppPage.Discovery, AppPage.TenantPortal, AppPage.Account ->
                        V1PublicNavigation(state, viewModel)
                    AppPage.OwnerDashboard, AppPage.OwnerProperties, AppPage.OwnerFinance, AppPage.OwnerIncidents ->
                        V1OwnerNavigation(state, viewModel)
                    else -> Unit
                }
            },
        ) { insets ->
            Box(Modifier.fillMaxSize().padding(insets)) {
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
                    AppPage.AuthSignUp -> SignUpScreen(
                        onBack = viewModel::goBack,
                        onLogin = viewModel::openLogin,
                        onSignUp = viewModel::signUp,
                    )
                    AppPage.AuthForgotPassword -> ForgotPasswordScreen(
                        onBack = viewModel::goBack,
                        onSubmit = viewModel::requestPasswordReset,
                    )
                    AppPage.Discovery -> V1DiscoveryScreen(state, viewModel::openListing)
                    is AppPage.ListingDetail -> V1ListingDetailScreen(
                        state, page.listingId, viewModel::goBack, viewModel::submitInquiry,
                    )
                    AppPage.TenantPortal -> V1TenantPortalScreen(state, viewModel::openDiscovery)
                    AppPage.Account -> V1AccountScreen(
                        state = state,
                        onLogin = viewModel::openLogin,
                        onSignUp = viewModel::openSignUp,
                        onDiscovery = viewModel::openDiscovery,
                        onTenantPortal = viewModel::openTenantPortal,
                        onOperations = viewModel::openOperations,
                        onLogout = viewModel::logout,
                    )
                    AppPage.OwnerDashboard -> V1OwnerDashboardScreen(state)
                    AppPage.OwnerProperties -> V1OwnerPropertiesScreen(state)
                    AppPage.OwnerFinance -> V1OwnerFinanceScreen(state)
                    AppPage.OwnerIncidents -> V1OwnerIncidentsScreen(state)
                }
            }
        }
    }
}

@Composable
private fun V1PublicNavigation(state: TroOiUiState, viewModel: TroOiViewModel) {
    NavigationBar(containerColor = androidx.compose.ui.graphics.Color.White) {
        NavigationBarItem(
            selected = state.page == AppPage.Discovery,
            onClick = viewModel::openDiscovery,
            icon = { Icon(Icons.Rounded.Search, "Tìm phòng") },
            label = { Text("Tìm phòng") },
        )
        if (state.isAuthenticated && state.access.allows(ClientArea.TENANT_PORTAL)) {
            NavigationBarItem(
                selected = state.page == AppPage.TenantPortal,
                onClick = viewModel::openTenantPortal,
                icon = { Icon(Icons.Rounded.Home, "Lượt thuê") },
                label = { Text("My Rental") },
            )
        }
        if (state.isAuthenticated && state.access.allows(ClientArea.OPERATIONS)) {
            NavigationBarItem(
                selected = false,
                onClick = viewModel::openOperations,
                icon = { Icon(Icons.Rounded.Apartment, "Vận hành") },
                label = { Text("Vận hành") },
            )
        }
        NavigationBarItem(
            selected = state.page == AppPage.Account,
            onClick = viewModel::openAccount,
            icon = { Icon(Icons.Rounded.PersonOutline, "Tài khoản") },
            label = { Text("Tài khoản") },
        )
    }
}

@Composable
private fun V1OwnerNavigation(state: TroOiUiState, viewModel: TroOiViewModel) {
    if (!state.isAuthenticated || !state.access.allows(ClientArea.OPERATIONS)) return
    NavigationBar(containerColor = androidx.compose.ui.graphics.Color.White) {
        NavigationBarItem(
            selected = state.page == AppPage.OwnerDashboard,
            onClick = viewModel::openOperations,
            icon = { Icon(Icons.Rounded.Dashboard, "Tổng quan") },
            label = { Text("Tổng quan") },
        )
        NavigationBarItem(
            selected = state.page == AppPage.OwnerProperties,
            onClick = viewModel::openOwnerProperties,
            icon = { Icon(Icons.Rounded.MeetingRoom, "Phòng") },
            label = { Text("Phòng") },
        )
        NavigationBarItem(
            selected = state.page == AppPage.OwnerFinance,
            onClick = viewModel::openOwnerFinance,
            icon = { Icon(Icons.Rounded.Payments, "Tài chính") },
            label = { Text("Tài chính") },
        )
        NavigationBarItem(
            selected = state.page == AppPage.OwnerIncidents,
            onClick = viewModel::openOwnerIncidents,
            icon = { Icon(Icons.Rounded.Build, "Sự cố") },
            label = { Text("Sự cố") },
        )
        NavigationBarItem(
            selected = false,
            onClick = viewModel::openAccount,
            icon = { Icon(Icons.Rounded.PersonOutline, "Tài khoản") },
            label = { Text("Tài khoản") },
        )
    }
}
