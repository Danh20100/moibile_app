package com.trooi.app.core.network

import com.google.gson.JsonParser
import com.trooi.app.core.network.dto.ErrorKind
import com.trooi.app.core.network.dto.TransportOutcome
import com.trooi.app.features.shared.V1PaymentGateway
import com.trooi.app.features.shared.V1RentalGateway
import java.net.InetAddress
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckoutTransportTest {
    private fun localUrl(server: MockWebServer): String =
        server.url("/").newBuilder().host("127.0.0.1").build().toString()

    private fun client(server: MockWebServer) = BackendClient(
        localUrl(server),
        InMemoryAuthTokenProvider().apply { setToken("verified-id-token") },
        allowLocalHttp = true,
    )

    private fun checkoutJson() = """
        {"id":"chk-1","tenancyId":"t-1","amount":"50000.00","referenceCode":"ref-1",
        "provider":"MOMO","status":"CREATED","createdAt":"2026-10-05T00:00:00Z",
        "replayAllowed":true,"payUrl":"https://test-payment.momo.vn/v2/gateway/pay"}
    """.trimIndent()

    @Test
    fun createSendsIdempotencyKeyAndDoesNotOverrideAuthorization() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(201).setBody(checkoutJson()))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val created = V1PaymentGateway(client(server)).create(
                "t-1",
                "50000.00",
                "22222222-2222-4222-8222-222222222222",
            )
            assertEquals("chk-1", created.id)
            assertFalse(created.resultingPaymentId != null)
            val request = server.takeRequest()
            assertEquals("/api/v1/finance/checkouts", request.path)
            assertEquals("POST", request.method)
            assertEquals("22222222-2222-4222-8222-222222222222", request.getHeader("Idempotency-Key"))
            assertEquals("Bearer verified-id-token", request.getHeader("Authorization"))
            val body = JsonParser.parseString(request.body.readUtf8()).asJsonObject
            assertEquals("t-1", body.get("tenancyId").asString)
            assertEquals("50000.00", body.get("amount").asString)
        }
    }

    @Test
    fun extraAuthorizationHeaderCannotOverrideBearer() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(201).setBody(checkoutJson()))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val outcome = client(server).postJson(
                "finance/checkouts",
                """{"tenancyId":"t-1","amount":"50000.00"}""",
                authenticated = true,
                headers = mapOf(
                    "Idempotency-Key" to "33333333-3333-4333-8333-333333333333",
                    "Authorization" to "Bearer hijacked",
                ),
            )
            assertTrue(outcome is TransportOutcome.Success)
            val request = server.takeRequest()
            assertEquals("Bearer verified-id-token", request.getHeader("Authorization"))
            assertEquals("33333333-3333-4333-8333-333333333333", request.getHeader("Idempotency-Key"))
        }
    }

    @Test
    fun getCheckoutIsNotPostedAndUnrelatedGetStillRetries() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody(checkoutJson()))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val checkout = V1PaymentGateway(client(server)).get("chk-1")
            assertEquals("CREATED", checkout.status)
            val get = server.takeRequest()
            assertEquals("GET", get.method)
            assertEquals("/api/v1/finance/checkouts/chk-1", get.path)
            assertEquals(1, server.requestCount)
        }
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
            server.enqueue(MockResponse().setBody("{\"success\":true,\"data\":[]}"))
            server.start(InetAddress.getLoopbackAddress(), 0)
            assertTrue(client(server).get("listings/public") is TransportOutcome.Success)
            assertEquals(2, server.requestCount)
        }
    }

    @Test
    fun createPostIsNotSilentlyRetried() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val result = runCatching {
                V1PaymentGateway(client(server)).create("t-1", "50000.00", "44444444-4444-4444-8444-444444444444")
            }
            assertTrue(result.isFailure)
            assertEquals(1, server.requestCount)
        }
    }

    @Test
    fun manualPaymentBodyOmitsVerification() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(
                MockResponse().setResponseCode(201).setBody(
                    """{"id":"pay-1","tenancyId":"t-1","amount":"5000.00","source":"MANUAL_CASH",
                    "verification":"USER_RECORDED","confirmedAt":"2026-10-02T01:00:00Z"}""",
                ),
            )
            server.start(InetAddress.getLoopbackAddress(), 0)
            V1RentalGateway(client(server)).recordPayment("t-1", "5000.00", "MANUAL_CASH", "2026-10-02T01:00:00Z")
            val sent = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertEquals("MANUAL_CASH", sent.get("source").asString)
            assertEquals("5000.00", sent.get("amount").asString)
            assertEquals("t-1", sent.get("tenancyId").asString)
            assertEquals("2026-10-02T01:00:00Z", sent.get("confirmedAt").asString)
            assertFalse(sent.has("verification"))
        }
    }

    @Test
    fun unconfiguredPostDoesNotHitNetwork() = runBlocking {
        val tokens = InMemoryAuthTokenProvider().apply { setToken("token") }
        val outcome = BackendClient("", tokens).postJson(
            "finance/checkouts",
            "{}",
            true,
            mapOf("Idempotency-Key" to "55555555-5555-4555-8555-555555555555"),
        )
        assertEquals(TransportOutcome.Failure(ErrorKind.UNCONFIGURED), outcome)
    }
}
