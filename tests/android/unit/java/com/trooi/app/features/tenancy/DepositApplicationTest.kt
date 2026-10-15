package com.trooi.app.features.tenancy

import com.google.gson.JsonParser
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.InMemoryAuthTokenProvider
import com.trooi.app.features.shared.V1RequestException
import com.trooi.app.features.shared.V1RentalGateway
import com.trooi.app.features.shared.depositApplicationAllowed
import java.io.File
import java.net.InetAddress
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DepositApplicationTest {
    private fun client(server: MockWebServer) = BackendClient(
        server.url("/").newBuilder().host("127.0.0.1").build().toString(),
        InMemoryAuthTokenProvider().apply { setToken("verified-id-token") },
        allowLocalHttp = true,
    )

    @Test
    fun applicationBodyUsesTargetIdAndChosenPayment() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(201).setBody(APPLICATION))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val applied = V1RentalGateway(client(server)).applyPaymentToDeposit("pay-1", "dep-1", "40.00")
            assertEquals("app-1", applied.id)
            assertEquals("pay-1", applied.paymentId)
            assertEquals("dep-1", applied.depositId)
            assertEquals("40.00", applied.appliedAmount)
            val request = server.takeRequest()
            assertEquals("POST", request.method)
            assertEquals("/api/v1/finance/payments/pay-1/deposit-applications", request.path)
            val body = JsonParser.parseString(request.body.readUtf8()).asJsonObject
            assertEquals(setOf("targetId", "amount"), body.keySet())
            assertEquals("dep-1", body.get("targetId").asString)
            assertEquals("40.00", body.get("amount").asString)
            assertFalse(body.has("depositId"))
            assertEquals(1, server.requestCount)
        }
    }

    @Test
    fun overflowDoesNotReturnASuccessfulApplication() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(409).setBody("""{"message":"cap"}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val failure = runCatching {
                V1RentalGateway(client(server)).applyPaymentToDeposit("pay-1", "dep-1", "999.00")
            }
            val error = failure.exceptionOrNull() as V1RequestException
            assertEquals(409, error.status)
            assertTrue(failure.isFailure)
        }
    }

    @Test
    fun onlyOperatorSameTenancyCanApplyAndCheckoutDoesNot() {
        assertTrue(depositApplicationAllowed(false, "t-1", "t-1"))
        assertFalse(depositApplicationAllowed(true, "t-1", "t-1"))
        assertFalse(depositApplicationAllowed(false, "t-1", "t-2"))
        val model = source("com/trooi/app/features/tenancy/RentalViewModel.kt")
        val checkout = model.substringAfter("private suspend fun applyCheckout")
            .substringBefore("private fun persistHint")
        assertFalse(checkout.contains("applyPaymentToDeposit"))
        assertFalse(checkout.contains("deposit-applications"))
        val workspace = source("com/trooi/app/features/tenancy/RentalWorkspace.kt")
        val gatewayPanel = source("com/trooi/app/features/tenancy/GatewayPaymentPanel.kt")
        assertFalse(gatewayPanel.contains("applyPaymentToDeposit"))
        assertFalse(gatewayPanel.contains("Gán vào tiền cọc"))
        assertTrue(workspace.contains("deposit-application-submit"))
        assertTrue(workspace.contains("Phân bổ vào Charge"))
        assertTrue(workspace.contains("Phát hành Receipt"))
    }

    private fun source(relative: String) =
        File(System.getProperty("user.dir"), "src/main/java/$relative").readText()

    private companion object {
        const val APPLICATION =
            """{"id":"app-1","paymentId":"pay-1","depositId":"dep-1","appliedAmount":"40.00","appliedAt":"2026-10-06T00:00:00.000Z"}"""
    }
}
