package com.trooi.app.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import com.trooi.app.BuildConfig
import com.trooi.app.core.auth.GoogleCredentialAuth
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.TransportOutcome
import androidx.lifecycle.viewModelScope
import com.trooi.app.core.data.TroOiRepository
import com.trooi.app.core.model.*
import com.trooi.app.features.auth.isValidIdentifier
import com.trooi.app.features.auth.isValidPassword
import com.trooi.app.features.auth.isValidSignup
import dagger.hilt.android.lifecycle.HiltViewModel
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
    fun openDiscovery() = open(AppPage.Discovery)
    fun openAccount() = open(AppPage.Account)
    fun openTenantPortal() = open(AppPage.TenantPortal)
    fun openOperations() = open(AppPage.OwnerDashboard)
    fun openOwnerProperties() = open(AppPage.OwnerProperties)
    fun openOwnerFinance() = open(AppPage.OwnerFinance)
    fun openOwnerIncidents() = open(AppPage.OwnerIncidents)

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
                                    it.copy(
                                        isAuthenticated = true,
                                        displayName = session.displayName,
                                        access = session.access,
                                        authInProgress = false,
                                        page = AppPage.Discovery,
                                    )
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
                    _state.update {
                        it.copy(
                            isAuthenticated = true,
                            displayName = session.displayName,
                            access = session.access,
                            read = snapshot.read,
                            page = AppPage.Discovery,
                        )
                    }
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
                    _state.update {
                        it.copy(
                            isAuthenticated = true,
                            displayName = session.displayName,
                            access = session.access,
                            read = snapshot.read,
                            page = AppPage.Discovery,
                        )
                    }
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
                        _state.update { it.copy(displayName = session.displayName, access = session.access) }
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
        authenticationJob?.cancel()
        authenticationJob = null
        repository.clearSession()
        _state.update { current ->
            current.copy(
                isAuthenticated = false,
                displayName = "",
                access = AccessCapabilities(),
                read = FrontendReadSnapshot(
                    publicListings = publicDiscoveryFeed(current.read.publicListings),
                ),
                page = AppPage.Discovery,
                authInProgress = false,
                runtimeLoading = false,
                submittingInquiry = false,
                inquiryCompletedListingId = null,
                inquiryError = null,
                snackbarMessage = null,
            )
        }
    }

    fun goBack() {
        val destination = when (_state.value.page) {
            AppPage.AuthForgotPassword -> AppPage.AuthLogin
            else -> AppPage.Discovery
        }
        open(destination)
    }

    fun clearSnackbar() = _state.update { it.copy(snackbarMessage = null) }

    private fun open(page: AppPage) = _state.update { current ->
        if (canOpenPage(page, current.isAuthenticated, current.access)) current.copy(page = page)
        else current.copy(snackbarMessage = "Bạn chưa được cấp quyền truy cập khu vực này.")
    }

    private fun showMessage(text: String) = _state.update { it.copy(snackbarMessage = text) }
}
