package com.trooi.app.features

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.landlord.LandlordDashboardScreen
import com.trooi.app.features.landlord.LandlordFinanceScreen
import com.trooi.app.features.landlord.LandlordRoomsScreen
import com.trooi.app.features.landlord.LandlordTicketsScreen
import com.trooi.app.features.tenant.TenantHomeScreen
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Runs on a physical device or emulator; stresses lazy composition across screen heights. */
@RunWith(AndroidJUnit4::class)
class ScrollSmokeTest {
    @get:Rule val compose = createComposeRule()

    private val state get() = TroOiUiState(
        rooms = DemoData.rooms,
        savedRoomIds = setOf(1, 2),
        bookings = DemoData.bookings,
        conversations = DemoData.conversations,
        tickets = DemoData.tickets,
        finance = DemoData.finance,
    )

    private fun scrollRepeatedly(tag: String) {
        repeat(12) {
            compose.onNodeWithTag(tag).performTouchInput { swipeUp() }
            compose.waitForIdle()
        }
    }

    @Test
    fun landlordDashboardScrollsWithoutDuplicateItemKeys() {
        compose.setContent {
            TroOiTheme {
                LandlordDashboardScreen(state, {}, {}, {}, {})
            }
        }
        scrollRepeatedly("landlord-dashboard-list")
    }

    @Test
    fun landlordRoomsScrollsOnDifferentRoomHeights() {
        compose.setContent { TroOiTheme { LandlordRoomsScreen(state) } }
        scrollRepeatedly("landlord-rooms-list")
    }

    @Test
    fun landlordFinanceScrollsWithMixedRoomAndTransactionIds() {
        compose.setContent { TroOiTheme { LandlordFinanceScreen(state) } }
        scrollRepeatedly("landlord-finance-list")
    }

    @Test
    fun landlordTicketsScrolls() {
        compose.setContent { TroOiTheme { LandlordTicketsScreen(state, {}) } }
        scrollRepeatedly("landlord-tickets-list")
    }

    @Test
    fun tenantHomeScrollsAcrossMapAndRoomCards() {
        compose.setContent { TroOiTheme { TenantHomeScreen(state, {}, {}) } }
        scrollRepeatedly("tenant-home-list")
    }
}
