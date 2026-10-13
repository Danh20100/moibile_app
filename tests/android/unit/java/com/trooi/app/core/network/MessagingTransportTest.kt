package com.trooi.app.core.network

import com.trooi.app.core.network.dto.ApiOutcome
import com.trooi.app.core.network.dto.ErrorKind
import java.net.InetAddress
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class MessagingTransportTest {
    @Test fun oversizedPrivateImageResponseIsRejectedWithoutRetry() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("x".repeat(3_000_001)))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("account-a-token") }
            val api = OkHttpBackendApi(BackendClient(server.url("/").newBuilder().host("127.0.0.1").build().toString(), tokens, true))
            assertEquals(ApiOutcome.Failure(ErrorKind.INVALID_RESPONSE, 200), api.messagingAttachment("conversation", "image"))
            assertEquals(1, server.requestCount)
        }
    }
    @Test fun imageSendEncodesBytesAndKeepsSenderServerAuthoritative() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(201).setBody("""{"success":true,"data":{"id":"m","conversationId":"c","senderUserId":"a","text":"","createdAt":"2026-10-14T00:00:00.000Z","delivery":"server","attachments":[{"id":"image","byteSize":6,"contentType":"image/jpeg"}]}}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("account-a-token") }
            val api = OkHttpBackendApi(BackendClient(server.url("/").newBuilder().host("127.0.0.1").build().toString(), tokens, true))
            val image = byteArrayOf(-1, -40, -1, -32, -1, -39)
            val result = api.messagingSend("c", "", listOf(image), "account-a-token") as ApiOutcome.Data
            assertEquals("server", result.value.delivery)
            val request = server.takeRequest()
            val body = com.google.gson.JsonParser.parseString(request.body.readUtf8()).asJsonObject
            assertFalse(body.has("senderUserId"))
            assertArrayEquals(image, java.util.Base64.getDecoder().decode(body.getAsJsonArray("images")[0].asJsonObject["base64"].asString))
        }
    }
    @Test fun changedAccountCannotSendPreviousAccountsDraft() = runBlocking {
        val tokens = InMemoryAuthTokenProvider().apply { setToken("account-b-token") }
        val api = OkHttpBackendApi(BackendClient("http://127.0.0.1:1/", tokens, true))
        assertEquals(ApiOutcome.Failure(ErrorKind.AUTH_EXPIRED), api.messagingSend("conversation", "A draft", emptyList(), "account-a-token"))
        assertEquals("account-b-token", tokens.token())
    }
    @Test fun privateImageUsesBearerScopedPrefixAndEnvelope() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"contentType":"image/jpeg","base64":"/9j/4P/Z"}}"""))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("account-a-token") }
            val api = OkHttpBackendApi(BackendClient(server.url("/api/v1/").newBuilder().host("127.0.0.1").build().toString(), tokens, true))
            val result = api.messagingAttachment("conversation", "image") as ApiOutcome.Data
            assertEquals("image/jpeg", result.value.contentType)
            val request = server.takeRequest()
            assertEquals("/api/v1/messaging/conversations/conversation/attachments/image", request.path)
            assertEquals("Bearer account-a-token", request.getHeader("Authorization"))
        }
    }
    @Test fun failedSendStaysFailureAndNeverReturnsLocalMessage() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(503))
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("account-a-token") }
            val api = OkHttpBackendApi(BackendClient(server.url("/").newBuilder().host("127.0.0.1").build().toString(), tokens, true))
            assertEquals(ApiOutcome.Failure(ErrorKind.HTTP_ERROR, 503), api.messagingSend("conversation", "Hello B", emptyList()))
            val request = server.takeRequest()
            assertFalse(request.body.readUtf8().contains("senderUserId"))
            assertEquals("POST", request.method)
            assertEquals(1, server.requestCount)
        }
    }
}
