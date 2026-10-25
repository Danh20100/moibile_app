package com.trooi.app.features.discovery

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.Normalizer
import java.util.Locale

/**
 * Visual semantics only. Labels come exclusively from published Listing data.
 * This is not an amenity catalog or a source of rental-property facts.
 */
internal enum class AmenityVisual {
    WIFI, AIR_CONDITIONING, LAUNDRY, PARKING, KITCHEN, CAMERA,
    BALCONY, BATHROOM, HOT_WATER, ELEVATOR, FURNITURE, SECURITY, PETS, OTHER
}

internal fun amenityVisual(name: String): AmenityVisual {
    val normalized = Normalizer.normalize(name.trim(), Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")
        .lowercase(Locale.ROOT)
        .replace('đ', 'd')
    val compact = normalized.replace(Regex("[^a-z0-9]"), "")
    return when {
        compact.contains("wifi") || compact.contains("internet") -> AmenityVisual.WIFI
        normalized.contains("may lanh") || normalized.contains("dieu hoa") -> AmenityVisual.AIR_CONDITIONING
        normalized.contains("may giat") || normalized.contains("giat say") -> AmenityVisual.LAUNDRY
        normalized.contains("cho de xe") || normalized.contains("bai xe") ||
            normalized.contains("giu xe") || normalized.contains("do xe") -> AmenityVisual.PARKING
        normalized.contains("bep") || normalized.contains("nau an") -> AmenityVisual.KITCHEN
        normalized.contains("camera") || normalized.contains("cctv") -> AmenityVisual.CAMERA
        normalized.contains("ban cong") -> AmenityVisual.BALCONY
        normalized.contains("phong tam") || normalized.contains("ve sinh") ||
            normalized.contains("wc rieng") -> AmenityVisual.BATHROOM
        normalized.contains("nuoc nong") || normalized.contains("binh nong") -> AmenityVisual.HOT_WATER
        normalized.contains("thang may") -> AmenityVisual.ELEVATOR
        normalized.contains("noi that") || normalized.contains("giuong") ||
            normalized.contains("tu lanh") -> AmenityVisual.FURNITURE
        normalized.contains("bao ve") || normalized.contains("an ninh") -> AmenityVisual.SECURITY
        normalized.contains("thu cung") || normalized.contains("pet") -> AmenityVisual.PETS
        else -> AmenityVisual.OTHER
    }
}

private fun amenityIcon(visual: AmenityVisual): ImageVector = when (visual) {
    AmenityVisual.WIFI -> Icons.Rounded.Wifi
    AmenityVisual.AIR_CONDITIONING -> Icons.Rounded.AcUnit
    AmenityVisual.LAUNDRY -> Icons.Rounded.LocalLaundryService
    AmenityVisual.PARKING -> Icons.Rounded.LocalParking
    AmenityVisual.KITCHEN -> Icons.Rounded.Kitchen
    AmenityVisual.CAMERA -> Icons.Rounded.Videocam
    AmenityVisual.BALCONY -> Icons.Rounded.Balcony
    AmenityVisual.BATHROOM -> Icons.Rounded.Bathtub
    AmenityVisual.HOT_WATER -> Icons.Rounded.WaterDrop
    AmenityVisual.ELEVATOR -> Icons.Rounded.Elevator
    AmenityVisual.FURNITURE -> Icons.Rounded.Chair
    AmenityVisual.SECURITY -> Icons.Rounded.Security
    AmenityVisual.PETS -> Icons.Rounded.Pets
    AmenityVisual.OTHER -> Icons.Rounded.CheckCircleOutline
}

/** Split only the first colon, preserving values with embedded punctuation. */
internal data class CostDisplayRow(val label: String, val value: String)

internal fun costDisplayRow(line: String): CostDisplayRow {
    val split = line.indexOf(':')
    if (split <= 0) return CostDisplayRow(line.trim(), "")
    return CostDisplayRow(line.substring(0, split).trim(), line.substring(split + 1).trim())
}

@Composable
internal fun DetailSectionCard(
    title: String,
    tag: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier.fillMaxWidth().testTag(tag),
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            content = {
                Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                content()
            },
        )
    }
}

@Composable
internal fun DetailTextBlock(lines: List<String>) {
    if (lines.isEmpty()) {
        Text("Chủ trọ chưa bổ sung thông tin.", style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    } else {
        lines.forEach { line ->
            if (line.isNotBlank()) Text(line, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
internal fun DetailAmenityGrid(amenities: List<String>) {
    if (amenities.isEmpty()) {
        Text("Chủ trọ chưa khai báo tiện nghi.", style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    } else {
        val compactLayout = LocalConfiguration.current.screenWidthDp < 360 ||
            LocalDensity.current.fontScale >= 1.2f
        val columns = if (compactLayout) 1 else 2
        amenities.chunked(columns).forEachIndexed { rowIndex, row ->
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                row.forEachIndexed { columnIndex, amenity ->
                    Surface(
                        modifier = Modifier.weight(1f).testTag("listing-amenity-$rowIndex-$columnIndex"),
                        shape = RoundedCornerShape(14.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
                    ) {
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = 68.dp).padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Surface(shape = CircleShape,
                                color = MaterialTheme.colorScheme.primaryContainer) {
                                Icon(
                                    imageVector = amenityIcon(amenityVisual(amenity)),
                                    contentDescription = null,
                                    modifier = Modifier.padding(8.dp).size(18.dp),
                                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                )
                            }
                            Text(amenity, style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium)
                        }
                    }
                }
                if (row.size < columns) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
internal fun DetailCostRows(costs: List<String>) {
    if (costs.isEmpty()) {
        Text("Chủ trọ chưa khai báo chi phí.", style = MaterialTheme.typography.bodyMedium)
    } else {
        costs.forEachIndexed { index, raw ->
            val item = costDisplayRow(raw)
            Row(
                Modifier.fillMaxWidth().testTag("listing-cost-$index"),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top,
            ) {
                if (item.value.isEmpty()) {
                    Text(item.label, style = MaterialTheme.typography.bodyMedium)
                } else if (item.label.length > 20 &&
                    (LocalConfiguration.current.screenWidthDp < 400 ||
                        LocalDensity.current.fontScale >= 1.2f)) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(item.label, style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(item.value, style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold)
                    }
                } else {
                    Text(item.label, modifier = Modifier.weight(0.46f),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(item.value, modifier = Modifier.weight(0.54f),
                        style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                }
            }
            if (index != costs.lastIndex) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.65f))
            }
        }
    }
}

@Composable
internal fun DetailPublicLocationNote() {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.60f),
        modifier = Modifier.fillMaxWidth().testTag("listing-public-location-note"),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Rounded.Info, contentDescription = null, modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.primary)
            Text("Ghim bản đồ là vị trí tham khảo, có thể không trùng địa chỉ thực tế. Vui lòng xác nhận khi liên hệ.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface)
        }
    }
}
