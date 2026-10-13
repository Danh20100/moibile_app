package com.trooi.app.core.network

import com.trooi.app.core.network.dto.*
import javax.inject.Inject

interface BackendApi {
    suspend fun getPublicListingsRaw(): TransportOutcome
    suspend fun getPublicListings(): ApiOutcome<List<PublicListingTransport>>
    suspend fun searchPublicListings(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        minPrice: String? = null,
        maxPrice: String? = null,
    ): ApiOutcome<List<PublicListingSearchResultTransport>>

    suspend fun authenticateGoogle(idToken: String): ApiOutcome<VerifiedPrincipalTransport>
    suspend fun getSessionContext(): ApiOutcome<SessionContextTransport>
    suspend fun updateOwnDisplayName(displayName: String): ApiOutcome<SessionContextTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun getOrganizations(): ApiOutcome<List<OrganizationTransport>>
    suspend fun getDashboard(organizationId: String): ApiOutcome<DashboardTransport>
    suspend fun getProperties(organizationId: String): ApiOutcome<List<PropertyTransport>>
    suspend fun getRooms(propertyId: String): ApiOutcome<List<RoomTransport>>
    suspend fun transitionRoomOperationalState(id: String, operationalState: String): ApiOutcome<RoomTransport>

    suspend fun getCurrentListing(roomId: String): ApiOutcome<ListingTransport>
    suspend fun publishListing(id: String): ApiOutcome<ListingTransport>
    suspend fun unpublishListing(id: String): ApiOutcome<ListingTransport>
    suspend fun archiveListing(id: String): ApiOutcome<ListingTransport>

    suspend fun getTenancy(id: String): ApiOutcome<TenancyTransport>
    suspend fun getTenancies(roomId: String): ApiOutcome<List<TenancyTransport>>
    suspend fun activateTenancy(id: String, occurredAt: String): ApiOutcome<TenancyTransport>
    suspend fun getTenancyHistory(id: String): ApiOutcome<RentalHistoryTransport>
    suspend fun getRoomHistory(id: String): ApiOutcome<RoomOperationalHistoryTransport>

    suspend fun getTerms(tenancyId: String): ApiOutcome<List<TenancyTermsTransport>>
    suspend fun acknowledgeTerms(
        tenancyId: String,
        termsId: String,
        tenancyParticipantId: String,
        acknowledgedAt: String,
    ): ApiOutcome<TermsAcknowledgementTransport>

    suspend fun getNotices(tenancyId: String): ApiOutcome<List<TenancyNoticeTransport>>
    suspend fun issueNotice(
        tenancyId: String,
        noticeType: String,
        contentOrNote: String,
        issuedAt: String,
    ): ApiOutcome<TenancyNoticeTransport>
    suspend fun acknowledgeNotice(
        tenancyId: String,
        noticeId: String,
        occurredAt: String,
    ): ApiOutcome<TenancyNoticeTransport>

    suspend fun getBillingCycles(tenancyId: String): ApiOutcome<List<BillingCycleTransport>>
    suspend fun getPayment(id: String): ApiOutcome<PaymentTransport>
    suspend fun getPayments(tenancyId: String): ApiOutcome<List<PaymentTransport>>
    suspend fun getReceipts(): ApiOutcome<List<ReceiptTransport>>

    suspend fun createDeposit(tenancyId: String): ApiOutcome<DepositProjectionTransport>
    suspend fun getDeposit(tenancyId: String): ApiOutcome<DepositProjectionTransport>
    suspend fun getDepositEvents(id: String): ApiOutcome<List<DepositEventTransport>>
    suspend fun settleDeposit(
        id: String,
        refundedAmount: String,
        retainedAmount: String,
        reasonOrNote: String,
        settledAt: String,
    ): ApiOutcome<DepositSettlementTransport>

    suspend fun getIncidents(roomId: String): ApiOutcome<List<IncidentTransport>>
    suspend fun getIncidentEvents(id: String): ApiOutcome<List<IncidentEventTransport>>
    suspend fun createInquiry(listingId: String, message: String): ApiOutcome<InquiryTransport>

    suspend fun getNotifications(): ApiOutcome<List<NotificationTransport>>
    suspend fun getNotification(id: String): ApiOutcome<NotificationTransport>
    suspend fun markNotificationRead(id: String): ApiOutcome<NotificationTransport>
}

