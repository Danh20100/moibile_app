package com.trooi.app.features

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.auth.RefreshCredentialStore
import com.trooi.app.core.data.BackendTroOiRepository
import com.trooi.app.core.network.AuthTokenProvider
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.InMemoryAuthTokenProvider
import com.trooi.app.core.network.dto.ApiOutcome
import com.trooi.app.core.network.dto.ErrorKind
import com.trooi.app.core.network.dto.IdentitySessionTransport
import java.lang.reflect.Proxy
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RefreshSessionFailureTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun rejectedRefreshClearsAccessAndPersistedRefreshCredentials() =
        runRefreshFailure(ApiOutcome.Failure(ErrorKind.HTTP_ERROR, 401))

    @Test
    fun ambiguousNetworkFailureClearsRotatingCredentialToPreventReplay() =
        runRefreshFailure(ApiOutcome.Failure(ErrorKind.NETWORK_UNAVAILABLE))

    @Test
    fun malformedRotationClearsCredentialsInsteadOfPersistingAnIncompleteSession() = runRefreshFailure(
        ApiOutcome.Data(IdentitySessionTransport("user-1", "session-1", "", "", "Bearer", 900, "")),
    )

    private fun runRefreshFailure(outcome: ApiOutcome<IdentitySessionTransport>) = runBlocking {
        val credential = "refresh-credential-test-only"
        val store = RefreshCredentialStore(context)
        val tokens: AuthTokenProvider = InMemoryAuthTokenProvider().apply { setToken("old-access-token") }
        store.clear()
        store.write(credential)
        try {
            val api = Proxy.newProxyInstance(
                BackendApi::class.java.classLoader,
                arrayOf(BackendApi::class.java),
            ) { _, method, _ ->
                if (method.name == "refreshIdentitySession") outcome
                else ApiOutcome.Failure(ErrorKind.UNCONFIGURED)
            } as BackendApi
            val result = BackendTroOiRepository(api, tokens, context).refreshSessionContext()

            assertTrue(result.isFailure)
            assertNull(tokens.token())
            assertNull(store.read())
        } finally {
            store.clear()
        }
    }
}
