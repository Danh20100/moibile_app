package com.trooi.app.core.model

import com.trooi.app.core.data.TroOiRepositoryImpl
import com.trooi.app.core.demo.DemoData
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Test

class LocalConversationTest {
    @Test fun concurrentLocalSavesPreserveEveryMessageAndRespectTheLimit() = runBlocking {
        val repository = TroOiRepositoryImpl()
        repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
        withContext(Dispatchers.Default) { coroutineScope {
            (0 until 100).map { index -> async { repository.saveLocalMessage(DemoData.accounts[0].userId, "conversation-a02", "Ghi chú $index") } }
                .awaitAll().forEach { assertTrue(it.isSuccess) }
        } }
        val notes = repository.loadLocalConversations().getOrThrow().flatMap { it.messages }.filter { it.localOnly }
        assertEquals(100, notes.size)
        assertEquals(100, notes.map { it.id }.toSet().size)
        assertEquals((0 until 100).map { "Ghi chú $it" }.toSet(), notes.map { it.text }.toSet())
        assertTrue(repository.saveLocalMessage(DemoData.accounts[0].userId, "conversation-a02", "Vượt giới hạn").isFailure)
        assertEquals(notes, repository.loadLocalConversations().getOrThrow().flatMap { it.messages }.filter { it.localOnly })
    }
    @Test fun localMessagesRemainPrivateAndNeverMutateRentalFinance() = runBlocking {
        val repository = TroOiRepositoryImpl()
        val tenant = repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
        val before = repository.refreshAuthorizedRead(tenant.access).getOrThrow()
        val conversations = repository.loadLocalConversations().getOrThrow()
        assertEquals(2, conversations.size)
        assertEquals(DemoData.ROOM, conversations.first().contextId)
        assertEquals(DemoData.accounts[1].displayName, conversations.first().counterpartName)
        assertTrue(repository.saveLocalMessage(DemoData.accounts[0].userId, "foreign-conversation", "Nội dung").isFailure)
        assertTrue(repository.saveLocalMessage(DemoData.accounts[0].userId, "conversation-a02", " ").isFailure)
        assertTrue(repository.saveLocalMessage(DemoData.accounts[0].userId, "conversation-a02", "x".repeat(501)).isFailure)
        val after = repository.saveLocalMessage(DemoData.accounts[0].userId, "conversation-a02", "  Em đã ghi lại lịch sửa vòi nước.  ").getOrThrow()
        val saved = after.conversations.first().messages.last()
        assertEquals("Em đã ghi lại lịch sửa vòi nước.", saved.text)
        assertEquals(tenant.userId, saved.senderUserId)
        assertTrue(saved.localOnly)
        assertEquals(before.tenantFinanceByTenancy, after.tenantFinanceByTenancy)
        assertEquals(before.incidents, after.incidents)
        repository.clearSession()
        repository.login("owner@trooi.local", "TroOi2026!").getOrThrow()
        val owner = repository.loadLocalConversations().getOrThrow()
        assertEquals(tenant.displayName, owner.first().counterpartName)
        assertFalse(owner.flatMap { it.messages }.any { it.id == saved.id })
        assertTrue(repository.saveLocalMessage(tenant.userId, "conversation-a02", "Late tenant write").isFailure)
        assertEquals(owner, repository.loadLocalConversations().getOrThrow())
        repository.clearSession()
        repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
        assertTrue(repository.loadLocalConversations().getOrThrow().flatMap { it.messages }.any { it.id == saved.id })
        repository.clearSession()
        repository.login("onboarding@trooi.local", "TroOi2026!").getOrThrow()
        assertTrue(repository.loadLocalConversations().getOrThrow().isEmpty())
        assertTrue(repository.saveLocalMessage(DemoData.accounts[2].userId, "conversation-a02", "Nội dung").isFailure)
    }
}
