package com.trooi.app.features.ledger

import com.trooi.app.core.model.*

enum class LedgerMode { TENANT, OWNER }

/** Existing detail workspaces belong to Sổ in the four-tab shell. */
fun ledgerRootTab(page: AppPage): AppPage = when (page) {
    AppPage.TenantHome, AppPage.TenantRental, AppPage.TenantFinance, AppPage.TenantIncidents,
    AppPage.OwnerDashboard, AppPage.OwnerProperties, AppPage.OwnerFinance, AppPage.OwnerIncidents -> AppPage.CoreWorkspace
    else -> page
}

data class LedgerPresentation(val ownerAvailable: Boolean, val canSwitch: Boolean, val defaultMode: LedgerMode) {
    fun resolve(requested: LedgerMode?): LedgerMode = defaultMode
}

fun ledgerPresentation(state: TroOiUiState): LedgerPresentation {
    val owner = state.isAuthenticated && state.access.operatedOrganizationIds.isNotEmpty()
    return LedgerPresentation(owner, false, if (owner) LedgerMode.OWNER else LedgerMode.TENANT)
}


/**
 * An Organization membership alone is not an operational record. Keep the
 * illustrated first-use state until this operator has actual managed data.
 * Do not suppress existing properties, rooms or financial records.
 */
internal fun ownerLedgerHasOperationalContent(state: TroOiUiState): Boolean {
    val access = state.access
    val read = state.read
    if (read.localManagement?.assets?.isNotEmpty() == true ||
        accessibleRooms(read, access).isNotEmpty() ||
        accessibleOperatorListings(read, access).isNotEmpty()) return true

    return access.operatedOrganizationIds.any { organizationId ->
        read.operatorFinanceByOrganization[organizationId]?.let {
            it.charges.isNotEmpty() || it.confirmedPayments.isNotEmpty() ||
                it.allocations.isNotEmpty() || it.deposits.isNotEmpty() ||
                it.receipts.isNotEmpty()
        } == true
    }
}

val tenantLedgerSections = listOf("Tài sản đang thuê", "Khoản cần thanh toán", "Tiền cọc", "Thanh toán / xác nhận", "Sự cố", "Lịch sử")
val ownerLedgerSections = listOf("Tổng quan vận hành", "Tài sản của tôi", "Người thuê", "Công nợ / khoản phải thu", "Sự cố", "Hoạt động gần đây")

/** IDs come only from the authenticated relationship; missing projections stay unavailable. */
data class LedgerTenantAsset(val tenancyId: String, val roomId: String?, val label: String, val terms: String?, val lifecycle: TenancyLifecycle?)
fun TenancyLifecycle?.isCurrentRental(): Boolean = this == TenancyLifecycle.ACTIVE || this == TenancyLifecycle.ENDING
fun rentalLifecycleLabel(lifecycle: TenancyLifecycle?): String = when (lifecycle) {
    TenancyLifecycle.ACTIVE -> "Đang thuê"
    TenancyLifecycle.ENDING -> "Đang kết thúc thuê"
    TenancyLifecycle.ENDED -> "Đã kết thúc thuê"
    TenancyLifecycle.CANCELLED -> "Đã hủy lượt thuê"
    TenancyLifecycle.DRAFT -> "Chưa bắt đầu thuê"
    null -> "Chưa có thông tin lượt thuê"
}
fun ledgerTenancies(state: TroOiUiState): List<LedgerTenantAsset> =
    if (!state.isAuthenticated) emptyList() else state.access.linkedTenancyIds.sorted().map { id ->
        val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == id }
        LedgerTenantAsset(id, tenancy?.roomId, tenancy?.roomLabel ?: "Thông tin tài sản chưa sẵn sàng", tenancy?.termsVersionLabel, tenancy?.lifecycle)
    }

fun selectedLedgerTenancy(assets: List<LedgerTenantAsset>, selectedId: String?): LedgerTenantAsset? =
    assets.firstOrNull { it.tenancyId == selectedId } ?: assets.firstOrNull { it.lifecycle.isCurrentRental() } ?: assets.firstOrNull()

