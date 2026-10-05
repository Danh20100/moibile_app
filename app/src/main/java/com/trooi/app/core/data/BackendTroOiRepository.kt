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
            userId = session.userId,
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

    override suspend fun searchPublicListings(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        minPrice: String?,
        maxPrice: String?,
    ): Result<List<PublicListingCard>> = try {
        require(latitude in -90.0..90.0 && longitude in -180.0..180.0) { "Tọa độ tìm kiếm không hợp lệ" }
        require(radiusMeters > 0.0) { "Bán kính tìm kiếm phải lớn hơn 0" }
        Result.success(
            api.searchPublicListings(latitude, longitude, radiusMeters, minPrice, maxPrice)
                .required("public listing search")
                .map(::mapPublicSearchResult),
        )
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
                    userId = session.userId,
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

    override suspend fun loadNotification(notificationId: String): Result<NotificationCard> = try {
        require(notificationId.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "Notification ID không hợp lệ" }
        Result.success(mapNotification(api.getNotification(notificationId).required("notification detail")))
    } catch (error: RuntimeException) {
        Result.failure(error)
    }

    override suspend fun markNotificationRead(notificationId: String): Result<Unit> = try {
        require(notificationId.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "Notification ID không hợp lệ" }
        api.markNotificationRead(notificationId).required("mark notification read")
        Result.success(Unit)
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
        val incidentEvents = mutableMapOf<String, List<IncidentEventTransport>>()
        val tenancies = linkedMapOf<String, TenancyTransport>()
        val operatorListings = mutableListOf<OperatorListingCard>()
        val dashboardByOrganization = mutableMapOf<String, DashboardReadModel>()
        val paymentsById = linkedMapOf<String, PaymentTransport>()
        val operatorCharges = mutableMapOf<String, MutableList<ChargeCard>>()
        val operatorPayments = mutableMapOf<String, MutableList<PaymentCard>>()
        val operatorDeposits = mutableMapOf<String, MutableList<DepositCard>>()
        val operatorTenancyToOrganization = mutableMapOf<String, String>()
        val operatorReceipts = mutableMapOf<String, MutableList<ReceiptCard>>()

        for (organization in organizationRows) {
            dashboardByOrganization[organization.id] = mapDashboard(
                api.getDashboard(organization.id).required("organization dashboard"),
            )
            val scopedProperties = api.getProperties(organization.id).required("properties")
                .filter { it.organizationId == organization.id }
            properties += scopedProperties
            val chargeBucket = operatorCharges.getOrPut(organization.id) { mutableListOf() }
            val paymentBucket = operatorPayments.getOrPut(organization.id) { mutableListOf() }
            val depositBucket = operatorDeposits.getOrPut(organization.id) { mutableListOf() }
            for (property in scopedProperties) {
                val scopedRooms = api.getRooms(property.id).required("rooms")
                    .filter { it.propertyId == property.id }
                rooms += scopedRooms
                for (room in scopedRooms) {
                    api.getCurrentListing(room.id).optionalNotFound("current listing")
                        ?.takeIf { it.roomId == room.id }
                        ?.let { operatorListings += mapOperatorListing(it) }

                    for (incident in api.getIncidents(room.id).required("incidents")) {
                        if (incident.roomId != room.id) continue
                        incidents[incident.id] = incident
                        incidentEvents[incident.id] = api.getIncidentEvents(incident.id)
                            .required("incident events")
                            .filter { it.incidentId == incident.id }
                    }

                    for (tenancy in api.getTenancies(room.id).required("tenancies")) {
                        if (tenancy.roomId != room.id) continue
                        tenancies[tenancy.id] = tenancy
                        operatorTenancyToOrganization[tenancy.id] = organization.id
                        api.getBillingCycles(tenancy.id).required("billing cycles")
                            .filter { it.tenancyId == tenancy.id }
                            .flatMap { it.charges }
                            .mapTo(chargeBucket, ::mapCharge)

                        val payments = api.getPayments(tenancy.id).required("operator payments")
                            .filter { it.tenancyId == tenancy.id }
                        payments.forEach { paymentsById[it.id] = it }
                        payments.mapTo(paymentBucket, ::mapPayment)

                        api.getDeposit(tenancy.id).optionalNotFound("operator deposit")
                            ?.takeIf { it.tenancyId == tenancy.id }
                            ?.let { depositBucket += mapDeposit(it) }
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
            for (incident in api.getIncidents(tenancy.roomId).required("tenant incidents")) {
                if (incident.roomId != tenancy.roomId) continue
                incidents[incident.id] = incident
                incidentEvents[incident.id] = api.getIncidentEvents(incident.id)
                    .required("tenant incident events")
                    .filter { it.incidentId == incident.id }
            }
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
            val payments = api.getPayments(tenancyId).required("tenant payments")
                .filter { it.tenancyId == tenancyId }
            payments.forEach { paymentsById[it.id] = it }
            val deposit = api.getDeposit(tenancyId).optionalNotFound("tenant deposit")
                ?.takeIf { it.tenancyId == tenancyId }
                ?.let(::mapDeposit)
            tenantFinance[tenancyId] = TenantFinanceProjection(
                tenancyId = tenancyId,
                charges = charges.distinctBy { it.chargeId },
                payments = payments.map(::mapPayment).distinctBy { it.paymentId },
                deposits = listOfNotNull(deposit),
            )
        }

        for (receipt in api.getReceipts().required("receipts")) {
            val payment = paymentsById[receipt.paymentId] ?: continue
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

        val notifications = api.getNotifications().required("notifications")
            .map(::mapNotification)

        val roomLabels = rooms.associate { it.id to it.nameOrLabel }
        val tenancyCards = tenancies.values.map { tenancy ->
            val latestTerms = termsByTenancy[tenancy.id]?.maxByOrNull { it.version }
            TenancyCard(
                tenancyId = tenancy.id,
                roomId = tenancy.roomId,
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
            operatorListings = operatorListings.distinctBy { it.listingId },
            tenancies = tenancyCards.distinctBy { it.tenancyId },
            tenantFinanceByTenancy = tenantFinance,
            noticesByTenancy = noticesByTenancy,
            operatorFinanceByOrganization = organizationRows.associate { organization ->
                organization.id to OperatorFinanceProjection(
                    charges = operatorCharges[organization.id].orEmpty().distinctBy { it.chargeId },
                    confirmedPayments = operatorPayments[organization.id].orEmpty().distinctBy { it.paymentId },
                    deposits = operatorDeposits[organization.id].orEmpty().distinctBy { it.depositId },
                    receipts = operatorReceipts[organization.id].orEmpty().distinctBy { it.receiptId },
                )
            },
            incidents = incidents.values.map { incident ->
                mapIncident(incident, incidentEvents[incident.id].orEmpty())
            },
            dashboardByOrganization = dashboardByOrganization,
            notifications = notifications,
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

    private fun mapPublicSearchResult(value: PublicListingSearchResultTransport) = PublicListingCard(
        listingId = value.listingId,
        title = value.publicTitle,
        publicAreaLabel = "Vị trí công khai",
        publicGeoPoint = PublicGeoPoint(value.publicLocation.latitude, value.publicLocation.longitude),
        askingPriceLabel = value.publicPriceProjection,
        visibility = ListingVisibility.PUBLISHED,
        distanceMeters = value.distanceMeters,
    )

    private fun mapRoom(room: RoomTransport) = OperationalRoomCard(
        roomId = room.id,
        propertyId = room.propertyId,
        label = room.nameOrLabel,
        operationalState = roomOperationalState(room.operationalState),
        lifecycle = recordLifecycle(room.recordLifecycle),
    )

    private fun mapOperatorListing(listing: ListingTransport) = OperatorListingCard(
        listingId = listing.id,
        roomId = listing.roomId,
        title = listing.publicTitle,
        visibility = listingVisibility(listing.status),
    )

    private fun mapDashboard(dashboard: DashboardTransport) = DashboardReadModel(
        roomsByState = mapOf(
            RoomOperationalState.VACANT to dashboard.roomsByState.vacant,
            RoomOperationalState.OCCUPIED to dashboard.roomsByState.occupied,
            RoomOperationalState.MAINTENANCE to dashboard.roomsByState.maintenance,
            RoomOperationalState.INACTIVE to dashboard.roomsByState.inactive,
        ),
        activeTenancyCount = dashboard.activeTenancyCount,
        outstandingReceivableLabel = dashboard.outstandingReceivable,
        confirmedPaymentTotalLabel = dashboard.confirmedPaymentTotal,
        openIncidentCount = dashboard.openIncidentCount,
    )

    private fun mapCharge(charge: ChargeTransport) = ChargeCard(
        chargeId = charge.id,
        label = charge.type,
        amountLabel = charge.amount,
        outstandingLabel = null,
    )

    private fun mapPayment(payment: PaymentTransport) = PaymentCard(
        paymentId = payment.id,
        amountLabel = payment.amount,
        confirmationLabel = "${payment.confirmedAt} · ${payment.verification}",
    )

    private fun mapDeposit(deposit: DepositProjectionTransport) = DepositCard(
        tenancyId = deposit.tenancyId,
        requiredLabel = deposit.requirementAmount,
        fundedLabel = deposit.fundedAmount,
        settlementLabel = deposit.settledAmount,
        depositId = deposit.id,
        heldLabel = deposit.heldAmount,
        state = deposit.state,
        blockedByOpenPolicy = deposit.blockedByOpenPolicy,
    )

    private fun mapNotice(notice: TenancyNoticeTransport) = TenancyNoticeCard(
        noticeId = notice.id,
        tenancyId = notice.tenancyId,
        type = notice.noticeType,
        content = notice.contentOrNote,
        issuedAtLabel = notice.issuedAt,
        acknowledgedAtLabel = notice.acknowledgedAt,
    )

    private fun mapNotification(notification: NotificationTransport) = NotificationCard(
        notificationId = notification.id,
        category = notification.category,
        message = notification.messageOrPayloadReference,
        deliveryStatus = notification.deliveryStatus,
        createdAtLabel = notification.createdAt,
        readAtLabel = notification.readAt?.let { value ->
            if (value.isJsonPrimitive) value.asString else value.toString()
        },
        sourceType = notification.sourceType,
        sourceId = notification.sourceId,
    )

    private fun mapIncident(
        incident: IncidentTransport,
        events: List<IncidentEventTransport>,
    ) = IncidentCard(
        incidentId = incident.id,
        roomId = incident.roomId,
        title = incident.category,
        lifecycle = incidentLifecycle(incident.status),
        timeline = events.map(::mapIncidentEvent),
        serverActions = emptyList(),
    )

    private fun mapIncidentEvent(event: IncidentEventTransport) = IncidentEventCard(
        eventId = event.id,
        description = buildString {
            append(event.eventType)
            if (event.fromStatus != null || event.toStatus != null) {
                append(": ")
                append(event.fromStatus ?: "-")
                append(" → ")
                append(event.toStatus ?: "-")
            }
            event.note?.takeIf { it.isNotBlank() }?.let {
                append(" · ")
                append(it)
            }
        },
        occurredAtLabel = event.occurredAt,
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

    private fun <T> ApiOutcome<T>.optionalNotFound(operation: String): T? = when (this) {
        is ApiOutcome.Data -> value
        is ApiOutcome.Failure -> if (httpStatus == 404) null else throw IllegalStateException(
            "$operation thất bại: $kind" + (httpStatus?.let { " (HTTP $it)" } ?: ""),
        )
    }
}
