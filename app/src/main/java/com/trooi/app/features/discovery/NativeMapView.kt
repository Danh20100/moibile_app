package com.trooi.app.features.discovery

import android.os.Bundle
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.MapView
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.android.gms.maps.model.MarkerOptions
import com.trooi.app.BuildConfig
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.publicMapPoint
import com.trooi.app.ui.components.V1Panel
import com.trooi.app.ui.components.V1Pending

@Composable
fun NativeMapView(
    publicMarkers: List<PublicListingCard>,
    selectedPoint: PublicGeoPoint?,
    onCameraCenter: (PublicGeoPoint) -> Unit,
    onMarkerListing: (String) -> Unit,
    onPick: (PublicGeoPoint) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (BuildConfig.MAPS_API_KEY.isBlank()) {
        V1Panel("Chưa cấu hình bản đồ", modifier = modifier.fillMaxWidth().testTag("native-map-unconfigured")) {
            V1Pending("Thiếu trooiMapsApiKey / TROOI_MAPS_API_KEY. Các màn khác vẫn dùng được.")
        }
        return
    }
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val saved = remember { Bundle() }
    val mapView = remember(context) { MapView(context) }
    val markers = remember(publicMarkers) { publicMapMarkers(publicMarkers) }
    var lastCentered by remember { mutableStateOf<PublicGeoPoint?>(null) }
    DisposableEffect(lifecycle, mapView) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> {
                    mapView.onPause()
                    mapView.onSaveInstanceState(saved)
                }
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                else -> Unit
            }
        }
        mapView.onCreate(saved)
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            runCatching {
                mapView.onPause()
                mapView.onSaveInstanceState(saved)
                mapView.onStop()
                mapView.onDestroy()
            }
        }
    }
    AndroidView(
        factory = { mapView },
        modifier = modifier
            .fillMaxWidth()
            .height(260.dp)
            .testTag("native-map"),
        update = { view ->
            view.getMapAsync { map ->
                map.uiSettings.isZoomControlsEnabled = true
                map.clear()
                markers.forEach { listing ->
                    val point = publicMapPoint(listing) ?: return@forEach
                    map.addMarker(
                        MarkerOptions()
                            .position(LatLng(point.latitude, point.longitude))
                            .title(listing.title),
                    )?.tag = listing.listingId
                }
                val focus = selectedPoint
                if (focus != null && focus != lastCentered) {
                    lastCentered = focus
                    map.moveCamera(CameraUpdateFactory.newLatLngZoom(LatLng(focus.latitude, focus.longitude), 14f))
                } else if (focus == null && markers.isNotEmpty()) {
                    val bounds = LatLngBounds.builder()
                    markers.forEach { listing ->
                        val point = publicMapPoint(listing) ?: return@forEach
                        bounds.include(LatLng(point.latitude, point.longitude))
                    }
                    runCatching { map.moveCamera(CameraUpdateFactory.newLatLngBounds(bounds.build(), 80)) }
                }
                map.setOnCameraIdleListener {
                    val target = map.cameraPosition.target
                    onCameraCenter(PublicGeoPoint(target.latitude, target.longitude))
                }
                map.setOnMarkerClickListener { marker ->
                    (marker.tag as? String)?.let(onMarkerListing)
                    false
                }
                map.setOnMapClickListener { latLng ->
                    onPick(PublicGeoPoint(latLng.latitude, latLng.longitude))
                }
            }
        },
    )
}
