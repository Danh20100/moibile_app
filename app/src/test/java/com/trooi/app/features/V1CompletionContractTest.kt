package com.trooi.app.features

import com.google.gson.JsonParser
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
            val value = V1ContractGateway(client(server)).createProperty("org-1","Khu nhà","PRIVATE",10.9,106.8,10.8,106.7)
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

    @Test fun momoCheckoutPostsToCheckoutsNotPayments() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"id":"chk-1","tenancyId":"t-1","amount":"4470000.00","referenceCode":"TROOI T-1 ABC","provider":"MOMO","status":"CREATED","deeplink":"momo://app"}""",201)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val session = V1RentalGateway(client(server)).createGatewayCheckout("t-1","4470000.00")
            assertEquals("CREATED", session.status)
            assertEquals(null, session.resultingPaymentId)
            val request = server.takeRequest()
            assertEquals("/api/v1/finance/checkouts", request.path)
            assertEquals("4470000.00", JsonParser.parseString(request.body.readUtf8()).asJsonObject.get("amount").asString)
        }
    }

    @Test fun paymentOnlyReportsSuccessWhenBackendConfirms() = runBlocking {
        MockWebServer().use { server ->
            server.ok("""{"id":"pay-1","tenancyId":"t-1","amount":"5000.00","source":"MANUAL_CASH","verification":"USER_RECORDED","confirmedAt":"2026-10-02T01:00:00Z"}""",201)
            server.start(InetAddress.getLoopbackAddress(), 0)
            val pay = V1RentalGateway(client(server)).recordPayment("t-1","5000.00","MANUAL_CASH","2026-10-02T01:00:00Z")
            assertEquals("pay-1", pay.id)
            val body = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertEquals("USER_RECORDED", body.get("verification").asString)
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
            assertTrue(runCatching { api.createProperty("org","name","private",100.0,106.0,10.0,106.0) }.isFailure)
            assertEquals(0,server.requestCount)
        }
    }
}
