package com.trooi.app.features.discovery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import com.trooi.app.ui.components.TroOiInlineAction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.trooi.app.BuildConfig
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.model.PublicListingCard

/**
 * A single interactive map interface shared by Guest Discovery and Owner location pickers.
 *
 * MapLibre + OpenFreeMap is the DEFAULT, requiring no Google API key or billing account.
 * Google Maps is strictly opt-in, with a manual switch back to the free provider because
 * the Google SDK cannot reliably report whether a Google Cloud project has billing enabled.
 */
@Composable
fun NativeMapView(
    publicMarkers: List<PublicListingCard>,
    selectedPoint: PublicGeoPoint?,
    onCameraCenter: (PublicGeoPoint) -> Unit,
    onMarkerListing: (String) -> Unit,
    onPick: (PublicGeoPoint) -> Unit,
    modifier: Modifier = Modifier,
) {
    val mapsKey = BuildConfig.MAPS_API_KEY
    var provider by remember(mapsKey) {
        mutableStateOf(selectMapProvider(BuildConfig.MAP_PROVIDER, mapsKey))
    }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                if (provider == MapProvider.MAPLIBRE) "MapLibre · OpenFreeMap" else "Google Maps",
                style = MaterialTheme.typography.labelMedium,
            )
            if (mapsKey.isNotBlank()) {
                TroOiInlineAction(
                    onClick = {
                        provider = if (provider == MapProvider.GOOGLE)
                            MapProvider.MAPLIBRE else MapProvider.GOOGLE
                    },
                    modifier = Modifier.testTag("map-switch-provider"),
                ) {
                    Text(if (provider == MapProvider.GOOGLE) "Dùng bản đồ miễn phí" else "Google Maps")
                }
            }
        }

        if (provider == MapProvider.MAPLIBRE) {
            MapLibreNativeView(
                publicMarkers = publicMarkers,
                selectedPoint = selectedPoint,
                onCameraCenter = onCameraCenter,
                onMarkerListing = onMarkerListing,
                onPick = onPick,
                styleUrl = selectMapLibreStyle(BuildConfig.MAPLIBRE_STYLE_URL),
                modifier = Modifier.testTag("maplibre-provider"),
            )
            Text(
                "© OpenStreetMap contributors · OpenFreeMap",
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.testTag("maplibre-attribution"),
            )
        } else {
            GoogleNativeMapView(
                publicMarkers = publicMarkers,
                selectedPoint = selectedPoint,
                onCameraCenter = onCameraCenter,
                onMarkerListing = onMarkerListing,
                onPick = onPick,
                modifier = Modifier.testTag("google-provider"),
            )
        }
    }
}
