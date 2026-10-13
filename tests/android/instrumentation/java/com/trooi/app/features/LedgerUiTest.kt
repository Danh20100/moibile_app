package com.trooi.app.features

import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.trooi.app.core.model.*
import com.trooi.app.features.ledger.*
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class LedgerUiTest {
    @get:Rule val compose = createComposeRule()

    @Test fun emptyLedgerExploresWithoutInventingTenancy() {
        var explored = 0
        compose.setContent { TroOiTheme {
            LedgerScreen(TroOiUiState(isAuthenticated = true), { explored++ }, {}, {})
        } }
        compose.onNodeWithText("Bạn chưa có tài sản thuê nào được liên kết.").assertExists()
        compose.onNodeWithTag("ledger-empty-explore").performClick()
        assertEquals(1, explored)
        compose.onNodeWithTag("ledger-payment-entry").assertDoesNotExist()
    }

    @Test fun selectingAssetChangesLedgerAndOnlyNavigatesOnPayment() {
        var financeId: String? = null
        val state = TroOiUiState(isAuthenticated = true, access = AccessCapabilities(linkedTenancyIds = setOf("a", "b")),
            read = FrontendReadSnapshot(tenancies = listOf(
                TenancyCard("a", "ra", "Studio A", TenancyLifecycle.ACTIVE, "A terms"),
                TenancyCard("b", "rb", "Căn hộ B", TenancyLifecycle.ACTIVE, "B terms"),
            ), tenantFinanceByTenancy = mapOf(
                "a" to TenantFinanceProjection("a", charges = listOf(ChargeCard("ca", "Tiền thuê A", "3.000.000đ", null))),
                "b" to TenantFinanceProjection("b", charges = listOf(ChargeCard("cb", "Tiền thuê B", "5.000.000đ", null))),
            )))
        compose.setContent { TroOiTheme { LedgerScreen(state, {}, { financeId = it }, {}) } }
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasText("Tiền thuê A"))
        compose.onNodeWithText("Tiền thuê A").assertExists()
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("ledger-asset-b"))
        compose.onNodeWithTag("ledger-asset-b").performClick().assertIsSelected()
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasText("Tiền thuê B"))
        compose.onNodeWithText("Tiền thuê B").assertExists()
        compose.onNodeWithText("Tiền thuê A").assertDoesNotExist()
        compose.onNodeWithTag("ledger-screen").performScrollToNode(hasTestTag("ledger-payment-entry"))
        compose.onNodeWithTag("ledger-payment-entry").performClick()
        assertEquals("b", financeId)
        assertTrue(state.read.tenantFinanceByTenancy.values.all { it.payments.isEmpty() })
    }

    @Test fun fullCapacityAllowsDraftAndRequiresExplicitPurchaseBeforePublication() {
        val ready = LocalRentalAsset("second", "property-second", "Phòng trọ", "Phòng C01", "Địa chỉ riêng", "Bình Thạnh", "20", "3000000", "3000000", "Phòng sáng",
            photoResources = listOf(com.trooi.app.R.drawable.rental_studio), bathroomArrangement = BathroomArrangement.PRIVATE, maxOccupants = 2)
        var catalog = LocalManagement(assets = listOf(ready.copy(id = "first", status = ManagedAssetStatus.ACTIVE)))
        var closed = false
        compose.setContent {
            var data by remember { mutableStateOf(catalog) }
            TroOiTheme { AssetWizard(ready, data, "Chủ trọ", { closed = true },
                { asset, activate, publish -> runCatching { data = data.save(asset, activate, publish); catalog = data } },
                { id -> runCatching { data = data.purchase(id); catalog = data } }) }
        }
        repeat(5) { compose.onNodeWithTag("asset-next").performClick() }
        compose.onNodeWithTag("asset-publish").performClick()
        compose.waitUntil(5000) { compose.onAllNodesWithTag("capacity-dialog").fetchSemanticsNodes().isNotEmpty() }
        assertEquals(1, catalog.capacity())
        assertEquals(ManagedAssetStatus.DRAFT, catalog.assets.last().status)
        compose.onNodeWithTag("capacity-confirm").performClick()
        assertEquals(1, catalog.capacity())
        compose.onNodeWithText("259.000đ / 1 năm").assertExists()
        compose.onNodeWithTag("capacity-confirm").performClick()
        compose.waitUntil(5000) { catalog.capacity() == 2 }
        assertEquals(1, catalog.used)
        compose.onNodeWithTag("capacity-confirm").performClick()
        compose.waitUntil(5000) { closed }
        assertEquals(2, catalog.used)
        assertEquals(ListingVisibility.PUBLISHED, catalog.assets.last().listingStatus)
    }
}
