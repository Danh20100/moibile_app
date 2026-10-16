package com.trooi.app.features.discovery

import android.os.Bundle
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.publicMapPoint
import com.trooi.app.ui.components.TroOiFeedback
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.annotations.MarkerOptions

/**
 * Interactive MapLibre Native view powered by the public OpenFreeMap style.
 *
 * No Google Maps SDK credentials, billing account, or OpenFreeMap API key are used here.
 * Map tiles are a separate third-party internet service: not guaranteed available forever.
 * Only PUBLIC listing coordinates are rendered (private property pins are never inferred).
 */
@Composable
internal fun MapLibreNativeView(
    publicMarkers: List<PublicListingCard>,
    selectedPoint: PublicGeoPoint?,
    onCameraCenter: (PublicGeoPoint) -> Unit,
    onMarkerListing: (String) -> Unit,
    onPick: (PublicGeoPoint) -> Unit,
    styleUrl: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val mapView = remember(context) {
        MapLibre.getInstance(context.applicationContext)
        MapView(context)
    }
    val savedState = remember { Bundle() }
    val markers = remember(publicMarkers) { publicMapMarkers(publicMarkers) }
    var readyMap by remember { mutableStateOf<MapLibreMap?>(null) }
    var styleError by remember { mutableStateOf(false) }
    var lastCentered by remember { mutableStateOf<PublicGeoPoint?>(null) }
    val markerIds = remember(mapView) { mutableMapOf<Long, String>() }

    val currentCameraCallback by rememberUpdatedState(onCameraCenter)
    val currentMarkerCallback by rememberUpdatedState(onMarkerListing)
    val currentPickCallback by rememberUpdatedState(onPick)

    DisposableEffect(lifecycle, mapView, styleUrl) {
        mapView.onCreate(savedState)
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) mapView.onStart()
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) mapView.onResume()
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> {
                    mapView.onPause()
                    mapView.onSaveInstanceState(savedState)
                }
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        // Render only after a successfully loaded style; a failed network request
        // must not be mistaken for a configured Google Maps fallback.
        mapView.addOnDidFailLoadingMapListener { styleError = true }
        mapView.getMapAsync { map ->
            map.setStyle(styleUrl) {
                styleError = false
                readyMap = map
            }
        }
        onDispose {
            lifecycle.removeObserver(observer)
            readyMap = null
            runCatching {
                if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) mapView.onPause()
                mapView.onSaveInstanceState(savedState)
                mapView.onStop()
                mapView.onDestroy()
            }
        }
    }

    DisposableEffect(readyMap) {
        val map = readyMap
        if (map == null) {
            onDispose { }
        } else {
            val ids = markerIds
            val cameraListener = MapLibreMap.OnCameraIdleListener {
                map.cameraPosition.target?.let { position ->
                    currentCameraCallback(PublicGeoPoint(position.latitude, position.longitude))
                }
            }
            val tapListener = MapLibreMap.OnMapClickListener { point ->
                currentPickCallback(PublicGeoPoint(point.latitude, point.longitude))
                true
            }
            map.addOnCameraIdleListener(cameraListener)
            map.addOnMapClickListener(tapListener)
            map.setOnMarkerClickListener { marker ->
                ids[marker.id]?.let(currentMarkerCallback)
                true
            }
            // This listener owns IDs while markers update inside the composition.
            onDispose {
                map.removeOnCameraIdleListener(cameraListener)
                map.removeOnMapClickListener(tapListener)
                map.setOnMarkerClickListener(null)
            }
        }
    }

    LaunchedEffect(readyMap, markers, selectedPoint) {
        val map = readyMap ?: return@LaunchedEffect
        map.removeAnnotations()
        markerIds.clear()
        markers.forEach { listing ->
            val point = publicMapPoint(listing) ?: return@forEach
            val marker = map.addMarker(
                MarkerOptions()
                    .position(LatLng(point.latitude, point.longitude))
                    .title(listing.title),
            )
            markerIds[marker.id] = listing.listingId
        }
        if (selectedPoint != null && selectedPoint != lastCentered) {
            lastCentered = selectedPoint
            map.moveCamera(CameraUpdateFactory.newLatLngZoom(
                LatLng(selectedPoint.latitude, selectedPoint.longitude), 14.0,
            ))
        } else if (selectedPoint == null && markers.isNotEmpty()) {
            val positions = markers.mapNotNull { listing ->
                publicMapPoint(listing)?.let { LatLng(it.latitude, it.longitude) }
            }
            when (positions.size) {
                0 -> Unit
                1 -> map.moveCamera(CameraUpdateFactory.newLatLngZoom(positions[0], 13.0))
                else -> mapView.post {
                    runCatching {
                        map.moveCamera(CameraUpdateFactory.newLatLngBounds(
                            LatLngBounds.fromLatLngs(positions), 80,
                        ))
                    }
                }
            }
        } else if (selectedPoint == null && markers.isEmpty()) {
            // Default HCMC center is a camera baseline, NOT a location assigned to a listing.
            map.moveCamera(CameraUpdateFactory.newLatLngZoom(
                LatLng(10.7769, 106.7009), 11.0,
            ))
        }
    }

    AndroidView(
        factory = { mapView },
        modifier = modifier.fillMaxWidth().height(260.dp).testTag("native-map"),
    )
    if (styleError) {
        TroOiFeedback("Không tải được bản đồ miễn phí. Kiểm tra mạng và thử lại sau.")
    }
}
