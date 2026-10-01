package com.trooi.app.core.model

/** Screens represent frontend context, not a persisted USER.role. */
sealed interface AppPage {
    data object AuthWelcome : AppPage
    data object AuthLogin : AppPage
    data object AuthSignUp : AppPage
    data object AuthForgotPassword : AppPage
    data object Discovery : AppPage
    data class ListingDetail(val listingId: String) : AppPage
    data object TenantPortal : AppPage
    data object Account : AppPage
    data object OwnerDashboard : AppPage
    data object OwnerProperties : AppPage
    data object OwnerFinance : AppPage
    data object OwnerIncidents : AppPage
}

data class TroOiUiState(
    val page: AppPage = AppPage.Discovery,
    val isAuthenticated: Boolean = false,
    val displayName: String = "",
    val access: AccessCapabilities = AccessCapabilities(),
    val read: FrontendReadSnapshot = FrontendReadSnapshot(),
    val demoPreview: Boolean = false,
    val authInProgress: Boolean = false,
    val runtimeLoading: Boolean = false,
    val submittingInquiry: Boolean = false,
    val snackbarMessage: String? = null,
)

/** Only UI routing and relationship checks: the backend remains the authority for operations. */
fun canOpenPage(page: AppPage, authenticated: Boolean, access: AccessCapabilities): Boolean =
    when (page) {
        AppPage.OwnerDashboard, AppPage.OwnerProperties, AppPage.OwnerFinance, AppPage.OwnerIncidents ->
            authenticated && access.allows(ClientArea.OPERATIONS)
        AppPage.TenantPortal -> authenticated && access.allows(ClientArea.TENANT_PORTAL)
        else -> true
    }