class OkHttpBackendApi @Inject constructor(private val client: BackendClient) : BackendApi {
    override suspend fun getPublicListingsRaw(): TransportOutcome =
        client.get("listings/public", authenticated = false)

    override suspend fun getPublicListings() =
        client.get("listings/public", authenticated = false).decode(BackendJsonCodec::publicListings)

    override suspend fun searchPublicListings(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        minPrice: String?,
        maxPrice: String?,
    ): ApiOutcome<List<PublicListingSearchResultTransport>> {
        val query = linkedMapOf(
            "latitude" to latitude.toString(),
            "longitude" to longitude.toString(),
            "radiusMeters" to radiusMeters.toString(),
        ).apply {
            minPrice?.let { put("minPrice", it) }
            maxPrice?.let { put("maxPrice", it) }
        }
        return client.get("listings/public/search", authenticated = false, query = query)
            .decode(BackendJsonCodec::publicSearchResults)
    }

    override suspend fun authenticateGoogle(idToken: String) =
        client.postJson(
            "identity-access/auth/google",
            BackendJsonCodec.encodeGoogleToken(idToken),
            authenticated = false,
        ).decode(BackendJsonCodec::verifiedPrincipal)

    override suspend fun getSessionContext() =
        client.get("identity-access/me", authenticated = true).decode(BackendJsonCodec::sessionContext)

    override suspend fun updateOwnDisplayName(displayName: String): ApiOutcome<SessionContextTransport> {
        val payload = com.google.gson.JsonObject().apply { addProperty("displayName", displayName) }
        return when (val result = client.patchJson("identity-access/profile", payload.toString(), authenticated = true)) {
            is TransportOutcome.Success -> getSessionContext()
            is TransportOutcome.Failure -> ApiOutcome.Failure(result.kind, result.httpStatus)
        }
    }

    override suspend fun getOrganizations() =
        client.get("organizations", authenticated = true).decode(BackendJsonCodec::organizations)

    override suspend fun getDashboard(organizationId: String) =
        client.get("organizations/$organizationId/dashboard", authenticated = true)
            .decode(BackendJsonCodec::dashboard)

    override suspend fun getProperties(organizationId: String) =
        client.get("properties", true, mapOf("organizationId" to organizationId))
            .decode(BackendJsonCodec::properties)

    override suspend fun getRooms(propertyId: String) =
        client.get("rooms", true, mapOf("propertyId" to propertyId)).decode(BackendJsonCodec::rooms)

    override suspend fun transitionRoomOperationalState(id: String, operationalState: String) =
        client.postJson(
            "rooms/$id/operational-state",
            BackendJsonCodec.encodeRoomOperationalState(operationalState),
            authenticated = true,
        ).decode(BackendJsonCodec::room)

    override suspend fun getCurrentListing(roomId: String) =
        client.get("listings", true, mapOf("roomId" to roomId)).decode(BackendJsonCodec::listing)

    override suspend fun publishListing(id: String) =
        client.postEmpty("listings/$id/publish", authenticated = true).decode(BackendJsonCodec::listing)

    override suspend fun unpublishListing(id: String) =
        client.postEmpty("listings/$id/unpublish", authenticated = true).decode(BackendJsonCodec::listing)

    override suspend fun archiveListing(id: String) =
        client.postEmpty("listings/$id/archive", authenticated = true).decode(BackendJsonCodec::listing)

    override suspend fun getTenancy(id: String) =
        client.get("tenancies/$id", true).decode(BackendJsonCodec::tenancy)

    override suspend fun getTenancies(roomId: String) =
        client.get("tenancies", true, mapOf("roomId" to roomId)).decode(BackendJsonCodec::tenancies)

    override suspend fun activateTenancy(id: String, occurredAt: String) =
        client.postJson(
            "tenancies/$id/activate",
            BackendJsonCodec.encodeTenancyActivation(occurredAt),
            authenticated = true,
        ).decode(BackendJsonCodec::tenancy)

    override suspend fun getTenancyHistory(id: String) =
        client.get("tenancies/$id/history", true).decode(BackendJsonCodec::rentalHistory)

    override suspend fun getRoomHistory(id: String) =
        client.get("rooms/$id/history", true).decode(BackendJsonCodec::roomHistory)

    override suspend fun getTerms(tenancyId: String) =
        client.get("tenancies/$tenancyId/terms", true).decode(BackendJsonCodec::terms)

