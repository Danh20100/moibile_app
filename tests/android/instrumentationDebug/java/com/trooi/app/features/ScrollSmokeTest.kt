package com.trooi.app.features

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.*
import com.trooi.app.features.tenant.V1DiscoveryScreen
import com.trooi.app.features.tenant.V1TenantPortalScreen
import com.trooi.app.features.landlord.V1OwnerDashboardScreen
import com.trooi.app.features.landlord.V1OwnerPropertiesScreen
import com.trooi.app.features.landlord.V1OwnerFinanceScreen
import com.trooi.app.features.landlord.V1OwnerIncidentsScreen
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ScrollSmokeTest {
    @get:Rule val compose = createComposeRule()

    private val state get() = TroOiUiState(
        isAuthenticated = true,
        selectedContext = SelectedContext.Operations("demo-organization-1"),
        access = AccessCapabilities(setOf("demo-tenancy-1"), setOf("demo-organization-1")),
        read = DemoData.read,
        demoPreview = true,
    )

    private fun scroll(tag: String) = repeat(10) {
        compose.onNodeWithTag(tag).performTouchInput { swipeUp() }
        compose.waitForIdle()
    }

    @Test fun discoveryScrollDoesNotMixDraftAndPublicCards() {
        compose.setContent { TroOiTheme { V1DiscoveryScreen(state, onOpenListing = {}) } }
        scroll("v1-discovery-list")
    }

    @Test fun tenantPortalScrollsWithoutBusinessStateMutations() {
        compose.setContent { TroOiTheme { V1TenantPortalScreen(state) {} } }
        scroll("v1-tenant-portal")
    }

    @Test fun ownerDashboardScrollsFromReadModel() {
        compose.setContent { TroOiTheme { V1OwnerDashboardScreen(state) } }
        scroll("v1-owner-dashboard")
    }

    @Test fun ownerPropertiesScrollAcrossOperationalRooms() {
        compose.setContent { TroOiTheme { V1OwnerPropertiesScreen(state) } }
        scroll("v1-owner-properties")
    }

    @Test fun ownerFinanceScrollsWithoutDebtDerivedPayment() {
        compose.setContent { TroOiTheme { V1OwnerFinanceScreen(state) } }
        scroll("v1-owner-finance")
    }

    @Test fun ownerIncidentScrollDoesNotAutocloseIncident() {
        compose.setContent { TroOiTheme { V1OwnerIncidentsScreen(state) } }
        scroll("v1-owner-incidents")
    }
}
