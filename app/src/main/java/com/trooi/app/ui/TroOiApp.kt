package com.trooi.app.ui

import android.os.SystemClock
import com.trooi.app.BuildConfig
import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.core.model.*
import com.trooi.app.features.auth.*
import com.trooi.app.features.landlord.*
import com.trooi.app.features.tenant.*
import com.trooi.app.features.organization.V1OperatorWorkspace
import com.trooi.app.features.notifications.V1NotificationCenterScreen
import com.trooi.app.features.notifications.V1NotificationDetailScreen
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun TroOiApp(viewModel: TroOiViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val activity = LocalActivity.current
    val context = LocalContext.current
    var lastExitAt by remember { mutableLongStateOf(0L) }
    LaunchedEffect(state.page) { lastExitAt = 0L }

    // Only root Discovery may close the app; swipes in nested screens navigate safely.
    BackHandler(
        enabled = state.page !is AppPage.ListingDetail &&
            state.page !is AppPage.NotificationDetail && state.page != AppPage.Notifications,
    ) {
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
            modifier = Modifier.fillMaxSize().semantics { testTagsAsResourceId = true },
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
                if (BuildConfig.BACKEND_BACKED && state.page in setOf(
                        AppPage.AuthWelcome, AppPage.AuthLogin, AppPage.AuthSignUp, AppPage.AuthForgotPassword,
                    )) {
                    BackendGoogleAuthentication(
                        inProgress = state.authInProgress,
                        onSignIn = { viewModel.signInWithGoogle(context) },
                        onBack = viewModel::goBack,
                    )
                } else when (val page = state.page) {
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
                    AppPage.Discovery -> V1DiscoveryScreen(
                        state = state,
                        onOpenListing = viewModel::openListing,
                        onSearch = if (BuildConfig.BACKEND_BACKED) viewModel::searchPublicListings else null,
                        onResetSearch = if (BuildConfig.BACKEND_BACKED) viewModel::reloadPublicListings else null,
                        onProbeTransport = if (BuildConfig.BACKEND_BACKED && BuildConfig.DEBUG) viewModel::probePublicTransport else null,
                    )
                    is AppPage.ListingDetail -> V1ListingDetailScreen(
                        state = state,
                        listingId = page.listingId,
                        onBack = viewModel::goBack,
                        onOpenLogin = viewModel::openLogin,
                        onSubmitInquiry = viewModel::submitInquiry,
                    )
                    AppPage.TenantPortal -> if (BuildConfig.BACKEND_BACKED) {
                        V1TenantFlow(state, viewModel::openDiscovery, viewModel::logout)
                    } else V1TenantPortalScreen(state, viewModel::openDiscovery)
                    AppPage.Notifications -> V1NotificationCenterScreen(
                        state = state,
                        onOpen = viewModel::openNotification,
                        onBack = viewModel::goBack,
                    )
                    is AppPage.NotificationDetail -> V1NotificationDetailScreen(
                        state = state,
                        notificationId = page.notificationId,
                        onBack = viewModel::goBack,
                        onMarkRead = viewModel::markNotificationRead,
                        onOpenSource = viewModel::openNotificationSource,
                    )
                    AppPage.Account -> V1AccountScreen(
                        state = state,
                        googleOnly = BuildConfig.BACKEND_BACKED,
                        onLogin = viewModel::openLogin,
                        onSignUp = viewModel::openSignUp,
                        onDiscovery = viewModel::openDiscovery,
                        onTenantPortal = viewModel::openTenantPortal,
                        onNotifications = viewModel::openNotifications,
                        onOperations = viewModel::openOperations,
                        onLogout = viewModel::logout,
                    )
                    AppPage.OwnerDashboard -> V1OwnerDashboardScreen(state)
                    AppPage.OwnerProperties -> if (BuildConfig.BACKEND_BACKED) {
                        V1OperatorWorkspace(state.access, onUnauthorized = viewModel::logout,
                            onWorkspaceCreated = viewModel::refreshSessionContext)
                    } else V1OwnerPropertiesScreen(state)
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
        if (state.isAuthenticated) {
            NavigationBarItem(
                selected = false,
                onClick = if (state.access.allows(ClientArea.OPERATIONS)) viewModel::openOperations else viewModel::openOwnerProperties,
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

@Composable
private fun BackendGoogleAuthentication(
    inProgress: Boolean,
    onSignIn: () -> Unit,
    onBack: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(24.dp)) {
        V1Panel("Đăng nhập TrọƠi bằng Google") {
            V1Pending("Google ID Token được Backend xác minh; quyền Owner/Tenant được suy ra từ relationship thật.")
            V1Action(
                if (inProgress) "Đang xác thực…" else "Tiếp tục với Google",
                onClick = onSignIn,
                modifier = Modifier.fillMaxWidth(),
                enabled = !inProgress,
            )
            TextButton(onClick = onBack, enabled = !inProgress) { Text("Quay về tìm phòng") }
        }
    }
}
