package com.trooi.app.core.network

import com.trooi.app.core.network.dto.*
import javax.inject.Inject

interface BackendApi {
    suspend fun messagingConversations(): ApiOutcome<List<MessagingConversation>> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun messagingMessages(id: String): ApiOutcome<List<MessagingMessage>> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun messagingOpen(type: String, id: String): ApiOutcome<MessagingOpen> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun messagingSend(id: String, text: String, images: List<ByteArray>, expectedToken: String? = null): ApiOutcome<MessagingMessage> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun messagingRead(id: String): ApiOutcome<Unit> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun messagingAttachment(id: String, attachmentId: String): ApiOutcome<MessagingImageBytes> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
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
    suspend fun getSessionContext(expectedToken: String? = null): ApiOutcome<SessionContextTransport>
    suspend fun updateOwnDisplayName(displayName: String): ApiOutcome<SessionContextTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun getOrganizations(): ApiOutcome<List<OrganizationTransport>>
    suspend fun getDashboard(organizationId: String): ApiOutcome<DashboardTransport>
    suspend fun getProperties(organizationId: String, expectedToken: String? = null): ApiOutcome<List<PropertyTransport>>
    suspend fun createProperty(id: String, organizationId: String, name: String, address: String, latitude: Double, longitude: Double, expectedToken: String? = null): ApiOutcome<PropertyTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun updateProperty(id: String, name: String, address: String, expectedToken: String? = null): ApiOutcome<PropertyTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun updatePropertyLocation(id: String, name: String, address: String, latitude: Double, longitude: Double, expectedToken: String? = null): ApiOutcome<PropertyTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun getRooms(propertyId: String, expectedToken: String? = null): ApiOutcome<List<RoomTransport>>
    suspend fun createRoom(id: String, propertyId: String, name: String, expectedToken: String? = null): ApiOutcome<RoomTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun updateRoom(id: String, name: String, expectedToken: String? = null): ApiOutcome<RoomTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun archiveRoom(id: String, expectedToken: String? = null): ApiOutcome<RoomTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun transitionRoomOperationalState(id: String, operationalState: String, expectedToken: String? = null): ApiOutcome<RoomTransport>

    suspend fun getCurrentListing(roomId: String, expectedToken: String? = null): ApiOutcome<ListingTransport>
    suspend fun getListingAssetDetails(id: String, expectedToken: String? = null): ApiOutcome<ListingAssetDetailsTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun saveListingAssetDetails(id: String, details: ListingAssetDetailsTransport, expectedToken: String? = null): ApiOutcome<ListingAssetDetailsTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun getListingAssetMedia(id: String, expectedToken: String? = null): ApiOutcome<List<ListingAssetMediaTransport>> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun uploadListingAssetMedia(id: String, mediaId: String, contentType: String, bytes: ByteArray, expectedToken: String? = null): ApiOutcome<ListingAssetMediaTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun getListingAssetMediaContent(id: String, mediaId: String, expectedToken: String? = null): ApiOutcome<ListingAssetMediaContentTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun setListingAssetMediaPublic(id: String, mediaId: String, isPublic: Boolean, expectedToken: String? = null): ApiOutcome<ListingAssetMediaTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun getPublicListingMediaContent(id: String, mediaId: String): ApiOutcome<ListingAssetMediaContentTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun reorderListingAssetMedia(id: String, mediaIds: List<String>, expectedToken: String? = null): ApiOutcome<List<ListingAssetMediaTransport>> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun removeListingAssetMedia(id: String, mediaId: String, expectedToken: String? = null): ApiOutcome<Unit> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun createListing(id: String, roomId: String, title: String, description: String, price: String, latitude: Double, longitude: Double, expectedToken: String? = null): ApiOutcome<ListingTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun updateListing(id: String, title: String, description: String, price: String, latitude: Double, longitude: Double, expectedToken: String? = null): ApiOutcome<ListingTransport> = ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
    suspend fun publishListing(id: String, expectedToken: String? = null): ApiOutcome<ListingTransport>
    suspend fun unpublishListing(id: String, expectedToken: String? = null): ApiOutcome<ListingTransport>
    suspend fun archiveListing(id: String, expectedToken: String? = null): ApiOutcome<ListingTransport>

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
    private val messagingGson = com.google.gson.Gson()
    override suspend fun messagingConversations() = client.get("messaging/conversations", true).decode {
        messagingGson.fromJson(it, Array<MessagingConversation>::class.java).toList()
    }
    override suspend fun messagingMessages(id: String) = client.get("messaging/conversations/$id/messages", true).decode {
        messagingGson.fromJson(it, Array<MessagingMessage>::class.java).toList()
    }
    override suspend fun messagingOpen(type: String, id: String): ApiOutcome<MessagingOpen> {
        val payload = com.google.gson.JsonObject().apply { addProperty("contextType", type); addProperty("contextId", id) }
        return client.postJson("messaging/conversations", payload.toString(), true).decode { messagingGson.fromJson(it, MessagingOpen::class.java) }
    }
    override suspend fun messagingSend(id: String, text: String, images: List<ByteArray>, expectedToken: String?): ApiOutcome<MessagingMessage> {
        require(images.size <= 5 && images.all { it.size <= 2_000_000 } && text.length <= 4000)
        val payload = com.google.gson.JsonObject().apply {
            addProperty("text", text)
            add("images", com.google.gson.JsonArray().apply { images.forEach { bytes ->
                add(com.google.gson.JsonObject().apply { addProperty("contentType", "image/jpeg")
                    addProperty("base64", java.util.Base64.getEncoder().encodeToString(bytes)) })
            } })
        }
        return client.postJson("messaging/conversations/$id/messages", payload.toString(), true, expectedToken = expectedToken).decode { messagingGson.fromJson(it, MessagingMessage::class.java) }
    }
    override suspend fun messagingRead(id: String) = client.postEmpty("messaging/conversations/$id/read", true).decode { Unit }
    override suspend fun messagingAttachment(id: String, attachmentId: String) =
        client.get("messaging/conversations/$id/attachments/$attachmentId", true).decode { messagingGson.fromJson(it, MessagingImageBytes::class.java) }
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

