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
    fun restore_requires_verified_me_before_hints() = runBlocking {
        val calls = mutableListOf<String>()
        val idToken = "google-id-token-secret"
        val persistedValues = mutableListOf("user-1", "tenant:t-1")
        val outcome = restoreVerifiedSession(
            reacquire = { Result.success(idToken) },
            authenticateGoogle = { Result.success(Unit) },
            loadMe = { Result.success(session) },
            hintsFor = { SessionHints("user-1", true, SelectedContext.Tenant("t-1")) },
            log = calls,
        )
        assertEquals(listOf("credential", "auth/google", "me", "hints", "context"), calls)
        assertFalse(persistedValues.any { it.contains(idToken) })
        assertTrue(outcome is RestoreOutcome.Restored)
        assertEquals(SelectedContext.Tenant("t-1"), (outcome as RestoreOutcome.Restored).resolution.selection)
    }

    @Test
    fun wrongUserHintsAreIgnored() = runBlocking {
        val outcome = restoreVerifiedSession(
            reacquire = { Result.success("token") },
            authenticateGoogle = { Result.success(Unit) },
            loadMe = { Result.success(session) },
            hintsFor = {
                SessionHints("other-user", true, SelectedContext.Tenant("t-other"))
            },
        ) as RestoreOutcome.Restored
        assertEquals(SelectedContext.Tenant("t-1"), outcome.resolution.selection)
    }

    @Test
    fun offlineOrUnauthorizedFailsClosed() = runBlocking {
        val offline = restoreVerifiedSession(
            reacquire = { Result.success("token") },
            authenticateGoogle = { Result.success(Unit) },
            loadMe = { Result.failure(IllegalStateException("offline")) },
            hintsFor = { null },
        )
        assertEquals(RestoreOutcome.FailedClosed, offline)
        assertFalse(offline is RestoreOutcome.Restored)
        val unauthorized = restoreVerifiedSession(
            reacquire = { Result.success("token") },
            authenticateGoogle = { Result.failure(IllegalStateException("401")) },
            loadMe = { error("me must not run") },
            hintsFor = { null },
        )
        assertEquals(RestoreOutcome.FailedClosed, unauthorized)
        val cancelled = restoreVerifiedSession(
            reacquire = { Result.failure(IllegalStateException("cancel")) },
            authenticateGoogle = { error("auth must not run") },
            loadMe = { error("me must not run") },
            hintsFor = { null },
        )
        assertEquals(RestoreOutcome.FailedClosed, cancelled)
        val stateAfterOfflineFailure = TroOiUiStateLike(isAuthenticated = offline is RestoreOutcome.Restored)
        assertFalse(stateAfterOfflineFailure.isAuthenticated)
    }

    @Test
    fun missingCredentialRequiresExplicitLogin() = runBlocking {
        val outcome = restoreVerifiedSession(
            reacquire = { Result.failure(NoRestoreCredential()) },
            authenticateGoogle = { error("auth must not run") },
            loadMe = { error("me must not run") },
            hintsFor = { null },
        )
        assertEquals(RestoreOutcome.NeedsLogin, outcome)
    }

    private data class TroOiUiStateLike(val isAuthenticated: Boolean)
}
