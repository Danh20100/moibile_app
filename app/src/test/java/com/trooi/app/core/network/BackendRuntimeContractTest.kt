package com.trooi.app.core.network

import com.trooi.app.core.data.BackendTroOiRepository
import com.trooi.app.core.model.ListingVisibility
import com.trooi.app.core.network.dto.*
import java.net.InetAddress
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class BackendRuntimeContractTest {
    private fun localUrl(server: MockWebServer) =
        server.url("/").newBuilder().host("127.0.0.1").build().toString()

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
            server.enqueue(MockResponse().setBody(VERIFIED_PRINCIPAL_JSON))
            server.enqueue(MockResponse().setBody(SESSION_JSON))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider()
            val api = OkHttpBackendApi(BackendClient(localUrl(server), tokens, true))

            api.authenticateGoogle("google-id-token").requireData()
            tokens.setToken("google-id-token")
            val session = api.getSessionContext().requireData()
            assertEquals(setOf("org-1"), session.operatedOrganizationIds.toSet())
            assertEquals(setOf("tenancy-1"), session.linkedTenancyIds.toSet())

            val authRequest = server.takeRequest()
            assertEquals("/api/v1/identity-access/auth/google", authRequest.path)
            assertNull(authRequest.getHeader("Authorization"))
            assertTrue(authRequest.body.readUtf8().contains("google-id-token"))
            assertEquals("Bearer google-id-token", server.takeRequest().getHeader("Authorization"))
        }
    }

    @Test fun failedSessionContextClearsGoogleCredential() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody(VERIFIED_PRINCIPAL_JSON))
            server.enqueue(MockResponse().setResponseCode(401))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider()
            val repository = BackendTroOiRepository(
                OkHttpBackendApi(BackendClient(localUrl(server), tokens, true)),
                tokens,
            )

            val result = repository.authenticateWithGoogleIdToken("expired-after-verify")
            assertTrue(result.isFailure)
            assertNull(tokens.token())
            assertNull(server.takeRequest().getHeader("Authorization"))
            assertEquals("Bearer expired-after-verify", server.takeRequest().getHeader("Authorization"))
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

        val session = repository.authenticateWithGoogleIdToken("id-token").getOrThrow()
        assertEquals(setOf("org-1"), session.access.operatedOrganizationIds)
        assertEquals(setOf("tenancy-1"), session.access.linkedTenancyIds)
        assertEquals("Nguyen A", session.displayName)
        assertEquals("id-token", tokens.token())
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
        assertTrue(read.dashboardByOrganization.isEmpty())
    }

    private class FakeRuntimeApi : BackendApi {
        override suspend fun getPublicListings() = ApiOutcome.Data(
            listOf(PublicListingTransport("listing-1", "room-1", "published", "Phòng sáng", "Mô tả", "3500000.00", PublicLocationTransport(10.77, 106.69))),
        )
        override suspend fun getPublicListingsRaw() = throw UnsupportedOperationException()
        override suspend fun authenticateGoogle(idToken: String) = ApiOutcome.Data(
            VerifiedPrincipalTransport("user-1", "google", "https://accounts.google.com", "sub-1", "a@b.com", true, "Nguyen A", null),
        )
        override suspend fun getSessionContext() = ApiOutcome.Data(
            SessionContextTransport("user-1", listOf("org-1"), listOf("tenancy-1"), "a@b.com", "Nguyen A", null),
        )
        override suspend fun getOrganizations() = ApiOutcome.Data(
            listOf(
                OrganizationTransport("org-1", "Org 1", "user-1"),
                OrganizationTransport("org-foreign", "Foreign", "other-user"),
            ),
        )
        override suspend fun getProperties(organizationId: String) = ApiOutcome.Data(
            listOf(
                PropertyTransport("prop-1", "org-1", "Property 1", "active"),
                PropertyTransport("prop-foreign", "org-foreign", "Foreign", "active"),
            ),
        )
        override suspend fun getRooms(propertyId: String) = ApiOutcome.Data(
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
        override suspend fun getBillingCycles(tenancyId: String) = ApiOutcome.Data(emptyList<BillingCycleTransport>())
        override suspend fun getPayment(id: String) = ApiOutcome.Data(
            PaymentTransport(id, "tenancy-1", "3500000.00", "MANUAL_TRANSFER", "USER_RECORDED", "2026-09-30T00:00:00.000Z"),
        )
        override suspend fun getReceipts() = ApiOutcome.Data(
            listOf(ReceiptTransport("receipt-1", "payment-1", "ISSUED", "2026-09-30T01:00:00.000Z", null, null)),
        )
        override suspend fun getIncidents(roomId: String) = ApiOutcome.Data(emptyList<IncidentTransport>())
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
        const val VERIFIED_PRINCIPAL_JSON = """{"userId":"user-1","provider":"google","issuer":"https://accounts.google.com","subject":"sub-1","email":"a@b.com","name":"Nguyen A"}"""
        const val SESSION_JSON = """{"userId":"user-1","operatedOrganizationIds":["org-1"],"linkedTenancyIds":["tenancy-1"],"email":"a@b.com","name":"Nguyen A"}"""
        const val INQUIRY_JSON = """{"id":"inquiry-1","listingId":"listing-1","senderUserId":"user-1","contactIntentOrMessage":"Cho mình xem phòng","status":"NEW","createdAt":"2026-09-30T00:00:00.000Z"}"""
    }
}
