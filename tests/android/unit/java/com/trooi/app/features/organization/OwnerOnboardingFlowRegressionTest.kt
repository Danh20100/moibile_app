package com.trooi.app.features.organization

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class OwnerOnboardingFlowRegressionTest {
    private val operator = File("src/main/java/com/trooi/app/features/organization/OperatorWorkspace.kt").readText()
    private val routes = File("src/main/java/com/trooi/app/features/organization/OperatorViewModel.kt").readText()
    private val app = File("src/main/java/com/trooi/app/ui/TroOiApp.kt").readText()
    private val root = File("src/main/java/com/trooi/app/ui/TroOiViewModel.kt").readText()

    @Test fun successPageRequiresExplicitContinueOrLater() {
        assertTrue(routes.contains("OperatorRoute.OrganizationCreated(refreshed.id)"))
        assertTrue(operator.contains("owner-setup-continue"))
        assertTrue(operator.contains("owner-setup-later"))
        assertTrue(operator.contains("model.open(OperatorRoute.CreateProperty(org.id))"))
        assertTrue(operator.contains("TroOiButton(\"Để sau\", onExitToProfile"))
        assertTrue(app.contains("onExitToProfile = viewModel::openAccount"))
        assertFalse(routes.contains("it.stack + OperatorRoute.Organization(refreshed.id)"))
    }

    @Test fun ownershipRefreshPreservesTheUnfinishedSuccessDecision() {
        val tokens = com.trooi.app.core.network.InMemoryAuthTokenProvider()
        val client = com.trooi.app.core.network.BackendClient("http://127.0.0.1:1", tokens, true)
        val model = OperatorViewModel(
            com.trooi.app.features.shared.V1ContractGateway(client),
            com.trooi.app.core.network.OkHttpBackendApi(client),
        )
        val started = OperatorViewModel::class.java.getDeclaredField("started").apply { isAccessible = true }
        started.setBoolean(model, true)
        val backing = OperatorViewModel::class.java.getDeclaredField("_ui").apply { isAccessible = true }
        @Suppress("UNCHECKED_CAST")
        val state = backing.get(model) as kotlinx.coroutines.flow.MutableStateFlow<OperatorUiState>
        val complete = OperatorRoute.OrganizationCreated("owner-org")
        state.value = OperatorUiState(stack = listOf(OperatorRoute.Organizations, complete))
        model.begin(
            com.trooi.app.core.model.AccessCapabilities(operatedOrganizationIds = setOf("owner-org")),
            "owner-org",
        )
        assertEquals(complete, state.value.route)
        assertEquals(2, state.value.stack.size)
    }

    @Test fun accountEntryCannotAutoJumpToPropertyOrRoom() {
        assertTrue(app.contains("entry = state.authorizedSource?.let(::operatorEntry)"))
        assertFalse(app.contains("properties.size == 1"))
        assertTrue(root.contains("copy(authorizedSource = null)"))
        assertTrue(root.contains("keepOperatorWorkspace: Boolean = false"))
        assertTrue(root.contains("current.page in setOf(AppPage.OwnerProperties, AppPage.Account)"))
        assertTrue(routes.contains("selectedOrganizationId == scoped"))
    }

    @Test fun propertySetupShowsOneLocationMapAtATimeAndRoomCreationStaysInRooms() {
        assertTrue(routes.contains("data class CreateProperty(val organizationId: String)"))
        assertTrue(operator.contains("if (propertyLocationStep == 0)"))
        assertTrue(operator.contains("private-pin-map"))
        assertTrue(operator.contains("public-pin-map"))
        assertTrue(operator.contains("owner-property-next"))
        assertTrue(operator.contains("owner-property-create"))
        assertTrue(operator.contains("owner-property-rooms"))
        assertTrue(routes.contains("stack = listOf(OperatorRoute.Organizations, OperatorRoute.Organization(organizationId),"))
        assertTrue(routes.contains("success = \"Đã tạo phòng.\""))
    }
}
