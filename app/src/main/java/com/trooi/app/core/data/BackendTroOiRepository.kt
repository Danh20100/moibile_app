package com.trooi.app.core.data

import com.trooi.app.core.model.*
import com.trooi.app.core.network.AuthTokenProvider
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.*
import javax.inject.Inject

/** Backend-backed repository. All authority remains server-side; mapping is read-only. */
class BackendTroOiRepository @Inject constructor(
    private val api: BackendApi,
    private val tokens: AuthTokenProvider,
) : TroOiRepository {
    override fun initialSnapshot() = TroOiSnapshot()
    override fun clearSession() = tokens.clear()

    suspend fun probePublicTransport(): TransportOutcome = api.getPublicListingsRaw()

    override suspend fun refreshSessionContext(): Result<UserSession> = try {
        val session = api.getSessionContext().required("session context")
        Result.success(UserSession(
            displayName = session.name ?: session.email ?: session.userId,
            access = AccessCapabilities(
                linkedTenancyIds = session.linkedTenancyIds.toSet(),
                operatedOrganizationIds = session.operatedOrganizationIds.toSet(),
            ),
        ))
    } catch (error: RuntimeException) { Result.failure(error) }

    override suspend fun refreshPublicListings(): Result<List<PublicListingCard>> = try {
        Result.success(mapPublicListings(api.getPublicListings().required("public listings")))
    } catch (error: RuntimeException) {
        Result.failure(error)
    }

    override suspend fun authenticateWithGoogleIdToken(idToken: String): Result<UserSession> {
        if (idToken.isBlank()) return Result.failure(IllegalArgumentException("Google ID Token trống"))
        return try {
            val principal = api.authenticateGoogle(idToken).required("Google authentication")
            tokens.setToken(idToken)
            val session = api.getSessionContext().required("session context")
            val displayName = session.name ?: principal.name ?: session.email ?: principal.email ?: session.userId
            Result.success(
                UserSession(
                    displayName = displayName,
                    access = AccessCapabilities(
                        linkedTenancyIds = session.linkedTenancyIds.toSet(),
                        operatedOrganizationIds = session.operatedOrganizationIds.toSet(),
                    ),
                ),
            )
        } catch (error: RuntimeException) {
            tokens.clear()
            Result.failure(error)
        }
    }

    override suspend fun refreshAuthorizedRead(access: AccessCapabilities): Result<FrontendReadSnapshot> = try {
        Result.success(loadAuthorizedRead(access))
    } catch (error: RuntimeException) {
        Result.failure(error)
    }
    override suspend fun submitInquiry(listingId: String, message: String): Result<Unit> = try {
        api.createInquiry(listingId, message).required("inquiry")
        Result.success(Unit)
    } catch (error: RuntimeException) {
        Result.failure(error)
    }

    override suspend fun login(identifier: String, password: String): Result<UserSession> = unsupportedAuth()
    override suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession> = unsupportedAuth()
    override suspend fun requestPasswordReset(identifier: String): Result<Unit> = unsupportedAuth()

    private fun <T> unsupportedAuth(): Result<T> = Result.failure(
        IllegalStateException("Backend-backed build chỉ hỗ trợ Google Credential Manager."),
    )

    private suspend fun loadAuthorizedRead(access: AccessCapabilities): FrontendReadSnapshot {
        val publicListings = mapPublicListings(api.getPublicListings().required("public listings"))
        val organizationRows = api.getOrganizations().required("organizations")
            .filter { it.id in access.operatedOrganizationIds }

        val properties = mutableListOf<PropertyTransport>()
        val rooms = mutableListOf<RoomTransport>()
        val incidents = linkedMapOf<String, IncidentTransport>()
        val tenancies = linkedMapOf<String, TenancyTransport>()
        val operatorCharges = mutableMapOf<String, MutableList<ChargeCard>>()
        val operatorTenancyToOrganization = mutableMapOf<String, String>()
        val operatorReceipts = mutableMapOf<String, MutableList<ReceiptCard>>()

        for (organization in organizationRows) {
            val scopedProperties = api.getProperties(organization.id).required("properties")
                .filter { it.organizationId == organization.id }
            properties += scopedProperties
            val chargeBucket = operatorCharges.getOrPut(organization.id) { mutableListOf() }
            for (property in scopedProperties) {
                val scopedRooms = api.getRooms(property.id).required("rooms")
                    .filter { it.propertyId == property.id }
                rooms += scopedRooms
                for (room in scopedRooms) {
                    api.getIncidents(room.id).required("incidents")
                        .filter { it.roomId == room.id }
                        .forEach { incidents[it.id] = it }
                    for (tenancy in api.getTenancies(room.id).required("tenancies")) {
                        if (tenancy.roomId != room.id) continue
                        tenancies[tenancy.id] = tenancy
                        operatorTenancyToOrganization[tenancy.id] = organization.id
                        api.getBillingCycles(tenancy.id).required("billing cycles")
                            .flatMap { it.charges }
                            .mapTo(chargeBucket, ::mapCharge)
                    }
                }
            }
        }

        val termsByTenancy = mutableMapOf<String, List<TenancyTermsTransport>>()
        val noticesByTenancy = mutableMapOf<String, List<TenancyNoticeCard>>()
        val tenantFinance = mutableMapOf<String, TenantFinanceProjection>()
        for (tenancyId in access.linkedTenancyIds) {
            val tenancy = api.getTenancy(tenancyId).required("tenant tenancy")
            if (tenancy.id != tenancyId) continue
            tenancies[tenancy.id] = tenancy
            val terms = api.getTerms(tenancyId).required("tenancy terms")
                .filter { it.tenancyId == tenancyId }
            termsByTenancy[tenancyId] = terms
            noticesByTenancy[tenancyId] = api.getNotices(tenancyId).required("tenancy notices")
                .filter { it.tenancyId == tenancyId }
                .map(::mapNotice)
            val charges = api.getBillingCycles(tenancyId).required("tenant billing cycles")
                .filter { it.tenancyId == tenancyId }
                .flatMap { it.charges }
                .map(::mapCharge)
            tenantFinance[tenancyId] = TenantFinanceProjection(
                tenancyId = tenancyId,
                charges = charges.distinctBy { it.chargeId },
            )
        }

        for (receipt in api.getReceipts().required("receipts")) {
            val payment = api.getPayment(receipt.paymentId).required("receipt payment")
            val receiptCard = ReceiptCard(
                receiptId = receipt.id,
                confirmedPaymentId = receipt.paymentId,
                issuedAtLabel = "${receipt.issuedAt} \u00B7 ${receipt.status}",
            )
            tenantFinance[payment.tenancyId]?.let { current ->
                tenantFinance[payment.tenancyId] = current.copy(
                    receipts = (current.receipts + receiptCard).distinctBy { it.receiptId },
                )
            }
            operatorTenancyToOrganization[payment.tenancyId]?.let { organizationId ->
                operatorReceipts.getOrPut(organizationId) { mutableListOf() }.add(receiptCard)
            }
        }

        val roomLabels = rooms.associate { it.id to it.nameOrLabel }
        val tenancyCards = tenancies.values.map { tenancy ->
            val latestTerms = termsByTenancy[tenancy.id]?.maxByOrNull { it.version }
            TenancyCard(
                tenancyId = tenancy.id,
                roomLabel = roomLabels[tenancy.roomId] ?: "Phòng",
                lifecycle = tenancyLifecycle(tenancy.status),
                termsVersionLabel = latestTerms?.let { "Terms v${it.version}" },
            )
        }

        return FrontendReadSnapshot(
            publicListings = publicListings,
            organizations = organizationRows.map { OrganizationCard(it.id, it.name) },
            properties = properties.distinctBy { it.id }.map { PropertyCard(it.id, it.organizationId, it.name) },
            operationalRooms = rooms.distinctBy { it.id }.map(::mapRoom),
            operatorListings = emptyList(),
            tenancies = tenancyCards.distinctBy { it.tenancyId },
            tenantFinanceByTenancy = tenantFinance,
            noticesByTenancy = noticesByTenancy,
            operatorFinanceByOrganization = organizationRows.associate { organization ->
                organization.id to OperatorFinanceProjection(
                    charges = operatorCharges[organization.id].orEmpty().distinctBy { it.chargeId },
                    receipts = operatorReceipts[organization.id].orEmpty().distinctBy { it.receiptId },
                )
            },
            incidents = incidents.values.map(::mapIncident),
            dashboardByOrganization = emptyMap(),
        )
    }

    private fun mapPublicListings(values: List<PublicListingTransport>): List<PublicListingCard> =
        values.mapNotNull { listing ->
            val visibility = listingVisibility(listing.status)
            if (visibility != ListingVisibility.PUBLISHED) return@mapNotNull null
            PublicListingCard(
                listingId = listing.id,
                title = listing.publicTitle,
                publicAreaLabel = "Vị trí công khai",
                publicGeoPoint = PublicGeoPoint(listing.publicLocation.latitude, listing.publicLocation.longitude),
                askingPriceLabel = listing.publicPriceProjection,
                visibility = visibility,
            )
        }

    private fun mapRoom(room: RoomTransport) = OperationalRoomCard(
        roomId = room.id,
        propertyId = room.propertyId,
        label = room.nameOrLabel,
        operationalState = roomOperationalState(room.operationalState),
        lifecycle = recordLifecycle(room.recordLifecycle),
    )

    private fun mapCharge(charge: ChargeTransport) = ChargeCard(
        chargeId = charge.id,
        label = charge.type,
        amountLabel = charge.amount,
        outstandingLabel = null,
    )

    private fun mapNotice(notice: TenancyNoticeTransport) = TenancyNoticeCard(
        noticeId = notice.id,
        tenancyId = notice.tenancyId,
        type = notice.noticeType,
        content = notice.contentOrNote,
        issuedAtLabel = notice.issuedAt,
        acknowledgedAtLabel = notice.acknowledgedAt,
    )

    private fun mapIncident(incident: IncidentTransport) = IncidentCard(
        incidentId = incident.id,
        roomId = incident.roomId,
        title = incident.category,
        lifecycle = incidentLifecycle(incident.status),
        timeline = emptyList(),
        serverActions = emptyList(),
    )

    private fun listingVisibility(value: String) = enumValue<ListingVisibility>(value)
    private fun roomOperationalState(value: String) = enumValue<RoomOperationalState>(value)
    private fun recordLifecycle(value: String) = enumValue<RecordLifecycle>(value)
    private fun tenancyLifecycle(value: String) = enumValue<TenancyLifecycle>(value)
    private fun incidentLifecycle(value: String) = enumValue<IncidentLifecycle>(value)

    private inline fun <reified T : Enum<T>> enumValue(value: String): T = try {
        enumValueOf<T>(value.uppercase())
    } catch (error: IllegalArgumentException) {
        throw IllegalStateException("Backend trả enum không hỗ trợ: $value", error)
    }

    private fun <T> ApiOutcome<T>.required(operation: String): T = when (this) {
        is ApiOutcome.Data -> value
        is ApiOutcome.Failure -> throw IllegalStateException(
            "$operation thất bại: $kind" + (httpStatus?.let { " (HTTP $it)" } ?: ""),
        )
    }
}
