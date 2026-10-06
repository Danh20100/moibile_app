package com.trooi.app.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import com.trooi.app.BuildConfig
import com.trooi.app.core.auth.GoogleCredentialAuth
import com.trooi.app.core.auth.RestoreOutcome
import com.trooi.app.core.auth.SessionHints
import com.trooi.app.core.auth.SessionHintsStore
import com.trooi.app.core.auth.restoreVerifiedSession
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.TransportOutcome
import androidx.lifecycle.viewModelScope
import com.trooi.app.core.data.TroOiRepository
import com.trooi.app.core.data.UserSession
import com.trooi.app.core.model.*
import com.trooi.app.features.auth.isValidIdentifier
import com.trooi.app.features.discovery.MapSearchQuery
import com.trooi.app.features.auth.isValidPassword
import com.trooi.app.features.auth.isValidSignup
import com.trooi.app.features.shared.V1ContractGateway
import com.trooi.app.features.shared.V1PaymentGateway
import com.trooi.app.features.shared.V1RentalGateway
import com.trooi.app.features.shared.V1RequestException
import com.trooi.app.features.tenancy.PaymentReturnAction
import com.trooi.app.features.tenancy.PaymentReturnUri
import com.trooi.app.features.tenancy.interpretPaymentReturn
import com.trooi.app.features.tenancy.isConfirmedGatewayPayment
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job

