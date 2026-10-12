package com.trooi.app.features

import android.content.Context
import android.content.ContextWrapper
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.data.*
import com.trooi.app.core.demo.DebugFixtureCatalog
import com.trooi.app.core.network.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class NativeFixtureIsolationTest {
    @Test fun switchingSourcesNeverReusesFixtureSessionOrFallsBackFromBackend() = runBlocking {
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        val prefix = "round4-${java.util.UUID.randomUUID()}-"
        val context = object : ContextWrapper(target) {
            override fun getSharedPreferences(name: String, mode: Int) = super.getSharedPreferences(prefix + name, mode)
        }
        val tokens = InMemoryAuthTokenProvider()
        val backend = BackendTroOiRepository(OkHttpBackendApi(BackendClient("", tokens, true)), tokens)
        val repository = TroOiRepositoryImpl(context, backend)
        try {
            assertTrue(RuntimeDataSource.chooseDebugSource(context, AppDataSource.MOCK))
            val account = DebugFixtureCatalog.current.accounts.first()
            val session = repository.login(account.email, "TroOi2026!").getOrThrow()
            assertEquals(account.session(), session)
            assertTrue(repository.initialSnapshot().demoPreview)
            repository.clearSession()
            assertTrue(RuntimeDataSource.chooseDebugSource(context, AppDataSource.BACKEND))
            assertFalse(repository.initialSnapshot().demoPreview)
            assertTrue(repository.initialSnapshot().read.publicListings.isEmpty())
            assertTrue(repository.refreshSessionContext().isFailure)
            assertTrue(repository.login(account.email, "TroOi2026!").isFailure)
            assertNull(tokens.token())
            repository.clearSession()
            assertTrue(RuntimeDataSource.chooseDebugSource(context, AppDataSource.MOCK))
            assertTrue(repository.refreshSessionContext().isFailure)
            assertEquals(session, repository.login(account.email, "TroOi2026!").getOrThrow())
        } finally {
            repository.clearSession()
            target.deleteSharedPreferences(prefix + "trooi_debug_session")
            target.deleteSharedPreferences(prefix + "trooi_developer_settings")
            RuntimeDataSource.initialize(target)
        }
    }
}
