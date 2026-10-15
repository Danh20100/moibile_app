package com.trooi.app.core.model

sealed interface SelectedContext {
    data object Discovery : SelectedContext
    data class Tenant(val tenancyId: String) : SelectedContext
    data class Operations(val organizationId: String) : SelectedContext
}

data class ContextResolution(
    val selection: SelectedContext,
    val needsPicker: Boolean,
)

fun reconcileContext(selection: SelectedContext?, access: AccessCapabilities): ContextResolution {
    if (selection != null && isAuthorized(selection, access)) {
        return ContextResolution(selection, needsPicker = false)
    }
    val tenancyIds = access.linkedTenancyIds
    val organizationIds = access.operatedOrganizationIds
    val remaining = tenancyIds.size + organizationIds.size
    return when {
        remaining == 0 -> ContextResolution(SelectedContext.Discovery, needsPicker = false)
        remaining == 1 && tenancyIds.size == 1 ->
            ContextResolution(SelectedContext.Tenant(tenancyIds.single()), needsPicker = false)
        remaining == 1 && organizationIds.size == 1 ->
            ContextResolution(SelectedContext.Operations(organizationIds.single()), needsPicker = false)
        else -> ContextResolution(SelectedContext.Discovery, needsPicker = true)
    }
}

fun isAuthorized(selection: SelectedContext, access: AccessCapabilities): Boolean = when (selection) {
    SelectedContext.Discovery -> true
    is SelectedContext.Tenant -> selection.tenancyId in access.linkedTenancyIds
    is SelectedContext.Operations -> selection.organizationId in access.operatedOrganizationIds
}

fun appContextFor(selection: SelectedContext): AppContext = when (selection) {
    SelectedContext.Discovery -> AppContext.DISCOVERY
    is SelectedContext.Tenant -> AppContext.TENANT
    is SelectedContext.Operations -> AppContext.OPERATIONS
}

fun homePageFor(selection: SelectedContext): AppPage = when (selection) {
    SelectedContext.Discovery -> AppPage.Discovery
    is SelectedContext.Tenant -> AppPage.TenantHome
    is SelectedContext.Operations -> AppPage.OwnerDashboard
}

fun destinationPage(resolution: ContextResolution): AppPage =
    if (resolution.needsPicker) AppPage.ContextSwitcher else homePageFor(resolution.selection)

const val NEUTRAL_TENANCY_LABEL = "Lượt thuê"
const val NEUTRAL_ORGANIZATION_LABEL = "Tài sản"

fun contextLabel(selection: SelectedContext, read: FrontendReadSnapshot): String = when (selection) {
    SelectedContext.Discovery -> "Khám phá"
    is SelectedContext.Tenant ->
        read.tenancies.firstOrNull { it.tenancyId == selection.tenancyId }
            ?.roomLabel
            ?.takeIf { it.isNotBlank() }
            ?: NEUTRAL_TENANCY_LABEL
    is SelectedContext.Operations ->
        read.organizations.firstOrNull { it.organizationId == selection.organizationId }
            ?.displayName
            ?.takeIf { it.isNotBlank() }
            ?: NEUTRAL_ORGANIZATION_LABEL
}

fun tenancyAllowsWrites(lifecycle: TenancyLifecycle?): Boolean = when (lifecycle) {
    TenancyLifecycle.DRAFT, TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING -> true
    TenancyLifecycle.ENDED, TenancyLifecycle.CANCELLED, null -> false
}