@HiltViewModel
class TroOiViewModel @Inject constructor(
    private val repository: TroOiRepository,
    private val backendApi: BackendApi,
    private val googleCredentialAuth: GoogleCredentialAuth,
    private val hintsStore: SessionHintsStore,
    private val paymentGateway: V1PaymentGateway,
    private val rentalGateway: V1RentalGateway,
    private val contractGateway: V1ContractGateway,
    @param:ApplicationContext private val appContext: Context,
) : ViewModel() {
    private val snapshot = repository.initialSnapshot()
    private val _state = MutableStateFlow(
        TroOiUiState(
            read = snapshot.read,
            demoPreview = snapshot.demoPreview,
        ),
    )
    val state: StateFlow<TroOiUiState> = _state.asStateFlow()
    /** Invalidates late auth and authorized read callbacks on logout/account change. */
    private var sessionGeneration = 0
    private var authenticationJob: Job? = null
    private var restoreStarted = false
    private var expiredAuthRetried = false

    init {
        if (BuildConfig.BACKEND_BACKED) refreshPublicListings()
    }

    /** Raw transport probe only; never maps unverified OpenAPI into business state. */
    fun probePublicTransport() {
        if (!BuildConfig.DEBUG || !BuildConfig.BACKEND_BACKED) return
        viewModelScope.launch {
            val message = when (val outcome = backendApi.getPublicListingsRaw()) {
                is TransportOutcome.Success -> "GET /listings/public: HTTP ${outcome.status}. Contract runtime đã kết nối."
                is TransportOutcome.Failure -> "Không kết nối được Backend: ${outcome.kind}" +
                    (outcome.httpStatus?.let { " (HTTP $it)" } ?: "")
            }
            showMessage(message)
        }
    }

    fun openLogin() = open(AppPage.AuthLogin)
    fun openSignUp() = open(AppPage.AuthSignUp)
    fun openForgotPassword() = open(AppPage.AuthForgotPassword)
    fun openDiscovery() = openContext(AppContext.DISCOVERY, AppPage.Discovery)
    fun openGuestMap() = openContext(AppContext.DISCOVERY, AppPage.GuestMap)
    fun openGuestActivity() = openContext(AppContext.DISCOVERY, AppPage.GuestActivity)
    fun openAccount() = open(AppPage.Account)
    fun openContextSwitcher() = open(AppPage.ContextSwitcher)
    fun openTenantHome() = openContext(AppContext.TENANT, AppPage.TenantHome)
    fun openTenantRental() = openContext(AppContext.TENANT, AppPage.TenantRental)
    fun openTenantFinance() = openContext(AppContext.TENANT, AppPage.TenantFinance)
    fun openTenantIncidents() = openContext(AppContext.TENANT, AppPage.TenantIncidents)
    fun openNotifications() = open(AppPage.Notifications)
    fun openOperations() = openContext(AppContext.OPERATIONS, AppPage.OwnerDashboard)
    fun openOwnerProperties() = openContext(AppContext.OPERATIONS, AppPage.OwnerProperties)
    fun openOwnerFinance() = openContext(AppContext.OPERATIONS, AppPage.OwnerFinance)
    fun openOwnerIncidents() = openContext(AppContext.OPERATIONS, AppPage.OwnerIncidents)

    fun selectContext(context: SelectedContext) {
        sessionGeneration++
        _state.update { current ->
            val next = applySelection(current, context, keepPage = false)
            persistHints(next.backendUserId, next.selectedContext)
            next
        }
    }

    fun bootstrapRestore(context: Context) {
        if (!BuildConfig.BACKEND_BACKED || restoreStarted) return
        restoreStarted = true
        val startedAt = sessionGeneration
        _state.update { it.copy(sessionRestoring = true, restoreFailed = false) }
        viewModelScope.launch {
            var captured: UserSession? = null
            val outcome = restoreVerifiedSession(
                reacquire = { googleCredentialAuth.reacquireIdToken(context) },
                authenticateGoogle = { token ->
                    repository.authenticateWithGoogleIdToken(token).onSuccess { captured = it }.map { }
                },
                loadMe = { captured?.let { Result.success(it) } ?: repository.refreshSessionContext() },
                hintsFor = { userId -> hintsStore.read()?.takeIf { it.userId == userId } },
            )
            if (startedAt != sessionGeneration) return@launch
            when (outcome) {
                is RestoreOutcome.Restored -> {
                    sessionGeneration++
                    expiredAuthRetried = false
                    _state.update {
                        applyAuthenticatedSession(it, outcome.session, resetRead = false).copy(
                            selectedContext = outcome.resolution.selection,
                            activeContext = if (outcome.resolution.needsPicker) {
                                AppContext.DISCOVERY
                            } else {
                                appContextFor(outcome.resolution.selection)
                            },
                            page = destinationPage(outcome.resolution),
                            sessionRestoring = false,
                            restoreFailed = false,
                        )
                    }
                    persistHints(outcome.session.userId, outcome.resolution.selection)
                    refreshAuthorizedRead(outcome.session.access)
                    refreshRememberedCheckout()
                }
                RestoreOutcome.NeedsLogin ->
                    _state.update { it.copy(sessionRestoring = false, restoreFailed = false) }
                RestoreOutcome.FailedClosed -> {
                    repository.clearSession()
                    _state.update {
                        it.copy(sessionRestoring = false, restoreFailed = true, isAuthenticated = false)
                    }
                }
            }
        }
    }

    fun retryRestore(context: Context) {
        restoreStarted = false
        bootstrapRestore(context)
    }

    fun handlePaymentReturn(uri: PaymentReturnUri) {
        val userId = _state.value.backendUserId
        val local = hintsStore.read()
            ?.takeIf { it.userId == userId && userId.isNotBlank() && it.restoreEnabled }
            ?.pendingCheckouts
            ?.firstOrNull()
        when (val action = interpretPaymentReturn(uri, local)) {
            is PaymentReturnAction.RefreshCheckout -> refreshRememberedCheckout(action.checkoutId)
            is PaymentReturnAction.ReplayCreate ->
                showMessage("Checkout chưa có ID từ Backend. Mở Thanh toán để replay cùng Idempotency-Key.")
            PaymentReturnAction.SafeRecovery ->
                showMessage("Liên kết thanh toán không khớp phiên hiện tại. Không ghi nhận tiền từ URI.")
        }
    }

    fun openNotification(notificationId: String) {
        if (!_state.value.isAuthenticated) return
        open(AppPage.NotificationDetail(notificationId))
        val generation = sessionGeneration
        _state.update { it.copy(runtimeLoading = true) }
        viewModelScope.launch {
            repository.loadNotification(notificationId).fold(
                onSuccess = { card ->
                    if (generation == sessionGeneration) _state.update { current ->
                        val rows = current.read.notifications.filterNot { it.notificationId == card.notificationId } + card
                        current.copy(runtimeLoading = false, read = current.read.copy(notifications = rows))
                    }
                },
                onFailure = { error ->
                    if (generation == sessionGeneration) {
                        _state.update { it.copy(runtimeLoading = false) }
                        showMessage(error.message ?: "Không tải được Notification.")
                    }
                },
            )
        }
    }

    fun markNotificationRead(notificationId: String) {
        if (!_state.value.isAuthenticated) return
        val generation = sessionGeneration
        viewModelScope.launch {
            repository.markNotificationRead(notificationId).fold(
                onSuccess = {
                    if (generation == sessionGeneration) openNotification(notificationId)
                },
                onFailure = { error ->
                    if (generation == sessionGeneration) showMessage(error.message ?: "Không đánh dấu được Notification.")
                },
            )
        }
    }

    fun openNotificationSource(notificationId: String) {
        val current = _state.value
        val notification = current.read.notifications.firstOrNull { it.notificationId == notificationId }
            ?: return showMessage("Notification không còn khả dụng.")
        val sourceId = notification.sourceId?.takeIf { it.isNotBlank() }
            ?: return showUnavailable("Notification không có sourceId để điều hướng.")
        val type = notification.sourceType?.takeIf { it.isNotBlank() }
            ?: return showUnavailable("Notification không có sourceType để điều hướng.")
        openSource(
            SourceTarget(type, sourceId),
            SourceNavigation(current.page, current.selectedContext, SourceTarget(type, sourceId)),
        )
    }

    fun openSource(target: SourceTarget, origin: SourceNavigation? = null) {
        val current = _state.value
        val enriched = enrichKnownScope(target)
        val navigation = origin ?: SourceNavigation(current.page, current.selectedContext, enriched)
        val resolved = resolveSource(enriched, current.access)
        if (resolved is SourceResolution.Authorized) {
            applyAuthorizedSource(resolved, navigation)
            return
        }
        if (needsAncestry(enriched, current.access)) {
            resolveAncestry(enriched, navigation)
            return
        }
        showUnavailable(navigation = navigation)
    }

    fun openListing(listingId: String) {
        if (publicDiscoveryFeed(_state.value.read.publicListings).none { it.listingId == listingId }) {
            return showMessage("Tin đăng này không có trong danh sách công khai.")
        }
        _state.update { it.copy(inquiryCompletedListingId = null, inquiryError = null) }
        open(AppPage.ListingDetail(listingId))
    }

    fun signInWithGoogle(context: Context) {
        if (!BuildConfig.BACKEND_BACKED || _state.value.authInProgress) return
        val startedAt = sessionGeneration
        _state.update { it.copy(authInProgress = true) }
        authenticationJob = viewModelScope.launch {
            googleCredentialAuth.getIdToken(context).fold(
                onSuccess = { idToken ->
                    repository.authenticateWithGoogleIdToken(idToken).fold(
                        onSuccess = { session ->
                            if (startedAt != sessionGeneration) {
                                // A previous credential response must not resurrect a logged-out user.
                                if (!_state.value.isAuthenticated) repository.clearSession()
                            } else {
                                sessionGeneration++
                                _state.update {
                                    applyAuthenticatedSession(it, session, resetRead = false)
                                        .copy(authInProgress = false)
                                }
                                refreshAuthorizedRead(session.access)
                            }
                        },
                        onFailure = { error ->
                            if (startedAt == sessionGeneration) {
                                _state.update { it.copy(authInProgress = false) }
                                showMessage(error.message ?: "Google authentication thất bại.")
                            }
                        },
                    )
                },
                onFailure = { error ->
                    if (startedAt == sessionGeneration) {
                        _state.update { it.copy(authInProgress = false) }
                        showMessage(error.message ?: "Không lấy được Google credential.")
                    }
                },
            )
        }
    }

    private fun refreshPublicListings() {
        if (_state.value.runtimeLoading) return
        _state.update { it.copy(runtimeLoading = true) }
        viewModelScope.launch {
            repository.refreshPublicListings().fold(
                onSuccess = { listings ->
                    _state.update { current ->
                        current.copy(
                            runtimeLoading = false,
                            read = current.read.copy(publicListings = publicDiscoveryFeed(listings)),
                        )
                    }
                },
                onFailure = { error ->
                    _state.update { it.copy(runtimeLoading = false) }
                    showMessage(error.message ?: "Không tải được tin đăng công khai.")
                },
            )
        }
    }

    fun searchPublicListings(query: MapSearchQuery) =
        searchPublicListings(query.latitude, query.longitude, query.radiusMeters, query.minPrice, query.maxPrice)

    fun searchPublicListings(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        minPrice: String?,
        maxPrice: String?,
    ) {
        if (!BuildConfig.BACKEND_BACKED || _state.value.runtimeLoading) return
        _state.update { it.copy(runtimeLoading = true) }
        viewModelScope.launch {
            repository.searchPublicListings(latitude, longitude, radiusMeters, minPrice, maxPrice).fold(
                onSuccess = { listings ->
                    _state.update { current ->
                        current.copy(
                            runtimeLoading = false,
                            read = current.read.copy(publicListings = publicDiscoveryFeed(listings)),
                        )
                    }
                },
                onFailure = { error ->
                    _state.update { it.copy(runtimeLoading = false) }
                    showMessage(error.message ?: "Không tìm được tin đăng quanh vị trí công khai.")
                },
            )
        }
    }

    fun reloadPublicListings() = refreshPublicListings()

    private fun refreshAuthorizedRead(access: AccessCapabilities) {
        val generation = sessionGeneration
        _state.update { it.copy(runtimeLoading = true) }
        viewModelScope.launch {
            repository.refreshAuthorizedRead(access).fold(
                onSuccess = { read ->
                    if (generation == sessionGeneration) _state.update { current ->
                        if (current.isAuthenticated) current.copy(read = read, runtimeLoading = false) else current
                    }
                },
                onFailure = { error ->
                    if (generation == sessionGeneration) {
                        _state.update { it.copy(runtimeLoading = false) }
                        showMessage(error.message ?: "Không tải được dữ liệu theo quyền hiện tại.")
                    }
                },
            )
        }
    }

    fun login(identifier: String, password: String) {
        if (!isValidIdentifier(identifier) || !isValidPassword(password)) {
            return showMessage("Thông tin đăng nhập chưa hợp lệ.")
        }
        viewModelScope.launch {
            repository.login(identifier.trim(), password).fold(
                onSuccess = { session ->
                    sessionGeneration++
                    _state.update { applyAuthenticatedSession(it, session) }
                },
                onFailure = { showMessage(it.message ?: "Đăng nhập thất bại.") },
            )
        }
    }

    fun signUp(fullName: String, phone: String, email: String, password: String) {
        if (!isValidSignup(fullName, phone, email, password, password, acceptedTerms = true)) {
            return showMessage("Thông tin đăng ký chưa hợp lệ.")
        }
        viewModelScope.launch {
            repository.signUp(fullName.trim(), phone.trim(), email.trim(), password).fold(
                onSuccess = { session ->
                    sessionGeneration++
                    _state.update { applyAuthenticatedSession(it, session) }
                },
                onFailure = { showMessage(it.message ?: "Đăng ký thất bại.") },
            )
        }
    }

    fun requestPasswordReset(identifier: String) {
        if (identifier.isBlank()) return showMessage("Vui lòng nhập email hoặc số điện thoại.")
        viewModelScope.launch {
            repository.requestPasswordReset(identifier.trim()).fold(
                onSuccess = { _state.update { it.copy(page = AppPage.AuthLogin, snackbarMessage = "Yêu cầu khôi phục đã được tiếp nhận.") } },
                onFailure = { showMessage(it.message ?: "Không thể gửi yêu cầu.") },
            )
        }
    }

    /** Inquiry must only succeed after the repository receives a real Backend acknowledgement. */
    fun submitInquiry(listingId: String, message: String) {
        val clean = message.trim()
        if (clean.isBlank()) return showMessage("Nhập nội dung cần liên hệ.")
        if (_state.value.submittingInquiry) return
        if (publicDiscoveryFeed(_state.value.read.publicListings).none { it.listingId == listingId }) {
            return showMessage("Không thể liên hệ về tin đăng chưa công khai.")
        }
        val generation = sessionGeneration
        _state.update { it.copy(submittingInquiry = true, inquiryCompletedListingId = null, inquiryError = null) }
        viewModelScope.launch {
            repository.submitInquiry(listingId, clean).fold(
                onSuccess = {
                    if (generation == sessionGeneration) _state.update {
                        it.copy(submittingInquiry = false, inquiryCompletedListingId = listingId,
                            inquiryError = null, snackbarMessage = "Hệ thống đã ghi nhận yêu cầu liên hệ.")
                    }
                },
                onFailure = { cause ->
                    if (generation == sessionGeneration) _state.update {
                        it.copy(submittingInquiry = false, inquiryError = cause.message ?: "Không thể gửi yêu cầu liên hệ.")
                    }
                },
            )
        }
    }

    fun refreshSessionContext() {
        if (!BuildConfig.BACKEND_BACKED || !_state.value.isAuthenticated) return
        val generation = sessionGeneration
        viewModelScope.launch {
            repository.refreshSessionContext().fold(
                onSuccess = { session ->
                    if (generation == sessionGeneration) {
                        sessionGeneration++
                        _state.update { current ->
                            applyReconciledAccess(current, session.displayName, session.access)
                        }
                        refreshAuthorizedRead(session.access)
                    }
                },
                onFailure = { error ->
                    if (generation == sessionGeneration) showMessage(error.message ?: "Không thể làm mới quyền truy cập.")
                },
            )
        }
    }

    fun logout() {
        sessionGeneration++
        restoreStarted = false
        expiredAuthRetried = false
        authenticationJob?.cancel()
        authenticationJob = null
        hintsStore.clear()
        repository.clearSession()
        viewModelScope.launch { googleCredentialAuth.clearCredentialState(appContext) }
        _state.update { current ->
            current.copy(
                isAuthenticated = false,
                displayName = "",
                backendUserId = "",
                access = AccessCapabilities(),
                read = FrontendReadSnapshot(
                    publicListings = publicDiscoveryFeed(current.read.publicListings),
                ),
                page = AppPage.Discovery,
                activeContext = AppContext.DISCOVERY,
                selectedContext = SelectedContext.Discovery,
                authInProgress = false,
                runtimeLoading = false,
                submittingInquiry = false,
                inquiryCompletedListingId = null,
                inquiryError = null,
                snackbarMessage = null,
                sessionRestoring = false,
                restoreFailed = false,
                sourceReturn = null,
                authorizedSource = null,
                sourceUnavailable = false,
            )
        }
    }

    fun goBack() {
        val current = _state.value
        if (current.sourceUnavailable && current.sourceReturn == null) {
            _state.update { it.copy(sourceUnavailable = false, snackbarMessage = null) }
            return
        }
        val returning = current.sourceReturn
        if (returning != null) {
            val (page, context) = returnFromSource(returning)
            sessionGeneration++
            _state.update {
                applySelection(it, context, keepPage = true, page = page).copy(
                    sourceReturn = if (page is AppPage.NotificationDetail) {
                        SourceNavigation(AppPage.Notifications, context, returning.target)
                    } else {
                        null
                    },
                    authorizedSource = null,
                    sourceUnavailable = false,
                )
            }
            return
        }
        val destination = when (current.page) {
            AppPage.AuthForgotPassword -> AppPage.AuthLogin
            is AppPage.NotificationDetail -> AppPage.Notifications
            AppPage.Notifications, AppPage.ContextSwitcher -> AppPage.Account
            is AppPage.ListingDetail -> AppPage.Discovery
            else -> contextHomePage(current.activeContext, current.access)
        }
        open(destination)
    }

    fun clearSnackbar() = _state.update { it.copy(snackbarMessage = null) }

    private fun landingFor(access: AccessCapabilities, remembered: SelectedContext? = null): ContextResolution =
        reconcileContext(remembered, access)

    private fun applyAuthenticatedSession(
        current: TroOiUiState,
        session: UserSession,
        resetRead: Boolean = true,
    ): TroOiUiState {
        val remembered = hintsStore.read()
            ?.takeIf { it.userId == session.userId && it.restoreEnabled }
            ?.selectedContext
        val resolved = landingFor(session.access, remembered)
        persistHints(session.userId, resolved.selection)
        return current.copy(
            isAuthenticated = true,
            displayName = session.displayName,
            backendUserId = session.userId,
            access = session.access,
            read = if (resetRead) snapshot.read else current.read,
            selectedContext = resolved.selection,
            activeContext = appContextFor(resolved.selection),
            page = destinationPage(resolved),
            sessionRestoring = false,
            restoreFailed = false,
        )
    }

    private fun persistHints(userId: String, selected: SelectedContext) {
        if (userId.isBlank()) return
        val pending = hintsStore.read()?.takeIf { it.userId == userId }?.pendingCheckouts.orEmpty()
        hintsStore.write(SessionHints(userId, true, selected, pending))
    }

    private fun refreshRememberedCheckout(checkoutId: String? = null) {
        val userId = _state.value.backendUserId
        if (!_state.value.isAuthenticated || userId.isBlank()) return
        val hint = hintsStore.read()?.takeIf { it.userId == userId }?.pendingCheckouts?.firstOrNull()
        val id = checkoutId ?: hint?.checkoutId ?: return
        if (hint != null && hint.checkoutId != null && hint.checkoutId != id) {
            showMessage("Liên kết thanh toán không khớp checkout đã nhớ. Không ghi nhận tiền từ URI.")
            return
        }
        val generation = sessionGeneration
        viewModelScope.launch {
            runCatching { paymentGateway.get(id) }
                .onSuccess { checkout ->
                    if (generation != sessionGeneration) return@onSuccess
                    if (hint != null && hint.tenancyId == checkout.tenancyId) {
                        hintsStore.upsertPendingCheckout(hint.copy(checkoutId = checkout.id))
                    }
                    showMessage(
                        if (isConfirmedGatewayPayment(checkout)) {
                            "Checkout SUCCEEDED. Payment chỉ hiện sau khi Backend xác nhận trong danh sách."
                        } else {
                            "Checkout ${checkout.status}. URI không phải bằng chứng đã trả."
                        },
                    )
                }
                .onFailure { error ->
                    if (generation != sessionGeneration) return@onFailure
                    val kind = (error as? V1RequestException)?.kind?.name
                    if (kind == "AUTH_EXPIRED" || kind == "FORBIDDEN") {
                        showMessage("Không đọc được checkout với quyền hiện tại.")
                    } else {
                        showMessage("Không tải được checkout từ Backend.")
                    }
                }
        }
    }

    private fun applyReconciledAccess(
        current: TroOiUiState,
        displayName: String,
        access: AccessCapabilities,
    ): TroOiUiState {
        val resolved = landingFor(access, current.selectedContext)
        val keepPage = resolved.selection == current.selectedContext &&
            !resolved.needsPicker &&
            canOpenPage(current.page, true, access)
        return current.copy(
            displayName = displayName,
            access = access,
            selectedContext = resolved.selection,
            activeContext = if (resolved.needsPicker) AppContext.DISCOVERY else appContextFor(resolved.selection),
            page = if (keepPage) current.page else destinationPage(resolved),
        )
    }

    private fun applySelection(
        current: TroOiUiState,
        requested: SelectedContext,
        keepPage: Boolean,
        page: AppPage? = null,
    ): TroOiUiState {
        val resolved = reconcileContext(requested, current.access)
        val nextPage = when {
            resolved.needsPicker -> AppPage.ContextSwitcher
            keepPage && page != null && canOpenPage(page, current.isAuthenticated, current.access) -> page
            else -> destinationPage(resolved)
        }
        return current.copy(
            selectedContext = resolved.selection,
            activeContext = if (resolved.needsPicker) AppContext.DISCOVERY else appContextFor(resolved.selection),
            page = nextPage,
        )
    }

    private fun contextHomePage(context: AppContext, access: AccessCapabilities): AppPage = when (context) {
        AppContext.TENANT -> if (access.allows(ClientArea.TENANT_PORTAL)) AppPage.TenantHome else AppPage.Discovery
        AppContext.OPERATIONS -> if (access.allows(ClientArea.OPERATIONS)) AppPage.OwnerDashboard else AppPage.Discovery
        AppContext.DISCOVERY -> AppPage.Discovery
    }

    private fun openContext(context: AppContext, page: AppPage) {
        val current = _state.value
        if (!canOpenPage(page, current.isAuthenticated, current.access)) {
            _state.update { it.copy(snackbarMessage = "Bạn chưa được cấp quyền truy cập khu vực này.") }
            return
        }
        if (context == AppContext.DISCOVERY) {
            if (current.selectedContext != SelectedContext.Discovery) sessionGeneration++
            _state.update {
                it.copy(
                    selectedContext = SelectedContext.Discovery,
                    activeContext = AppContext.DISCOVERY,
                    page = page,
                )
            }
            return
        }
        if (appContextFor(current.selectedContext) == context) {
            _state.update { it.copy(activeContext = context, page = page) }
            return
        }
        _state.update {
            it.copy(page = AppPage.ContextSwitcher, snackbarMessage = "Chọn không gian cụ thể trước khi mở khu vực này.")
        }
    }

    private fun open(page: AppPage) = _state.update { current ->
        if (canOpenPage(page, current.isAuthenticated, current.access)) current.copy(page = page)
        else current.copy(snackbarMessage = "Bạn chưa được cấp quyền truy cập khu vực này.")
    }

    private fun enrichKnownScope(target: SourceTarget): SourceTarget {
        var next = target
        if (next.roomId.isNullOrBlank() && target.type.equals("ROOM", ignoreCase = true)) {
            next = next.copy(roomId = target.id)
        }
        if (next.tenancyId.isNullOrBlank() && target.type.equals("TENANCY", ignoreCase = true)) {
            next = next.copy(tenancyId = target.id)
        }
        if (next.organizationId.isNullOrBlank() && target.type.equals("ORGANIZATION", ignoreCase = true)) {
            next = next.copy(organizationId = target.id)
        }
        if (next.propertyId.isNullOrBlank() && target.type.equals("PROPERTY", ignoreCase = true)) {
            next = next.copy(propertyId = target.id)
        }
        return next
    }

    private fun applyAuthorizedSource(resolved: SourceResolution.Authorized, navigation: SourceNavigation) {
        if (resolved.page is AppPage.ListingDetail &&
            publicDiscoveryFeed(_state.value.read.publicListings).none { it.listingId == resolved.target.id }
        ) {
            showUnavailable("Tin đăng nguồn không còn công khai.", navigation)
            return
        }
        sessionGeneration++
        _state.update { current ->
            val next = applySelection(current, resolved.context, keepPage = true, page = resolved.page)
            persistHints(current.backendUserId, next.selectedContext)
            next.copy(
                authorizedSource = resolved,
                sourceReturn = navigation,
                sourceUnavailable = false,
            )
        }
    }

    private fun needsAncestry(target: SourceTarget, access: AccessCapabilities): Boolean {
        val type = target.type.uppercase()
        if (type !in setOf(
                "PAYMENT", "RECEIPT", "DEPOSIT", "BILLING_CYCLE", "CHARGE",
                "INCIDENT", "TENANCY", "ROOM", "PROPERTY",
            )
        ) {
            return false
        }
        val tenant = access.allows(ClientArea.TENANT_PORTAL)
        val ops = access.allows(ClientArea.OPERATIONS)
        if (!tenant && !ops) return false
        if (ops && (target.organizationId.isNullOrBlank() || target.roomId.isNullOrBlank())) return true
        return target.tenancyId.isNullOrBlank() && target.organizationId.isNullOrBlank()
    }

    private fun resolveAncestry(target: SourceTarget, navigation: SourceNavigation) {
        val generation = sessionGeneration
        viewModelScope.launch {
            val enriched = runCatching { enrichSource(target) }.getOrNull()
            if (generation != sessionGeneration) return@launch
            when (val resolved = enriched?.let { resolveSource(it, _state.value.access) }) {
                is SourceResolution.Authorized -> applyAuthorizedSource(resolved, navigation.copy(target = enriched))
                else -> showUnavailable(navigation = navigation)
            }
        }
    }

    private suspend fun enrichSource(target: SourceTarget): SourceTarget {
        var next = target
        when (target.type.uppercase()) {
            "PAYMENT" -> {
                val payment = rentalGateway.payment(target.id)
                val tenancy = rentalGateway.tenancy(payment.tenancyId)
                next = next.copy(tenancyId = payment.tenancyId, roomId = tenancy.roomId)
            }
            "RECEIPT" -> {
                val receipt = rentalGateway.receipt(target.id)
                val payment = rentalGateway.payment(receipt.paymentId)
                val tenancy = rentalGateway.tenancy(payment.tenancyId)
                next = next.copy(tenancyId = payment.tenancyId, roomId = tenancy.roomId)
            }
            "BILLING_CYCLE" -> {
                val cycle = rentalGateway.billingCycle(target.id)
                val tenancy = rentalGateway.tenancy(cycle.tenancyId)
                next = next.copy(tenancyId = cycle.tenancyId, roomId = tenancy.roomId)
            }
            "DEPOSIT" -> {
                val tenancyId = target.tenancyId ?: target.id
                val tenancy = rentalGateway.tenancy(tenancyId)
                next = next.copy(tenancyId = tenancy.id, roomId = tenancy.roomId)
            }
            "CHARGE" -> {
                val tenancyId = target.tenancyId ?: _state.value.read.tenantFinanceByTenancy.entries
                    .firstOrNull { it.value.charges.any { charge -> charge.chargeId == target.id } }?.key
                if (tenancyId != null) {
                    val tenancy = rentalGateway.tenancy(tenancyId)
                    next = next.copy(tenancyId = tenancyId, roomId = tenancy.roomId)
                }
            }
            "INCIDENT" -> {
                val incident = rentalGateway.incident(target.id)
                next = next.copy(roomId = incident.roomId)
            }
            "TENANCY" -> {
                val tenancy = rentalGateway.tenancy(target.id)
                next = next.copy(tenancyId = tenancy.id, roomId = tenancy.roomId)
            }
            "ROOM" -> next = next.copy(roomId = target.id)
            "PROPERTY" -> {
                val property = contractGateway.property(target.id)
                next = next.copy(organizationId = property.organizationId, propertyId = property.id)
            }
        }
        val roomId = next.roomId
        if (roomId != null && (next.organizationId.isNullOrBlank() || next.propertyId.isNullOrBlank()) &&
            _state.value.access.allows(ClientArea.OPERATIONS)
        ) {
            val (propertyId, organizationId) = contractGateway.roomScope(roomId)
            next = next.copy(propertyId = propertyId, organizationId = organizationId)
        }
        return next
    }

    private fun showUnavailable(
        message: String = "Bản ghi nguồn đã bị xóa hoặc bạn không còn quyền truy cập.",
        navigation: SourceNavigation? = null,
    ) {
        _state.update {
            it.copy(
                sourceUnavailable = true,
                authorizedSource = null,
                snackbarMessage = message,
                sourceReturn = navigation ?: it.sourceReturn,
            )
        }
    }

    private fun showMessage(text: String) = _state.update { it.copy(snackbarMessage = text) }
}
