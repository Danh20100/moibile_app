package com.trooi.app.features

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.trooi.app.core.model.LedgerSurface
import com.trooi.app.core.model.SourceTarget
import com.trooi.app.ui.components.LedgerAttentionRow
import com.trooi.app.ui.components.LedgerNavStrip
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SourceNavigationSmokeTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun ledgerRowsAndNavOpenExactTargets() {
        val opened = mutableListOf<String>()
        compose.setContent {
            TroOiTheme {
                LedgerNavStrip(
                    active = LedgerSurface.OVERVIEW,
                    items = LedgerSurface.ALL,
                    onSelect = { opened += "nav:$it" },
                )
                LedgerAttentionRow(
                    title = "Payment pay-1",
                    supporting = "Tenancy t-1",
                    onClick = { opened += "payment" },
                )
            }
        }
        compose.onNodeWithText(LedgerSurface.INCIDENT).assertIsDisplayed().performClick()
        compose.onNodeWithText("Payment pay-1").performClick()
        assertEquals(listOf("nav:${LedgerSurface.INCIDENT}", "payment"), opened)
        assertEquals("pay-1", SourceTarget("PAYMENT", "pay-1", tenancyId = "t-1").id)
    }
}
