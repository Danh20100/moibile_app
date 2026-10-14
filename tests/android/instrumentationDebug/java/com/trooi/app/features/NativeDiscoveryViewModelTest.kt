package com.trooi.app.features

import android.content.Context
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.trooi.app.core.auth.GoogleCredentialAuth
import com.trooi.app.core.auth.SessionHintsStore
import com.trooi.app.core.data.AppDataSource
import com.trooi.app.core.data.BackendTroOiRepository
import com.trooi.app.core.data.RuntimeDataSource
import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.InMemoryAuthTokenProvider
import com.trooi.app.core.network.OkHttpBackendApi
import com.trooi.app.features.discovery.DiscoveryExperience
import com.trooi.app.features.shared.V1ContractGateway
import com.trooi.app.features.shared.V1PaymentGateway
import com.trooi.app.features.shared.V1RentalGateway
import com.trooi.app.features.shared.V1TrustGateway
import com.trooi.app.ui.TroOiViewModel
import com.trooi.app.ui.theme.TroOiTheme
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeDiscoveryViewModelTest {
    @get:Rule val compose = createComposeRule()

    @Test fun publicDiscoveryResultsTitleIsExposedAsHeading() {
        compose.setContent {
            TroOiTheme {
                DiscoveryExperience(
                    state = TroOiUiState(),
                    onOpenListing = {},
                    onOpenMap = {},
                    allowDemoFallback = false,
                )
            }
        }
        assertTrue(
            compose.onNodeWithText("Phòng đang cho thuê")
                .fetchSemanticsNode().config.contains(SemanticsProperties.Heading),
        )
    }

    @Test fun backendTimeoutFlowsThroughViewModelToRetryAndEmptyUiWithoutFixtures() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val previousMode = RuntimeDataSource.currentMode()
        val attempts = AtomicInteger()
        val transport = OkHttpClient.Builder().addInterceptor { chain ->
            if (attempts.incrementAndGet() <= 2) throw IOException("synthetic timeout")
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .header("Content-Type", "application/json")
                .body("""{"success":true,"data":[]}""".toResponseBody("application/json".toMediaType()))
                .build()
        }.build()
        val tokens = InMemoryAuthTokenProvider()
        val client = BackendClient("http://127.0.0.1/", tokens, true, transport)
        val api = OkHttpBackendApi(client)
        check(RuntimeDataSource.chooseDebugSource(context, AppDataSource.BACKEND))
        val viewModel = TroOiViewModel(
            BackendTroOiRepository(api, tokens, context), api, GoogleCredentialAuth(api),
            SessionHintsStore(context, "native_discovery_view_model_test"),
            V1PaymentGateway(client), V1RentalGateway(client), V1ContractGateway(client), V1TrustGateway(client), context,
        )
        try {
            compose.setContent {
                val state by viewModel.state.collectAsState()
                TroOiTheme {
                    DiscoveryExperience(
                        state = state,
                        onOpenListing = {},
                        onOpenMap = {},
                        onRetrySearch = viewModel::retryPublicDiscovery,
                        allowDemoFallback = false,
                    )
                }
            }
            compose.waitUntil(5_000) { attempts.get() >= 2 }
            assertEquals(2, attempts.get())
            compose.waitUntil(5_000) { viewModel.state.value.publicDiscoveryError != null }
            val error = checkNotNull(viewModel.state.value.publicDiscoveryError)
            assertTrue(error.contains("NETWORK_UNAVAILABLE"))
            compose.onAllNodesWithText(error).assertCountEquals(1)
            assertFalse(DemoData.read.publicListings.any { listing ->
                compose.onAllNodesWithText(listing.title).fetchSemanticsNodes().isNotEmpty()
            })

            compose.onNodeWithTag("discovery-retry").performClick()
            compose.onNodeWithText("Chưa có tin đăng phù hợp. Hãy thử mở rộng khu vực hoặc khoảng giá.").assertIsDisplayed()
            assertEquals(3, attempts.get())
        } finally {
            RuntimeDataSource.chooseDebugSource(context, previousMode)
        }
    }
}
