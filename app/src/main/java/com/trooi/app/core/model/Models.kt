package com.trooi.app.core.model

/** UI context is derived from relationships and is never persisted as USER.role. */
enum class AppContext { DISCOVERY, TENANT, OPERATIONS }

/** Screens represent frontend context, not a persisted USER.role. */
sealed interface AppPage {
    data object AuthWelcome : AppPage
    data object AuthLogin : AppPage
    data object AuthSignUp : AppPage
    data object AuthForgotPassword : AppPage
    data object ContextSwitcher : AppPage
    data object Discovery : AppPage
    data object Favorites : AppPage
    data object CoreWorkspace : AppPage
    data object Messages : AppPage
    data object GuestMap : AppPage
    data object GuestActivity : AppPage
    data class ListingDetail(val listingId: String) : AppPage
    data class TrustReport(val listingId: String) : AppPage
    data object TenantHome : AppPage
    data object TenantRental : AppPage
    data object TenantFinance : AppPage
    data object TenantIncidents : AppPage
    data object Notifications : AppPage
    data class NotificationDetail(val notificationId: String) : AppPage
    data object Account : AppPage
    data object Settings : AppPage
    data object Help : AppPage
    data object OwnerDashboard : AppPage
    data object OwnerProperties : AppPage
    data object OwnerFinance : AppPage
    data object OwnerIncidents : AppPage
}

data class TroOiUiState(
    val page: AppPage = AppPage.AuthWelcome,
    val splashCompleted: Boolean = false,
    val activeContext: AppContext = AppContext.DISCOVERY,
    val selectedContext: SelectedContext = SelectedContext.Discovery,
    val isAuthenticated: Boolean = false,
    val displayName: String = "",
    val email: String? = null,
    val pictureUrl: String? = null,
    val access: AccessCapabilities = AccessCapabilities(),
    val read: FrontendReadSnapshot = FrontendReadSnapshot(),
    val demoPreview: Boolean = false,
    val authInProgress: Boolean = false,
    val runtimeLoading: Boolean = false,
    val authorizedReadFailed: Boolean = false,
    val messagesLoading: Boolean = false,
    val messagesLoadFailed: Boolean = false,
    val submittingInquiry: Boolean = false,
    val inquiryCompletedListingId: String? = null,
    val inquiryCompletedId: String? = null,
    val messageConversationId: String? = null,
    val inquiryError: String? = null,
    val submittingTrustReport: Boolean = false,
    val trustReceipt: TrustReportReceipt? = null,
    val trustReportError: String? = null,
    val trustReportUnavailable: Boolean = false,
    val authReturnListingId: String? = null,
    val sharedCaller: AppPage? = null,
    val settingsEntry: String = "settings",
    val snackbarMessage: String? = null,
    val sessionRestoring: Boolean = false,
    val restoreFailed: Boolean = false,
    val backendUserId: String = "",
    val sourceReturn: SourceNavigation? = null,
    val authorizedSource: SourceResolution.Authorized? = null,
    val sourceUnavailable: Boolean = false,
)

/** Only UI routing and relationship checks: the backend remains the authority for operations. */
fun canOpenPage(page: AppPage, authenticated: Boolean, access: AccessCapabilities): Boolean =
    when (page) {
        AppPage.Account, AppPage.ContextSwitcher, AppPage.Notifications, is AppPage.NotificationDetail -> authenticated
        AppPage.Favorites, AppPage.CoreWorkspace, AppPage.Messages -> authenticated
        AppPage.TenantHome, AppPage.TenantRental, AppPage.TenantFinance, AppPage.TenantIncidents ->
            authenticated && access.allows(ClientArea.TENANT_PORTAL)
        AppPage.OwnerDashboard, AppPage.OwnerFinance, AppPage.OwnerIncidents ->
            authenticated && access.allows(ClientArea.OPERATIONS)
        AppPage.OwnerProperties -> authenticated
        is AppPage.TrustReport -> authenticated
        AppPage.Settings, AppPage.Help -> authenticated
        else -> true
    }

fun accountTabSelected(page: AppPage): Boolean =
    page == AppPage.Account || page == AppPage.Settings || page == AppPage.Help

fun sharedBackPage(page: AppPage, caller: AppPage?): AppPage? = when (page) {
    AppPage.Settings, AppPage.Help -> caller ?: AppPage.Account
    else -> null
}

data class ActivityDecision(val id: String, val enabled: Boolean, val reason: String)

fun activityDecisions(): List<ActivityDecision> = listOf(
    ActivityDecision("CLAIM", false, "Xác nhận đã chuyển tiền chưa được mở."),
    ActivityDecision("REVIEW", false, "Đánh giá chưa được mở."),
    ActivityDecision("INQUIRY_ACTIVITY", false, "Lịch sử yêu cầu liên hệ chưa khả dụng."),
)

/** Receipt for the report just submitted. Not a history or moderation record. */
data class TrustReportReceipt(
    val id: String,
    val listingId: String,
    val reason: String,
    val status: String,
    val createdAt: String,
)

/** The root shell is available only after authenticated session restoration. */
fun rootNavigationVisible(state: TroOiUiState): Boolean =
    state.isAuthenticated && state.splashCompleted && !state.sessionRestoring && !state.restoreFailed && (
        state.page in setOf(AppPage.Discovery, AppPage.Favorites, AppPage.CoreWorkspace, AppPage.Messages) || when (state.activeContext) {
        AppContext.DISCOVERY -> state.page in setOf(
            AppPage.Discovery, AppPage.Favorites, AppPage.CoreWorkspace, AppPage.Messages,
            AppPage.GuestMap, AppPage.GuestActivity, AppPage.Account,
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
)
