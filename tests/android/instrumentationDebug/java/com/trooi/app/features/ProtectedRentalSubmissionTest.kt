package com.trooi.app.features

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.trooi.app.core.auth.SessionHintsStore
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.InMemoryAuthTokenProvider
import com.trooi.app.features.shared.*
import com.trooi.app.features.tenancy.RentalViewModel
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.atomic.AtomicInteger

/** Proves a manual Ledger payment submission reaches the authenticated API and honors its denial. */
@RunWith(AndroidJUnit4::class)
class ProtectedRentalSubmissionTest {
    @Test fun manualPaymentRequiresBackendAuthorizationAndDoesNotFakeSuccess() {
        val calls = AtomicInteger()
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            calls.incrementAndGet()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(403).message("Synthetic authorization denial").body("{}".toResponseBody()).build()
        }.build()
        val tokens = InMemoryAuthTokenProvider().apply { setToken("isolated-test-token") }
        val backend = BackendClient("http://127.0.0.1:1", tokens, true, client)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val model = RentalViewModel(V1RentalGateway(backend), V1ContractGateway(backend), V1PaymentGateway(backend), SessionHintsStore(context, "round3-security-test"))
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            model.recordPayment("synthetic-tenancy", "1000", "MANUAL_CASH")
        }
        repeat(50) { if (model.ui.value.busy) Thread.sleep(100) }
        assertTrue(calls.get() > 0)
        assertEquals("FORBIDDEN", model.ui.value.errorKind)
        assertFalse(model.ui.value.busy)
        assertNull(model.ui.value.success)
    }
}
