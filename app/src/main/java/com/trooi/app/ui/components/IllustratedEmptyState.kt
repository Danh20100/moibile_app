package com.trooi.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

enum class EmptyStateScene { MESSAGES, RENTAL_NOTEBOOK }

/**
 * Decorative, accessible empty view. No card outline, stock image, fake records,
 * or networking side effects. The layout leaves generous blank space in each tab.
 */
@Composable
fun IllustratedEmptyState(
    scene: EmptyStateScene,
    title: String,
    description: String,
    actionText: String,
    onAction: () -> Unit,
    modifier: Modifier = Modifier,
    actionTag: String = "empty-state-action",
) {
    val palette = MaterialTheme.colorScheme
    val ink = palette.primary
    val subtle = palette.primary.copy(alpha = 0.13f)
    val lines = palette.primary.copy(alpha = 0.50f)
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(width = 240.dp, height = 196.dp)) {
            Canvas(Modifier.size(width = 240.dp, height = 196.dp).testTag("empty-illustration-" + scene.name.lowercase())) {
                val x = size.width / 240f
                val y = size.height / 196f
                fun pt(a: Float, b: Float) = Offset(a * x, b * y)
                fun sz(a: Float, b: Float) = Size(a * x, b * y)
                drawCircle(subtle, 86f * x, pt(120f, 91f))
                drawCircle(ink.copy(alpha = 0.09f), 15f * x, pt(23f, 43f))
                drawCircle(ink.copy(alpha = 0.12f), 10f * x, pt(215f, 135f))
                if (scene == EmptyStateScene.MESSAGES) {
                    drawRoundRect(
                        ink.copy(alpha = 0.12f), topLeft = pt(38f, 51f),
                        size = sz(132f, 87f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(20f * x),
                    )
                    drawRoundRect(
                        palette.surface, topLeft = pt(56f, 40f), size = sz(144f, 92f),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(19f * x),
                    )
                    drawRoundRect(
                        lines, topLeft = pt(56f, 40f), size = sz(144f, 92f),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(19f * x),
                        style = Stroke(width = 2.5f * x),
                    )
                    drawLine(lines, pt(81f, 68f), pt(172f, 68f), 4f * x, cap = StrokeCap.Round)
                    drawLine(lines.copy(alpha = 0.60f), pt(81f, 88f), pt(148f, 88f), 4f * x, cap = StrokeCap.Round)
                    drawLine(lines.copy(alpha = 0.60f), pt(81f, 107f), pt(120f, 107f), 4f * x, cap = StrokeCap.Round)
                    drawLine(lines, pt(174f, 131f), pt(193f, 151f), 2.5f * x, cap = StrokeCap.Round)
                    drawLine(lines, pt(193f, 151f), pt(194f, 129f), 2.5f * x, cap = StrokeCap.Round)
                } else {
                    drawRoundRect(
                        ink.copy(alpha = 0.17f), topLeft = pt(65f, 39f),
                        size = sz(117f, 139f),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(12f * x),
                    )
                    drawRoundRect(
                        palette.surface, topLeft = pt(57f, 28f),
                        size = sz(117f, 139f),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(12f * x),
                    )
                    drawRoundRect(
                        lines, topLeft = pt(57f, 28f),
                        size = sz(117f, 139f),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(12f * x),
                        style = Stroke(width = 2.5f * x),
                    )
                    drawLine(lines, pt(83f, 57f), pt(151f, 57f), 4f * x, cap = StrokeCap.Round)
                    drawLine(lines.copy(alpha = 0.5f), pt(83f, 80f), pt(151f, 80f), 3f * x, cap = StrokeCap.Round)
                    drawLine(lines.copy(alpha = 0.5f), pt(83f, 103f), pt(151f, 103f), 3f * x, cap = StrokeCap.Round)
                    drawLine(lines.copy(alpha = 0.5f), pt(83f, 126f), pt(135f, 126f), 3f * x, cap = StrokeCap.Round)
                    drawCircle(ink.copy(alpha = 0.23f), 19f * x, pt(177f, 149f))
                    drawCircle(palette.surface, 8f * x, pt(177f, 149f))
                }
            }
        }
        Text(
            title, style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
        )
        Text(
            description, style = MaterialTheme.typography.bodyMedium,
            color = palette.onSurfaceVariant, textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 14.dp),
        )
        TroOiButton(
            actionText, onAction,
            modifier = Modifier.padding(top = 8.dp).testTag(actionTag),
        )
    }
}
