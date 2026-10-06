package com.trooi.app.features.tenant

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.discovery.NativeMapView
import com.trooi.app.features.discovery.PUBLIC_SEARCH_RADII_METERS
import com.trooi.app.features.discovery.PublicDiscoveryFilters
import com.trooi.app.features.discovery.cameraSearch
import com.trooi.app.features.discovery.publicMapMarkers
import com.trooi.app.features.discovery.usableCamera
import com.trooi.app.ui.components.*

@Composable
fun V1GuestMapScreen(
    state: TroOiUiState,
    onOpenListing: (String) -> Unit,
    onSearch: ((Double, Double, Double, String?, String?) -> Unit)? = null,
) {
    val context = LocalContext.current
    val markers = publicMapMarkers(state.read.publicListings)
    var camera by remember { mutableStateOf<PublicGeoPoint?>(null) }
    var explicitCenter by remember { mutableStateOf<PublicGeoPoint?>(null) }
    var locationDenied by rememberSaveable { mutableStateOf(false) }
    var minPrice by rememberSaveable { mutableStateOf("") }
    var maxPrice by rememberSaveable { mutableStateOf("") }
    var radiusMeters by rememberSaveable { mutableStateOf(3000) }
    var locationMessage by rememberSaveable { mutableStateOf<String?>(null) }
    val filters = PublicDiscoveryFilters(minPrice.trim(), maxPrice.trim(), radiusMeters)
    val searchCenter = usableCamera(camera, explicitCenter, locationDenied)
    val query = searchCenter?.let { cameraSearch(it, filters) }
    fun applyApproximateFix() {
        val point = lastKnownPublicCenter(context)
        if (point == null) {
            locationMessage = "Chưa lấy được vị trí gần đúng. Có thể kéo bản đồ rồi tìm khu vực này."
        } else {
            explicitCenter = point
            camera = point
            locationMessage = "Đã dùng vị trí gần đúng làm tâm tìm kiếm."
        }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        locationDenied = !granted
        if (granted) applyApproximateFix()
        else locationMessage = "Không có quyền vị trí. Kéo bản đồ rồi nhấn Tìm khu vực này."
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("guest-map"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            V1PageTitle("Bản đồ", "Xem các phòng đang được công khai theo khu vực.")
        }
        item {
            NativeMapView(
                publicMarkers = state.read.publicListings,
                selectedPoint = explicitCenter,
                onCameraCenter = { camera = it },
                onMarkerListing = onOpenListing,
                onPick = { explicitCenter = it },
            )
        }
        item {
            V1Panel("Tìm khu vực trên bản đồ") {
                V1Pending(locationMessage ?: "Kéo bản đồ hoặc dùng vị trí gần đúng, rồi tìm theo bán kính và giá.")
                V1Action(
                    "Dùng vị trí hiện tại",
                    {
                        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
                            PackageManager.PERMISSION_GRANTED
                        ) applyApproximateFix()
                        else permission.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                    },
                    modifier = Modifier.fillMaxWidth().testTag("map-use-current-location"),
                )
                Text("Bán kính", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PUBLIC_SEARCH_RADII_METERS.forEach { meters ->
                        FilterChip(
                            selected = radiusMeters == meters,
                            onClick = { radiusMeters = meters },
                            label = { Text("${meters / 1000} km") },
                            modifier = Modifier.testTag("map-radius-$meters"),
                        )
                    }
                }
                OutlinedTextField(
                    value = minPrice,
                    onValueChange = { minPrice = it.filter(Char::isDigit).take(16) },
                    label = { Text("Giá thấp nhất (VND)") },
                    modifier = Modifier.fillMaxWidth().testTag("map-filter-min-price"),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = maxPrice,
                    onValueChange = { maxPrice = it.filter(Char::isDigit).take(16) },
                    label = { Text("Giá cao nhất (VND)") },
                    modifier = Modifier.fillMaxWidth().testTag("map-filter-max-price"),
                    singleLine = true,
                )
                filters.validationMessage()?.let {
                    Text(it, color = MaterialTheme.colorScheme.error)
                }
                if (onSearch != null) {
                    V1Action(
                        "Tìm khu vực này",
                        {
                            val next = query ?: return@V1Action
                            onSearch(next.latitude, next.longitude, next.radiusMeters, next.minPrice, next.maxPrice)
                        },
                        enabled = query != null && !state.runtimeLoading,
                        modifier = Modifier.fillMaxWidth().testTag("map-search-this-area"),
                    )
                }
            }
        }
        if (markers.isNotEmpty()) {
            item { LedgerSectionTitle("Phòng trên bản đồ", "Chạm marker hoặc hàng để mở tin đăng") }
            items(markers, key = { "map-listing-" + it.listingId }) { listing ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenListing(listing.listingId) }
                        .padding(vertical = 10.dp)
                        .testTag("map-listing-" + listing.listingId),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Rounded.LocationOn, null, tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.weight(1f)) {
                        Text(listing.title, style = MaterialTheme.typography.titleSmall)
                        Text(
                            listing.publicAreaLabel,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(listing.askingPriceLabel ?: "Chưa công khai giá", style = MaterialTheme.typography.labelLarge)
                }
                LedgerDivider()
            }
        }
    }
}

@Composable
fun V1GuestActivityScreen(state: TroOiUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("guest-activity"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { V1PageTitle("Hoạt động", "Các lần liên hệ với tin đăng công khai") }
        item {
            V1Panel("Yêu cầu liên hệ") {
                V1Pending("Lịch sử yêu cầu liên hệ chưa khả dụng ở phiên bản này.")
            }
        }
        if (state.isAuthenticated && state.read.notifications.isNotEmpty()) {
            item {
                LedgerSectionTitle(
                    "Thông báo liên quan",
                    "Các thông báo gần đây liên quan đến tài khoản của bạn.",
                )
            }
            items(state.read.notifications.take(5), key = { "guest-activity-notification-" + it.notificationId }) { row ->
                LedgerAttentionRow(
                    title = row.category,
                    supporting = row.message,
                    tone = if (row.readAtLabel == null) LedgerTone.Clay else LedgerTone.Neutral,
                )
                LedgerDivider()
            }
        }
    }
}

@SuppressLint("MissingPermission")
private fun lastKnownPublicCenter(context: Context): PublicGeoPoint? {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
    val latest = manager.getProviders(true)
        .mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
        .maxByOrNull { it.time }
        ?: return null
    return PublicGeoPoint(latest.latitude, latest.longitude)
}
