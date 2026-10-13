package com.trooi.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.unit.dp
import com.trooi.app.ui.theme.TroOiDimens

enum class TroOiButtonStyle { PRIMARY, SECONDARY, TERTIARY, DESTRUCTIVE }

/** One action family. Busy prevents repeat activation; callers own progress text and errors. */
@Composable
fun TroOiButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier,
    enabled: Boolean = true, style: TroOiButtonStyle = TroOiButtonStyle.PRIMARY, busy: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    val target = modifier.heightIn(min = TroOiDimens.actionMinHeight)
    val label: @Composable RowScope.() -> Unit = {
        if (busy) {
            CircularProgressIndicator(Modifier.size(18.dp), color = LocalContentColor.current, strokeWidth = 2.dp)
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
    if (style == TroOiButtonStyle.TERTIARY) {
        TextButton(onClick, target, enabled = enabled && !busy, content = label)
    } else {
        val container = when (style) {
            TroOiButtonStyle.SECONDARY -> colors.primaryContainer
            TroOiButtonStyle.DESTRUCTIVE -> colors.error
            else -> colors.primary
        }
        val foreground = when (style) {
            TroOiButtonStyle.SECONDARY -> colors.onPrimaryContainer
            TroOiButtonStyle.DESTRUCTIVE -> colors.onError
            else -> colors.onPrimary
        }
        Button(onClick, target, enabled = enabled && !busy, shape = MaterialTheme.shapes.medium,
            colors = ButtonDefaults.buttonColors(containerColor = container, contentColor = foreground), content = label)
    }
}

/** Grouped generic content. Domain ledger/media surfaces keep their own composition. */
@Composable
fun TroOiCard(title: String, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Column(Modifier.padding(TroOiDimens.panelPadding), verticalArrangement = Arrangement.spacedBy(TroOiDimens.contentGap)) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
            content()
        }
    }
}

/** Navigation/action row, with a named Button role and a target that expands with text. */
@Composable
fun TroOiListRow(title: String, subtitle: String = "", onClick: (() -> Unit)? = null,
    action: String = "", modifier: Modifier = Modifier, destructive: Boolean = false,
    leading: @Composable (() -> Unit)? = null, selected: Boolean = false) {
    val color = if (destructive) MaterialTheme.colorScheme.error else if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface
    val supporting = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
    Surface(modifier.fillMaxWidth()
        .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
        .then(if (selected) Modifier.semantics { this.selected = true } else Modifier), shape = MaterialTheme.shapes.large,
        color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface) {
        Row(Modifier.heightIn(min = TroOiDimens.rowMinHeight).padding(TroOiDimens.contentGap),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(TroOiDimens.contentGap)) {
            if (leading != null) leading()
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(TroOiDimens.labelGap)) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = color)
                if (subtitle.isNotEmpty()) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = supporting)
                if (action.isNotEmpty()) Text(action, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            }
            if (onClick != null) Icon(Icons.Rounded.ChevronRight, null, tint = supporting)
        }
    }
}

/** Actions stack at compact width or large font instead of squeezing long personal values. */
@Composable
fun TroOiInformationRow(label: String, value: String, action: String = "", status: String = "",
    onClick: (() -> Unit)? = null, actionModifier: Modifier = Modifier) {
    BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = TroOiDimens.contentGap, vertical = 8.dp)) {
        val stacked = maxWidth < TroOiDimens.compactRowBreakpoint || LocalDensity.current.fontScale > 1.2f
        val information: @Composable () -> Unit = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(value, style = MaterialTheme.typography.bodyLarge)
                if (status.isNotEmpty()) Text(status, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        val button: @Composable () -> Unit = {
            if (onClick != null) TroOiButton(action, onClick, actionModifier, style = TroOiButtonStyle.TERTIARY)
        }
        if (stacked) Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { information(); button() }
        else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f)) { information() }; button()
        }
    }
}

/** An in-content header; it adds no system insets and leaves Back state to its screen owner. */
@Composable
fun TroOiPageHeader(title: String, subtitle: String = "", onBack: (() -> Unit)? = null, backLabel: String = "Quay lại",
    actions: @Composable RowScope.() -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) IconButton(onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, backLabel) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(TroOiDimens.labelGap)) {
            Text(title, modifier = Modifier.semantics { heading() }, style = if (onBack == null) MaterialTheme.typography.headlineLarge else MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground)
            if (subtitle.isNotEmpty()) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        actions()
    }
}

/** Informational/unavailable feedback; it never represents persisted or verified success. */
@Composable
fun TroOiFeedback(text: String, modifier: Modifier = Modifier, error: Boolean = false) {
    Text(text, modifier, style = MaterialTheme.typography.bodyMedium,
        color = if (error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
}
