package com.trooi.app.features

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class SharedPrimitivesTest {
    @get:Rule val compose = createComposeRule()
    @Test fun sharedActionsPreserveEnabledStateClickAndTags() {
        var clicks = 0
        compose.setContent { TroOiTheme {
            Column {
                TroOiButton("Primary", { clicks++ }, modifier = Modifier.testTag("primary"))
                TroOiButton("Disabled", { clicks++ }, enabled = false, modifier = Modifier.testTag("disabled"))
                TroOiButton("Secondary", { clicks++ }, style = TroOiButtonStyle.SECONDARY, modifier = Modifier.testTag("secondary"))
                TroOiButton("Busy", { clicks++ }, busy = true, modifier = Modifier.testTag("busy"))
            }
        } }
        compose.onNodeWithTag("primary").assertHasClickAction().performClick()
        compose.onNodeWithTag("secondary").performClick()
        compose.onNodeWithTag("disabled").assertIsNotEnabled()
        compose.onNodeWithTag("busy").assertIsNotEnabled()
        compose.runOnIdle { assertEquals(2, clicks) }
    }
    @Test fun compactLargeFontInformationActionStacksInBothThemes() {
        var dark by androidx.compose.runtime.mutableStateOf(false)
        compose.setContent { TroOiTheme(darkTheme = dark) {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                Box(Modifier.width(320.dp)) {
                    TroOiInformationRow("Địa chỉ cư trú", "Căn hộ A02, Bình Thạnh, TP. Hồ Chí Minh", "Xem chi tiết",
                        onClick = {}, actionModifier = Modifier.testTag("personal-action-address"))
                }
            }
        } }
        repeat(2) {
            val value = compose.onNodeWithText("Căn hộ A02, Bình Thạnh, TP. Hồ Chí Minh").fetchSemanticsNode().boundsInRoot
            val action = compose.onNodeWithTag("personal-action-address").assertIsDisplayed().assertHasClickAction().fetchSemanticsNode().boundsInRoot
            assertTrue(action.top >= value.bottom)
            compose.runOnIdle { dark = true }
        }
    }
}