    override suspend fun getSessionContext(expectedToken: String?) =
        client.get("identity-access/me", authenticated = true, expectedToken = expectedToken).decode(BackendJsonCodec::sessionContext)

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

    override suspend fun getProperties(organizationId: String, expectedToken: String?) =
        client.get("properties", true, mapOf("organizationId" to organizationId), expectedToken)
            .decode(BackendJsonCodec::properties)

    override suspend fun createProperty(id: String, organizationId: String, name: String, address: String, latitude: Double, longitude: Double, expectedToken: String?) =
        client.postJson("properties", BackendJsonCodec.encodeProperty(id, organizationId, name, address, latitude, longitude), true, expectedToken = expectedToken).decode(BackendJsonCodec::property)

    override suspend fun updateProperty(id: String, name: String, address: String, expectedToken: String?) =
        client.patchJson("properties/$id", com.google.gson.JsonObject().apply { addProperty("name", name); addProperty("operationalAddressText", address) }.toString(), true, expectedToken).decode(BackendJsonCodec::property)

    override suspend fun updatePropertyLocation(id: String, name: String, address: String, latitude: Double, longitude: Double, expectedToken: String?) =
        client.patchJson("properties/$id", com.google.gson.JsonObject().apply {
            addProperty("name", name); addProperty("operationalAddressText", address)
            add("operationalLocation", com.google.gson.JsonObject().apply { addProperty("latitude", latitude); addProperty("longitude", longitude) })
            add("publicLocationProjection", com.google.gson.JsonObject().apply { addProperty("latitude", kotlin.math.round(latitude * 100) / 100); addProperty("longitude", kotlin.math.round(longitude * 100) / 100) })
        }.toString(), true, expectedToken).decode(BackendJsonCodec::property)

    override suspend fun getRooms(propertyId: String, expectedToken: String?) =
        client.get("rooms", true, mapOf("propertyId" to propertyId), expectedToken).decode(BackendJsonCodec::rooms)

    override suspend fun createRoom(id: String, propertyId: String, name: String, expectedToken: String?) =
        client.postJson("rooms", BackendJsonCodec.encodeRoom(id, propertyId, name), true, expectedToken = expectedToken).decode(BackendJsonCodec::room)

    override suspend fun updateRoom(id: String, name: String, expectedToken: String?) =
        client.patchJson("rooms/$id", com.google.gson.JsonObject().apply { addProperty("nameOrLabel", name) }.toString(), true, expectedToken).decode(BackendJsonCodec::room)

    override suspend fun archiveRoom(id: String, expectedToken: String?) = client.postEmpty("rooms/$id/archive", true, expectedToken).decode(BackendJsonCodec::room)

    override suspend fun transitionRoomOperationalState(id: String, operationalState: String, expectedToken: String?) =
        client.postJson(
            "rooms/$id/operational-state",
            BackendJsonCodec.encodeRoomOperationalState(operationalState),
            authenticated = true, expectedToken = expectedToken,
        ).decode(BackendJsonCodec::room)

