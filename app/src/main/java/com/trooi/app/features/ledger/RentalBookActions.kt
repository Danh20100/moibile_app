package com.trooi.app.features.ledger

import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.trooi.app.ui.components.TroOiInlineAction
import com.trooi.app.ui.components.TroOiInlineActionStyle

@Composable
internal fun BookButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    TroOiInlineAction(onClick, modifier, enabled, TroOiInlineActionStyle.FILLED, content)
}

@Composable
internal fun BookOutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    TroOiInlineAction(onClick, modifier, enabled, TroOiInlineActionStyle.OUTLINED, content)
}

@Composable
internal fun BookTextButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    TroOiInlineAction(onClick, modifier, enabled, TroOiInlineActionStyle.TEXT, content)
}
