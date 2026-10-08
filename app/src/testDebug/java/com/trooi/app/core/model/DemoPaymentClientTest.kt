package com.trooi.app.core.model

import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.demo.DemoPaymentClient
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class DemoPaymentClientTest {
    @Test fun realSessionScopePrecedesExplicitDemoCheckoutAndForeignIdentityFailsClosed() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            fun response(json: String) = server.enqueue(MockResponse().setHeader("Content-Type", "application/json").setBody(json))
            val client = DemoPaymentClient(server.url("api/v1").newBuilder().host("127.0.0.1").build().toString())
            response("""{"userId":"e0080000-0000-4000-8000-000000000001","token":"transient-fixture-bearer"}""")
            response("""{"userId":"e0080000-0000-4000-8000-000000000001","linkedTenancyIds":["${DemoData.TENANCY}"],"operatedOrganizationIds":[]}""")
            response("""{"id":"checkout-1","tenancyId":"${DemoData.TENANCY}","amount":"1000.00","referenceCode":"ref-1","provider":"DEMO","status":"CREATED","createdAt":"2026-10-08T00:00:00Z","replayAllowed":true}""")
            val checkout = client.create(DemoData.accounts[0].userId, DemoData.TENANCY, "1000", "immutable-key")
            assertEquals("CREATED", checkout.status)
            assertNull(checkout.resultingPaymentId)
            assertEquals("/api/v1/demo/login", server.takeRequest().path)
            assertEquals("Bearer transient-fixture-bearer", server.takeRequest().getHeader("Authorization"))
            val request = server.takeRequest()
            assertEquals("immutable-key", request.getHeader("Idempotency-Key"))
            assertTrue(request.body.readUtf8().contains("\"provider\":\"DEMO\""))
            response("""{"userId":"e0080000-0000-4000-8000-000000000002","token":"foreign-bearer"}""")
            assertTrue(runCatching { client.get(DemoData.accounts[0].userId, "checkout-1") }.isFailure)
            assertEquals("/api/v1/demo/login", server.takeRequest().path)
            assertEquals(4, server.requestCount)
        }
    }
}
