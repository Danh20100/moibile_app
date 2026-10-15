package com.trooi.app.core.auth

import com.trooi.app.core.data.UserSession
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.SelectedContext
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionRestoreTest {
    private val session = UserSession(
        userId = "user-1",
        displayName = "A",
        access = AccessCapabilities(linkedTenancyIds = setOf("t-1")),
    )

    @Test
    fun restore_rotates_server_session_before_applying_hints() = runBlocking {
        val calls = mutableListOf<String>()
        val outcome = restoreVerifiedSession(
            restore = { Result.success(session) },
            hintsFor = { SessionHints("user-1", true, SelectedContext.Tenant("t-1")) },
            log = calls,
        )
        assertEquals(listOf("session/refresh", "hints", "context"), calls)
        assertTrue(outcome is RestoreOutcome.Restored)
        assertEquals(SelectedContext.Tenant("t-1"), (outcome as RestoreOutcome.Restored).resolution.selection)
    }

    @Test
    fun wrongUserHintsAreIgnored() = runBlocking {
        val outcome = restoreVerifiedSession(
            restore = { Result.success(session) },
            hintsFor = {
                SessionHints("other-user", true, SelectedContext.Tenant("t-other"))
            },
        ) as RestoreOutcome.Restored
        assertEquals(SelectedContext.Tenant("t-1"), outcome.resolution.selection)
    }

    @Test
    fun offlineOrUnauthorizedFailsClosed() = runBlocking {
        val offline = restoreVerifiedSession(
            restore = { Result.failure(IllegalStateException("offline")) },
            hintsFor = { null },
        )
        assertEquals(RestoreOutcome.FailedClosed, offline)
        assertFalse(offline is RestoreOutcome.Restored)
        val unauthorized = restoreVerifiedSession(
            restore = { Result.failure(IllegalStateException("401")) },
            hintsFor = { null },
        )
        assertEquals(RestoreOutcome.FailedClosed, unauthorized)
        val cancelled = restoreVerifiedSession(
            restore = { Result.failure(IllegalStateException("offline")) },
            hintsFor = { null },
        )
        assertEquals(RestoreOutcome.FailedClosed, cancelled)
        val stateAfterOfflineFailure = TroOiUiStateLike(isAuthenticated = offline is RestoreOutcome.Restored)
        assertFalse(stateAfterOfflineFailure.isAuthenticated)
    }

    @Test
    fun missingCredentialRequiresExplicitLogin() = runBlocking {
        val outcome = restoreVerifiedSession(
            restore = { Result.failure(NoRestoreCredential()) },
            hintsFor = { null },
        )
        assertEquals(RestoreOutcome.NeedsLogin, outcome)
    }

    private data class TroOiUiStateLike(val isAuthenticated: Boolean)
}
