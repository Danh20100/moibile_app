package com.trooi.app.core.model

import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.InMemoryAuthTokenProvider
import com.trooi.app.core.network.OkHttpBackendApi
import com.trooi.app.core.network.dto.ApiOutcome
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue

class ListingMediaConsentApiTest {
    @Test fun ownerConsentUsesAuthorizedPatchAndDiscoveryPhotoUsesPublicRead() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"id":"photo-1","contentType":"image/jpeg","byteSize":3,"position":0,"createdAt":"2026-10-14T00:00:00Z","isPublic":true}}"""))
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"contentType":"image/jpeg","base64":"AQID"}}"""))
            val tokens = InMemoryAuthTokenProvider().apply { setToken("owner-token") }
            val api = OkHttpBackendApi(BackendClient(server.url("api/v1/").toString(), tokens, allowLocalHttp = true))

            val saved = (api.setListingAssetMediaPublic("listing-1", "photo-1", true) as ApiOutcome.Data).value
            assertTrue(saved.isPublic)
            val patch = server.takeRequest()
            assertEquals("PATCH", patch.method)
            assertEquals("/api/v1/listings/listing-1/media/photo-1/public", patch.path)
            assertEquals("Bearer owner-token", patch.getHeader("Authorization"))
            assertEquals("{\"isPublic\":true}", patch.body.readUtf8())

            val bytes = (api.getPublicListingMediaContent("listing-1", "photo-1") as ApiOutcome.Data).value
            assertEquals("AQID", bytes.base64)
            val publicRead = server.takeRequest()
            assertEquals("/api/v1/listings/public/listing-1/media/photo-1/content", publicRead.path)
            assertNull(publicRead.getHeader("Authorization"))
        }
    }
}
