package com.trooi.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.theme.TroOiDimens

enum class TroOiStateKind { LOADING, EMPTY, ERROR, UNAVAILABLE }

/** Presentation only: the caller owns state, retry, navigation and unavailable boundaries. */
@Composable
fun TroOiStateMessage(kind: TroOiStateKind, message: String, modifier: Modifier = Modifier,
    title: String = "", actionText: String = "", onAction: (() -> Unit)? = null,
    actionModifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(TroOiDimens.contentGap)) {
        if (kind == TroOiStateKind.LOADING) CircularProgressIndicator(Modifier.size(24.dp))
        if (title.isNotEmpty()) Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
        if (message.isNotEmpty()) TroOiFeedback(message, error = kind == TroOiStateKind.ERROR)
        if (onAction != null) TroOiButton(actionText, onAction, actionModifier)
    }
}
