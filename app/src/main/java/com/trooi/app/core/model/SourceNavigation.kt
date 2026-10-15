package com.trooi.app.core.model

object LedgerSurface {
    const val OVERVIEW = "Tổng quan"
    const val LISTING = "Tin đăng"
    const val TENANCY = "Lượt thuê"
    const val FINANCE = "Tài chính"
    const val INCIDENT = "Sự cố"
    const val HISTORY = "Lịch sử"
    val ALL = listOf(OVERVIEW, LISTING, TENANCY, FINANCE, INCIDENT, HISTORY)
}

data class SourceTarget(
    val type: String,
    val id: String,
    val tenancyId: String? = null,
    val organizationId: String? = null,
    val roomId: String? = null,
    val propertyId: String? = null,
)

data class SourceNavigation(
    val originPage: AppPage,
    val originContext: SelectedContext,
    val target: SourceTarget,
)

sealed interface SourceResolution {
    data class Authorized(
        val context: SelectedContext,
        val page: AppPage,
        val surface: String,
        val target: SourceTarget,
    ) : SourceResolution

    data object Unavailable : SourceResolution
}

fun ledgerTargets(
    roomId: String,
    organizationId: String,
    tenancyId: String?,
): List<Pair<String, SourceTarget>> = LedgerSurface.ALL.map { label ->
    val type = when (label) {
        LedgerSurface.LISTING -> "LISTING"
        LedgerSurface.TENANCY -> "TENANCY"
        LedgerSurface.FINANCE -> "BILLING_CYCLE"
        LedgerSurface.INCIDENT -> "INCIDENT"
        LedgerSurface.HISTORY -> "HISTORY"
        else -> "ROOM"
    }
    val id = if (label == LedgerSurface.TENANCY) tenancyId ?: roomId else roomId
    label to SourceTarget(type, id, tenancyId, organizationId, roomId)
}

fun resolveSource(target: SourceTarget, access: AccessCapabilities): SourceResolution {
    val type = target.type.uppercase()
    val tenancy = target.tenancyId?.takeIf { it.isNotBlank() }
    val org = target.organizationId?.takeIf { it.isNotBlank() }
    val tenantOk = tenancy != null && tenancy in access.linkedTenancyIds
    val opsOk = org != null && org in access.operatedOrganizationIds

    fun tenant(surface: String) = SourceResolution.Authorized(
        SelectedContext.Tenant(tenancy!!),
        AppPage.TenantRental,
        surface,
        target,
    )

    fun ops(surface: String, page: AppPage = AppPage.OwnerProperties) = SourceResolution.Authorized(
        SelectedContext.Operations(org!!),
        page,
        surface,
        target,
    )

    return when (type) {
        "LISTING" -> when {
            opsOk -> ops(LedgerSurface.LISTING)
            org != null -> SourceResolution.Unavailable
            target.id.isNotBlank() -> SourceResolution.Authorized(
                SelectedContext.Discovery,
                AppPage.ListingDetail(target.id),
                LedgerSurface.LISTING,
                target,
            )
            else -> SourceResolution.Unavailable
        }
        "ORGANIZATION" -> if (opsOk) ops(LedgerSurface.OVERVIEW, AppPage.OwnerDashboard) else SourceResolution.Unavailable
        "PROPERTY", "ROOM" -> if (opsOk) ops(LedgerSurface.OVERVIEW) else SourceResolution.Unavailable
        "TENANCY" -> when {
            tenantOk -> tenant(LedgerSurface.TENANCY)
            opsOk -> ops(LedgerSurface.TENANCY)
            else -> SourceResolution.Unavailable
        }
        "PAYMENT", "RECEIPT", "DEPOSIT", "BILLING_CYCLE", "CHARGE" -> when {
            tenantOk -> tenant(LedgerSurface.FINANCE)
            opsOk -> ops(LedgerSurface.FINANCE)
            else -> SourceResolution.Unavailable
        }
        "INCIDENT" -> when {
            tenantOk -> tenant(LedgerSurface.INCIDENT)
            opsOk -> ops(LedgerSurface.INCIDENT)
            else -> SourceResolution.Unavailable
        }
        "HISTORY" -> when {
            tenantOk -> tenant(LedgerSurface.HISTORY)
            opsOk -> ops(LedgerSurface.HISTORY)
            else -> SourceResolution.Unavailable
        }
        else -> SourceResolution.Unavailable
    }
}

fun returnFromSource(navigation: SourceNavigation): Pair<AppPage, SelectedContext> =
    navigation.originPage to navigation.originContext
