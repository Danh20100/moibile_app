package com.trooi.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.trooi.app.ui.theme.*

enum class LedgerTone { Neutral, Success, Warning, Error, Clay }

@Composable
private fun ledgerToneColor(tone: LedgerTone): Color {
    val dark = isSystemInDarkTheme()
    return when (tone) {
        LedgerTone.Success -> if (dark) TroOiDarkSuccess else TroOiSuccess
        LedgerTone.Warning -> if (dark) TroOiDarkWarning else TroOiWarning
        LedgerTone.Error -> if (dark) TroOiDarkError else TroOiError
        LedgerTone.Clay -> MaterialTheme.colorScheme.secondary
        LedgerTone.Neutral -> MaterialTheme.colorScheme.onSurfaceVariant
    }
}

@Composable
fun RoomLedgerPlate(
    roomLabel: String,
    contextLabel: String,
    stateLabel: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.primary,
        contentColor = MaterialTheme.colorScheme.onPrimary,
        shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp, bottomEnd = 16.dp, bottomStart = 4.dp),
    ) {
        Column(
            Modifier.padding(horizontal = 18.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                contextLabel.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.78f),
            )
            Text(
                roomLabel,
                fontSize = 38.sp,
                lineHeight = 42.sp,
                fontWeight = FontWeight.Bold,
            )
            LedgerStateLabel(
                label = stateLabel,
                tone = LedgerTone.Neutral,
                inverted = true,
            )
        }
    }
}

@Composable
fun LedgerStateLabel(
    label: String,
    tone: LedgerTone = LedgerTone.Neutral,
    modifier: Modifier = Modifier,
    inverted: Boolean = false,
) {
    val base = ledgerToneColor(tone)
    val color = if (inverted) MaterialTheme.colorScheme.onPrimary else base
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(
            Modifier
                .size(7.dp)
                .clip(RoundedCornerShape(50))
                .background(color),
        )
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = color,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun LedgerSectionTitle(
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        subtitle?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
fun LedgerAttentionRow(
    title: String,
    supporting: String,
    amount: String? = null,
    tone: LedgerTone = LedgerTone.Neutral,
    modifier: Modifier = Modifier,
) {
    val mark = if (tone == LedgerTone.Neutral) MaterialTheme.colorScheme.primary else ledgerToneColor(tone)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 11.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            Modifier
                .padding(top = 4.dp)
                .size(width = 4.dp, height = 34.dp)
                .clip(RoundedCornerShape(50))
                .background(mark),
        )
        Column(
            Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(
                supporting,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        amount?.let {
            Text(
                it,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.End,
            )
        }
    }
}

@Composable
fun LedgerMoney(
    amount: String,
    context: String,
    tone: LedgerTone = LedgerTone.Neutral,
    modifier: Modifier = Modifier,
) {
    val amountColor = if (tone == LedgerTone.Neutral) MaterialTheme.colorScheme.onSurface else ledgerToneColor(tone)
    Column(
        modifier,
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Text(
            amount,
            fontSize = 33.sp,
            lineHeight = 38.sp,
            fontWeight = FontWeight.Bold,
            color = amountColor,
        )
        Text(
            context,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun LedgerMediaPlaceholder(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    val dark = isSystemInDarkTheme()
    val mediaColor = if (dark) TroOiDarkMedia else TroOiMedia
    val mediaText = if (dark) TroOiDarkInk else TroOiInk
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 148.dp),
        color = mediaColor,
        shape = RoundedCornerShape(14.dp),
    ) {
        Box(Modifier.padding(18.dp), contentAlignment = Alignment.BottomStart) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    color = mediaText,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = mediaText.copy(alpha = 0.72f),
                )
            }
        }
    }
}

@Composable
fun LedgerHistoryEvent(
    source: String,
    title: String,
    occurredAt: String,
    supporting: String? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier
                    .size(10.dp)
                    .clip(RoundedCornerShape(50))
                    .background(MaterialTheme.colorScheme.secondary),
            )
            Box(
                Modifier
                    .width(2.dp)
                    .height(48.dp)
                    .background(MaterialTheme.colorScheme.secondaryContainer),
            )
        }
        Column(
            Modifier.weight(1f).padding(bottom = 10.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                source.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.secondary,
            )
            Text(title, style = MaterialTheme.typography.titleSmall)
            supporting?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                occurredAt,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
fun LedgerNavStrip(
    active: String,
    items: List<String>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items.forEach { label ->
            Surface(
                modifier = Modifier.weight(1f),
                color = if (label == active) MaterialTheme.colorScheme.primaryContainer else Color.Transparent,
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(
                    1.dp,
                    if (label == active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                ),
            ) {
                Text(
                    label,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 9.dp),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (label == active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun LedgerDivider(modifier: Modifier = Modifier) {
    HorizontalDivider(modifier = modifier, color = MaterialTheme.colorScheme.outline)
}
