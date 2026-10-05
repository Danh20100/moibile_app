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
    data object GuestMap : AppPage
    data object GuestActivity : AppPage
    data class ListingDetail(val listingId: String) : AppPage
    data object TenantHome : AppPage
    data object TenantRental : AppPage
    data object TenantFinance : AppPage
    data object TenantIncidents : AppPage
    data object Notifications : AppPage
    data class NotificationDetail(val notificationId: String) : AppPage
    data object Account : AppPage
    data object OwnerDashboard : AppPage
    data object OwnerProperties : AppPage
    data object OwnerFinance : AppPage
    data object OwnerIncidents : AppPage
}

data class TroOiUiState(
    val page: AppPage = AppPage.Discovery,
    val activeContext: AppContext = AppContext.DISCOVERY,
    val selectedContext: SelectedContext = SelectedContext.Discovery,
    val isAuthenticated: Boolean = false,
    val displayName: String = "",
    val access: AccessCapabilities = AccessCapabilities(),
    val read: FrontendReadSnapshot = FrontendReadSnapshot(),
    val demoPreview: Boolean = false,
    val authInProgress: Boolean = false,
    val runtimeLoading: Boolean = false,
    val submittingInquiry: Boolean = false,
    val inquiryCompletedListingId: String? = null,
    val inquiryError: String? = null,
    val snackbarMessage: String? = null,
)

/** Only UI routing and relationship checks: the backend remains the authority for operations. */
fun canOpenPage(page: AppPage, authenticated: Boolean, access: AccessCapabilities): Boolean =
    when (page) {
        AppPage.ContextSwitcher, AppPage.Notifications, is AppPage.NotificationDetail -> authenticated
        AppPage.TenantHome, AppPage.TenantRental, AppPage.TenantFinance, AppPage.TenantIncidents ->
            authenticated && access.allows(ClientArea.TENANT_PORTAL)
        AppPage.OwnerDashboard, AppPage.OwnerFinance, AppPage.OwnerIncidents ->
            authenticated && access.allows(ClientArea.OPERATIONS)
        AppPage.OwnerProperties -> authenticated
        else -> true
    }