    override suspend fun getCurrentListing(roomId: String, expectedToken: String?) =
        client.get("listings", true, mapOf("roomId" to roomId), expectedToken).decode(BackendJsonCodec::listing)

    override suspend fun getListingAssetDetails(id: String, expectedToken: String?) =
        client.get("listings/$id/asset-details", true, expectedToken = expectedToken).decode(BackendJsonCodec::listingAssetDetails)

    override suspend fun saveListingAssetDetails(id: String, details: ListingAssetDetailsTransport, expectedToken: String?) =
        client.putJson("listings/$id/asset-details", BackendJsonCodec.encodeListingAssetDetails(details), true, expectedToken).decode(BackendJsonCodec::listingAssetDetails)

    override suspend fun getListingAssetMedia(id: String, expectedToken: String?) =
        client.get("listings/$id/media", true, expectedToken = expectedToken).decode { messagingGson.fromJson(it, Array<ListingAssetMediaTransport>::class.java).toList() }

    override suspend fun uploadListingAssetMedia(id: String, mediaId: String, contentType: String, bytes: ByteArray, expectedToken: String?) = run {
        require(contentType in listOf("image/jpeg", "image/png") && bytes.size <= 5 * 1024 * 1024)
        val payload = com.google.gson.JsonObject().apply {
            addProperty("mediaId", mediaId); addProperty("contentType", contentType)
            addProperty("base64", java.util.Base64.getEncoder().encodeToString(bytes))
        }
        client.postJson("listings/$id/media", payload.toString(), true, expectedToken = expectedToken)
            .decode { messagingGson.fromJson(it, ListingAssetMediaTransport::class.java) }
    }

    override suspend fun getListingAssetMediaContent(id: String, mediaId: String, expectedToken: String?) =
        client.get("listings/$id/media/$mediaId/content", true, expectedToken = expectedToken)
            .decode { messagingGson.fromJson(it, ListingAssetMediaContentTransport::class.java) }

    override suspend fun setListingAssetMediaPublic(id: String, mediaId: String, isPublic: Boolean, expectedToken: String?) =
        client.patchJson("listings/$id/media/$mediaId/public", com.google.gson.JsonObject().apply {
            addProperty("isPublic", isPublic)
        }.toString(), true, expectedToken).decode { messagingGson.fromJson(it, ListingAssetMediaTransport::class.java) }

    override suspend fun getPublicListingMediaContent(id: String, mediaId: String) =
        client.get("listings/public/$id/media/$mediaId/content", authenticated = false)
            .decode { messagingGson.fromJson(it, ListingAssetMediaContentTransport::class.java) }

    override suspend fun reorderListingAssetMedia(id: String, mediaIds: List<String>, expectedToken: String?) =
        client.patchJson("listings/$id/media/order", com.google.gson.JsonObject().apply {
            add("mediaIds", com.google.gson.JsonArray().apply { mediaIds.forEach(::add) })
        }.toString(), true, expectedToken).decode { messagingGson.fromJson(it, Array<ListingAssetMediaTransport>::class.java).toList() }

    override suspend fun removeListingAssetMedia(id: String, mediaId: String, expectedToken: String?) =
        client.delete("listings/$id/media/$mediaId", true, expectedToken).decode { Unit }

    override suspend fun createListing(id: String, roomId: String, title: String, description: String, price: String, latitude: Double, longitude: Double, expectedToken: String?) =
        client.postJson("listings", BackendJsonCodec.encodeListing(id, roomId, title, description, price, latitude, longitude), true, expectedToken = expectedToken).decode(BackendJsonCodec::listing)

    override suspend fun updateListing(id: String, title: String, description: String, price: String, latitude: Double, longitude: Double, expectedToken: String?) =
        client.patchJson("listings/$id", BackendJsonCodec.encodeListingUpdate(title, description, price, latitude, longitude), true, expectedToken).decode(BackendJsonCodec::listing)

    override suspend fun publishListing(id: String, expectedToken: String?) =
        client.postEmpty("listings/$id/publish", authenticated = true, expectedToken = expectedToken).decode(BackendJsonCodec::listing)

    override suspend fun unpublishListing(id: String, expectedToken: String?) =
        client.postEmpty("listings/$id/unpublish", authenticated = true, expectedToken = expectedToken).decode(BackendJsonCodec::listing)

    override suspend fun archiveListing(id: String, expectedToken: String?) =
        client.postEmpty("listings/$id/archive", authenticated = true, expectedToken = expectedToken).decode(BackendJsonCodec::listing)

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
