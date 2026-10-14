package com.trooi.app.core.network

import com.trooi.app.core.data.BackendTroOiRepository
import java.net.InetAddress
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.*
import okhttp3.mockwebserver.*
import org.junit.Assert.*
import org.junit.Test

class MessagingRepositoryTest {
    private val id = "b40b85c0-7d30-4d40-904a-389ccfc0d528"
    private val conversation = """{"id":"$id","contextType":"inquiry","contextId":"$id","participants":[{"userId":"a","displayName":"A"},{"userId":"b","displayName":"B"}]}"""
    private fun response(data: String) = MockResponse().setBody("""{"success":true,"data":$data}""")
    @Test fun refreshStartedBeforeSendRetainsServerAcknowledgement() = runBlocking {
        MockWebServer().use { server ->
            val oldHistoryRequested = CountDownLatch(1)
            val releaseOldHistory = CountDownLatch(1)
            var histories = 0
            server.dispatcher = object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse = when {
                    request.path!!.endsWith("identity-access/me") -> response("""{"userId":"a","operatedOrganizationIds":[],"linkedTenancyIds":[]}""")
                    request.path!!.endsWith("/messages") && request.method == "GET" -> {
                        if (++histories == 2) { oldHistoryRequested.countDown(); check(releaseOldHistory.await(5, TimeUnit.SECONDS)) }
                        response("[]")
                    }
                    request.path!!.endsWith("/messages") -> response("""{"id":"m","conversationId":"$id","senderUserId":"a","text":"saved","createdAt":"2026-10-14T00:00:00.000Z","delivery":"server","attachments":[]}""").setResponseCode(201)
                    else -> response("[$conversation]")
                }
            }
            server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("a-token") }
            val repo = BackendTroOiRepository(OkHttpBackendApi(BackendClient(server.url("/").toString(), tokens, true)), tokens)
            repo.loadLocalConversations().getOrThrow()
            val refresh = async(Dispatchers.IO) { repo.loadLocalConversations().getOrThrow() }
            assertTrue(oldHistoryRequested.await(5, TimeUnit.SECONDS))
            try { assertEquals("m", repo.sendMessage("a", id, "saved", emptyList()).getOrThrow().single().messages.single().id) }
            finally { releaseOldHistory.countDown() }
            assertEquals("m", refresh.await().single().messages.single().id)
            assertEquals(1, repo.sendMessage("a", id, "saved", emptyList()).getOrThrow().single().messages.size)
        }
    }
    @Test fun openRetainsAuthoritativeConversationId() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(response("""{"id":"$id"}""").setResponseCode(201)); server.start(InetAddress.getLoopbackAddress(), 0)
            val tokens = InMemoryAuthTokenProvider().apply { setToken("a-token") }
            val repo = BackendTroOiRepository(OkHttpBackendApi(BackendClient(server.url("/").toString(), tokens, true)), tokens)
            assertEquals(id, repo.openConversation("inquiry", id).getOrThrow())
        }
    }
}
