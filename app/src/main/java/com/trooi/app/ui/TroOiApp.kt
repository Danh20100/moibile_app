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
import androidx.compose.ui.platform.LocalConfiguration
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
import com.trooi.app.features.shared.V1ContextSwitcherScreen
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
    val useNavigationRail = LocalConfiguration.current.screenWidthDp >= 600
    val rootNavigationVisible = when (state.activeContext) {
        AppContext.DISCOVERY -> state.page in setOf(
            AppPage.Discovery, AppPage.GuestMap, AppPage.GuestActivity, AppPage.Account,
        )
        AppContext.TENANT -> state.page in setOf(
            AppPage.TenantHome, AppPage.TenantRental, AppPage.TenantFinance,
            AppPage.TenantIncidents, AppPage.Account,
        )
        AppContext.OPERATIONS -> state.page in setOf(
            AppPage.OwnerDashboard, AppPage.OwnerProperties, AppPage.OwnerFinance,
            AppPage.OwnerIncidents, AppPage.Account,
        )
    }
    var lastExitAt by remember { mutableLongStateOf(0L) }
    LaunchedEffect(state.page) { lastExitAt = 0L }

    val isContextRoot = state.page == AppPage.Discovery ||
        state.page == AppPage.TenantHome || state.page == AppPage.OwnerDashboard
    BackHandler(
        enabled = state.page !is AppPage.ListingDetail &&
            state.page !is AppPage.NotificationDetail && state.page != AppPage.Notifications,
    ) {
        if (!isContextRoot) {
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
            containerColor = MaterialTheme.colorScheme.background,
            snackbarHost = { SnackbarHost(snackbar) },
            contentWindowInsets = WindowInsets.safeDrawing,
            bottomBar = {
                if (!useNavigationRail && rootNavigationVisible) {
                    when (state.activeContext) {
                        AppContext.DISCOVERY -> V1GuestNavigation(state, viewModel)
                        AppContext.TENANT -> V1TenantNavigation(state, viewModel)
                        AppContext.OPERATIONS -> V1OwnerNavigation(state, viewModel)
                    }
                }
            },
        ) { insets ->
            Row(Modifier.fillMaxSize().padding(insets)) {
                if (useNavigationRail && rootNavigationVisible) {
                    V1AdaptiveNavigationRail(state, viewModel)
                }
                Box(Modifier.weight(1f).fillMaxHeight().imePadding()) {
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
                    AppPage.ContextSwitcher -> V1ContextSwitcherScreen(
                        state = state,
                        onDiscovery = viewModel::openDiscovery,
                        onTenant = viewModel::openTenantHome,
                        onOperations = viewModel::openOperations,
                        onBack = viewModel::goBack,
                    )
                    AppPage.Discovery -> V1DiscoveryScreen(
                        state = state,
                        onOpenListing = viewModel::openListing,
                        onContextSwitcher = if (state.isAuthenticated) viewModel::openContextSwitcher else null,
                        onSearch = if (BuildConfig.BACKEND_BACKED) viewModel::searchPublicListings else null,
                        onResetSearch = if (BuildConfig.BACKEND_BACKED) viewModel::reloadPublicListings else null,
                        onProbeTransport = if (BuildConfig.BACKEND_BACKED && BuildConfig.DEBUG) viewModel::probePublicTransport else null,
                    )
                    AppPage.GuestMap -> V1GuestMapScreen(state, viewModel::openListing)
                    AppPage.GuestActivity -> V1GuestActivityScreen(state)
                    is AppPage.ListingDetail -> V1ListingDetailScreen(
                        state = state,
                        listingId = page.listingId,
                        onBack = viewModel::goBack,
                        onOpenLogin = viewModel::openLogin,
                        onSubmitInquiry = viewModel::submitInquiry,
                    )
                    AppPage.TenantHome -> V1TenantHomeScreen(
                        state = state,
                        onRental = viewModel::openTenantRental,
                        onFinance = viewModel::openTenantFinance,
                        onIncidents = viewModel::openTenantIncidents,
                        onContextSwitcher = viewModel::openContextSwitcher,
                    )
                    AppPage.TenantRental -> if (BuildConfig.BACKEND_BACKED) {
                        V1TenantFlow(state, viewModel::openDiscovery, viewModel::logout)
                    } else V1TenantPortalScreen(state, viewModel::openDiscovery)
                    AppPage.TenantFinance -> V1TenantFinanceScreen(state, viewModel::openTenantRental)
                    AppPage.TenantIncidents -> V1TenantIncidentsScreen(state, viewModel::openTenantRental)
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
                        onContextSwitcher = viewModel::openContextSwitcher,
                        onNotifications = viewModel::openNotifications,
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
}

@Composable
private fun V1AdaptiveNavigationRail(state: TroOiUiState, viewModel: TroOiViewModel) {
    NavigationRail(
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        when (state.activeContext) {
            AppContext.DISCOVERY -> {
                NavigationRailItem(
                    selected = state.page == AppPage.Discovery,
                    onClick = viewModel::openDiscovery,
                    icon = { Icon(Icons.Rounded.Home, "Trang chủ") },
                    label = { Text("Trang chủ") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.GuestMap,
                    onClick = viewModel::openGuestMap,
                    icon = { Icon(Icons.Rounded.Map, "Bản đồ") },
                    label = { Text("Bản đồ") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.GuestActivity,
                    onClick = viewModel::openGuestActivity,
                    icon = { Icon(Icons.Rounded.Send, "Hoạt động") },
                    label = { Text("Hoạt động") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.Account,
                    onClick = viewModel::openAccount,
                    icon = { Icon(Icons.Rounded.PersonOutline, "Tài khoản") },
                    label = { Text("Tài khoản") },
                    alwaysShowLabel = true,
                )
            }
            AppContext.TENANT -> {
                NavigationRailItem(
                    selected = state.page == AppPage.TenantHome,
                    onClick = viewModel::openTenantHome,
                    icon = { Icon(Icons.Rounded.Home, "Trang chủ") },
                    label = { Text("Trang chủ") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.TenantRental,
                    onClick = viewModel::openTenantRental,
                    icon = { Icon(Icons.Rounded.MeetingRoom, "Nhà tôi") },
                    label = { Text("Nhà tôi") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.TenantFinance,
                    onClick = viewModel::openTenantFinance,
                    icon = { Icon(Icons.Rounded.Payments, "Thanh toán") },
                    label = { Text("Thanh toán") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.TenantIncidents,
                    onClick = viewModel::openTenantIncidents,
                    icon = { Icon(Icons.Rounded.Build, "Sự cố") },
                    label = { Text("Sự cố") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.Account,
                    onClick = viewModel::openAccount,
                    icon = { Icon(Icons.Rounded.PersonOutline, "Tài khoản") },
                    label = { Text("Tài khoản") },
                    alwaysShowLabel = true,
                )
            }
            AppContext.OPERATIONS -> {
                NavigationRailItem(
                    selected = state.page == AppPage.OwnerDashboard,
                    onClick = viewModel::openOperations,
                    icon = { Icon(Icons.Rounded.Dashboard, "Tổng quan") },
                    label = { Text("Tổng quan") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.OwnerProperties,
                    onClick = viewModel::openOwnerProperties,
                    icon = { Icon(Icons.Rounded.MeetingRoom, "Phòng") },
                    label = { Text("Phòng") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.OwnerFinance,
                    onClick = viewModel::openOwnerFinance,
                    icon = { Icon(Icons.Rounded.Payments, "Tài chính") },
                    label = { Text("Tài chính") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.OwnerIncidents,
                    onClick = viewModel::openOwnerIncidents,
                    icon = { Icon(Icons.Rounded.Build, "Sự cố") },
                    label = { Text("Sự cố") },
                    alwaysShowLabel = true,
                )
                NavigationRailItem(
                    selected = state.page == AppPage.Account,
                    onClick = viewModel::openAccount,
                    icon = { Icon(Icons.Rounded.PersonOutline, "Tài khoản") },
                    label = { Text("Tài khoản") },
                    alwaysShowLabel = true,
                )
            }
        }
    }
}

@Composable
private fun V1GuestNavigation(state: TroOiUiState, viewModel: TroOiViewModel) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
    ) {
        NavigationBarItem(
            selected = state.page == AppPage.Discovery,
            onClick = viewModel::openDiscovery,
            icon = { Icon(Icons.Rounded.Home, "Trang chủ") },
            label = { Text("Trang chủ") },
        )
        NavigationBarItem(
            selected = state.page == AppPage.GuestMap,
            onClick = viewModel::openGuestMap,
            icon = { Icon(Icons.Rounded.Map, "Bản đồ") },
            label = { Text("Bản đồ") },
        )
        NavigationBarItem(
            selected = state.page == AppPage.GuestActivity,
            onClick = viewModel::openGuestActivity,
            icon = { Icon(Icons.Rounded.Send, "Hoạt động") },
            label = { Text("Hoạt động") },
        )
        NavigationBarItem(
            selected = state.page == AppPage.Account,
            onClick = viewModel::openAccount,
            icon = { Icon(Icons.Rounded.PersonOutline, "Tài khoản") },
            label = { Text("Tài khoản") },
        )
    }
}

@Composable
private fun V1TenantNavigation(state: TroOiUiState, viewModel: TroOiViewModel) {
    if (!state.isAuthenticated || !state.access.allows(ClientArea.TENANT_PORTAL)) return
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
    ) {
        NavigationBarItem(
            selected = state.page == AppPage.TenantHome,
            onClick = viewModel::openTenantHome,
            icon = { Icon(Icons.Rounded.Home, "Trang chủ") },
            label = { Text("Trang chủ") },
        )
        NavigationBarItem(
            selected = state.page == AppPage.TenantRental,
            onClick = viewModel::openTenantRental,
            icon = { Icon(Icons.Rounded.MeetingRoom, "Nhà tôi") },
            label = { Text("Nhà tôi") },
        )
        NavigationBarItem(
            selected = state.page == AppPage.TenantFinance,
            onClick = viewModel::openTenantFinance,
            icon = { Icon(Icons.Rounded.Payments, "Thanh toán") },
            label = { Text("Thanh toán") },
        )
        NavigationBarItem(
            selected = state.page == AppPage.TenantIncidents,
            onClick = viewModel::openTenantIncidents,
            icon = { Icon(Icons.Rounded.Build, "Sự cố") },
            label = { Text("Sự cố") },
        )
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
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
    ) {
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
    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        TroOiBrand()
        Spacer(Modifier.height(8.dp))
        if (inProgress) {
            V1PageTitle(
                "Mở lại không gian của bạn",
                "Đang xác minh Google credential và capability từ Backend.",
            )
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
            V1Panel("Đang xác minh") {
                LedgerStateLabel("Google credential đã được chọn", LedgerTone.Success)
                LedgerStateLabel("Đang xác định không gian được truy cập", LedgerTone.Warning)
                V1Pending(
                    "Token chỉ được giữ trong phiên chạy hiện tại; app chưa có persistent session restore qua process restart.",
                )
            }
        } else {
            V1PageTitle(
                "Mở không gian của bạn",
                "Đăng nhập để xem nơi đang thuê hoặc khu trọ được cấp quyền.",
            )
            V1Panel("Đăng nhập với Google") {
                V1Pending(
                    "Google ID Token được Backend xác minh; Tenant/Landlord là context từ relationship thật, không phải USER.role.",
                )
                V1Action(
                    "Tiếp tục với Google",
                    onClick = onSignIn,
                    modifier = Modifier.fillMaxWidth(),
                )
                TextButton(onClick = onBack) { Text("Tiếp tục khám phá phòng") }
            }
        }
    }
}
