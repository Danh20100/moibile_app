package com.trooi.app.ui

import android.os.SystemClock
import com.trooi.app.BuildConfig
import com.trooi.app.core.data.RuntimeDataSource
import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.trooi.app.core.model.*
import com.trooi.app.features.auth.*
import com.trooi.app.features.discovery.*
import com.trooi.app.features.landlord.*
import com.trooi.app.features.ledger.*
import com.trooi.app.features.tenant.*
import com.trooi.app.features.organization.V1OperatorWorkspace
import com.trooi.app.features.shared.HelpScreen
import com.trooi.app.features.shared.SettingsScreen
import com.trooi.app.features.shared.TrustReportScreen
import com.trooi.app.core.model.accountTabSelected
import com.trooi.app.features.shared.V1ContextSwitcherScreen
import com.trooi.app.features.organization.OperatorRoute
import com.trooi.app.features.tenancy.PaymentReturnUri
import com.trooi.app.features.tenancy.RentalRoute
import com.trooi.app.features.tenancy.V1RentalWorkspace
import com.trooi.app.features.notifications.V1NotificationCenterScreen
import com.trooi.app.features.notifications.V1NotificationDetailScreen
import com.trooi.app.ui.components.*
import com.trooi.app.ui.navigation.CoreTabIdentity
import com.trooi.app.ui.navigation.TroOiBottomNavigation
import com.trooi.app.ui.splash.TroOiFirstEntryScreen
import com.trooi.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun TroOiApp(
    viewModel: TroOiViewModel = hiltViewModel(),
    paymentReturnUri: PaymentReturnUri? = null,
    debugTestCommand: DebugTestCommand? = null,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val demoBackend = BuildConfig.DEBUG && BuildConfig.DEMO_BACKEND_ENABLED && !RuntimeDataSource.isBackendBacked()
    val snackbar = remember { SnackbarHostState() }
    val accountDrafts = rememberSaveableStateHolder()
    val discoveryStates = rememberSaveableStateHolder()
    var lastAccountDraftKey by remember { mutableStateOf<String?>(null) }
    val accountDraftKey = "account-settings-${state.backendUserId}"
    LaunchedEffect(state.isAuthenticated, accountDraftKey) {
        if (!state.isAuthenticated || lastAccountDraftKey != accountDraftKey) {
            lastAccountDraftKey?.let(accountDrafts::removeState)
            lastAccountDraftKey = if (state.isAuthenticated) accountDraftKey else null
        }
    }
    val scope = rememberCoroutineScope()
    val activity = LocalActivity.current
    val context = LocalContext.current
    val useNavigationRail = LocalConfiguration.current.screenWidthDp >= 600
    LaunchedEffect(Unit) { viewModel.bootstrapRestore(context) }
    LaunchedEffect(paymentReturnUri, state.sessionRestoring, state.isAuthenticated) {
        if (paymentReturnUri == null || state.sessionRestoring || !state.isAuthenticated) return@LaunchedEffect
        viewModel.handlePaymentReturn(paymentReturnUri)
    }
    LifecycleResumeEffect(state.isAuthenticated, state.sessionRestoring) {
        if (state.isAuthenticated && !state.sessionRestoring) viewModel.onAppResume()
        onPauseOrDispose { }
    }
    var messageDetailVisible by remember { mutableStateOf(false) }
    val rootNavigationVisible = rootNavigationVisible(state) && !messageDetailVisible
    LifecycleResumeEffect(state.page, state.backendUserId) {
        val polling = if (state.page == AppPage.Messages && state.isAuthenticated) scope.launch {
            while (true) { viewModel.openMessages(); kotlinx.coroutines.delay(8000) }
        } else null
        onPauseOrDispose { polling?.cancel() }
    }
    var lastExitAt by remember { mutableLongStateOf(0L) }
    LaunchedEffect(state.page) { lastExitAt = 0L }

    val isContextRoot = state.page == AppPage.Discovery ||
        state.page == AppPage.TenantHome || state.page == AppPage.OwnerDashboard ||
        state.page == AppPage.AuthWelcome
    BackHandler(
        enabled = state.page !is AppPage.ListingDetail &&
            state.page !is AppPage.TrustReport &&
            state.page != AppPage.Settings && state.page != AppPage.Help &&
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
        DebugTestBridge(viewModel, debugTestCommand)
        TroOiScreenScaffold(
            modifier = Modifier.fillMaxSize().semantics { testTagsAsResourceId = true },
            snackbarHost = { SnackbarHost(snackbar) },
            contentWindowInsets = WindowInsets.safeDrawing,
            bottomBar = {
                if (!useNavigationRail && rootNavigationVisible) {
                    TroOiBottomNavigation(
                        currentPage = ledgerRootTab(state.page),
                        onNavigate = { destination ->
                            when (destination) {
                                AppPage.Discovery -> viewModel.openDiscovery()
                                AppPage.CoreWorkspace -> viewModel.openCoreWorkspace()
                                AppPage.Messages -> viewModel.openMessages()
                                AppPage.Account -> viewModel.openAccount()
                                else -> Unit
                            }
                        },
                    )
                }
            },
        ) { insets ->
            Row(Modifier.fillMaxSize().padding(insets).consumeWindowInsets(insets)) {
                if (useNavigationRail && rootNavigationVisible) {
                    V1AdaptiveNavigationRail(state, viewModel)
                }
                Box(Modifier.weight(1f).fillMaxHeight().imePadding()) {
                if (!state.splashCompleted) {
                    TroOiFirstEntryScreen(
                        onSignInWithGoogle = if (demoBackend) null else { { viewModel.onGoogleLoginTapped(context) } },
                        onLoginClick = viewModel::openLogin,
                        onSignUpClick = viewModel::openSignUp,
                        authInProgress = state.authInProgress,
                        googleBacked = RuntimeDataSource.isBackendBacked() && !demoBackend,
                        sessionRestoring = state.sessionRestoring,
                        isAuthenticated = state.isAuthenticated,
                        onCompleteTransition = viewModel::completeSplash,
                    )
                } else if (state.sessionRestoring) {
                    TroOiStateMessage(TroOiStateKind.LOADING, "Đang xác minh tài khoản với Backend.", title = "Đang khôi phục phiên")
                } else if (state.restoreFailed) {
                    TroOiStateMessage(TroOiStateKind.ERROR, "Phiên trước không thể được xác minh lại.", title = "Không khôi phục được phiên",
                        actionText = "Thử lại", onAction = { viewModel.retryRestore(context) })
                } else if (!state.isAuthenticated && state.page !in setOf(AppPage.AuthLogin, AppPage.AuthSignUp, AppPage.AuthForgotPassword)) {
                    AuthWelcomeScreen(
                        onLogin = viewModel::openLogin,
                        onSignUp = viewModel::openSignUp,
                        onSignInWithGoogle = if (demoBackend) null else { { viewModel.onGoogleLoginTapped(context) } },
                        googleBacked = RuntimeDataSource.isBackendBacked() && !demoBackend,
                        authInProgress = state.authInProgress,
                    )
                } else if (state.sourceUnavailable) {
                    TroOiStateMessage(TroOiStateKind.UNAVAILABLE, "Bản ghi nguồn đã bị xóa hoặc bạn không còn quyền truy cập.", title = "Nguồn không khả dụng",
                        actionText = "Quay lại", onAction = viewModel::goBack)
                } else when (val page = state.page) {
                    AppPage.AuthWelcome -> AuthWelcomeScreen(
                        onLogin = viewModel::openLogin,
                        onSignUp = viewModel::openSignUp,
                        onSignInWithGoogle = if (demoBackend) null else { { viewModel.onGoogleLoginTapped(context) } },
                        googleBacked = RuntimeDataSource.isBackendBacked() && !demoBackend,
                        authInProgress = state.authInProgress,
                    )
                    AppPage.AuthLogin -> LoginScreen(
                        onBack = viewModel::goBack,
                        onSignUp = viewModel::openSignUp,
                        onForgotPassword = viewModel::openForgotPassword,
                        onLogin = viewModel::login,
                        onSignInWithGoogle = if (demoBackend) null
                            else { { viewModel.onGoogleLoginTapped(context) } },
                        authInProgress = state.authInProgress,
                        initialIdentifier = debugTestCommand?.takeIf { it.route == "login" }?.identifier.orEmpty(),
                        initialPassword = debugTestCommand?.takeIf { it.route == "login" }?.password.orEmpty(),
                        prefillKey = debugTestCommand?.id ?: 0L,
                        demoBackend = demoBackend,
                        backendOnly = RuntimeDataSource.isBackendBacked(),
                    )
                    AppPage.AuthSignUp -> SignUpScreen(
                        onBack = viewModel::goBack,
                        onLogin = viewModel::openLogin,
                        onSignUp = viewModel::signUp,
                        onGoogleRegister = { viewModel.registerWithGoogle(context) },
                        googleBacked = RuntimeDataSource.isBackendBacked() && !demoBackend,
                        authInProgress = state.authInProgress,
                        initialFullName = debugTestCommand?.takeIf { it.route == "signup" }?.fullName.orEmpty(),
                        initialPhone = debugTestCommand?.takeIf { it.route == "signup" }?.phone.orEmpty(),
                        initialEmail = debugTestCommand?.takeIf { it.route == "signup" }?.email.orEmpty(),
                        initialPassword = debugTestCommand?.takeIf { it.route == "signup" }?.password.orEmpty(),
                        prefillKey = debugTestCommand?.id ?: 0L,
                    )
                    AppPage.AuthForgotPassword -> ForgotPasswordScreen(
                        onBack = viewModel::goBack,
                        onSubmit = viewModel::requestPasswordReset,
                        initialIdentifier = debugTestCommand?.takeIf { it.route == "forgot" }?.identifier.orEmpty(),
                        prefillKey = debugTestCommand?.id ?: 0L,
                    )
                    AppPage.ContextSwitcher -> V1ContextSwitcherScreen(
                        state = state,
                        onSelect = viewModel::selectContext,
                        onBack = viewModel::goBack,
                    )
                    AppPage.Discovery -> discoveryStates.SaveableStateProvider("discovery-main") {
                        DiscoveryExperience(
                            state = state,
                            onOpenListing = viewModel::openListing,
                            onLoadPublicPhoto = viewModel::loadPublicListingCover,
                            onOpenMap = viewModel::openGuestMap,
                            onSearch = if (RuntimeDataSource.isBackendBacked()) viewModel::searchPublicListings else null,
                            onResetSearch = if (RuntimeDataSource.isBackendBacked()) viewModel::reloadPublicListings else null,
                            onRetrySearch = if (RuntimeDataSource.isBackendBacked()) viewModel::retryPublicDiscovery else null,
                            allowDemoFallback = !RuntimeDataSource.isBackendBacked(),
                        )
                    }
                    AppPage.Favorites -> FavoritesPlaceholderScreen(
                        onExplore = viewModel::openDiscovery,
                    )
                    AppPage.CoreWorkspace, AppPage.OwnerDashboard -> LedgerScreen(
                        state = state,
                        onExplore = viewModel::openDiscovery,
                        onFinance = { tenancyId ->
                            viewModel.selectContext(SelectedContext.Tenant(tenancyId))
                            viewModel.openTenantFinance()
                        },
                        onOperations = viewModel::openOwnerProperties,
                        onOwnerFinance = viewModel::openOwnerFinance,
                        onSaveAsset = viewModel::saveLocalAsset,
                        onPurchaseCapacity = viewModel::purchaseLocalCapacity,
                        onArchiveAsset = viewModel::archiveLocalAsset,
                        onMessageContext = viewModel::openMessageContext,
                        onRetryRead = viewModel::retryAuthorizedRead,
                        onTenantIncidents = viewModel::openTenantIncidents,
                        onOwnerIncidents = viewModel::openOwnerIncidents,
                        onNotifications = viewModel::openNotifications,
                    )
                    AppPage.Messages -> com.trooi.app.features.messages.MessagesScreen(state,
                        viewModel::openDiscovery, viewModel::openMessages, viewModel::saveLocalMessage,
                        onDetailVisibilityChanged = { messageDetailVisible = it },
                        onOpenContext = viewModel::openMessageContext, onContextSelected = viewModel::consumeMessageContext,
                        onRead = viewModel::readMessageConversation,
                        onLoadOlderMessages = viewModel::loadOlderMessagePage,
                        onAttachment = viewModel::loadMessageAttachment)
                    AppPage.GuestMap -> V1GuestMapScreen(
                        state = state,
                        onOpenListing = viewModel::openListing,
                        onSearch = if (RuntimeDataSource.isBackendBacked()) viewModel::searchPublicListings else null,
                    )

                    is AppPage.ListingDetail -> {
                        val publicListing = state.read.publicListings.firstOrNull { it.listingId == page.listingId }
                        val presentation = publicListing?.let { com.trooi.app.features.discovery.publicRentalDetail(it) }
                            ?: com.trooi.app.features.discovery.ListingFixtures.resolve(page.listingId)
                                .takeIf { state.demoPreview }
                        ListingDetailScreen(
                            listingId = page.listingId,
                            onBack = viewModel::goBack,
                            presentation = presentation,
                            state = state,
                            onOpenLogin = viewModel::openLogin,
                            onSubmitInquiry = viewModel::submitInquiry,
                            onOpenReport = viewModel::openTrustReport,
                        )
                    }
                    is AppPage.TrustReport -> TrustReportScreen(
                        state = state,
                        listingId = page.listingId,
                        onBack = viewModel::goBack,
                        onSubmit = viewModel::submitListingReport,
                    )
                    AppPage.TenantHome -> V1TenantHomeScreen(
                        state = state,
                        onRental = viewModel::openTenantRental,
                        onFinance = viewModel::openTenantFinance,
                        onIncidents = viewModel::openTenantIncidents,
                        onContextSwitcher = viewModel::openContextSwitcher,
                        onOpenSource = viewModel::openSource,
                        onRetryRead = viewModel::retryAuthorizedRead,
                    )
                    AppPage.TenantRental -> if (RuntimeDataSource.isBackendBacked()) {
                        val tenancyId = (state.selectedContext as? SelectedContext.Tenant)?.tenancyId
                        if (tenancyId != null) {
                            val authorized = state.authorizedSource
                            V1RentalWorkspace(
                                roomId = "",
                                linkedTenancyId = tenancyId,
                                entry = authorized?.let(::rentalEntry),
                                focusId = authorized?.target?.id?.takeIf { it.isNotBlank() },
                                onExit = viewModel::goBack,
                                onUnauthorized = viewModel::logout,
                                onMessageContext = viewModel::openMessageContext,
                            )
                        } else V1TenantFlow(state, viewModel::openDiscovery, viewModel::logout, viewModel::openMessageContext)
                    } else V1TenantPortalScreen(state, viewModel::openDiscovery)
                    AppPage.TenantFinance -> if (state.demoPreview) com.trooi.app.features.tenancy.RentPaymentScreen(
                        state, viewModel::openCoreWorkspace, viewModel::finishDemoPayment, viewModel::retryAuthorizedRead, viewModel::rememberedDemoPayment,
                        viewModel::createDemoPayment, viewModel::refreshDemoPayment,
                    ) else V1TenantFinanceScreen(state, viewModel::openTenantRental, viewModel::openSource)
                    AppPage.TenantIncidents -> V1TenantIncidentsScreen(state, viewModel::openTenantRental, viewModel::openSource)
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
                        googleOnly = RuntimeDataSource.isBackendBacked(),
                        onLogin = viewModel::openLogin,
                        onSignUp = viewModel::openSignUp,
                        onDiscovery = viewModel::openDiscovery,
                        onContextSwitcher = viewModel::openContextSwitcher,
                        onNotifications = viewModel::openNotifications,
                        onSettings = viewModel::openSettings,
                        onHelp = viewModel::openHelp,
                        onPrivacy = viewModel::openPrivacy,
                        onLogout = viewModel::logout,
                        onSaveDisplayName = viewModel::updateDisplayName,
                        onUploadAvatar = if (RuntimeDataSource.isBackendBacked()) viewModel::uploadProfileAvatar else null,
                        onCompleteLandlord = viewModel::completeLocalLandlordOnboarding,
                        onOpenWorkspace = viewModel::openOperatorWorkspaceFromAccount,
                    )
                    AppPage.Settings -> accountDrafts.SaveableStateProvider(accountDraftKey) {
                        SettingsScreen(state = state, onBack = viewModel::goBack,
                            onSaveDisplayName = viewModel::updateDisplayName,
                            onOpenWorkspace = viewModel::openOperatorWorkspaceFromAccount,
                            onCompleteLandlord = viewModel::completeLocalLandlordOnboarding)
                    }
                    AppPage.Help -> HelpScreen(state = state, onBack = viewModel::goBack)
                    AppPage.OwnerProperties -> if (RuntimeDataSource.isBackendBacked()) {
                        val organizationId = (state.selectedContext as? SelectedContext.Operations)?.organizationId.orEmpty()
                        V1OperatorWorkspace(
                            state.access,
                            organizationId,
                            entry = state.authorizedSource?.let(::operatorEntry)
                                ?: organizationId.takeIf { it.isNotBlank() }?.let { orgId ->
                                    val properties = accessibleProperties(state.read, state.access)
                                        .filter { it.organizationId == orgId }
                                    if (properties.size == 1) {
                                        OperatorRoute.Rooms(properties.single().propertyId, orgId)
                                    } else {
                                        OperatorRoute.Properties(orgId)
                                    }
                                },
                            onUnauthorized = viewModel::logout,
                                onMessageContext = viewModel::openMessageContext,
                            onWorkspaceCreated = viewModel::refreshSessionContext,
                        )
                    } else V1OwnerPropertiesScreen(state)
                    AppPage.OwnerFinance -> V1OwnerFinanceScreen(state, viewModel::openSource)
                    AppPage.OwnerIncidents -> V1OwnerIncidentsScreen(state, viewModel::openSource)
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
        listOf(
            Triple(AppPage.Discovery, "Khám phá", Icons.Rounded.Search),
            Triple(AppPage.CoreWorkspace, "Sổ", CoreTabIdentity.icon),
            Triple(AppPage.Messages, "Tin nhắn", Icons.Rounded.ChatBubbleOutline),
            Triple(AppPage.Account, "Hồ sơ", Icons.Rounded.PersonOutline),
        ).forEach { (page, label, icon) ->
            NavigationRailItem(
                selected = if (page == AppPage.Account) accountTabSelected(state.page) else ledgerRootTab(state.page) == page,
                onClick = {
                    when (page) {
                        AppPage.Discovery -> viewModel.openDiscovery()
                        AppPage.CoreWorkspace -> viewModel.openCoreWorkspace()
                        AppPage.Messages -> viewModel.openMessages()
                        AppPage.Account -> viewModel.openAccount()
                        else -> Unit
                    }
                },
                icon = { Icon(icon, label) }, label = { Text(label) }, alwaysShowLabel = true,
            )
        }
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
            selected = accountTabSelected(state.page),
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
            TroOiPageHeader(
                "Mở lại không gian của bạn",
                "Đang xác minh Google credential và capability từ Backend.",
            )
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
            TroOiCard("Đang xác minh") {
                LedgerStateLabel("Google credential đã được chọn", LedgerTone.Success)
                LedgerStateLabel("Đang xác định không gian được truy cập", LedgerTone.Warning)
                TroOiFeedback(
                    "Token chỉ được giữ trong phiên chạy hiện tại; app chưa có persistent session restore qua process restart.",
                )
            }
        } else {
            TroOiPageHeader(
                "Mở không gian của bạn",
                "Đăng nhập để xem nơi đang thuê hoặc khu trọ được cấp quyền.",
            )
            TroOiCard("Đăng nhập với Google") {
                TroOiFeedback(
                    "Google ID Token được Backend xác minh; Tenant/Landlord là context từ relationship thật, không phải USER.role.",
                )
                TroOiButton(
                    "Tiếp tục với Google",
                    onClick = onSignIn,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

private fun rentalEntry(authorized: SourceResolution.Authorized): RentalRoute? {
    val target = authorized.target
    val tenancyId = target.tenancyId
    return when (authorized.surface) {
        LedgerSurface.TENANCY -> tenancyId?.let(RentalRoute::Tenancy)
        LedgerSurface.FINANCE -> tenancyId?.let { id ->
            when (target.type.uppercase()) {
                "PAYMENT" -> RentalRoute.Payment(id)
                "RECEIPT" -> RentalRoute.ReceiptDetail(id, target.id)
                "DEPOSIT" -> RentalRoute.Deposit(id)
                "BILLING_CYCLE" -> RentalRoute.BillingDetail(id, target.id)
                "CHARGE" -> RentalRoute.BillingDetail(id, "", target.id)
                else -> RentalRoute.Billing(id)
            }
        }
        LedgerSurface.INCIDENT -> {
            val roomId = target.roomId ?: return null
            if (target.type.equals("INCIDENT", true) && target.id.isNotBlank()) {
                RentalRoute.Incident(target.id, roomId)
            } else {
                RentalRoute.Incidents(roomId)
            }
        }
        LedgerSurface.HISTORY -> tenancyId?.let(RentalRoute::History)
        else -> tenancyId?.let(RentalRoute::Tenancy)
    }
}

private fun operatorEntry(authorized: SourceResolution.Authorized): OperatorRoute? {
    val target = authorized.target
    val org = target.organizationId ?: return null
    val roomId = target.roomId
    val propertyId = target.propertyId
    return when (authorized.surface) {
        LedgerSurface.LISTING -> if (roomId != null && propertyId != null && target.id.isNotBlank()) {
            OperatorRoute.Listing(target.id, roomId, propertyId, org)
        } else {
            null
        }
        LedgerSurface.HISTORY -> if (roomId != null && propertyId != null) {
            OperatorRoute.RoomHistory(roomId, propertyId, org)
        } else {
            null
        }
        LedgerSurface.OVERVIEW -> if (roomId != null && propertyId != null) {
            OperatorRoute.Room(roomId, propertyId, org)
        } else {
            null
        }
        LedgerSurface.TENANCY, LedgerSurface.FINANCE, LedgerSurface.INCIDENT -> roomId?.let {
            OperatorRoute.Rentals(it, org, authorized.surface, target.tenancyId, target.id, target.type)
        }
        else -> null
    }
}
