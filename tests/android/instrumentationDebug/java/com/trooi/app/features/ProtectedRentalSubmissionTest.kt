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

/** No Espresso or real server: prove protected submissions never reach transport. */
@RunWith(AndroidJUnit4::class)
class ProtectedRentalSubmissionTest {
    @Test fun financialAndLinkedPermissionWritesRequireServerProof() {
        val calls = AtomicInteger()
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            calls.incrementAndGet()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(500).message("Synthetic only").body("{}".toResponseBody()).build()
        }.build()
        val backend = BackendClient("http://127.0.0.1:1", InMemoryAuthTokenProvider(), true, client)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val model = RentalViewModel(V1RentalGateway(backend), V1ContractGateway(backend), V1PaymentGateway(backend), SessionHintsStore(context, "round3-security-test"))
        val submissions = listOf<() -> Unit>(
            { model.createBilling("t", "terms", "2026-10-01", "2026-10-31", "rent", "1000") },
            { model.recordPayment("synthetic-tenancy", "1000", "cash") },
            { model.allocate("p", "c", "1000") },
            { model.applyPaymentToDeposit("p", "d", "1000") },
            { model.createDeposit("t") },
            { model.settleDeposit("t", "1000", "0", "test") },
            { model.issueReceipt("p") },
            { model.voidReceipt("r") },
            { model.linkParticipant("t", "p", "u") },
            { model.leaveParticipant("t", RentalParticipant("p", "t", "occupant", "u", null)) },
        )
        submissions.forEach { submit ->
            submit()
            assertEquals("REAUTH_UNAVAILABLE", model.ui.value.errorKind)
            assertFalse(model.ui.value.busy)
            assertNull(model.ui.value.success)
        }
        assertEquals(0, calls.get())
    }
}
