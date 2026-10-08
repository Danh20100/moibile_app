package com.trooi.app.core.model

/** Listing management is a separate authorized view from public discovery. */
data class OperatorListingCard(val listingId: String, val roomId: String, val title: String, val visibility: ListingVisibility)

/** Backend must scope this projection by Organization before delivering it. */
data class OperatorFinanceProjection(
    val charges: List<ChargeCard> = emptyList(),
    val confirmedPayments: List<PaymentCard> = emptyList(),
    val allocations: List<PaymentAllocationCard> = emptyList(),
    val deposits: List<DepositCard> = emptyList(),
    val receipts: List<ReceiptCard> = emptyList(),
)

/** Backend must scope this projection by the current User–Participant–Tenancy relationship. */
data class TenantFinanceProjection(
    val tenancyId: String,
    val charges: List<ChargeCard> = emptyList(),
    val payments: List<PaymentCard> = emptyList(),
    val deposits: List<DepositCard> = emptyList(),
    val receipts: List<ReceiptCard> = emptyList(),
)

data class TenancyNoticeCard(
    val noticeId: String,
    val tenancyId: String,
    val type: String,
    val content: String,
    val issuedAtLabel: String,
    val acknowledgedAtLabel: String? = null,
)

data class NotificationCard(
    val notificationId: String,
    val category: String,
    val message: String,
    val deliveryStatus: String,
    val createdAtLabel: String,
    val readAtLabel: String? = null,
    val sourceType: String? = null,
    val sourceId: String? = null,
)

data class RentalHistoryCard(
    val tenancyId: String, val roomId: String, val title: String, val publicArea: String,
    val period: String, val endedState: String, val photoResources: List<Int> = emptyList(),
)

/** Supplemental local presentation, keyed by canonical Room ID; never a financial record. */
data class RentalAssetPresentation(val type: String, val publicArea: String, val photoResources: List<Int>, val photoUris: List<String> = emptyList())

/** Read projections do not own or mutate business facts. */
data class FrontendReadSnapshot(
    val conversations: List<ConversationCard> = emptyList(),
    val localManagement: LocalManagement? = null,
    val publicListings: List<PublicListingCard> = emptyList(),
    val rentalHistory: List<RentalHistoryCard> = emptyList(),
    val rentalAssetPresentationByRoom: Map<String, RentalAssetPresentation> = emptyMap(),
    val organizations: List<OrganizationCard> = emptyList(),
    val properties: List<PropertyCard> = emptyList(),
    val operationalRooms: List<OperationalRoomCard> = emptyList(),
    val operatorListings: List<OperatorListingCard> = emptyList(),
    val tenancies: List<TenancyCard> = emptyList(),
    val tenantFinanceByTenancy: Map<String, TenantFinanceProjection> = emptyMap(),
    val noticesByTenancy: Map<String, List<TenancyNoticeCard>> = emptyMap(),
    val operatorFinanceByOrganization: Map<String, OperatorFinanceProjection> = emptyMap(),
    val operatorFinanceByRoom: Map<String, OperatorFinanceProjection> = emptyMap(),
    val incidents: List<IncidentCard> = emptyList(),
    val dashboardByOrganization: Map<String, DashboardReadModel> = emptyMap(),
    val notifications: List<NotificationCard> = emptyList(),
)

/** Enforce relationship boundaries in client projections as defense-in-depth. */
fun accessibleProperties(read: FrontendReadSnapshot, access: AccessCapabilities): List<PropertyCard> =
    read.properties.filter { it.organizationId in access.operatedOrganizationIds }

fun accessibleRooms(read: FrontendReadSnapshot, access: AccessCapabilities): List<OperationalRoomCard> {
    val propertyIds = accessibleProperties(read, access).map { it.propertyId }.toSet()
    return read.operationalRooms.filter { it.propertyId in propertyIds }
}

fun accessibleOperatorListings(read: FrontendReadSnapshot, access: AccessCapabilities): List<OperatorListingCard> {
    val roomIds = accessibleRooms(read, access).map { it.roomId }.toSet()
    return read.operatorListings.filter { it.roomId in roomIds }
}

fun accessibleIncidents(read: FrontendReadSnapshot, access: AccessCapabilities): List<IncidentCard> {
    val roomIds = accessibleRooms(read, access).map { it.roomId }.toSet()
    return read.incidents.filter { it.roomId in roomIds }
}

fun scopedTenancies(
    read: FrontendReadSnapshot,
    access: AccessCapabilities,
    selected: SelectedContext,
): List<TenancyCard> {
    val id = (selected as? SelectedContext.Tenant)?.tenancyId?.takeIf { it in access.linkedTenancyIds }
        ?: return emptyList()
    return read.tenancies.filter { it.tenancyId == id }
}

fun scopedOrganizations(
    read: FrontendReadSnapshot,
    access: AccessCapabilities,
    selected: SelectedContext,
): List<OrganizationCard> {
    val id = (selected as? SelectedContext.Operations)?.organizationId
        ?.takeIf { it in access.operatedOrganizationIds }
        ?: return emptyList()
    return read.organizations.filter { it.organizationId == id }
}

fun scopedOperatorIncidents(
    read: FrontendReadSnapshot,
    access: AccessCapabilities,
    selected: SelectedContext,
): List<IncidentCard> {
    val orgId = (selected as? SelectedContext.Operations)?.organizationId
        ?.takeIf { it in access.operatedOrganizationIds }
        ?: return emptyList()
    val propertyIds = read.properties.filter { it.organizationId == orgId }.map { it.propertyId }.toSet()
    val roomIds = read.operationalRooms.filter { it.propertyId in propertyIds }.map { it.roomId }.toSet()
    return read.incidents.filter { it.roomId in roomIds }
}
