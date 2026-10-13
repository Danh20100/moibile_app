package com.trooi.app.core.network

import com.google.gson.JsonParser
import com.google.gson.JsonObject
import com.trooi.app.support.JsonFixtures
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
        InMemoryAuthTokenProvider().apply { setToken(value("token")) },
        allowLocalHttp = true,
    )

    private val fixture = JsonFixtures.load("network/checkout-transport")
    private fun value(key: String) = fixture.get(key).asString
    private fun number(key: String) = fixture.get(key).asInt
    private val fixtureCheckout get() = fixture.getAsJsonObject("checkout")
    private val payment get() = fixture.getAsJsonObject("payment")
    private fun checkoutJson() = fixtureCheckout.toString()

    @Test fun fixtureRejectsMissingWrongTypeUnknownFieldsAndVersion() {
        val schema = JsonFixtures.resource("network/checkout-transport.schema.json")
        val invalid = listOf(
            fixture.deepCopy().apply { remove("amount") },
            fixture.deepCopy().apply { addProperty("amount", 1) },
            fixture.deepCopy().apply { addProperty("unexpected", true) },
            fixture.deepCopy().apply { addProperty("version", 2) },
        )
        invalid.forEach { assertTrue(runCatching { JsonFixtures.validate(it, schema) }.isFailure) }
        val flowSchema = JsonFixtures.resource("tenancy/checkout-flow.schema.json")
        val flow = JsonFixtures.load("tenancy/checkout-flow")
        flow.getAsJsonArray("invalidDemoUrls").add(true)
        assertTrue(runCatching { JsonFixtures.validate(flow, flowSchema) }.isFailure)
        val contractSchema = JsonFixtures.resource("model/contract-boundary.schema.json")
        val contract = JsonFixtures.load("model/contract-boundary")
        contract.addProperty("unknownOutstanding", "unexpected")
        assertTrue(runCatching { JsonFixtures.validate(contract, contractSchema) }.isFailure)
    }

    @Test
    fun createSendsIdempotencyKeyAndDoesNotOverrideAuthorization() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(number("createResponseCode")).setBody(checkoutJson()))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val created = V1PaymentGateway(client(server)).create(
                value("tenancyId"),
                value("amount"),
                value("createKey"),
            )
            assertEquals(fixtureCheckout.get("id").asString, created.id)
            assertFalse(created.resultingPaymentId != null)
            val request = server.takeRequest()
            assertEquals("/api/v1/finance/checkouts", request.path)
            assertEquals("POST", request.method)
            assertEquals(value("createKey"), request.getHeader("Idempotency-Key"))
            assertEquals(value("authorization"), request.getHeader("Authorization"))
            val body = JsonParser.parseString(request.body.readUtf8()).asJsonObject
            assertEquals(value("provider"), body.get("provider").asString)
            assertEquals(value("tenancyId"), body.get("tenancyId").asString)
            assertEquals(value("amount"), body.get("amount").asString)
        }
    }

    @Test fun demoProviderIsExplicitAndNeverConfirmsPaymentOnCreation() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(number("createResponseCode")).setBody(fixtureCheckout.deepCopy().apply { addProperty("provider", value("demoProvider")) }.toString()))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val checkout = V1PaymentGateway(client(server)).create(value("tenancyId"), value("wholeAmount"), value("createKey"), value("demoProvider"))
            val body = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertEquals(value("demoProvider"), body.get("provider").asString)
            assertEquals(fixtureCheckout.get("status").asString, checkout.status)
            assertFalse(com.trooi.app.features.tenancy.isConfirmedGatewayPayment(checkout))
        }
    }

    @Test
    fun extraAuthorizationHeaderCannotOverrideBearer() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(number("createResponseCode")).setBody(checkoutJson()))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val outcome = client(server).postJson(
                "finance/checkouts",
                JsonObject().apply { addProperty("tenancyId", value("tenancyId")); addProperty("amount", value("amount")) }.toString(),
                authenticated = true,
                headers = mapOf(
                    "Idempotency-Key" to value("headerKey"),
                    "Authorization" to value("hijackedAuthorization"),
                ),
            )
            assertTrue(outcome is TransportOutcome.Success)
            val request = server.takeRequest()
            assertEquals(value("authorization"), request.getHeader("Authorization"))
            assertEquals(value("headerKey"), request.getHeader("Idempotency-Key"))
        }
    }

    @Test
    fun getCheckoutIsNotPostedAndUnrelatedGetStillRetries() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody(checkoutJson()))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val checkout = V1PaymentGateway(client(server)).get(fixtureCheckout.get("id").asString)
            assertEquals(fixtureCheckout.get("status").asString, checkout.status)
            val get = server.takeRequest()
            assertEquals("GET", get.method)
            assertEquals("/api/v1/finance/checkouts/${fixtureCheckout.get("id").asString}", get.path)
            assertEquals(number("singleRequestCount"), server.requestCount)
        }
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
            server.enqueue(MockResponse().setBody(fixture.get("publicResponse").toString()))
            server.start(InetAddress.getLoopbackAddress(), 0)
            assertTrue(client(server).get("listings/public") is TransportOutcome.Success)
            assertEquals(number("retryRequestCount"), server.requestCount)
        }
    }

    @Test
    fun reconcilePostsToCheckoutIdAndIsNotAGet() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody(checkoutJson()))
            server.start(InetAddress.getLoopbackAddress(), 0)
            V1PaymentGateway(client(server)).reconcile(fixtureCheckout.get("id").asString)
            val request = server.takeRequest()
            assertEquals("POST", request.method)
            assertEquals("/api/v1/finance/checkouts/${fixtureCheckout.get("id").asString}/reconcile", request.path)
            assertEquals(value("authorization"), request.getHeader("Authorization"))
        }
    }

    @Test
    fun createPostIsNotSilentlyRetried() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val result = runCatching {
                V1PaymentGateway(client(server)).create(value("tenancyId"), value("amount"), value("disconnectKey"))
            }
            assertTrue(result.isFailure)
            assertEquals(number("singleRequestCount"), server.requestCount)
        }
    }

    @Test
    fun manualPaymentBodyOmitsVerification() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(
                MockResponse().setResponseCode(number("createResponseCode")).setBody(
                    payment.toString(),
                ),
            )
            server.start(InetAddress.getLoopbackAddress(), 0)
            V1RentalGateway(client(server)).recordPayment(value("tenancyId"), payment.get("amount").asString, payment.get("source").asString, payment.get("confirmedAt").asString)
            val sent = JsonParser.parseString(server.takeRequest().body.readUtf8()).asJsonObject
            assertEquals(payment.get("source").asString, sent.get("source").asString)
            assertEquals(payment.get("amount").asString, sent.get("amount").asString)
            assertEquals(value("tenancyId"), sent.get("tenancyId").asString)
            assertEquals(payment.get("confirmedAt").asString, sent.get("confirmedAt").asString)
            assertFalse(sent.has("verification"))
        }
    }

    @Test
    fun unconfiguredPostDoesNotHitNetwork() = runBlocking {
        val tokens = InMemoryAuthTokenProvider().apply { setToken(value("unconfiguredToken")) }
        val outcome = BackendClient("", tokens).postJson(
            "finance/checkouts",
            "{}",
            true,
            mapOf("Idempotency-Key" to value("unconfiguredKey")),
        )
        assertEquals(TransportOutcome.Failure(ErrorKind.UNCONFIGURED), outcome)
    }
}
