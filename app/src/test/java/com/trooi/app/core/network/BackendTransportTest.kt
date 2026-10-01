package com.trooi.app.core.network

import com.trooi.app.core.network.dto.ErrorKind
import com.trooi.app.core.data.BackendTroOiRepository
import com.trooi.app.core.network.dto.TransportOutcome
import kotlinx.coroutines.runBlocking
import java.net.InetAddress
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class BackendTransportTest {
    private fun localUrl(server: MockWebServer): String =
        server.url("/").newBuilder().host("127.0.0.1").build().toString()
    @Test fun baseUrlRequiresConfigurationAndProtectsReleaseTls() {
        assertEquals("https://example.org/api/", BackendEnvironment.normalize(" https://example.org/api ").toString())
        assertEquals("https://example.org/api/v1/", BackendEnvironment.normalize("https://example.org").toString())
        assertThrows(IllegalArgumentException::class.java) { BackendEnvironment.normalize("") }
        assertThrows(IllegalArgumentException::class.java) { BackendEnvironment.normalize("http://example.org") }
        assertThrows(IllegalArgumentException::class.java) { BackendEnvironment.normalize("http://example.org", true) }
        assertThrows(IllegalArgumentException::class.java) { BackendEnvironment.normalize("https://a:b@example.org") }
        assertThrows(IllegalArgumentException::class.java) { BackendEnvironment.normalize("https://example.org/?token=secret") }
        assertEquals("http://127.0.0.1:4000/api/v1/", BackendEnvironment.normalize("http://127.0.0.1:4000", true).toString())
    }

    @Test fun publicListingTransportNeverSendsBearerOrMapsUnknownDto() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("{\"items\":[{\"unknownField\":7}]}").addHeader("Content-Type", "application/json"))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val token = InMemoryAuthTokenProvider().apply { setToken("private-id-token") }
            val api = OkHttpBackendApi(BackendClient(localUrl(server), token, allowLocalHttp = true))
            val result = api.getPublicListingsRaw()
            assertTrue(result is TransportOutcome.Success)
            assertTrue((result as TransportOutcome.Success).document.rawBody.contains("unknownField"))
            val request = server.takeRequest()
            assertEquals("/api/v1/listings/public", request.path)
            assertNull(request.getHeader("Authorization"))
        }
    }

    @Test fun protectedRequestUsesBearerAndInvalidatesExpiredSession() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(401))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("test-google-id-token") }
            val client = BackendClient(localUrl(server), tokens, allowLocalHttp = true)
            val result = client.get("protected-read", authenticated = true)
            assertEquals(TransportOutcome.Failure(ErrorKind.AUTH_EXPIRED, 401), result)
            assertEquals("Bearer test-google-id-token", server.takeRequest().getHeader("Authorization"))
            assertNull(tokens.token())
            assertEquals(TransportOutcome.Failure(ErrorKind.AUTH_EXPIRED), client.get("protected-read", true))
        }
    }

    @Test fun missingConfigAndNetworkErrorsDoNotReturnDemoData() = runBlocking {
        val tokens = InMemoryAuthTokenProvider()
        assertEquals(TransportOutcome.Failure(ErrorKind.UNCONFIGURED), BackendClient("", tokens).get("listings/public"))
        val failed = BackendClient("http://127.0.0.1:1", tokens, true).get("listings/public")
        assertEquals(TransportOutcome.Failure(ErrorKind.NETWORK_UNAVAILABLE), failed)
    }

    @Test fun backendRepositoryLogoutClearsTokenAndNeverExposesDemoSnapshot() {
        val token = InMemoryAuthTokenProvider().apply { setToken("short-lived-google-id-token") }
        val api = OkHttpBackendApi(BackendClient("", token))
        val repository = BackendTroOiRepository(api, token)
        assertFalse(repository.initialSnapshot().demoPreview)
        assertTrue(repository.initialSnapshot().read.publicListings.isEmpty())
        repository.clearSession()
        assertNull(token.token())
    }

    @Test fun httpFailuresAndForbiddenAreTyped() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(403))
            server.enqueue(MockResponse().setResponseCode(503))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val client = BackendClient(localUrl(server), InMemoryAuthTokenProvider(), true)
            assertEquals(TransportOutcome.Failure(ErrorKind.FORBIDDEN, 403), client.get("listings/public"))
            assertEquals(TransportOutcome.Failure(ErrorKind.HTTP_ERROR, 503), client.get("listings/public"))
        }
    }
}
