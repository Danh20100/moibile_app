package com.trooi.app.core.model

/** Navigation entitlement derived from authenticated relationships, never a global User.role. */
enum class ClientArea { DISCOVERY, TENANT_PORTAL, OPERATIONS }

data class AccessCapabilities(
    val linkedTenancyIds: Set<String> = emptySet(),
    val operatedOrganizationIds: Set<String> = emptySet(),
) {
    fun allows(area: ClientArea): Boolean = when (area) {
        ClientArea.DISCOVERY -> true
        ClientArea.TENANT_PORTAL -> linkedTenancyIds.isNotEmpty()
        ClientArea.OPERATIONS -> operatedOrganizationIds.isNotEmpty()
    }

    fun visibleAreas(): List<ClientArea> = ClientArea.entries.filter(::allows)
}

/** Public discovery projection: intentionally has no operational address or tenant data. */
enum class ListingVisibility { DRAFT, PUBLISHED, UNPUBLISHED, ARCHIVED }

data class PublicGeoPoint(val latitude: Double, val longitude: Double)

data class PublicListingCard(
    val listingId: String,
    val title: String,
    val publicAreaLabel: String,
    val publicGeoPoint: PublicGeoPoint?,
    val askingPriceLabel: String?,
    val visibility: ListingVisibility,
    val amenities: List<String> = emptyList(),
)

/** A discovery feed may render only published public Listing projections. */
fun publicDiscoveryFeed(listings: List<PublicListingCard>): List<PublicListingCard> =
    listings.filter { it.visibility == ListingVisibility.PUBLISHED }

enum class RoomOperationalState { VACANT, OCCUPIED, MAINTENANCE, INACTIVE }
enum class RecordLifecycle { ACTIVE, ARCHIVED }

data class OperationalRoomCard(
    val roomId: String,
    val propertyId: String,
    val label: String,
    val operationalState: RoomOperationalState,
    val lifecycle: RecordLifecycle,
)

data class OrganizationCard(val organizationId: String, val displayName: String)
data class PropertyCard(val propertyId: String, val organizationId: String, val displayName: String)

enum class TenancyLifecycle { DRAFT, ACTIVE, ENDING, ENDED, CANCELLED }

data class TenancyCard(
    val tenancyId: String,
    val roomLabel: String,
    val lifecycle: TenancyLifecycle,
    val termsVersionLabel: String?,
)

/** Finance projections are separate read surfaces, not inferred from Room rent/debt. */
data class ChargeCard(val chargeId: String, val label: String, val amountLabel: String, val outstandingLabel: String?)
data class PaymentCard(val paymentId: String, val amountLabel: String, val confirmationLabel: String?)
data class PaymentAllocationCard(val allocationId: String, val paymentId: String, val chargeId: String, val amountLabel: String)
data class DepositCard(val tenancyId: String, val requiredLabel: String?, val fundedLabel: String?, val settlementLabel: String?)
data class ReceiptCard(val receiptId: String, val confirmedPaymentId: String, val issuedAtLabel: String)

enum class IncidentLifecycle { REPORTED, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, REJECTED, CLOSED }

data class IncidentEventCard(val eventId: String, val description: String, val occurredAtLabel: String)

data class IncidentCard(
    val incidentId: String,
    val roomId: String,
    val title: String,
    val lifecycle: IncidentLifecycle,
    val timeline: List<IncidentEventCard>,
    /** Actions available to the user must come from the authorized Backend response. */
    val serverActions: List<String> = emptyList(),
)

/** Values here come directly from a Backend dashboard read model, never client calculations. */
data class DashboardReadModel(
    val roomsByState: Map<RoomOperationalState, Int>,
    val activeTenancyCount: Int?,
    val outstandingReceivableLabel: String?,
    val confirmedPaymentTotalLabel: String?,
    val openIncidentCount: Int?,
)