    override suspend fun acknowledgeTerms(
        tenancyId: String,
        termsId: String,
        tenancyParticipantId: String,
        acknowledgedAt: String,
    ) = client.postJson(
        "tenancies/$tenancyId/terms/$termsId/acknowledgements",
        BackendJsonCodec.encodeTermsAcknowledgement(tenancyParticipantId, acknowledgedAt),
        authenticated = true,
    ).decode(BackendJsonCodec::termsAcknowledgement)

    override suspend fun getNotices(tenancyId: String) =
        client.get("tenancies/$tenancyId/notices", true).decode(BackendJsonCodec::notices)

    override suspend fun issueNotice(
        tenancyId: String,
        noticeType: String,
        contentOrNote: String,
        issuedAt: String,
    ) = client.postJson(
        "tenancies/$tenancyId/notices",
        BackendJsonCodec.encodeNoticeIssue(noticeType, contentOrNote, issuedAt),
        authenticated = true,
    ).decode(BackendJsonCodec::notice)

    override suspend fun acknowledgeNotice(tenancyId: String, noticeId: String, occurredAt: String) =
        client.postJson(
            "tenancies/$tenancyId/notices/$noticeId/acknowledge",
            BackendJsonCodec.encodeNoticeAcknowledgement(occurredAt),
            authenticated = true,
        ).decode(BackendJsonCodec::notice)

    override suspend fun getBillingCycles(tenancyId: String) =
        client.get("finance/cycles", true, mapOf("tenancyId" to tenancyId))
            .decode(BackendJsonCodec::billingCycles)

    override suspend fun getPayment(id: String) =
        client.get("finance/payments/$id", true).decode(BackendJsonCodec::payment)

    override suspend fun getPayments(tenancyId: String) =
        client.get("finance/payments", true, mapOf("tenancyId" to tenancyId))
            .decode(BackendJsonCodec::payments)

    override suspend fun getReceipts() =
        client.get("receipts", true).decode(BackendJsonCodec::receipts)

    override suspend fun createDeposit(tenancyId: String) =
        client.postJson(
            "finance/deposits",
            BackendJsonCodec.encodeDepositCreate(tenancyId),
            authenticated = true,
        ).decode(BackendJsonCodec::deposit)

    override suspend fun getDeposit(tenancyId: String) =
        client.get("finance/deposits", true, mapOf("tenancyId" to tenancyId))
            .decode(BackendJsonCodec::deposit)

    override suspend fun getDepositEvents(id: String) =
        client.get("finance/deposits/$id/events", true).decode(BackendJsonCodec::depositEvents)

    override suspend fun settleDeposit(
        id: String,
        refundedAmount: String,
        retainedAmount: String,
        reasonOrNote: String,
        settledAt: String,
    ) = client.postJson(
        "finance/deposits/$id/settlements",
        BackendJsonCodec.encodeDepositSettlement(
            refundedAmount = refundedAmount,
            retainedAmount = retainedAmount,
            reasonOrNote = reasonOrNote,
            settledAt = settledAt,
        ),
        authenticated = true,
    ).decode(BackendJsonCodec::depositSettlement)

    override suspend fun getIncidents(roomId: String) =
        client.get("incidents", true, mapOf("roomId" to roomId)).decode(BackendJsonCodec::incidents)

    override suspend fun getIncidentEvents(id: String) =
        client.get("incidents/$id/events", true).decode(BackendJsonCodec::incidentEvents)

    override suspend fun createInquiry(listingId: String, message: String) =
        client.postJson("inquiries", BackendJsonCodec.encodeInquiry(listingId, message), true)
            .decode(BackendJsonCodec::inquiry)

    override suspend fun getNotifications() =
        client.get("notifications", true).decode(BackendJsonCodec::notifications)

    override suspend fun getNotification(id: String) =
        client.get("notifications/$id", true).decode(BackendJsonCodec::notification)

    override suspend fun markNotificationRead(id: String) =
        client.postEmpty("notifications/$id/read", authenticated = true)
            .decode(BackendJsonCodec::notification)

    private inline fun <T> TransportOutcome.decode(parser: (String) -> T): ApiOutcome<T> = when (this) {
        is TransportOutcome.Failure -> ApiOutcome.Failure(kind, httpStatus)
        is TransportOutcome.Success -> try {
            ApiOutcome.Data(parser(BackendJsonCodec.unwrapResponseData(document.rawBody)))
        } catch (_: RuntimeException) {
            ApiOutcome.Failure(ErrorKind.INVALID_RESPONSE, status)
        }
    }
}
