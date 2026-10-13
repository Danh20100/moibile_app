package com.trooi.app.features.profile

import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.InMemoryAuthTokenProvider
import com.trooi.app.features.organization.OperatorViewModel
import com.trooi.app.features.shared.V1ContractGateway
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class ProtectedSubmissionTest {
    @Test fun sessionCannotGrantManagementWithoutServerReauthentication() {
        MockWebServer().use { server ->
            server.start()
            val tokens = InMemoryAuthTokenProvider().apply { setToken("synthetic-session") }
            val model = OperatorViewModel(V1ContractGateway(BackendClient(server.url("/").toString(), tokens, true)))
            model.createOrganization("Synthetic organization")
            assertEquals("REAUTH_UNAVAILABLE", model.ui.value.errorKind)
            assertFalse(model.ui.value.busy)
            assertNull(model.ui.value.success)
            assertEquals(0, server.requestCount)
        }
    }
}
