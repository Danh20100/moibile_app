package com.trooi.app.features.profile

import com.trooi.app.core.data.BackendTroOiRepository
import com.trooi.app.core.network.*
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test
import java.net.InetAddress

class ProfileSessionMappingTest {
    @Test fun existingMeProjectionKeepsPictureAndRelationships() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"userId":"u","name":"Lan","email":"lan@example.com","pictureUrl":"https://example.com/avatar.jpg","linkedTenancyIds":["t"],"operatedOrganizationIds":["o"]}}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("token") }
            val repository = BackendTroOiRepository(OkHttpBackendApi(BackendClient(server.url("/").newBuilder().host("127.0.0.1").build().toString(), tokens, true)), tokens)
            val session = repository.refreshSessionContext().getOrThrow()
            assertEquals("Lan", session.displayName)
            assertEquals("lan@example.com", session.email)
            assertEquals("https://example.com/avatar.jpg", session.pictureUrl)
            assertEquals(setOf("t"), session.access.linkedTenancyIds)
            assertEquals(setOf("o"), session.access.operatedOrganizationIds)
            assertEquals("/api/v1/identity-access/me", server.takeRequest().path)
        }
    }

    @Test fun ownNameUpdateUsesAuthenticatedPatchAndRefreshesSessionProjection() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"userId":"u","displayName":"Mai"}}"""))
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"userId":"u","name":"Mai","email":"lan@example.com","linkedTenancyIds":["t"],"operatedOrganizationIds":["o"]}}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("token") }
            val repository = BackendTroOiRepository(OkHttpBackendApi(BackendClient(server.url("/").newBuilder().host("127.0.0.1").build().toString(), tokens, true)), tokens)
            val session = repository.updateDisplayName("  Mai  ").getOrThrow()
            val patch = server.takeRequest()
            assertEquals("PATCH", patch.method)
            assertEquals("/api/v1/identity-access/profile", patch.path)
            assertEquals("Bearer token", patch.getHeader("Authorization"))
            assertEquals("Mai", com.google.gson.JsonParser.parseString(patch.body.readUtf8()).asJsonObject.get("displayName").asString)
            assertEquals("/api/v1/identity-access/me", server.takeRequest().path)
            assertEquals("Mai", session.displayName)
            assertEquals(setOf("t"), session.access.linkedTenancyIds)
            assertEquals(setOf("o"), session.access.operatedOrganizationIds)
        }
    }

    @Test fun rejectedProfileWriteDoesNotRefreshOrReportASavedName() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(401).setBody("""{"message":"Unauthorized"}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("expired") }
            val repository = BackendTroOiRepository(OkHttpBackendApi(BackendClient(server.url("/").newBuilder().host("127.0.0.1").build().toString(), tokens, true)), tokens)
            assertTrue(repository.updateDisplayName("Mai").isFailure)
            assertEquals(1, server.requestCount)
            assertEquals("PATCH", server.takeRequest().method)
        }
    }
}
