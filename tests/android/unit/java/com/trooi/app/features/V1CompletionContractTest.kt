package com.trooi.app.features

import com.google.gson.JsonParser
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.InMemoryAuthTokenProvider
import com.trooi.app.features.shared.*
import kotlinx.coroutines.runBlocking
import java.net.InetAddress
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

/** Real HTTP request/response contract tests; no fake client-side business success. */
class V1CompletionContractTest {
    private fun client(server: MockWebServer) = BackendClient(
        server.url("/").newBuilder().host("127.0.0.1").build().toString(),
        InMemoryAuthTokenProvider().apply { setToken("verified-id-token") },
        allowLocalHttp = true,
    )
    private fun MockWebServer.ok(body: String, code: Int = 200) =
        enqueue(MockResponse().setResponseCode(code).setHeader("Content-Type", "application/json")
            .setBody(body))

    @Test fun organizationWriteIsJsonAndConfirmedByServerResponse() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"id":"org-1","name":"Nhà thuê","primaryOwnerUserId":"user-1"}""", 201)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val created = V1ContractGateway(client(server)).createOrganization("Nhà thuê")
            assertEquals("org-1", created.id)
            val request = server.takeRequest()
            assertEquals("POST", request.method)
            assertEquals("/api/v1/organizations", request.path)
            assertEquals("Bearer verified-id-token", request.getHeader("Authorization"))
            assertEquals("Nhà thuê", JsonParser.parseString(request.body.readUtf8()).asJsonObject.get("name").asString)
        }
    }

    @Test fun propertyHasSeparatePublicAndOperationalLocations() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"id":"p-1","organizationId":"org-1","name":"Khu nhà","lifecycleStatus":"active","operationalAddressText":"PRIVATE","operationalLocation":{"latitude":10.9,"longitude":106.8},"publicLocationProjection":{"latitude":10.8,"longitude":106.7}}""", 201)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val value = V1ContractGateway(client(server)).createProperty(
                "org-1",
                "Khu nhà",
                "PRIVATE",
                PublicGeoPoint(10.9, 106.8),
                PublicGeoPoint(10.8, 106.7),
            )
            assertEquals("org-1", value.organizationId)
            val request = server.takeRequest()
            val sent = JsonParser.parseString(request.body.readUtf8()).asJsonObject
            assertEquals("/api/v1/properties", request.path)
            assertEquals("PRIVATE", sent.get("operationalAddressText").asString)
            assertEquals(10.8, sent.getAsJsonObject("publicLocationProjection").get("latitude").asDouble, 0.0)
            assertEquals(10.9, sent.getAsJsonObject("operationalLocation").get("latitude").asDouble, 0.0)
        }
    }

    @Test fun operatorCanOnlyUseExplicitLinkedOrganizationFromSessionResponse() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"userId":"user-1","operatedOrganizationIds":["org-2"],"linkedTenancyIds":["tenant-3"]}""")
            server.start(InetAddress.getLoopbackAddress(), 0)
            val granted = V1ContractGateway(client(server)).sessionAccess()
            assertEquals(setOf("org-2"), granted.operatedOrganizationIds)
            assertEquals(setOf("tenant-3"), granted.linkedTenancyIds)
            assertEquals("/api/v1/identity-access/me", server.takeRequest().path)
        }
    }

    @Test fun createsOnlyDraftTenancyAndServerControlsResult() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"id":"t-1","roomId":"room-1","status":"draft"}""",201)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val saved = V1RentalGateway(client(server)).createTenancy("room-1")
            assertEquals("draft", saved.status)
            val request = server.takeRequest()
            assertEquals("/api/v1/tenancies", request.path)
            val json = JsonParser.parseString(request.body.readUtf8()).asJsonObject
            assertEquals("room-1", json.get("roomId").asString)
            assertFalse(json.has("status"))
        }
    }

    @Test fun checkoutSendsCanonicalEndReasonAndBackendTimeField() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"id":"t-1","roomId":"room-1","status":"ended"}""")
            server.start(InetAddress.getLoopbackAddress(), 0)
            val done = V1RentalGateway(client(server)).checkout("t-1","TENANT_INITIATED","2026-10-02T01:00:00Z")
            assertEquals("ended", done.status)
            val request = server.takeRequest()
            assertEquals("/api/v1/tenancies/t-1/checkout",request.path)
            assertEquals("TENANT_INITIATED", JsonParser.parseString(request.body.readUtf8()).asJsonObject.get("endReason").asString)
        }
    }

    @Test fun termsPersistAndReadBackAgreedMonthlyDueDay() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"id":"terms-1","tenancyId":"t-1","version":1,"rentAmount":"1000.00","agreedDepositRequirement":"500.00","termStart":"2026-10-01","termEnd":"2027-09-30","effectiveFromCycleBoundary":"2026-10-01","billingDayOrDueDateRule":{"day":5},"electricityArrangement":"metered","waterArrangement":"fixed","minimalRentalConditions":"quiet hours"}""")
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = V1RentalGateway(client(server))
            val terms = api.createTerms("t-1", 1, "1000.00", "500.00", "2026-10-01", "2027-09-30", "2026-10-01", 5, "metered", "fixed", "quiet hours")
            assertEquals(5, terms.billingDay)
            val request = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertEquals(5, request.getAsJsonObject("billingDayOrDueDateRule").get("day").asInt)
        }
    }
    @Test fun forbiddenFutureChargeAndGatewayPaymentsAreRejectedLocally() = runBlocking {
        MockWebServer().use { server ->
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = V1RentalGateway(client(server))
            assertTrue(runCatching {
                api.createBilling("t-1","terms-1","2026-10-01","2026-11-01",listOf("WIFI" to "120000"))
            }.isFailure)
            assertTrue(runCatching {
                api.recordPayment("t-1","100000","GATEWAY")
            }.isFailure)
            assertEquals(0, server.requestCount)
        }
    }

    @Test fun paymentOnlyReportsSuccessWhenBackendConfirms() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"id":"pay-1","tenancyId":"t-1","amount":"5000.00","source":"MANUAL_CASH","verification":"USER_RECORDED","confirmedAt":"2026-10-02T01:00:00Z"}""",201)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val pay = V1RentalGateway(client(server)).recordPayment("t-1","5000.00","MANUAL_CASH","2026-10-02T01:00:00Z")
            assertEquals("pay-1", pay.id)
            val body = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertFalse(body.has("verification"))
            assertEquals("5000.00", body.get("amount").asString)
        }
    }

    @Test fun incidentTransitionsFollowFrozenLifecycleAndDoNotGuessActorId() = runBlocking {
        MockWebServer().use { server ->
            val incident = """{"id":"inc-1","roomId":"room-1","category":"PLUMBING","status":"REPORTED","createdAt":"2026-10-02T01:00:00Z"}"""
            val acknowledged = incident.replace("REPORTED", "ACKNOWLEDGED")
            server.ok(incident); server.ok(acknowledged)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val updated = V1RentalGateway(client(server)).transitionIncident("inc-1","ACKNOWLEDGED",null,null)
            assertEquals("ACKNOWLEDGED", updated.status)
            assertEquals("/api/v1/incidents/inc-1",server.takeRequest().path)
            val patch = server.takeRequest()
            assertEquals("PATCH", patch.method)
            assertEquals("/api/v1/incidents/inc-1/status",patch.path)
            val sent = JsonParser.parseString(patch.body.readUtf8()).asJsonObject
            assertEquals("ACKNOWLEDGED",sent.get("status").asString)
            assertFalse(sent.has("actorUserId"))
            assertFalse(V1RentalGateway.INCIDENT_TRANSITIONS["ACKNOWLEDGED"].orEmpty().contains("CLOSED"))
        }
    }

    @Test fun roomDiscoversCurrentListingAndTreats404AsNoCurrentListing() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"message":"not found"}""", 404)
            server.ok("""{"id":"list-1","roomId":"room-1","status":"draft","publicTitle":"P101","publicDescription":"Public","publicPriceProjection":"3500000.00","publicLocationProjection":{"latitude":10.77,"longitude":106.69}}""")
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = V1ContractGateway(client(server))

            assertNull(api.currentListing("room-1"))
            assertEquals("list-1", api.currentListing("room-1")?.id)

            repeat(2) {
                val request = server.takeRequest()
                assertEquals("GET", request.method)
                assertEquals("/api/v1/listings?roomId=room-1", request.path)
                assertEquals("Bearer verified-id-token", request.getHeader("Authorization"))
            }
        }
    }

    @Test fun operatorLifecycleCommandsDoNotSendServerOwnedProvenance() = runBlocking {
        MockWebServer().use { server ->
            val draft = """{"id":"list-1","roomId":"room-1","status":"draft","publicTitle":"P101","publicDescription":"Public","publicPriceProjection":"3500000.00","publicLocationProjection":{"latitude":10.77,"longitude":106.69}}"""
            server.ok(draft.replace("\"draft\"", "\"published\""))
            server.ok(draft.replace("\"draft\"", "\"unpublished\""))
            server.ok(draft.replace("\"draft\"", "\"archived\""))
            server.ok("""{"id":"room-1","propertyId":"prop-1","nameOrLabel":"P101","operationalState":"maintenance","recordLifecycle":"active"}""")
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = V1ContractGateway(client(server))

            assertEquals("published", api.publishListing("list-1").status)
            assertEquals("unpublished", api.unpublishListing("list-1").status)
            assertEquals("archived", api.archiveListing("list-1").status)
            assertEquals("maintenance", api.transitionRoomOperationalState("room-1", "maintenance").state)

            listOf(
                "/api/v1/listings/list-1/publish",
                "/api/v1/listings/list-1/unpublish",
                "/api/v1/listings/list-1/archive",
            ).forEach { expected ->
                val request = server.takeRequest()
                assertEquals("POST", request.method)
                assertEquals(expected, request.path)
                assertEquals(0L, request.body.size)
            }
            val transition = server.takeRequest()
            assertEquals("POST", transition.method)
            assertEquals("/api/v1/rooms/room-1/operational-state", transition.path)
            val body = JsonParser.parseString(transition.body.readUtf8()).asJsonObject
            assertEquals(setOf("operationalState"), body.keySet())
            assertEquals("maintenance", body.get("operationalState").asString)

            assertTrue(runCatching { api.transitionRoomOperationalState("room-1", "occupied") }.isFailure)
            assertTrue(runCatching { api.transitionRoomOperationalState("room-1", "vacant", "OCCUPIED") }.isFailure)
            assertEquals(4, server.requestCount)
        }
    }

    @Test fun rentalReadEndpointsUseTenancyAndEventScopeWithoutManualIds() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""[{"id":"pay-1","tenancyId":"t-1","amount":"5000.00","source":"MANUAL_CASH","verification":"USER_RECORDED","confirmedAt":"2026-10-03T01:00:00Z"}]""")
            server.ok("""{"message":"not found"}""", 404)
            server.ok("""[{"id":"event-2","incidentId":"inc-1","eventType":"STATUS_CHANGED","fromStatus":"REPORTED","toStatus":"ACKNOWLEDGED","occurredAt":"2026-10-03T03:00:00Z"},{"id":"event-1","incidentId":"inc-1","eventType":"REPORTED","occurredAt":"2026-10-03T02:00:00Z"}]""")
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = V1RentalGateway(client(server))

            assertEquals(listOf("pay-1"), api.payments("t-1").map { it.id })
            assertNull(api.deposit("t-1"))
            assertEquals(listOf("event-2", "event-1"), api.incidentEvents("inc-1").map { it.id })

            assertEquals("/api/v1/finance/payments?tenancyId=t-1", server.takeRequest().path)
            assertEquals("/api/v1/finance/deposits?tenancyId=t-1", server.takeRequest().path)
            assertEquals("/api/v1/incidents/inc-1/events", server.takeRequest().path)
        }
    }

    @Test fun rentalCommandsNeverSendServerOwnedIdentityOrProvenance() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"id":"ack-1"}""", 201)
            server.ok("""{"id":"notice-1","tenancyId":"t-1","noticeType":"GENERAL","issuedByUserId":"server-user","contentOrNote":"Nội dung","issuedAt":"2026-10-03T01:00:00Z"}""", 201)
            server.ok("""{"id":"notice-1","tenancyId":"t-1","noticeType":"GENERAL","issuedByUserId":"server-user","contentOrNote":"Nội dung","issuedAt":"2026-10-03T01:00:00Z","acknowledgedByUserId":"server-reader","acknowledgedAt":"2026-10-03T02:00:00Z"}""")
            server.ok("""{"id":"settlement-1","depositId":"dep-1","refundedAmount":"3000000.00","retainedAmount":"500000.00","reasonOrNote":"Khấu trừ","actedByUserId":"server-user","settledAt":"2026-10-03T03:00:00Z"}""", 201)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = V1RentalGateway(client(server))

            api.acknowledgeTerms("t-1", "terms-1", "participant-1", "2026-10-03T00:00:00Z")
            api.issueNotice("t-1", "GENERAL", "Nội dung", "2026-10-03T01:00:00Z")
            api.acknowledgeNotice("t-1", "notice-1", "2026-10-03T02:00:00Z")
            api.settleDeposit("dep-1", "3000000.00", "500000.00", "Khấu trừ", "2026-10-03T03:00:00Z")

            val terms = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertEquals(setOf("tenancyParticipantId", "acknowledgedAt"), terms.keySet())
            assertFalse(terms.has("userId"))

            val issue = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertEquals(setOf("noticeType", "contentOrNote", "issuedAt"), issue.keySet())
            assertFalse(issue.has("issuedByUserId"))

            val acknowledge = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertEquals(setOf("occurredAt"), acknowledge.keySet())
            assertFalse(acknowledge.has("userId"))

            val settlement = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertEquals(setOf("refundedAmount", "retainedAmount", "reasonOrNote", "settledAt"), settlement.keySet())
            assertFalse(settlement.has("actedByUserId"))
        }
    }

    @Test fun denialOrNetworkFailuresNeverPretendToCreateBusinessRecords() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"message":"forbidden"}""",403)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val error = runCatching { V1ContractGateway(client(server)).createOrganization("Other") }.exceptionOrNull()
            assertTrue(error is V1RequestException)
            assertEquals(403,(error as V1RequestException).status)
        }
    }

    @Test fun incompleteIdOrInvalidGeopointIsRejectedBeforeRequest() = runBlocking {
        MockWebServer().use { server ->
            server.start(InetAddress.getLoopbackAddress(), 0)
            val api = V1ContractGateway(client(server))
            assertTrue(runCatching { api.organization("../foreign") }.isFailure)
            assertTrue(runCatching { api.createProperty("org","name","private", PublicGeoPoint(100.0, 106.0), PublicGeoPoint(10.0, 106.0)) }.isFailure)
            assertEquals(0,server.requestCount)
        }
    }
}
