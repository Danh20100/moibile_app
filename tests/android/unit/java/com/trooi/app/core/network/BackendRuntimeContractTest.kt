package com.trooi.app.core.network

import com.trooi.app.core.data.BackendTroOiRepository
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.IncidentLifecycle
import com.trooi.app.core.model.ListingVisibility
import com.trooi.app.core.model.LocalRentalAsset
import com.trooi.app.core.network.dto.*
import java.net.InetAddress
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class BackendRuntimeContractTest {
    private fun localUrl(server: MockWebServer) =
        server.url("/").newBuilder().host("127.0.0.1").build().toString()

    @Test fun organizationReauthenticationUsesAuthenticatedChallengeAndNonceProofRequests() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("""{"nonce":"challenge-nonce","expiresAt":"2026-10-15T00:05:00Z"}"""))
            server.enqueue(MockResponse().setBody("""{"proof":"opaque-server-proof","expiresAt":"2026-10-15T00:05:00Z"}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("app-access-token") }
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true))
            assertEquals("challenge-nonce", api.issueOrganizationCreateReauthChallenge().requireData().nonce)
            assertEquals("opaque-server-proof", api.completeOrganizationCreateReauth("google-id-token", "challenge-nonce")
                .requireData().proof)
            val challenge = server.takeRequest()
            assertEquals("/api/v1/identity-access/reauth/organization-create/challenge", challenge.path)
            assertEquals("Bearer app-access-token", challenge.getHeader("Authorization"))
            val proof = server.takeRequest()
            assertEquals("/api/v1/identity-access/reauth/organization-create/proof", proof.path)
            assertEquals("Bearer app-access-token", proof.getHeader("Authorization"))
            assertTrue(proof.body.readUtf8().contains("challenge-nonce"))
        }
    }

    @Test fun rejectedPasswordReauthenticationNeverClearsValidLoginSession() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(403).setBody("{}"))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("valid-existing-token") }
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true))
            val result = api.completeOrganizationCreatePasswordReauth("wrong-password", "fresh-nonce")
            assertTrue(result is ApiOutcome.Failure)
            assertEquals(403, (result as ApiOutcome.Failure).httpStatus)
            assertEquals("valid-existing-token", tokens.token())
            val request = server.takeRequest()
            assertEquals("/api/v1/identity-access/reauth/organization-create/password", request.path)
            assertEquals("Bearer valid-existing-token", request.getHeader("Authorization"))
            val payload = request.body.readUtf8()
            assertTrue(payload.contains("fresh-nonce"))
            assertTrue(payload.contains("wrong-password"))
        }
    }

    @Test fun publicListingTimeoutRetriesOnceThenRepositoryReturnsNetworkUnavailable() = runBlocking {
        MockWebServer().use { server ->
            repeat(2) { server.enqueue(MockResponse().setHeadersDelay(250, TimeUnit.MILLISECONDS).setBody("{}")) }
            server.start(InetAddress.getLoopbackAddress(), 0)
            val client = OkHttpClient.Builder()
                .readTimeout(50, TimeUnit.MILLISECONDS)
                .retryOnConnectionFailure(false)
                .build()
            val tokens = InMemoryAuthTokenProvider()
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true, client))
            val repository = BackendTroOiRepository(api, tokens)

            val result = repository.refreshPublicListings()

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull()?.message.orEmpty().contains("NETWORK_UNAVAILABLE"))
            assertEquals(2, server.requestCount)
        }
    }

    @Test fun assetPhotoTransportUsesAuthenticatedUploadReadOrderAndRemoveRoutes() = runBlocking {
        MockWebServer().use { server ->
            val id = "93000000-0000-4000-8000-000000000001"
            val row = """{"id":"$id","contentType":"image/png","byteSize":4,"position":0,"createdAt":"2026-10-14T00:00:00.000Z"}"""
            server.enqueue(MockResponse().setResponseCode(201).setBody("""{"success":true,"data":$row}"""))
            server.enqueue(MockResponse().setBody("""{"success":true,"data":[$row]}"""))
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"contentType":"image/png","base64":"AQIDBA=="}}"""))
            server.enqueue(MockResponse().setBody("""{"success":true,"data":[$row]}"""))
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"removed":true}}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("owner-token") }
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true))
            assertEquals(id, api.uploadListingAssetMedia("listing-1", id, "image/png", byteArrayOf(1, 2, 3, 4)).requireData().id)
            assertEquals(id, api.getListingAssetMedia("listing-1").requireData().single().id)
            assertEquals("AQIDBA==", api.getListingAssetMediaContent("listing-1", id).requireData().base64)
            assertEquals(id, api.reorderListingAssetMedia("listing-1", listOf(id)).requireData().single().id)
            assertNotNull(api.removeListingAssetMedia("listing-1", id).requireData())
            val upload = server.takeRequest()
            assertEquals("POST", upload.method); assertEquals("/api/v1/listings/listing-1/media", upload.path)
            assertEquals("Bearer owner-token", upload.getHeader("Authorization")); assertTrue(upload.body.readUtf8().contains("AQIDBA=="))
            assertEquals("/api/v1/listings/listing-1/media", server.takeRequest().path)
            assertEquals("/api/v1/listings/listing-1/media/$id/content", server.takeRequest().path)
            val reorder = server.takeRequest(); assertEquals("PATCH", reorder.method); assertTrue(reorder.body.readUtf8().contains(id))
            val remove = server.takeRequest(); assertEquals("DELETE", remove.method); assertEquals("/api/v1/listings/listing-1/media/$id", remove.path)
        }
    }

    @Test fun privateProfileAvatarTransportUsesOnlyTheAuthenticatedSelfRoute() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(201).setBody(
                """{"success":true,"data":{"contentType":"image/jpeg","byteSize":4,"updatedAt":"2026-10-14T00:00:00.000Z"}}""",
            ))
            server.enqueue(MockResponse().setBody(
                """{"success":true,"data":{"contentType":"image/jpeg","byteSize":4,"updatedAt":"2026-10-14T00:00:00.000Z","base64":"AQIDBA=="}}""",
            ))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("owner-token") }
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true))

            assertEquals(4, api.uploadOwnAvatar("image/jpeg", byteArrayOf(1, 2, 3, 4), "owner-token").requireData().byteSize)
            assertEquals("AQIDBA==", api.getOwnAvatar("owner-token").requireData().base64)

            val upload = server.takeRequest()
            assertEquals("POST", upload.method)
            assertEquals("/api/v1/identity-access/profile/avatar", upload.path)
            assertEquals("Bearer owner-token", upload.getHeader("Authorization"))
            val requestBody = com.google.gson.JsonParser.parseString(upload.body.readUtf8()).asJsonObject
            assertEquals("image/jpeg", requestBody.get("contentType").asString)
            assertEquals("AQIDBA==", requestBody.get("base64").asString)
            assertFalse("The client cannot select an avatar owner", requestBody.has("userId"))

            val read = server.takeRequest()
            assertEquals("GET", read.method)
            assertEquals("/api/v1/identity-access/profile/avatar", read.path)
            assertEquals("Bearer owner-token", read.getHeader("Authorization"))
        }
    }

    @Test fun publicListingMapsOnlyPublishedPublicProjection() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(
                MockResponse().setBody(
                    """{"success":true,"data":$PUBLISHED_LISTING_JSON,"timestamp":"2026-10-02T00:00:00.000Z"}""",
                ),
            )
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider()
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true))
            val repository = BackendTroOiRepository(api, tokens)

            val listings = repository.refreshPublicListings().getOrThrow()
            assertEquals(1, listings.size)
            assertEquals("listing-1", listings.single().listingId)
            assertEquals(ListingVisibility.PUBLISHED, listings.single().visibility)
            assertEquals(10.77, listings.single().publicGeoPoint?.latitude ?: 0.0, 0.0001)
            assertFalse(listings.single().toString().contains("SECRET"))
            val request = server.takeRequest()
            assertEquals("/api/v1/listings/public", request.path)
            assertNull(request.getHeader("Authorization"))
        }
    }

    @Test fun googleAuthThenSessionUsesSameBearerCredential() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody(IDENTITY_SESSION_JSON))
            server.enqueue(MockResponse().setBody(SESSION_JSON))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider()
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true))

            val issued = api.authenticateGoogle("google-id-token", "request-nonce").requireData()
            tokens.setToken(issued.accessToken)
            val session = api.getSessionContext().requireData()
            assertEquals(setOf("org-1"), session.operatedOrganizationIds.toSet())
            assertEquals(setOf("tenancy-1"), session.linkedTenancyIds.toSet())

            val authRequest = server.takeRequest()
            assertEquals("/api/v1/identity-access/auth/google", authRequest.path)
            assertNull(authRequest.getHeader("Authorization"))
            val authBody = authRequest.body.readUtf8()
            assertTrue(authBody.contains("google-id-token"))
            assertTrue(authBody.contains("request-nonce"))
            assertEquals("Bearer app-access-token", server.takeRequest().getHeader("Authorization"))
        }
    }

    @Test fun googleRegistrationUsesTheExplicitPublicRegistrationRoute() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody(IDENTITY_SESSION_JSON))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = OkHttpBackendApi(BackendClient(localUrl(server), InMemoryAuthTokenProvider(), true))

            api.registerGoogle("verified-google-id-token", "registration-nonce").requireData()

            val request = server.takeRequest()
            assertEquals("/api/v1/identity-access/register/google", request.path)
            assertNull(request.getHeader("Authorization"))
            val body = request.body.readUtf8()
            assertTrue(body.contains("verified-google-id-token"))
            assertTrue(body.contains("registration-nonce"))
        }
    }

    @Test fun ledgerRequestRejectsAChangedAccountTokenBeforeSending() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("{}"))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("account-b-token") }
            val client = BackendClient(localUrl(server), tokens, true)

            assertEquals(ErrorKind.AUTH_EXPIRED, (client.get("properties", true, expectedToken = "account-a-token") as TransportOutcome.Failure).kind)
            assertEquals(0, server.requestCount)
            assertTrue(client.get("properties", true, expectedToken = "account-b-token") is TransportOutcome.Success)
            assertEquals("Bearer account-b-token", server.takeRequest().getHeader("Authorization"))
        }
    }

    @Test fun propertyRequestKeepsExactPrivateCoordinatesOutOfThePublicProjection() {
        val body = com.google.gson.JsonParser.parseString(
            BackendJsonCodec.encodeProperty("property-id", "org-id", "House", "Private street", 10.7777, 106.6888),
        ).asJsonObject
        assertEquals(10.7777, body.getAsJsonObject("operationalLocation").get("latitude").asDouble, 0.00001)
        assertEquals(10.78, body.getAsJsonObject("publicLocationProjection").get("latitude").asDouble, 0.00001)
        assertEquals(106.69, body.getAsJsonObject("publicLocationProjection").get("longitude").asDouble, 0.00001)
    }

    @Test fun assetDetailsUseAuthenticatedPutAndPreserveTypedWizardFields() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"listingId":"listing-1","managementStatus":"DRAFT","assetType":"Phòng trọ","publicAreaLabel":"Quận 3","areaSquareMeters":"24.50","advertisedDeposit":"3000000.00","bedrooms":1,"bathrooms":1,"furnishing":"Đầy đủ","amenityIds":["wifi"],"rules":["Không hút thuốc"],"electricityOffer":"4000/kWh","waterOffer":null,"serviceOffer":null,"minimumTermMonths":6,"availableFrom":"2026-11-01","bathroomArrangement":"PRIVATE","maxOccupants":2,"floorLabel":"2"}}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("owner-token") }
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true))
            val result = api.saveListingAssetDetails("listing-1", ListingAssetDetailsTransport(
                listingId = "listing-1", managementStatus = "DRAFT", assetType = "Phòng trọ",
                publicAreaLabel = "Quận 3", areaSquareMeters = "24.50", advertisedDeposit = "3000000.00",
                bedrooms = 1, bathrooms = 1, furnishing = "Đầy đủ", amenityIds = listOf("wifi"),
                rules = listOf("Không hút thuốc"), electricityOffer = "4000/kWh", waterOffer = null,
                serviceOffer = null, minimumTermMonths = 6, availableFrom = "2026-11-01",
                bathroomArrangement = "PRIVATE", maxOccupants = 2, floorLabel = "2",
            ))
            assertEquals("24.50", result.requireData().areaSquareMeters)
            val request = server.takeRequest()
            assertEquals("PUT", request.method)
            assertEquals("/api/v1/listings/listing-1/asset-details", request.path)
            assertEquals("Bearer owner-token", request.getHeader("Authorization"))
            assertTrue(request.body.readUtf8().contains("\"amenityIds\":[\"wifi\"]"))
        }
    }

    @Test fun failedSessionContextClearsGoogleCredential() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody(IDENTITY_SESSION_JSON))
            server.enqueue(MockResponse().setResponseCode(401))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider()
            val repository = BackendTroOiRepository(
                OkHttpBackendApi(BackendClient(localUrl(server), tokens, true)),
                tokens,
            )

            val result = repository.authenticateWithGoogleIdToken("expired-after-verify", "nonce")
            assertTrue(result.isFailure)
            assertNull(tokens.token())
            assertNull(server.takeRequest().getHeader("Authorization"))
            assertEquals("Bearer app-access-token", server.takeRequest().getHeader("Authorization"))
        }
    }

    @Test fun inquiryUsesBearerAndNeverSendsClientSenderAuthority() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(201).setBody(INQUIRY_JSON))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("google-id-token") }
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true))

            val inquiry = api.createInquiry("listing-1", "Cho mình xem phòng").requireData()
            assertEquals("inquiry-1", inquiry.id)
            val request = server.takeRequest()
            assertEquals("/api/v1/inquiries", request.path)
            assertEquals("Bearer google-id-token", request.getHeader("Authorization"))
            val body = request.body.readUtf8()
            assertTrue(body.contains("listing-1"))
            assertTrue(body.contains("Cho mình xem phòng"))
            assertFalse(body.contains("senderUserId"))
            assertFalse(body.contains("booking", ignoreCase = true))
        }
    }

    @Test fun backendRepositoryAuthMapsRelationshipCapabilities() = runBlocking {
        val api = FakeRuntimeApi()
        val tokens = InMemoryAuthTokenProvider()
        val repository = BackendTroOiRepository(api, tokens)

        val session = repository.authenticateWithGoogleIdToken("id-token", "nonce").getOrThrow()
        assertEquals(setOf("org-1"), session.access.operatedOrganizationIds)
        assertEquals(setOf("tenancy-1"), session.access.linkedTenancyIds)
        assertEquals("Nguyen A", session.displayName)
        assertEquals("app-access-token", tokens.token())
        val read = repository.refreshAuthorizedRead(session.access).getOrThrow()
        assertEquals(1, read.publicListings.size)
        assertEquals(ListingVisibility.PUBLISHED, read.publicListings.single().visibility)
        assertEquals(setOf("tenancy-1"), read.tenancies.map { it.tenancyId }.toSet())
        assertEquals(setOf("org-1"), read.organizations.map { it.organizationId }.toSet())
        assertEquals(setOf("prop-1"), read.properties.map { it.propertyId }.toSet())
        assertEquals(setOf("room-1"), read.operationalRooms.map { it.roomId }.toSet())
        assertEquals(1, read.noticesByTenancy["tenancy-1"]?.size)
        assertEquals(1, read.tenantFinanceByTenancy["tenancy-1"]?.receipts?.size)
        assertEquals(
            "2026-09-30T01:00:00.000Z \u00B7 ISSUED",
            read.tenantFinanceByTenancy["tenancy-1"]?.receipts?.single()?.issuedAtLabel,
        )
        assertTrue(read.operatorListings.isEmpty())
        assertEquals(1, read.tenantFinanceByTenancy["tenancy-1"]?.payments?.size)
        val deposit = read.tenantFinanceByTenancy["tenancy-1"]?.deposits?.single()
        assertTrue(deposit?.blockedByOpenPolicy == true)
        assertNull(deposit?.requiredLabel)
        val dashboard = read.dashboardByOrganization["org-1"]
        assertEquals(1, dashboard?.activeTenancyCount)
        assertNull(dashboard?.outstandingReceivableLabel)
        assertNull(dashboard?.confirmedPaymentTotalLabel)
    }

    @Test fun authoritativeOperatorListingAndIncidentTimelinePreserveBackendScopeAndOrder() = runBlocking {
        val incident = IncidentTransport(
            id = "incident-1",
            roomId = "room-1",
            reportedByUserId = null,
            category = "PLUMBING",
            status = "ACKNOWLEDGED",
            closureReason = null,
            createdAt = "2026-10-03T01:00:00Z",
            closedAt = null,
        )
        val events = listOf(
            IncidentEventTransport(
                id = "event-2",
                incidentId = "incident-1",
                eventType = "STATUS_CHANGED",
                actorUserId = null,
                note = "Đã tiếp nhận",
                attachmentReference = null,
                fromStatus = "REPORTED",
                toStatus = "ACKNOWLEDGED",
                occurredAt = "2026-10-03T03:00:00Z",
            ),
            IncidentEventTransport(
                id = "event-1",
                incidentId = "incident-1",
                eventType = "REPORTED",
                actorUserId = null,
                note = null,
                attachmentReference = null,
                fromStatus = null,
                toStatus = null,
                occurredAt = "2026-10-03T02:00:00Z",
            ),
        )
        val api = FakeRuntimeApi(
            currentListing = ListingTransport(
                id = "listing-1",
                roomId = "room-1",
                status = "draft",
                publicTitle = "P101",
                publicDescription = "Draft",
                publicPriceProjection = "3500000.00",
                publicLocation = PublicLocationTransport(10.77, 106.69),
            ),
            incidentRows = listOf(incident),
            incidentEventRows = mapOf("incident-1" to events),
        )
        val repository = BackendTroOiRepository(api, InMemoryAuthTokenProvider().apply { setToken("owner-token") })

        val read = repository.refreshAuthorizedRead(
            AccessCapabilities(operatedOrganizationIds = setOf("org-1")),
        ).getOrThrow()

        assertEquals(listOf("listing-1"), read.operatorListings.map { it.listingId })
        assertEquals(ListingVisibility.DRAFT, read.operatorListings.single().visibility)
        assertEquals(listOf("event-2", "event-1"), read.incidents.single().timeline.map { it.eventId })
        assertEquals(IncidentLifecycle.ACKNOWLEDGED, read.incidents.single().lifecycle)
        assertTrue(read.properties.none { it.organizationId == "org-foreign" })
        assertTrue(read.operationalRooms.none { it.roomId == "room-foreign" })
    }

    @Test fun financeFailuresRetainRoomAndTenancyReadbackWithVisibleRetryState() = runBlocking {
        val api = FakeRuntimeApi(financeFails = true)
        val repository = BackendTroOiRepository(api, InMemoryAuthTokenProvider().apply { setToken("owner-token") })
        val read = repository.refreshAuthorizedRead(AccessCapabilities(
            linkedTenancyIds = setOf("tenancy-1"), operatedOrganizationIds = setOf("org-1"),
        )).getOrThrow()
        assertEquals(setOf("room-1"), read.operationalRooms.map { it.roomId }.toSet())
        assertEquals(setOf("tenancy-1"), read.tenancies.map { it.tenancyId }.toSet())
        assertTrue(read.recoverableReadErrors.isNotEmpty())
        assertTrue(read.tenantFinanceByTenancy.containsKey("tenancy-1"))
    }

    private class FakeRuntimeApi(
        private val currentListing: ListingTransport? = null,
        private val incidentRows: List<IncidentTransport> = emptyList(),
        private val incidentEventRows: Map<String, List<IncidentEventTransport>> = emptyMap(),
        private val financeFails: Boolean = false,
    ) : BackendApi {
        private fun <T> unsupported(): ApiOutcome<T> = throw UnsupportedOperationException()

        override suspend fun searchPublicListings(
            latitude: Double,
            longitude: Double,
            radiusMeters: Double,
            minPrice: String?,
            maxPrice: String?,
        ) = unsupported<List<PublicListingSearchResultTransport>>()
        override suspend fun getDashboard(organizationId: String) = ApiOutcome.Data(
            DashboardTransport(
                organizationId = organizationId,
                roomsByState = DashboardRoomStateCountsTransport(0, 1, 0, 0),
                activeTenancyCount = 1,
                outstandingReceivable = null,
                confirmedPaymentTotal = null,
                openIncidentCount = 0,
            ),
        )
        override suspend fun transitionRoomOperationalState(id: String, operationalState: String, expectedToken: String?) =
            unsupported<RoomTransport>()
        override suspend fun getCurrentListing(roomId: String, expectedToken: String?): ApiOutcome<ListingTransport> =
            currentListing?.takeIf { it.roomId == roomId }?.let { ApiOutcome.Data(it) }
                ?: ApiOutcome.Failure(ErrorKind.HTTP_ERROR, 404)
        override suspend fun getListingAssetDetails(id: String, expectedToken: String?) =
            ApiOutcome.Failure(ErrorKind.HTTP_ERROR, 404)
        override suspend fun getListingAssetMedia(id: String, expectedToken: String?) =
            ApiOutcome.Data(emptyList<ListingAssetMediaTransport>())
        override suspend fun publishListing(id: String, expectedToken: String?) = unsupported<ListingTransport>()
        override suspend fun unpublishListing(id: String, expectedToken: String?) = unsupported<ListingTransport>()
        override suspend fun archiveListing(id: String, expectedToken: String?) = unsupported<ListingTransport>()
        override suspend fun activateTenancy(id: String, occurredAt: String) = unsupported<TenancyTransport>()
        override suspend fun getTenancyHistory(id: String) = unsupported<RentalHistoryTransport>()
        override suspend fun getRoomHistory(id: String) = unsupported<RoomOperationalHistoryTransport>()
        override suspend fun acknowledgeTerms(
            tenancyId: String,
            termsId: String,
            tenancyParticipantId: String,
            acknowledgedAt: String,
        ) = unsupported<TermsAcknowledgementTransport>()
        override suspend fun issueNotice(
            tenancyId: String,
            noticeType: String,
            contentOrNote: String,
            issuedAt: String,
        ) = unsupported<TenancyNoticeTransport>()
        override suspend fun acknowledgeNotice(tenancyId: String, noticeId: String, occurredAt: String) =
            unsupported<TenancyNoticeTransport>()
        override suspend fun getPayments(tenancyId: String) = if (financeFails) ApiOutcome.Failure(ErrorKind.HTTP_ERROR, 503) else ApiOutcome.Data(
            listOf(
                PaymentTransport(
                    "payment-1",
                    tenancyId,
                    "3500000.00",
                    "MANUAL_TRANSFER",
                    "USER_RECORDED",
                    "2026-09-30T00:00:00.000Z",
                ),
            ),
        )
        override suspend fun createDeposit(tenancyId: String) = unsupported<DepositProjectionTransport>()
        override suspend fun getDeposit(tenancyId: String) = if (financeFails) ApiOutcome.Failure(ErrorKind.HTTP_ERROR, 503) else ApiOutcome.Data(
            DepositProjectionTransport(
                id = "deposit-1",
                tenancyId = tenancyId,
                requirementAmount = null,
                fundedAmount = "0.00",
                settledAmount = "0.00",
                heldAmount = "0.00",
                state = null,
                blockedByOpenPolicy = true,
            ),
        )
        override suspend fun getDepositEvents(id: String) = unsupported<List<DepositEventTransport>>()
        override suspend fun settleDeposit(
            id: String,
            refundedAmount: String,
            retainedAmount: String,
            reasonOrNote: String,
            settledAt: String,
        ) = unsupported<DepositSettlementTransport>()
        override suspend fun getIncidentEvents(id: String) = ApiOutcome.Data(incidentEventRows[id].orEmpty())
        override suspend fun getNotifications() = ApiOutcome.Data(emptyList<NotificationTransport>())
        override suspend fun getNotification(id: String) = unsupported<NotificationTransport>()
        override suspend fun markNotificationRead(id: String) = unsupported<NotificationTransport>()

        override suspend fun getPublicListings() = ApiOutcome.Data(
            listOf(PublicListingTransport("listing-1", "room-1", "published", "Phòng sáng", "Mô tả", "3500000.00", PublicLocationTransport(10.77, 106.69))),
        )
        override suspend fun getPublicListingsRaw() = throw UnsupportedOperationException()
        override suspend fun authenticateGoogle(idToken: String, nonce: String) = ApiOutcome.Data(
            IdentitySessionTransport("user-1", "session-1", "app-access-token", "refresh-token", "Bearer", 900, "2027-01-01T00:00:00Z"),
        )
        override suspend fun getSessionContext(expectedToken: String?) = ApiOutcome.Data(
            SessionContextTransport("user-1", listOf("org-1"), listOf("tenancy-1"), "a@b.com", "Nguyen A", null),
        )
        override suspend fun getOrganizations() = ApiOutcome.Data(
            listOf(
                OrganizationTransport("org-1", "Org 1", "user-1"),
                OrganizationTransport("org-foreign", "Foreign", "other-user"),
            ),
        )
        override suspend fun getProperties(organizationId: String, expectedToken: String?) = ApiOutcome.Data(
            listOf(
                PropertyTransport("prop-1", "org-1", "Property 1", "active"),
                PropertyTransport("prop-foreign", "org-foreign", "Foreign", "active"),
            ),
        )
        override suspend fun getRooms(propertyId: String, expectedToken: String?) = ApiOutcome.Data(
            listOf(
                RoomTransport("room-1", "prop-1", "P101", "occupied", "active"),
                RoomTransport("room-foreign", "prop-foreign", "X", "vacant", "active"),
            ),
        )
        override suspend fun getTenancy(id: String) = ApiOutcome.Data(TenancyTransport(id, "room-tenant", "ended", null, null, null))
        override suspend fun getTenancies(roomId: String) = ApiOutcome.Data(emptyList<TenancyTransport>())
        override suspend fun getTerms(tenancyId: String) = ApiOutcome.Data(emptyList<TenancyTermsTransport>())
        override suspend fun getNotices(tenancyId: String) = ApiOutcome.Data(
            listOf(
                TenancyNoticeTransport(
                    "notice-1",
                    tenancyId,
                    "MOVE_OUT",
                    "user-1",
                    "Notice content",
                    "2026-09-30T00:00:00.000Z",
                    null,
                    null,
                ),
            ),
        )
        override suspend fun getBillingCycles(tenancyId: String) = if (financeFails) ApiOutcome.Failure(ErrorKind.HTTP_ERROR, 503) else ApiOutcome.Data(emptyList<BillingCycleTransport>())
        override suspend fun getPayment(id: String) = ApiOutcome.Data(
            PaymentTransport(id, "tenancy-1", "3500000.00", "MANUAL_TRANSFER", "USER_RECORDED", "2026-09-30T00:00:00.000Z"),
        )
        override suspend fun getReceipts() = if (financeFails) ApiOutcome.Failure(ErrorKind.HTTP_ERROR, 503) else ApiOutcome.Data(
            listOf(ReceiptTransport("receipt-1", "payment-1", "ISSUED", "2026-09-30T01:00:00.000Z", null, null)),
        )
        override suspend fun getIncidents(roomId: String) = ApiOutcome.Data(
            incidentRows.filter { it.roomId == roomId },
        )
        override suspend fun createInquiry(listingId: String, message: String) = ApiOutcome.Data(
            InquiryTransport("inquiry-1", listingId, "user-1", message, "NEW", "2026-09-30T00:00:00.000Z"),
        )
    }

    private fun <T> ApiOutcome<T>.requireData(): T = when (this) {
        is ApiOutcome.Data -> value
        is ApiOutcome.Failure -> error("Unexpected failure: $kind/$httpStatus")
    }

    private companion object {
        const val PUBLISHED_LISTING_JSON = """[{"id":"listing-1","roomId":"room-1","status":"published","publicTitle":"Ph\u00f2ng s\u00e1ng","publicDescription":"M\u00f4 t\u1ea3","publicPriceProjection":"3500000.00","publicLocationProjection":{"latitude":10.77,"longitude":106.69},"operationalAddressText":"SECRET"},{"id":"listing-2","roomId":"room-2","status":"draft","publicTitle":"Draft","publicDescription":"Hidden","publicPriceProjection":"1.00","publicLocationProjection":{"latitude":10.0,"longitude":106.0}}]"""
        const val IDENTITY_SESSION_JSON = """{"userId":"user-1","sessionId":"session-1","accessToken":"app-access-token","refreshToken":"refresh-token","tokenType":"Bearer","expiresInSeconds":900,"refreshExpiresAt":"2027-01-01T00:00:00Z"}"""
        const val SESSION_JSON = """{"userId":"user-1","operatedOrganizationIds":["org-1"],"linkedTenancyIds":["tenancy-1"],"email":"a@b.com","name":"Nguyen A"}"""
        const val INQUIRY_JSON = """{"id":"inquiry-1","listingId":"listing-1","senderUserId":"user-1","contactIntentOrMessage":"Cho mình xem phòng","status":"NEW","createdAt":"2026-09-30T00:00:00.000Z"}"""
    }
}
