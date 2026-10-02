package com.trooi.app.core.network

import com.trooi.app.core.network.dto.*
import javax.inject.Inject

interface BackendApi {
    suspend fun getPublicListingsRaw(): TransportOutcome
    suspend fun getPublicListings(): ApiOutcome<List<PublicListingTransport>>
    suspend fun authenticateGoogle(idToken: String): ApiOutcome<VerifiedPrincipalTransport>
    suspend fun getSessionContext(): ApiOutcome<SessionContextTransport>
    suspend fun getOrganizations(): ApiOutcome<List<OrganizationTransport>>
    suspend fun getProperties(organizationId: String): ApiOutcome<List<PropertyTransport>>
    suspend fun getRooms(propertyId: String): ApiOutcome<List<RoomTransport>>
    suspend fun getTenancy(id: String): ApiOutcome<TenancyTransport>
    suspend fun getTenancies(roomId: String): ApiOutcome<List<TenancyTransport>>
    suspend fun getTerms(tenancyId: String): ApiOutcome<List<TenancyTermsTransport>>
    suspend fun getNotices(tenancyId: String): ApiOutcome<List<TenancyNoticeTransport>>
    suspend fun getBillingCycles(tenancyId: String): ApiOutcome<List<BillingCycleTransport>>
    suspend fun getPayment(id: String): ApiOutcome<PaymentTransport>
    suspend fun getReceipts(): ApiOutcome<List<ReceiptTransport>>
    suspend fun getIncidents(roomId: String): ApiOutcome<List<IncidentTransport>>
    suspend fun createInquiry(listingId: String, message: String): ApiOutcome<InquiryTransport>
}

class OkHttpBackendApi @Inject constructor(private val client: BackendClient) : BackendApi {
    override suspend fun getPublicListingsRaw(): TransportOutcome =
        client.get("listings/public", authenticated = false)

    override suspend fun getPublicListings() =
        client.get("listings/public").decode(BackendJsonCodec::publicListings)

    override suspend fun authenticateGoogle(idToken: String) =
        client.postJson(
            "identity-access/auth/google",
            BackendJsonCodec.encodeGoogleToken(idToken),
            authenticated = false,
        ).decode(BackendJsonCodec::verifiedPrincipal)

    override suspend fun getSessionContext() =
        client.get("identity-access/me", authenticated = true).decode(BackendJsonCodec::sessionContext)

    override suspend fun getOrganizations() =
        client.get("organizations", authenticated = true).decode(BackendJsonCodec::organizations)

    override suspend fun getProperties(organizationId: String) =
        client.get("properties", true, mapOf("organizationId" to organizationId)).decode(BackendJsonCodec::properties)

    override suspend fun getRooms(propertyId: String) =
        client.get("rooms", true, mapOf("propertyId" to propertyId)).decode(BackendJsonCodec::rooms)

    override suspend fun getTenancy(id: String) =
        client.get("tenancies/$id", true).decode(BackendJsonCodec::tenancy)

    override suspend fun getTenancies(roomId: String) =
        client.get("tenancies", true, mapOf("roomId" to roomId)).decode(BackendJsonCodec::tenancies)

    override suspend fun getTerms(tenancyId: String) =
        client.get("tenancies/$tenancyId/terms", true).decode(BackendJsonCodec::terms)

    override suspend fun getNotices(tenancyId: String) =
        client.get("tenancies/$tenancyId/notices", true).decode(BackendJsonCodec::notices)

    override suspend fun getBillingCycles(tenancyId: String) =
        client.get("finance/cycles", true, mapOf("tenancyId" to tenancyId)).decode(BackendJsonCodec::billingCycles)

    override suspend fun getPayment(id: String) =
        client.get("finance/payments/$id", true).decode(BackendJsonCodec::payment)

    override suspend fun getReceipts() =
        client.get("receipts", true).decode(BackendJsonCodec::receipts)

    override suspend fun getIncidents(roomId: String) =
        client.get("incidents", true, mapOf("roomId" to roomId)).decode(BackendJsonCodec::incidents)

    override suspend fun createInquiry(listingId: String, message: String) =
        client.postJson("inquiries", BackendJsonCodec.encodeInquiry(listingId, message), true)
            .decode(BackendJsonCodec::inquiry)

    private inline fun <T> TransportOutcome.decode(parser: (String) -> T): ApiOutcome<T> = when (this) {
        is TransportOutcome.Failure -> ApiOutcome.Failure(kind, httpStatus)
        is TransportOutcome.Success -> try {
            ApiOutcome.Data(parser(BackendJsonCodec.unwrapResponseData(document.rawBody)))
        } catch (_: RuntimeException) {
            ApiOutcome.Failure(ErrorKind.INVALID_RESPONSE, status)
        }
    }
}
