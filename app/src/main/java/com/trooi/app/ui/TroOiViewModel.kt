package com.trooi.app.ui

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import com.trooi.app.BuildConfig
import com.trooi.app.core.data.RuntimeDataSource
import com.trooi.app.core.data.AppDataSource
import com.trooi.app.core.auth.GoogleCredentialAuth
import com.trooi.app.core.auth.RestoreOutcome
import com.trooi.app.core.auth.SessionHints
import com.trooi.app.core.auth.SessionHintsStore
import com.trooi.app.core.auth.restoreVerifiedSession
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.TransportOutcome
import androidx.lifecycle.viewModelScope
import com.trooi.app.core.data.SlotCheckoutPending
import com.trooi.app.core.data.TroOiRepository
import com.trooi.app.core.data.UserSession
import com.trooi.app.core.model.*
import com.trooi.app.features.auth.isValidIdentifier
import com.trooi.app.features.discovery.MapSearchQuery
import com.trooi.app.features.auth.isValidPassword
import com.trooi.app.features.auth.isValidSignup
import com.trooi.app.features.shared.TrustReportDestination
import com.trooi.app.features.shared.V1ContractGateway
import com.trooi.app.features.shared.V1PaymentGateway
import com.trooi.app.features.shared.V1RentalGateway
import com.trooi.app.features.shared.V1RequestException
import com.trooi.app.features.shared.V1TrustGateway
import com.trooi.app.features.shared.claimTrustSubmit
import com.trooi.app.features.shared.pageAfterTrustLogin
import com.trooi.app.features.shared.trustBackPage
import com.trooi.app.features.shared.trustReportDestination
import com.trooi.app.features.shared.trustTargetUnavailable
import com.trooi.app.features.tenancy.PaymentReturnAction
import com.trooi.app.features.tenancy.PaymentReturnUri
import com.trooi.app.features.tenancy.interpretPaymentReturn
import com.trooi.app.features.tenancy.isConfirmedGatewayPayment
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.atomic.AtomicBoolean
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
    private val trustGateway: V1TrustGateway,
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
    private var verifiedDemoCheckout: Pair<String, String>? = null
    private var authenticationJob: Job? = null
    private var restoreStarted = false
    private var expiredAuthRetried = false
    private var lastPublicSearch: MapSearchQuery? = null
    private var publicListingsRequestGeneration = 0L
    private val trustSubmitGate = AtomicBoolean(false)

    init {
        if (RuntimeDataSource.isBackendBacked()) refreshPublicListings()
    }

    /** Raw transport probe only; never maps unverified OpenAPI into business state. */
    fun probePublicTransport() {
        if (!BuildConfig.DEBUG || !RuntimeDataSource.isBackendBacked()) return
        viewModelScope.launch {
            val message = when (val outcome = backendApi.getPublicListingsRaw()) {
                is TransportOutcome.Success -> "GET /listings/public: HTTP ${outcome.status}. Contract runtime đã kết nối."
                is TransportOutcome.Failure -> "Không kết nối được Backend: ${outcome.kind}" +
                    (outcome.httpStatus?.let { " (HTTP $it)" } ?: "")
            }
            showMessage(message)
        }
    }

    fun completeSplash() = _state.update { it.copy(splashCompleted = true) }
    /** Switching sources is debug-only; active credentials, pending payment hints and UI state are discarded. */
    fun switchDebugDataSource(context: Context, next: AppDataSource): Boolean {
        if (!BuildConfig.DEBUG) return false
        if (next == RuntimeDataSource.currentMode()) return true

        // Do not erase recovery context for an unresolved real/simulated checkout.
        if (hintsStore.read()?.pendingCheckouts?.isNotEmpty() == true) {
            showMessage("Đang có thanh toán chờ đối chiếu. Hãy xử lý trước khi đổi nguồn dữ liệu.")
            return false
        }
        if (!RuntimeDataSource.chooseDebugSource(context, next)) {
            showMessage("Không lưu được chế độ DEV.")
            return false
        }

        sessionGeneration++
        authenticationJob?.cancel()
        authenticationJob = null
        hintsStore.clear()
        repository.clearSession()
        trustSubmitGate.set(false)
        verifiedDemoCheckout = null
        restoreStarted = true // explicitly stay logged out instead of silently restoring an old account
        expiredAuthRetried = false
        val fresh = repository.initialSnapshot()
        _state.value = TroOiUiState(
            read = fresh.read,
            demoPreview = fresh.demoPreview,
            splashCompleted = true,
            page = AppPage.AuthWelcome,
            snackbarMessage = if (next == AppDataSource.BACKEND)
                "Đã chuyển sang Backend. Hãy đăng nhập Google để tiếp tục."
            else "Đã chuyển sang Mock. Đăng nhập bằng tài khoản demo.",
        )
        if (RuntimeDataSource.isBackendBacked()) refreshPublicListings()
        return true
    }

    /** Debug harness opens real screens through ordinary access checks, never forges permissions. */
    fun openDebugTestScreen(route: String, listingId: String = "") {
        if (!BuildConfig.DEBUG) return
        when (route.lowercase()) {
            "welcome" -> _state.update { it.copy(page = AppPage.AuthWelcome, splashCompleted = true) }
            "login" -> openLogin()
            "signup" -> openSignUp()
            "forgot" -> openForgotPassword()
            "discovery" -> openDiscovery()
            "map" -> openGuestMap()
            "favorites" -> openFavorites()
            "messages" -> openMessages()
            "workspace" -> openCoreWorkspace()

            "account" -> openAccount()
            "settings" -> openSettings()
            "help" -> openHelp()
            "context" -> openContextSwitcher()
            "tenant-home" -> openTenantHome()
            "tenant-rental" -> openTenantRental()
            "tenant-finance" -> openTenantFinance()
            "tenant-incidents" -> openTenantIncidents()
            "owner-dashboard" -> openOperations()
            "owner-properties" -> openOwnerProperties()
            "owner-finance" -> openOwnerFinance()
            "owner-incidents" -> openOwnerIncidents()
            "notifications" -> openNotifications()
            "listing" -> {
                if (listingId.isNotBlank()) openListing(listingId)
                else showMessage("Nhập Listing ID trước khi mở chi tiết.")
            }
            else -> showMessage("Không tìm thấy flow test: $route")
        }
    }

    fun openLogin() = _state.update { it.copy(page = AppPage.AuthLogin, authReturnListingId = null, splashCompleted = true) }
    fun openSignUp() = _state.update { it.copy(page = AppPage.AuthSignUp, splashCompleted = true) }
    fun openForgotPassword() = open(AppPage.AuthForgotPassword)
    fun openDiscovery() = openContext(AppContext.DISCOVERY, AppPage.Discovery)
    fun openFavorites() = openContext(AppContext.DISCOVERY, AppPage.Favorites)
    fun openCoreWorkspace() = openContext(AppContext.DISCOVERY, AppPage.CoreWorkspace)
    fun openMessages() {
        openContext(AppContext.DISCOVERY, AppPage.Messages)
        if (!_state.value.isAuthenticated) return
        if (_state.value.messagesLoading) return
        val generation = sessionGeneration
        _state.update { it.copy(messagesLoading = true, messagesLoadFailed = false) }
        viewModelScope.launch {
            val result = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { repository.loadLocalConversations() }
            if (generation != sessionGeneration) return@launch
            result.fold(
                onSuccess = { conversations ->
                    _state.update { current -> current.copy(
                        messagesLoading = false,
                        read = current.read.copy(conversations = conversations.map { card ->
                            val previousMessages = current.read.conversations
                                .firstOrNull { old -> old.id == card.id }?.messages.orEmpty()
                            card.copy(messages = (card.messages + previousMessages)
                                .distinctBy { message -> message.id }
                                .sortedWith(compareBy<com.trooi.app.core.model.ConversationMessage> { it.createdAt }.thenBy { it.id }))
                        }),
                    ) }
                },
                onFailure = { _state.update { it.copy(messagesLoading = false, messagesLoadFailed = true) } },
            )
        }
    }
    fun loadOlderMessagePage(conversationId: String) {
        val existing = _state.value.read.conversations.firstOrNull { it.id == conversationId } ?: return
        if (existing.olderMessagesCursor == null || existing.loadingOlderMessages) return
        val generation = sessionGeneration
        _state.update { current -> current.copy(read = current.read.copy(conversations =
            current.read.conversations.map { card -> if (card.id == conversationId) card.copy(
                loadingOlderMessages = true, olderMessagesLoadFailed = false) else card })) }
        viewModelScope.launch {
            val result = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                repository.loadOlderMessages(conversationId)
            }
            if (generation != sessionGeneration) return@launch
            result.fold(
                onSuccess = { loaded -> _state.update { current -> current.copy(read = current.read.copy(
                    conversations = current.read.conversations.map { card -> if (card.id != conversationId) card else loaded.copy(
                        messages = (loaded.messages + card.messages).distinctBy { it.id }
                            .sortedWith(compareBy<com.trooi.app.core.model.ConversationMessage> { it.createdAt }.thenBy { it.id }),
                        loadingOlderMessages = false,
                        olderMessagesLoadFailed = false,
                    ) }
                )) } },
                onFailure = { _state.update { current -> current.copy(read = current.read.copy(
                    conversations = current.read.conversations.map { card -> if (card.id == conversationId) card.copy(
                        loadingOlderMessages = false, olderMessagesLoadFailed = true) else card }
                )) } },
            )
        }
    }
    fun openGuestMap() = openContext(AppContext.DISCOVERY, AppPage.GuestMap)

    fun openAccount() {
        open(AppPage.Account)
        refreshProfileAvatar()
    }
    fun openSettings() {
        _state.update { it.copy(settingsEntry = "settings") }
        openShared(AppPage.Settings)
    }
    fun openPrivacy() {
        _state.update { it.copy(settingsEntry = "privacy") }
        openShared(AppPage.Settings)
    }
    fun openHelp() = openShared(AppPage.Help)
    fun sessionRestoreEnabled(): Boolean {
        val hint = hintsStore.read() ?: return false
        return hint.restoreEnabled && hint.userId == _state.value.backendUserId && _state.value.backendUserId.isNotBlank()
    }
    fun openContextSwitcher() = open(AppPage.ContextSwitcher)
    fun openTenantHome() = openContext(AppContext.TENANT, AppPage.TenantHome)
    fun openTenantRental() = openContext(AppContext.TENANT, AppPage.TenantRental)
    fun openTenantFinance() = openContext(AppContext.TENANT, AppPage.TenantFinance)
    fun openTenantIncidents() = openContext(AppContext.TENANT, AppPage.TenantIncidents)
    fun openNotifications() = open(AppPage.Notifications)
    fun openOperations() = openContext(AppContext.OPERATIONS, AppPage.OwnerDashboard)
    fun openOwnerProperties() = openContext(AppContext.OPERATIONS, AppPage.OwnerProperties)
    /** Operator Workspace may create the first Organization; access is still enforced on Backend. */
    fun openOperatorWorkspaceFromAccount() {
        val current = _state.value
        val selected = (current.selectedContext as? SelectedContext.Operations)?.organizationId
            ?.takeIf { it in current.access.operatedOrganizationIds }
        val organizationId = selected ?: current.access.operatedOrganizationIds.firstOrNull()
        if (organizationId == null) {
            open(AppPage.OwnerProperties)
            return
        }
        _state.update { state ->
            val next = applySelection(state, SelectedContext.Operations(organizationId), keepPage = true, page = AppPage.OwnerProperties)
            persistHints(next.backendUserId, next.selectedContext)
            next
        }
    }
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
        if (restoreStarted) return
        if (!RuntimeDataSource.isBackendBacked()) {
            restoreStarted = true
            val generation = sessionGeneration
            _state.update { it.copy(sessionRestoring = true) }
            viewModelScope.launch {
                repository.refreshSessionContext().fold(
                    onSuccess = { session ->
                        if (generation != sessionGeneration) return@fold
                        sessionGeneration++
                        _state.update { applyAuthenticatedSession(it, session).copy(sessionRestoring = false) }
                        refreshAuthorizedRead(session.access)
                    },
                    onFailure = { if (generation == sessionGeneration) _state.update { it.copy(sessionRestoring = false) } },
                )
            }
            return
        }
        restoreStarted = true
        val startedAt = sessionGeneration
        _state.update { it.copy(sessionRestoring = true, restoreFailed = false) }
        viewModelScope.launch {
            val outcome = restoreVerifiedSession(
                restore = { repository.refreshSessionContext() },
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
                    _state.update { it.copy(sessionRestoring = false, restoreFailed = false, page = AppPage.AuthWelcome) }
                RestoreOutcome.FailedClosed -> {
                    repository.clearSession()
                    _state.update {
                        it.copy(sessionRestoring = false, restoreFailed = true, isAuthenticated = false, page = AppPage.AuthWelcome)
                    }
                }
            }
        }
    }

    fun retryRestore(context: Context) {
        restoreStarted = false
        bootstrapRestore(context)
    }

    fun onAppResume() {
        if (!_state.value.isAuthenticated || _state.value.sessionRestoring) return
        refreshRememberedCheckout()
    }

    fun handlePaymentReturn(uri: PaymentReturnUri) {
        val userId = _state.value.backendUserId
        val local = hintsStore.read()
            ?.takeIf { it.userId == userId && userId.isNotBlank() && it.restoreEnabled }
            ?.pendingCheckouts
            ?.firstOrNull()
        if (_state.value.demoPreview) {
            if (interpretPaymentReturn(uri, local, allowDemo = true) != PaymentReturnAction.SafeRecovery &&
                local?.tenancyId in _state.value.access.linkedTenancyIds) {
                selectContext(SelectedContext.Tenant(local!!.tenancyId))
                openTenantFinance()
            } else showMessage("Chưa tìm thấy thanh toán trong phiên hiện tại. Mở Sổ để kiểm tra.")
            return
        }
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
        val listing = publicDiscoveryFeed(_state.value.read.publicListings).firstOrNull { it.listingId == listingId }
        if (listing == null) {
            return showMessage("Tin đăng này không có trong danh sách công khai.")
        }
        _state.update { it.copy(inquiryCompletedListingId = null, inquiryCompletedId = null, inquiryError = null) }
        open(AppPage.ListingDetail(listingId))
        // Discovery eagerly caches only the cover. The detail gallery must fetch every
        // approved public image even when the cover is already available.
        if (listing.publicPhotoIds.isNotEmpty() && listing.photoUris.size < listing.publicPhotoIds.size) {
            val generation = sessionGeneration
            viewModelScope.launch {
                repository.loadPublicListingPhotos(listingId, listing.publicPhotoIds).fold(
                    onSuccess = { uris ->
                        if (generation == sessionGeneration && _state.value.page == AppPage.ListingDetail(listingId)) {
                            _state.update { current -> current.copy(read = current.read.copy(publicListings = current.read.publicListings.map {
                                if (it.listingId == listingId) it.copy(photoUris = uris) else it
                            })) }
                        }
                    },
                    onFailure = { showMessage("Chưa tải được ảnh công khai. Kiểm tra kết nối rồi mở lại tin đăng.") },
                )
            }
        }
    }

    fun loadPublicListingCover(listingId: String, mediaId: String) {
        val listing = _state.value.read.publicListings.firstOrNull { it.listingId == listingId } ?: return
        if (listing.photoUris.isNotEmpty() || mediaId !in listing.publicPhotoIds) return
        val generation = sessionGeneration
        viewModelScope.launch {
            repository.loadPublicListingPhotos(listingId, listOf(mediaId)).onSuccess { uris ->
                if (generation == sessionGeneration) _state.update { current ->
                    current.copy(read = current.read.copy(publicListings = current.read.publicListings.map {
                        if (it.listingId == listingId && mediaId in it.publicPhotoIds && it.photoUris.isEmpty()) it.copy(photoUris = uris) else it
                    }))
                }
            }
        }
    }

    fun openTrustReport(listingId: String) {
        val public = publicDiscoveryFeed(_state.value.read.publicListings).any { it.listingId == listingId }
        when (val dest = trustReportDestination(_state.value.isAuthenticated, public, listingId)) {
            TrustReportDestination.Unavailable -> showMessage("Tin đăng không còn công khai để báo cáo.")
            is TrustReportDestination.Login -> _state.update {
                it.copy(page = AppPage.AuthLogin, authReturnListingId = dest.listingId)
            }
            is TrustReportDestination.Form -> _state.update {
                it.copy(
                    page = AppPage.TrustReport(dest.listingId),
                    authReturnListingId = null,
                    submittingTrustReport = false,
                    trustReceipt = null,
                    trustReportError = null,
                    trustReportUnavailable = false,
                )
            }
        }
    }

    fun submitListingReport(listingId: String, reason: String, note: String) {
        if (!claimTrustSubmit(trustSubmitGate)) return
        val current = _state.value
        val onForm = current.page is AppPage.TrustReport && current.page.listingId == listingId
        val public = publicDiscoveryFeed(current.read.publicListings).any { it.listingId == listingId }
        if (!current.isAuthenticated || !onForm || !public) {
            trustSubmitGate.set(false)
            if (onForm && !public) _state.update { it.copy(trustReportUnavailable = true, trustReceipt = null) }
            return
        }
        val generation = sessionGeneration
        _state.update {
            it.copy(
                submittingTrustReport = true,
                trustReportError = null,
                trustReceipt = null,
                trustReportUnavailable = false,
            )
        }
        viewModelScope.launch {
            try {
                val receipt = trustGateway.submitListingReport(listingId, reason, note)
                if (generation == sessionGeneration) _state.update {
                    it.copy(
                        submittingTrustReport = false,
                        trustReceipt = receipt,
                        trustReportError = null,
                        snackbarMessage = "Đã ghi nhận báo cáo.",
                    )
                }
            } catch (error: RuntimeException) {
                if (generation == sessionGeneration) {
                    val unavailable = trustTargetUnavailable((error as? V1RequestException)?.status)
                    _state.update {
                        it.copy(
                            submittingTrustReport = false,
                            trustReportUnavailable = unavailable,
                            trustReportError = if (unavailable) null else error.message ?: "Không gửi được báo cáo.",
                        )
                    }
                }
            } finally {
                trustSubmitGate.set(false)
            }
        }
    }

    /** Keep the Google action visible in mock UI without pretending to authenticate. */
    fun onGoogleLoginTapped(context: Context) {
        if (!RuntimeDataSource.isBackendBacked()) {
            showMessage("Hiện chưa thể đăng nhập bằng Google. Vui lòng thử lại sau.")
            return
        }
        signInWithGoogle(context)
    }

    fun signInWithGoogle(context: Context) {
        completeGoogleAuthentication(context, register = false)
    }

    fun registerWithGoogle(context: Context) {
        if (!RuntimeDataSource.isBackendBacked()) {
            showMessage("Đăng ký Google chỉ khả dụng khi kết nối Backend.")
            return
        }
        completeGoogleAuthentication(context, register = true)
    }

    private fun completeGoogleAuthentication(context: Context, register: Boolean) {
        if (!RuntimeDataSource.isBackendBacked() || _state.value.authInProgress) return
        val startedAt = sessionGeneration
        _state.update { it.copy(authInProgress = true) }
        authenticationJob = viewModelScope.launch {
            (if (register) googleCredentialAuth.getRegistrationIdToken(context) else googleCredentialAuth.getIdToken(context)).fold(
                onSuccess = { proof ->
                    (if (register) repository.registerWithGoogleIdToken(proof.idToken, proof.nonce)
                    else repository.authenticateWithGoogleIdToken(proof.idToken, proof.nonce)).fold(
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
        val generation = sessionGeneration
        val requestGeneration = ++publicListingsRequestGeneration
        _state.update { it.copy(publicDiscoveryLoading = true, publicDiscoveryError = null) }
        viewModelScope.launch {
            repository.refreshPublicListings().fold(
                onSuccess = { listings ->
                    if (generation == sessionGeneration && requestGeneration == publicListingsRequestGeneration) _state.update { current ->
                        current.copy(
                            publicDiscoveryLoading = false,
                            read = current.read.copy(publicListings = publicDiscoveryFeed(listings)),
                        )
                    }
                },
                onFailure = { error ->
                    if (generation == sessionGeneration && requestGeneration == publicListingsRequestGeneration) {
                        _state.update { it.copy(
                            publicDiscoveryLoading = false,
                            publicDiscoveryError = error.message ?: "Không tải được tin đăng công khai.",
                        ) }
                    }
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
        if (!RuntimeDataSource.isBackendBacked()) return
        val query = MapSearchQuery(latitude, longitude, radiusMeters, minPrice, maxPrice)
        lastPublicSearch = query
        val requestGeneration = ++publicListingsRequestGeneration
        _state.update { it.copy(publicDiscoveryLoading = true, publicDiscoveryError = null) }
        viewModelScope.launch {
            repository.searchPublicListings(query.latitude, query.longitude, query.radiusMeters, query.minPrice, query.maxPrice).fold(
                onSuccess = { listings ->
                    if (requestGeneration == publicListingsRequestGeneration) _state.update { current ->
                        current.copy(
                            publicDiscoveryLoading = false,
                            read = current.read.copy(publicListings = publicDiscoveryFeed(listings)),
                        )
                    }
                },
                onFailure = { error ->
                    if (requestGeneration == publicListingsRequestGeneration) _state.update { it.copy(
                        publicDiscoveryLoading = false,
                        publicDiscoveryError = error.message ?: "Không tìm được tin đăng quanh vị trí công khai.",
                    ) }
                },
            )
        }
    }

    fun retryPublicDiscovery() {
        val query = lastPublicSearch
        if (query == null) refreshPublicListings()
        else searchPublicListings(query)
    }

    fun reloadPublicListings() {
        lastPublicSearch = null
        refreshPublicListings()
    }
    fun retryAuthorizedRead() {
        if (_state.value.isAuthenticated) refreshAuthorizedRead(_state.value.access)
    }

    private fun refreshAuthorizedRead(access: AccessCapabilities) {
        val generation = sessionGeneration
        _state.update { it.copy(runtimeLoading = true) }
        viewModelScope.launch {
            repository.refreshAuthorizedRead(access).fold(
                onSuccess = { read ->
                    if (generation == sessionGeneration) _state.update { current ->
                        if (current.isAuthenticated) current.copy(read = read, runtimeLoading = false, authorizedReadFailed = false) else current
                    }
                },
                onFailure = { error ->
                    if (generation == sessionGeneration) {
                        Log.w("TroOiAuthorizedRead", "refreshAuthorizedRead failed: ${error.message}", error)
                        _state.update { it.copy(runtimeLoading = false, authorizedReadFailed = true) }
                        showMessage("Chưa tải được Sổ. Kiểm tra kết nối rồi thử lại.")
                    }
                },
            )
        }
    }

    fun rememberedDemoPayment(): com.trooi.app.core.auth.PendingCheckoutHint? = hintsStore.read()
        ?.takeIf { _state.value.isAuthenticated && it.userId == _state.value.backendUserId }
        ?.pendingCheckouts?.firstOrNull()?.takeIf { it.tenancyId in _state.value.access.linkedTenancyIds }

    suspend fun createDemoPayment(tenancyId: String, amount: String): Result<com.trooi.app.features.shared.GatewayCheckout> = runCatching {
        val current = _state.value
        val generation = sessionGeneration
        check(_state.value.demoPreview && current.isAuthenticated && tenancyId in current.access.linkedTenancyIds)
        check(current.read.tenancies.any { it.tenancyId == tenancyId && it.lifecycle in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING) })
        require(com.trooi.app.features.tenancy.validGatewayAmount(amount))
        val previous = rememberedDemoPayment()
        check(previous == null || (previous.tenancyId == tenancyId && previous.amount == amount))
        val hint = previous ?: com.trooi.app.core.auth.PendingCheckoutHint(tenancyId, amount, java.util.UUID.randomUUID().toString(), null)
        check(hintsStore.upsertPendingCheckout(hint))
        val checkout = repository.createDemoCheckout(tenancyId, amount, hint.idempotencyKey).getOrThrow()
        check(generation == sessionGeneration)
        check(com.trooi.app.features.tenancy.checkoutMatchesIntent(checkout, hint, "DEMO"))
        check(hintsStore.upsertPendingCheckout(hint.copy(checkoutId = checkout.id)))
        checkout
    }

    suspend fun refreshDemoPayment(): Result<com.trooi.app.features.shared.GatewayCheckout> = runCatching {
        val generation = sessionGeneration
        val current = _state.value
        check(_state.value.demoPreview && current.isAuthenticated)
        val hint = rememberedDemoPayment() ?: error("Chưa có thanh toán để kiểm tra.")
        val checkout = repository.getDemoCheckout(requireNotNull(hint.checkoutId)).getOrThrow()
        check(generation == sessionGeneration)
        check(com.trooi.app.features.tenancy.checkoutMatchesIntent(checkout, hint, "DEMO"))
        if (isConfirmedGatewayPayment(checkout)) {
            val read = repository.readConfirmedDemoPayment(current.access, requireNotNull(checkout.resultingPaymentId)).getOrThrow()
            check(generation == sessionGeneration)
            check(read.tenantFinanceByTenancy[hint.tenancyId]?.payments?.any { it.paymentId == checkout.resultingPaymentId } == true)
            _state.update { it.copy(read = read) }
            verifiedDemoCheckout = current.backendUserId to checkout.id
        }
        checkout
    }

    fun finishDemoPayment() {
        val hints = hintsStore.read()
        val verified = verifiedDemoCheckout
        val userId = _state.value.backendUserId
        if (hints != null && verified != null && verified.first == userId) {
            hintsStore.write(hints.copy(pendingCheckouts = hints.pendingCheckouts.filterNot { it.checkoutId == verified.second }))
            verifiedDemoCheckout = null
        }
        openCoreWorkspace()
    }

    private suspend fun localManagementCommand(command: suspend () -> Result<FrontendReadSnapshot>): Result<Unit> {
        val generation = sessionGeneration
        if (!_state.value.isAuthenticated) return Result.failure(IllegalStateException("Vui lòng đăng nhập lại."))
        val result = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { command() }
        if (generation != sessionGeneration) return Result.failure(IllegalStateException("Phiên đăng nhập đã thay đổi."))
        return result.map { read -> _state.update { it.copy(read = read) }; Unit }
    }

    suspend fun saveLocalAsset(asset: LocalRentalAsset, activate: Boolean, publish: Boolean): Result<Unit> =
        localManagementCommand { repository.saveLocalAsset(asset, activate, publish) }
    suspend fun saveLocalMessage(conversationId: String, text: String, images: List<LocalMessageImage> = emptyList()): Result<Unit> {
        val userId = _state.value.backendUserId
        val generation = sessionGeneration
        if (!_state.value.isAuthenticated) return Result.failure(IllegalStateException("Vui lòng đăng nhập."))
        val result = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { repository.sendMessage(userId, conversationId, text, images) }
        if (generation != sessionGeneration) return Result.failure(IllegalStateException("Phiên đã thay đổi."))
        return result.map { conversations ->
            _state.update { current -> current.copy(read = current.read.copy(
                conversations = conversations.map { card ->
                    val previousMessages = current.read.conversations
                        .firstOrNull { it.id == card.id }?.messages.orEmpty()
                    card.copy(messages = (card.messages + previousMessages)
                        .distinctBy { it.id }
                        .sortedWith(compareBy<com.trooi.app.core.model.ConversationMessage> { it.createdAt }.thenBy { it.id }))
                },
            )) }
            Unit
        }
    }
    fun consumeMessageContext() { _state.update { it.copy(messageConversationId = null) } }
    fun openMessageContext(type: String, id: String) {
        val generation = sessionGeneration
        viewModelScope.launch {
            repository.openConversation(type, id).fold(
                { conversationId -> if (generation == sessionGeneration) {
                    _state.update { it.copy(messageConversationId = conversationId) }; openMessages()
                } },
                { if (generation == sessionGeneration) showMessage("Không mở được cuộc trò chuyện: ${it.message}") },
            )
        }
    }
    suspend fun readMessageConversation(id: String) {
        val generation = sessionGeneration
        repository.readConversation(id).fold(
            { if (generation == sessionGeneration) _state.update { current -> current.copy(read = current.read.copy(
                conversations = current.read.conversations.map { card -> if (card.id != id) card else card.copy(lastReadAt = card.messages.lastOrNull()?.createdAt) })) } },
            { if (generation == sessionGeneration) showMessage("Chưa cập nhật được trạng thái đã đọc. Hãy làm mới để thử lại.") },
        )
    }
    suspend fun loadMessageAttachment(id: String, attachmentId: String): Result<ByteArray> {
        val generation = sessionGeneration
        val result = repository.messageAttachment(id, attachmentId)
        return if (generation == sessionGeneration) result else Result.failure(IllegalStateException("Phiên đã thay đổi."))
    }
    suspend fun purchaseLocalCapacity(purchaseId: String): Result<Unit> {
        val result = localManagementCommand { repository.purchaseLocalCapacity(purchaseId) }
        val pending = result.exceptionOrNull() as? SlotCheckoutPending ?: return result
        val url = com.trooi.app.features.tenancy.launchableHttpsPayUrl(pending.payUrl, allowLocalHttp = true) ?: return result
        runCatching {
            appContext.startActivity(
                android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                    .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
        return result
    }
    suspend fun archiveLocalAsset(assetId: String): Result<Unit> =
        localManagementCommand { repository.archiveLocalAsset(assetId) }

    suspend fun completeLocalLandlordOnboarding(application: LocalLandlordApplication): Result<Unit> {
        val generation = sessionGeneration
        if (!_state.value.isAuthenticated) return Result.failure(IllegalStateException("Vui lòng đăng nhập lại."))
        if (!_state.value.demoPreview) {
            val reauthentication = runCatching { com.trooi.app.features.profile.requireBackendReauthentication() }
            reauthentication.exceptionOrNull()?.let { return Result.failure(it) }
        }
        val result = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            repository.completeLocalLandlordOnboarding(application).mapCatching { session ->
                session to repository.refreshAuthorizedRead(session.access).getOrThrow()
            }
        }
        if (generation != sessionGeneration) return Result.failure(IllegalStateException("Phiên đăng nhập đã thay đổi."))
        return result.map { (session, read) ->
            _state.update { applyAuthenticatedSession(it, session, resetRead = false).copy(read = read, page = it.page) }
            Unit
        }
    }

    fun login(identifier: String, password: String) {
        if (RuntimeDataSource.isBackendBacked()) {
            return showMessage("Email/mật khẩu chưa hỗ trợ trên Backend. Hãy đăng nhập bằng Google.")
        }
        if (!isValidIdentifier(identifier) || !isValidPassword(password)) {
            return showMessage("Thông tin đăng nhập chưa hợp lệ.")
        }
        viewModelScope.launch {
            repository.login(identifier.trim(), password).fold(
                onSuccess = { session ->
                    sessionGeneration++
                    _state.update { applyAuthenticatedSession(it, session) }
                    refreshAuthorizedRead(session.access)
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
                    refreshAuthorizedRead(session.access)
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
        _state.update { it.copy(submittingInquiry = true, inquiryCompletedListingId = null, inquiryCompletedId = null, inquiryError = null) }
        viewModelScope.launch {
            repository.submitInquiry(listingId, clean).fold(
                onSuccess = { inquiryId ->
                    if (generation == sessionGeneration) _state.update {
                        it.copy(submittingInquiry = false, inquiryCompletedListingId = listingId, inquiryCompletedId = inquiryId,
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

    /** Save presentation only; preserve User ownership and authenticated session generation. */
    suspend fun updateDisplayName(displayName: String): Result<Unit> {
        val original = _state.value
        if (!original.isAuthenticated || original.backendUserId.isBlank()) {
            return Result.failure(IllegalStateException("Bạn cần đăng nhập để chỉnh sửa hồ sơ."))
        }
        val generation = sessionGeneration
        return repository.updateDisplayName(displayName).fold(
            onSuccess = { session ->
                if (generation != sessionGeneration || session.userId != original.backendUserId) {
                    Result.failure(IllegalStateException("Phiên đăng nhập đã thay đổi."))
                } else {
                    _state.update { current ->
                        if (current.backendUserId == session.userId) current.copy(
                            displayName = session.displayName,
                            email = session.email,
                            pictureUrl = session.pictureUrl,
                        ) else current
                    }
                    Result.success(Unit)
                }
            },
            onFailure = { Result.failure(it) },
        )
    }

    fun refreshProfileAvatar() {
        val original = _state.value
        if (!RuntimeDataSource.isBackendBacked() || !original.isAuthenticated || original.backendUserId.isBlank()) return
        val userId = original.backendUserId
        val generation = sessionGeneration
        viewModelScope.launch {
            repository.loadOwnAvatar(userId).fold(
                onSuccess = { image ->
                    if (generation == sessionGeneration) _state.update { current ->
                        if (current.backendUserId == userId) current.copy(profileAvatarBytes = image?.bytes) else current
                    }
                },
                onFailure = { /* Keep the current image; a private avatar read failure is not a successful empty result. */ },
            )
        }
    }

    suspend fun uploadProfileAvatar(contentType: String, bytes: ByteArray): Result<Unit> {
        val original = _state.value
        if (!RuntimeDataSource.isBackendBacked() || !original.isAuthenticated || original.backendUserId.isBlank()) {
            return Result.failure(IllegalStateException("Bạn cần phiên Backend hợp lệ để tải ảnh hồ sơ."))
        }
        if (contentType !in listOf("image/jpeg", "image/png") || bytes.isEmpty() || bytes.size > 2 * 1024 * 1024) {
            return Result.failure(IllegalArgumentException("Ảnh phải là JPEG/PNG và không quá 2 MB."))
        }
        val userId = original.backendUserId
        val generation = sessionGeneration
        _state.update { current -> if (current.backendUserId == userId) current.copy(profileAvatarUploading = true) else current }
        return repository.updateOwnAvatar(userId, contentType, bytes).fold(
            onSuccess = { image ->
                if (generation != sessionGeneration || _state.value.backendUserId != userId) {
                    Result.failure(IllegalStateException("Phiên đăng nhập đã thay đổi."))
                } else {
                    _state.update { current ->
                        if (current.backendUserId == userId) current.copy(profileAvatarBytes = image.bytes, profileAvatarUploading = false) else current
                    }
                    Result.success(Unit)
                }
            },
            onFailure = { error ->
                if (generation == sessionGeneration) _state.update { current ->
                    if (current.backendUserId == userId) current.copy(profileAvatarUploading = false) else current
                }
                Result.failure(error)
            },
        )
    }

    fun refreshSessionContext() {
        if (!_state.value.isAuthenticated) return
        val generation = sessionGeneration
        viewModelScope.launch {
            repository.refreshSessionContext().fold(
                onSuccess = { session ->
                    if (generation == sessionGeneration) {
                        sessionGeneration++
                        _state.update { current ->
                            applyReconciledAccess(current, session.displayName, session.access).copy(pictureUrl = session.pictureUrl, email = session.email)
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
        trustSubmitGate.set(false)
        viewModelScope.launch {
            runCatching { repository.revokeCurrentBackendSession() }
            repository.clearSession()
            googleCredentialAuth.clearCredentialState(appContext)
        }
        _state.update { current ->
            current.copy(
                isAuthenticated = false,
                displayName = "",
                email = null,
                pictureUrl = null,
                profileAvatarBytes = null,
                profileAvatarUploading = false,
                backendUserId = "",
                access = AccessCapabilities(),
                read = FrontendReadSnapshot(
                    publicListings = publicDiscoveryFeed(current.read.publicListings),
                ),
                page = AppPage.AuthWelcome,
                splashCompleted = true,
                activeContext = AppContext.DISCOVERY,
                selectedContext = SelectedContext.Discovery,
                authInProgress = false,
                runtimeLoading = false,
                submittingInquiry = false,
                inquiryCompletedListingId = null, inquiryCompletedId = null, messageConversationId = null,
                inquiryError = null,
                submittingTrustReport = false,
                trustReceipt = null,
                trustReportError = null,
                trustReportUnavailable = false,
                authReturnListingId = null,
                sharedCaller = null,
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
        trustBackPage(current.page, current.authReturnListingId)?.let { destination ->
            _state.update {
                it.copy(page = destination, authReturnListingId = null, submittingTrustReport = false)
            }
            return
        }
        sharedBackPage(current.page, current.sharedCaller)?.let { destination ->
            _state.update { it.copy(page = destination, sharedCaller = null) }
            return
        }
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
            AppPage.AuthLogin, AppPage.AuthSignUp -> AppPage.AuthWelcome
            is AppPage.NotificationDetail -> AppPage.Notifications
            AppPage.Notifications, AppPage.ContextSwitcher -> AppPage.Account
            is AppPage.ListingDetail -> AppPage.Discovery
            AppPage.Favorites, AppPage.CoreWorkspace, AppPage.Messages -> AppPage.Discovery
            else -> if (!current.isAuthenticated) AppPage.AuthWelcome else contextHomePage(current.activeContext, current.access)
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
        val nextRead = if (resetRead) snapshot.read else current.read
        val returnId = current.authReturnListingId
        val returnPage = pageAfterTrustLogin(
            returnId,
            returnId != null && publicDiscoveryFeed(nextRead.publicListings).any { it.listingId == returnId },
        )
        return current.copy(
            isAuthenticated = true,
            displayName = session.displayName,
            email = session.email,
            pictureUrl = session.pictureUrl,
            profileAvatarBytes = current.profileAvatarBytes.takeIf { current.backendUserId == session.userId },
            profileAvatarUploading = current.profileAvatarUploading.takeIf { current.backendUserId == session.userId } ?: false,
            backendUserId = session.userId,
            access = session.access,
            read = nextRead,
            selectedContext = resolved.selection,
            activeContext = appContextFor(resolved.selection),
            page = returnPage ?: if (current.demoPreview) AppPage.CoreWorkspace else destinationPage(resolved),
            sessionRestoring = false,
            restoreFailed = false,
            authReturnListingId = null,
            authorizedReadFailed = false,
            messagesLoading = false,
            messagesLoadFailed = false,
            submittingTrustReport = false,
            trustReceipt = null,
            trustReportError = null,
            trustReportUnavailable = false,
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
            runCatching {
                val current = paymentGateway.get(id)
                if (current.provider == "SEPAY" && !isConfirmedGatewayPayment(current)) {
                    runCatching { paymentGateway.reconcile(id) }.getOrDefault(current)
                } else {
                    current
                }
            }
                .onSuccess { checkout ->
                    if (generation != sessionGeneration) return@onSuccess
                    if (hint != null && hint.tenancyId == checkout.tenancyId) {
                        hintsStore.upsertPendingCheckout(hint.copy(checkoutId = checkout.id))
                    }
                    refreshAuthorizedRead(_state.value.access)
                    showMessage(
                        if (isConfirmedGatewayPayment(checkout)) {
                            "Backend đã xác nhận Payment. Số liệu được làm mới từ danh sách."
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
            _state.update {
                it.copy(
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

    private fun openShared(page: AppPage) = _state.update { current ->
        if (!current.isAuthenticated) current.copy(snackbarMessage = "Đăng nhập trước khi mở mục này.")
        else current.copy(page = page, sharedCaller = current.page)
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
