package com.trooi.app.features

import com.google.gson.JsonParser
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.AppPage
import com.trooi.app.core.model.canOpenPage
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.InMemoryAuthTokenProvider
import com.trooi.app.features.shared.TrustReportDestination
import com.trooi.app.features.shared.TrustReportReason
import com.trooi.app.features.shared.V1RequestException
import com.trooi.app.features.shared.V1TrustGateway
import com.trooi.app.features.shared.claimTrustSubmit
import com.trooi.app.features.shared.pageAfterTrustLogin
import com.trooi.app.features.shared.reviewReportEnabled
import com.trooi.app.features.shared.trustBackPage
import com.trooi.app.features.shared.trustReportDestination
import com.trooi.app.features.shared.trustTargetUnavailable
import java.io.File
import java.net.InetAddress
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TrustReportSubmissionTest {
    private fun client(server: MockWebServer) = BackendClient(
        server.url("/").newBuilder().host("127.0.0.1").build().toString(),
        InMemoryAuthTokenProvider().apply { setToken("verified-id-token") },
        allowLocalHttp = true,
    )

    @Test
    fun reportBodyIsOnlyListingReasonAndOptionalNote() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(201).setBody(RECEIPT))
            server.enqueue(MockResponse().setResponseCode(201).setBody(RECEIPT))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val gateway = V1TrustGateway(client(server))

            val withNote = gateway.submitListingReport("list-1", "SPAM", "  sai giá  ")
            val noted = server.takeRequest()
            assertEquals("POST", noted.method)
            assertEquals("/api/v1/audit-trust/reports", noted.path)
            assertEquals("Bearer verified-id-token", noted.getHeader("Authorization"))
            assertNull(noted.getHeader("Idempotency-Key"))
            val raw = noted.body.readUtf8()
            assertEquals(setOf("listingId", "reason", "note"), jsonKeys(raw))
            val sent = JsonParser.parseString(raw).asJsonObject
            assertEquals("list-1", sent.get("listingId").asString)
            assertEquals("SPAM", sent.get("reason").asString)
            assertEquals("sai giá", sent.get("note").asString)
            assertFalse(sent.has("reporterUserId"))
            assertFalse(sent.has("status"))
            assertFalse(sent.has("reviewId"))
            assertEquals("rep-1", withNote.id)
            assertEquals("list-1", withNote.listingId)
            assertEquals("SUBMITTED", withNote.status)

            gateway.submitListingReport("list-1", "OTHER", "   ")
            val bare = server.takeRequest()
            assertNull(bare.getHeader("Idempotency-Key"))
            assertEquals(setOf("listingId", "reason"), jsonKeys(bare.body.readUtf8()))
            assertEquals(2, server.requestCount)
        }
    }

    @Test
    fun missingPublicTargetIsUnavailableAndDoesNotPost() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(404).setBody("""{"message":"missing"}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val failure = runCatching { V1TrustGateway(client(server)).submitListingReport("list-1", "SPAM", null) }
            val error = failure.exceptionOrNull() as V1RequestException
            assertEquals(404, error.status)
            assertTrue(trustTargetUnavailable(error.status))
            assertEquals(TrustReportDestination.Unavailable, trustReportDestination(true, listingPublic = false, "list-1"))
            val unknown = runCatching { V1TrustGateway(client(server)).submitListingReport("list-1", "NOT_A_REASON", null) }
            assertTrue(unknown.exceptionOrNull() is IllegalArgumentException)
            assertEquals(1, server.requestCount)
        }
    }

    @Test
    fun guestReportOpensLoginAndReturnsToTheListing() {
        val dest = trustReportDestination(authenticated = false, listingPublic = true, listingId = "list-1")
        assertEquals(TrustReportDestination.Login("list-1"), dest)
        assertEquals(AppPage.ListingDetail("list-1"), trustBackPage(AppPage.AuthLogin, "list-1"))
        assertEquals(AppPage.TrustReport("list-1"), pageAfterTrustLogin("list-1", listingPublic = true))
        assertEquals(AppPage.ListingDetail("list-1"), pageAfterTrustLogin("list-1", listingPublic = false))
        assertNull(pageAfterTrustLogin(null, listingPublic = true))
        assertFalse(canOpenPage(AppPage.TrustReport("list-1"), false, AccessCapabilities()))
        assertTrue(canOpenPage(AppPage.TrustReport("list-1"), true, AccessCapabilities()))
    }

    @Test
    fun backFromTheFormReturnsToTheListingCaller() {
        assertEquals(
            AppPage.ListingDetail("list-1"),
            trustBackPage(AppPage.TrustReport("list-1"), null),
        )
    }

    @Test
    fun reviewReportStaysDisabled() {
        assertFalse(reviewReportEnabled())
        val screen = source("com/trooi/app/features/shared/TrustReportScreen.kt")
        val listing = source("com/trooi/app/features/tenant/TenantScreens.kt")
        assertTrue(screen.contains("enabled = reviewReportEnabled()"))
        assertTrue(screen.contains("trust-report-receipt"))
        assertFalse(screen.contains("audit-trust/reports"))
        assertTrue(listing.contains("listing-open-report"))
        assertEquals(
            listOf(
                "INCORRECT_INFORMATION",
                "MISLEADING_PRICE",
                "WRONG_LOCATION",
                "DUPLICATE_LISTING",
                "INAPPROPRIATE_CONTENT",
                "SUSPECTED_FRAUD",
                "PRIVACY_VIOLATION",
                "SPAM",
                "OTHER",
            ),
            TrustReportReason.entries.map { it.name },
        )
    }

    @Test
    fun doubleTapDoesNotClaimASecondSubmit() {
        val gate = AtomicBoolean(false)
        assertTrue(claimTrustSubmit(gate))
        assertFalse(claimTrustSubmit(gate))
        val gateway = source("com/trooi/app/features/shared/V1TrustGateway.kt")
        assertFalse(gateway.contains("Idempotency-Key"))
    }

    private fun jsonKeys(raw: String) = JsonParser.parseString(raw).asJsonObject.keySet()

    private fun source(relative: String): String =
        File(System.getProperty("user.dir"), "src/main/java/$relative").readText()

    private companion object {
        const val RECEIPT =
            """{"id":"rep-1","reporterUserId":"user-9","listingId":"list-1","reason":"SPAM","status":"SUBMITTED","createdAt":"2026-10-06T00:00:00.000Z"}"""
    }
}
