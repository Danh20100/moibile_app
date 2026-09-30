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

/** Read projections do not own or mutate business facts. */
data class FrontendReadSnapshot(
    val publicListings: List<PublicListingCard> = emptyList(),
    val organizations: List<OrganizationCard> = emptyList(),
    val properties: List<PropertyCard> = emptyList(),
    val operationalRooms: List<OperationalRoomCard> = emptyList(),
    val operatorListings: List<OperatorListingCard> = emptyList(),
    val tenancies: List<TenancyCard> = emptyList(),
    val tenantFinanceByTenancy: Map<String, TenantFinanceProjection> = emptyMap(),
    val operatorFinanceByOrganization: Map<String, OperatorFinanceProjection> = emptyMap(),
    val incidents: List<IncidentCard> = emptyList(),
    val dashboardByOrganization: Map<String, DashboardReadModel> = emptyMap(),
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
