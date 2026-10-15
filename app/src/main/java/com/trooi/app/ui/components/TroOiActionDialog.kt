package com.trooi.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

/** Native dismissal and theme tokens shared by confirmations and protected forms. */
@Composable
fun TroOiActionDialog(
    onDismissRequest: () -> Unit,
    title: @Composable () -> Unit,
    text: @Composable () -> Unit,
    confirmButton: @Composable () -> Unit,
    dismissButton: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Dialog(onDismissRequest = onDismissRequest) {
        Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surface, contentColor = MaterialTheme.colorScheme.onSurface) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                ProvideTextStyle(MaterialTheme.typography.titleLarge) { Box(Modifier.semantics { heading() }) { title() } }
                ProvideTextStyle(MaterialTheme.typography.bodyMedium) { text() }
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (dismissButton != null) Box(Modifier.weight(1f).fillMaxHeight().heightIn(min = 48.dp), propagateMinConstraints = true) { dismissButton() }
                    Box(Modifier.weight(1f).fillMaxHeight().heightIn(min = 48.dp), propagateMinConstraints = true) { confirmButton() }
                }
            }
        }
    }
}

/** Ordinary confirmations share action roles; custom security forms retain the slot-based dialog. */
@Composable
fun TroOiConfirmDialog(title: String, text: String, confirmLabel: String, onConfirm: () -> Unit,
    onDismissRequest: () -> Unit, dismissLabel: String? = "Hủy", destructive: Boolean = false,
    enabled: Boolean = true, busy: Boolean = false) {
    TroOiActionDialog(onDismissRequest = { if (!busy) onDismissRequest() },
        title = { Text(title) }, text = { Text(text) },
        confirmButton = { TroOiButton(confirmLabel, onConfirm, enabled = enabled,
            style = if (destructive) TroOiButtonStyle.DESTRUCTIVE else TroOiButtonStyle.PRIMARY, busy = busy) },
        dismissButton = dismissLabel?.let { label -> { TroOiButton(label, onDismissRequest,
            enabled = !busy, style = TroOiButtonStyle.SECONDARY) } })
}
