package com.trooi.app.core.network

import com.google.gson.JsonParser
import com.trooi.app.core.network.dto.*
import java.net.InetAddress
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class BackendOpenApiAlignmentTest {
    private fun localUrl(server: MockWebServer): String =
        server.url("/").newBuilder().host("127.0.0.1").build().toString()

    private fun api(server: MockWebServer, token: String? = "verified-id-token"): OkHttpBackendApi {
        val tokens = InMemoryAuthTokenProvider().apply { token?.let(::setToken) }
        return OkHttpBackendApi(BackendClient(localUrl(server), tokens, allowLocalHttp = true))
    }

    private fun MockWebServer.ok(body: String, code: Int = 200) {
        enqueue(
            MockResponse()
                .setResponseCode(code)
                .setHeader("Content-Type", "application/json")
                .setBody(body),
        )
    }

    @Test fun publicSpatialSearchIsUnauthenticatedAndUsesOnlyPublicQueryContract() = runBlocking {
        MockWebServer().use { server ->
            server.ok(
                """[{"listingId":"list-1","roomId":"room-1","publicTitle":"Room","publicDescription":"Public","publicPriceProjection":"3500000.00","publicLocation":{"latitude":10.77,"longitude":106.69},"distanceMeters":842.5}]""",
            )
            server.start(InetAddress.getLoopbackAddress(), 0)

            val result = api(server).searchPublicListings(
                latitude = 10.77,
                longitude = 106.69,
                radiusMeters = 1500.0,
                minPrice = "3000000.00",
                maxPrice = "4000000.00",
            ).requireData()

            assertEquals("list-1", result.single().listingId)
            assertEquals(842.5, result.single().distanceMeters, 0.0)
            val request = server.takeRequest()
            assertEquals("GET", request.method)
            assertEquals("/api/v1/listings/public/search", request.requestUrl?.encodedPath)
            assertEquals("10.77", request.requestUrl?.queryParameter("latitude"))
            assertEquals("106.69", request.requestUrl?.queryParameter("longitude"))
            assertEquals("1500.0", request.requestUrl?.queryParameter("radiusMeters"))
            assertEquals("3000000.00", request.requestUrl?.queryParameter("minPrice"))
            assertEquals("4000000.00", request.requestUrl?.queryParameter("maxPrice"))
            assertNull(request.getHeader("Authorization"))
        }
    }

    @Test fun protectedReadContractsUseBearerAndPreserveNullableServerFacts() = runBlocking {
        MockWebServer().use { server ->
            server.ok(LISTING_JSON)
            server.ok(
                """[{"id":"pay-1","tenancyId":"ten-1","amount":"3500000.00","source":"MANUAL_TRANSFER","verification":"USER_RECORDED","confirmedAt":"2026-10-03T01:00:00Z","voidedOrReversedAt":null,"correctionNote":null,"replacementPaymentId":null}]""",
            )
            server.ok(
                """[{"id":"evt-1","incidentId":"inc-1","eventType":"STATUS_CHANGED","actorUserId":null,"note":null,"attachmentReference":null,"fromStatus":"REPORTED","toStatus":"ACKNOWLEDGED","occurredAt":"2026-10-03T02:00:00Z"}]""",
            )
            server.ok(
                """[{"id":"11111111-1111-1111-1111-111111111111","recipientUserId":"22222222-2222-2222-2222-222222222222","category":"INCIDENT_STATUS","messageOrPayloadReference":"incident:inc-1","sourceType":null,"sourceId":null,"deliveryStatus":"PENDING","createdAt":"2026-10-03T02:00:00Z","deliveredAt":null,"readAt":null}]""",
            )
            server.ok(
                """{"organizationId":"org-1","roomsByState":{"VACANT":2,"OCCUPIED":3,"MAINTENANCE":1,"INACTIVE":0},"activeTenancyCount":3,"outstandingReceivable":null,"confirmedPaymentTotal":null,"openIncidentCount":1}""",
            )
            server.ok(
                """{"id":"dep-1","tenancyId":"ten-1","requirementAmount":null,"fundedAmount":"0.00","settledAmount":"0.00","heldAmount":"0.00","state":null,"blockedByOpenPolicy":true}""",
            )
            server.ok(
                """[{"id":"de-1","depositId":"dep-1","eventType":"RECEIVED","amount":"500000.00","occurredAt":"2026-10-03T03:00:00Z","paymentApplicationId":null,"settlementId":null}]""",
            )
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = api(server)

            assertEquals("list-1", api.getCurrentListing("room-1").requireData().id)
            assertNull(api.getPayments("ten-1").requireData().single().correctionNote)
            assertNull(api.getIncidentEvents("inc-1").requireData().single().actorUserId)
            assertNull(api.getNotifications().requireData().single().sourceType)
            val dashboard = api.getDashboard("org-1").requireData()
            assertNull(dashboard.outstandingReceivable)
            assertNull(dashboard.confirmedPaymentTotal)
            val deposit = api.getDeposit("ten-1").requireData()
            assertTrue(deposit.blockedByOpenPolicy)
            assertNull(deposit.requirementAmount)
            assertNull(deposit.state)
            assertNull(api.getDepositEvents("dep-1").requireData().single().settlementId)

            val expectedPaths = listOf(
                "/api/v1/listings?roomId=room-1",
                "/api/v1/finance/payments?tenancyId=ten-1",
                "/api/v1/incidents/inc-1/events",
                "/api/v1/notifications",
                "/api/v1/organizations/org-1/dashboard",
                "/api/v1/finance/deposits?tenancyId=ten-1",
                "/api/v1/finance/deposits/dep-1/events",
            )
            expectedPaths.forEach { expected ->
                val request = server.takeRequest()
                assertEquals(expected, request.path)
                assertEquals("Bearer verified-id-token", request.getHeader("Authorization"))
            }
        }
    }

    @Test fun serverOwnedCommandMetadataIsNeverSentByAndroid() = runBlocking {
        MockWebServer().use { server ->
            server.ok(LISTING_JSON)
            server.ok(ROOM_JSON)
            server.ok(TENANCY_JSON)
            server.ok(TERMS_ACK_JSON)
            server.ok(NOTICE_JSON)
            server.ok(NOTICE_JSON)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = api(server)

            api.publishListing("list-1").requireData()
            val publish = server.takeRequest()
            assertEquals("POST", publish.method)
            assertEquals("/api/v1/listings/list-1/publish", publish.path)
            assertEquals(0L, publish.body.size)

            api.transitionRoomOperationalState("room-1", "maintenance").requireData()
            val room = server.takeRequest()
            assertEquals("POST", room.method)
            assertEquals("/api/v1/rooms/room-1/operational-state", room.path)
            assertJsonHasExactly(room.body.readUtf8(), setOf("operationalState"))

            api.activateTenancy("ten-1", "2026-10-03T04:00:00Z").requireData()
            val activate = server.takeRequest()
            assertJsonHasExactly(activate.body.readUtf8(), setOf("occurredAt"))

            api.acknowledgeTerms(
                "ten-1",
                "terms-1",
                "part-1",
                "2026-10-03T04:10:00Z",
            ).requireData()
            val terms = server.takeRequest()
            assertJsonHasExactly(terms.body.readUtf8(), setOf("tenancyParticipantId", "acknowledgedAt"))
            assertFalse(terms.body.clone().readUtf8().contains("userId"))

            api.issueNotice(
                "ten-1",
                "MOVE_OUT",
                "Notice content",
                "2026-10-03T04:20:00Z",
            ).requireData()
            val issueNotice = server.takeRequest()
            assertJsonHasExactly(issueNotice.body.readUtf8(), setOf("noticeType", "contentOrNote", "issuedAt"))

            api.acknowledgeNotice("ten-1", "notice-1", "2026-10-03T04:30:00Z").requireData()
            val acknowledgeNotice = server.takeRequest()
            assertJsonHasExactly(acknowledgeNotice.body.readUtf8(), setOf("occurredAt"))

            assertThrows(IllegalArgumentException::class.java) {
                BackendJsonCodec.encodeRoomOperationalState("occupied")
            }
            Unit
        }
    }

    @Test fun depositSettlementNeverSendsActorIdentity() = runBlocking {
        MockWebServer().use { server ->
            server.ok(
                """{"id":"set-1","depositId":"dep-1","refundedAmount":"3000000.00","retainedAmount":"500000.00","reasonOrNote":"checkout","actedByUserId":"33333333-3333-3333-3333-333333333333","settledAt":"2026-10-03T05:00:00Z"}""",
                201,
            )
            server.start(InetAddress.getLoopbackAddress(), 0)

            api(server).settleDeposit(
                id = "dep-1",
                refundedAmount = "3000000.00",
                retainedAmount = "500000.00",
                reasonOrNote = "checkout",
                settledAt = "2026-10-03T05:00:00Z",
            ).requireData()

            val request = server.takeRequest()
            assertEquals("/api/v1/finance/deposits/dep-1/settlements", request.path)
            assertJsonHasExactly(
                request.body.readUtf8(),
                setOf("refundedAmount", "retainedAmount", "reasonOrNote", "settledAt"),
            )
        }
    }

    @Test fun emailChangeOtpResponseCarriesTheServerDirectedSecondStage() = runBlocking {
        MockWebServer().use { server ->
            server.ok(
                """{"emailChanged":false,"email":"new@example.com","nextStep":"NEW_EMAIL","resendAvailableAt":"2026-10-27T12:10:00Z"}""",
            )
            server.start(InetAddress.getLoopbackAddress(), 0)

            val result = api(server).verifyEmailChangeOtp(
                "b43d6010-f40d-4a34-84af-3aba98cecf20", "123456",
            ).requireData()

            assertFalse(result.emailChanged)
            assertEquals("NEW_EMAIL", result.nextStep)
            assertEquals("new@example.com", result.email)
            assertNotNull(result.resendAvailableAt)
            val request = server.takeRequest()
            assertEquals("POST", request.method)
            assertEquals("/api/v1/identity-access/profile/email/otp/verify", request.path)
            assertEquals("Bearer verified-id-token", request.getHeader("Authorization"))
        }
    }

    @Test fun codecPreservesNestedArraysAndNullableHistoryWithoutInventingDefaults() {
        val rental = BackendJsonCodec.rentalHistory(
            """{"tenancy":{"id":"ten-1","roomId":"room-1","status":"ended"},"terms":[],"payments":[],"notices":[],"incidents":[],"deposit":null}""",
        )
        assertEquals("ended", rental.tenancy.status)
        assertTrue(rental.terms.isEmpty())
        assertTrue(rental.payments.isEmpty())
        assertTrue(rental.incidents.isEmpty())
        assertNull(rental.deposit)

        val room = BackendJsonCodec.roomHistory(
            """{"room":{"id":"room-1","propertyId":"prop-1","nameOrLabel":"101","operationalState":"vacant","recordLifecycle":"active"},"listings":[],"tenancies":[],"incidents":[]}""",
        )
        assertEquals("vacant", room.room.operationalState)
        assertTrue(room.listings.isEmpty())
        assertTrue(room.tenancies.isEmpty())

        assertThrows(IllegalArgumentException::class.java) {
            BackendJsonCodec.deposit(
                """{"id":"dep-1","tenancyId":"ten-1","fundedAmount":"0.00","settledAmount":"0.00","heldAmount":"0.00","state":"UNKNOWN","blockedByOpenPolicy":false}""",
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            BackendJsonCodec.payment(
                """{"id":"pay-1","tenancyId":"ten-1","amount":"1.00","source":"UNKNOWN","verification":"USER_RECORDED","confirmedAt":"2026-10-03T00:00:00Z"}""",
            )
        }
    }

    @Test fun notificationDetailAndReadUseProtectedSourceBackedContracts() = runBlocking {
        MockWebServer().use { server ->
            val id = "11111111-1111-1111-1111-111111111111"
            val unread = """{"id":"$id","recipientUserId":"22222222-2222-2222-2222-222222222222","category":"INCIDENT_STATUS","messageOrPayloadReference":"incident updated","sourceType":"INCIDENT","sourceId":"inc-1","deliveryStatus":"DELIVERED","createdAt":"2026-10-03T02:00:00Z","deliveredAt":"2026-10-03T02:01:00Z","readAt":null}"""
            val read = unread.replace("\"readAt\":null", "\"readAt\":\"2026-10-03T02:02:00Z\"")
            server.ok(unread)
            server.ok(read)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = api(server)

            val detail = api.getNotification(id).requireData()
            assertEquals("INCIDENT", detail.sourceType)
            assertEquals("inc-1", detail.sourceId)
            assertNull(detail.readAt)
            val marked = api.markNotificationRead(id).requireData()
            assertNotNull(marked.readAt)

            val detailRequest = server.takeRequest()
            assertEquals("GET", detailRequest.method)
            assertEquals("/api/v1/notifications/$id", detailRequest.path)
            assertEquals("Bearer verified-id-token", detailRequest.getHeader("Authorization"))
            val readRequest = server.takeRequest()
            assertEquals("POST", readRequest.method)
            assertEquals("/api/v1/notifications/$id/read", readRequest.path)
            assertEquals(0L, readRequest.body.size)
            assertEquals("Bearer verified-id-token", readRequest.getHeader("Authorization"))
        }
    }

    private fun assertJsonHasExactly(raw: String, expectedKeys: Set<String>) {
        val obj = JsonParser.parseString(raw).asJsonObject
        assertEquals(expectedKeys, obj.keySet())
        assertFalse(obj.has("reasonCode"))
        assertFalse(obj.has("actorType"))
        assertFalse(obj.has("actorUserId"))
        assertFalse(obj.has("trigger"))
        assertFalse(obj.has("userId"))
        assertFalse(obj.has("issuedByUserId"))
    }

    private fun <T> ApiOutcome<T>.requireData(): T = when (this) {
        is ApiOutcome.Data -> value
        is ApiOutcome.Failure -> error("Unexpected failure: $kind/$httpStatus")
    }

    private companion object {
        const val LISTING_JSON =
            """{"id":"list-1","roomId":"room-1","status":"published","publicTitle":"Room","publicDescription":"Public","publicPriceProjection":"3500000.00","publicLocationProjection":{"latitude":10.77,"longitude":106.69}}"""
        const val ROOM_JSON =
            """{"id":"room-1","propertyId":"prop-1","nameOrLabel":"101","operationalState":"maintenance","recordLifecycle":"active"}"""
        const val TENANCY_JSON =
            """{"id":"ten-1","roomId":"room-1","status":"active","startedAt":"2026-10-03T04:00:00Z"}"""
        const val TERMS_ACK_JSON =
            """{"id":"ack-1","tenancyTermsId":"terms-1","tenancyParticipantId":"part-1","userId":"44444444-4444-4444-4444-444444444444","acknowledgedAt":"2026-10-03T04:10:00Z"}"""
        const val NOTICE_JSON =
            """{"id":"notice-1","tenancyId":"ten-1","noticeType":"MOVE_OUT","issuedByUserId":"44444444-4444-4444-4444-444444444444","contentOrNote":"Notice content","issuedAt":"2026-10-03T04:20:00Z"}"""
    }
}
