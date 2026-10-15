package com.trooi.app.features.discovery

import android.graphics.BitmapFactory
import android.location.Geocoder
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.components.TroOiButtonStyle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Cache
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import java.io.File
import kotlin.math.*
import kotlin.coroutines.resume

internal fun mapPixel(point: PublicGeoPoint, zoom: Int): Pair<Double, Double> {
    val scale = 256.0 * (1 shl zoom)
    val latitude = Math.toRadians(point.latitude.coerceIn(-85.05112878, 85.05112878))
    return (point.longitude + 180.0) / 360.0 * scale to (1.0 - ln(tan(latitude) + 1.0 / cos(latitude)) / PI) / 2.0 * scale
}

internal fun mapPoint(x: Double, y: Double, zoom: Int): PublicGeoPoint {
    val scale = 256.0 * (1 shl zoom)
    val longitude = ((x / scale * 360.0) % 360.0 + 360.0) % 360.0 - 180.0
    return PublicGeoPoint(Math.toDegrees(atan(sinh(PI * (1.0 - 2.0 * y.coerceIn(0.0, scale) / scale)))), longitude)
}

/** Only the visible viewport is requested. OkHttp honors tile cache headers; no offline/prefetch flow. */
@Composable
fun StreetMapPicker(area: String, selectedPoint: PublicGeoPoint?, onPick: (PublicGeoPoint) -> Unit, readOnly: Boolean = false) {
    require(!readOnly || selectedPoint != null) { "A public map requires an explicit public projection." }
    val context = LocalContext.current
    val density = LocalDensity.current.density
    val tileSize = 256.0 * density
    fun pixel(point: PublicGeoPoint, level: Int): Pair<Double, Double> = mapPixel(point, level).let { it.first * density to it.second * density }
    fun point(x: Double, y: Double, level: Int) = mapPoint(x / density, y / density, level)
    val links = LocalUriHandler.current
    val areaColor = MaterialTheme.colorScheme.primary
    val mapBackground = MaterialTheme.colorScheme.surfaceVariant
    val client = remember { OkHttpClient.Builder().callTimeout(5, TimeUnit.SECONDS)
        .cache(Cache(File(context.cacheDir, "street-map"), 20L * 1024 * 1024)).build() }
    DisposableEffect(client) { onDispose { client.dispatcher.executorService.execute {
        client.dispatcher.cancelAll(); client.cache?.close(); client.connectionPool.evictAll()
    } } }
    var center by remember { mutableStateOf(selectedPoint ?: PublicGeoPoint(0.0, 0.0)) }
    var zoom by remember { mutableIntStateOf(if (selectedPoint == null) 2 else 15) }
    var size by remember { mutableStateOf(IntSize.Zero) }
    var drag by remember { mutableStateOf(Offset.Zero) }
    var tiles by remember { mutableStateOf(emptyList<Triple<IntOffset, ImageBitmap, IntSize>>()) }
    var loading by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var retry by remember { mutableIntStateOf(0) }
    var positioned by remember { mutableStateOf(selectedPoint != null) }
    val canPick = !readOnly && positioned && !loading && !failed && tiles.isNotEmpty()
    LaunchedEffect(area) {
        if (selectedPoint == null && area.isNotBlank() && Geocoder.isPresent()) {
            @Suppress("DEPRECATION")
            val address = withContext(Dispatchers.IO) { runCatching { Geocoder(context).getFromLocationName(area, 1)?.firstOrNull() }.getOrNull() }
            if (address != null && !positioned) { center = PublicGeoPoint(address.latitude, address.longitude); zoom = 14; positioned = true }
        }
    }
    LaunchedEffect(center, zoom, size, retry) {
        if (size.width == 0 || size.height == 0) return@LaunchedEffect
        loading = true
        failed = false
        tiles = emptyList()
        val (cx, cy) = pixel(center, zoom)
        val left = cx - size.width / 2.0
        val top = cy - size.height / 2.0
        val count = 1 shl zoom
        val result = withContext(Dispatchers.IO) {
            buildList {
                for (y in floor(top / tileSize).toInt()..floor((top + size.height) / tileSize).toInt()) {
                    if (y !in 0 until count) continue
                    for (x in floor(left / tileSize).toInt()..floor((left + size.width) / tileSize).toInt()) {
                        coroutineContext.ensureActive()
                        val wrappedX = (x % count + count) % count
                        val bitmap = suspendCancellableCoroutine<ImageBitmap?> { continuation ->
                            val call = client.newCall(Request.Builder().url("https://tile.opentopomap.org/$zoom/$wrappedX/$y.png")
                                .header("User-Agent", "TroOi-Android/1.0 (com.trooi.app)").build())
                            continuation.invokeOnCancellation { call.cancel() }
                            call.enqueue(object : Callback {
                                override fun onFailure(call: Call, e: IOException) { if (continuation.isActive) continuation.resume(null) }
                                override fun onResponse(call: Call, response: Response) {
                                    val image = response.use { runCatching { if (it.isSuccessful) it.body?.byteStream()?.use { stream -> BitmapFactory.decodeStream(stream)?.asImageBitmap() } else null }.getOrNull() }
                                    if (continuation.isActive) continuation.resume(image)
                                }
                            })
                        }
                        if (bitmap != null) add(Triple(IntOffset((x * tileSize - left).roundToInt(), (y * tileSize - top).roundToInt()), bitmap, IntSize(tileSize.roundToInt(), tileSize.roundToInt())))
                    }
                }
            }
        }
        tiles = result
        failed = result.isEmpty()
        loading = false
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(if (readOnly) "Vị trí ở mức khu vực, không phải địa chỉ chính xác." else "Di chuyển bản đồ, rồi chạm để ghim vị trí.", style = MaterialTheme.typography.bodySmall)
        Box(Modifier.fillMaxWidth().height(260.dp)) {
            Canvas(Modifier.fillMaxSize().clipToBounds().testTag(if (readOnly) "listing-public-map" else "asset-pin-map")
                .semantics { contentDescription = if (readOnly) "Bản đồ khu vực $area" else "Bản đồ chọn vị trí" }.onSizeChanged { size = it }
                .pointerInput(center, zoom) { detectDragGestures(onDragEnd = {
                    val (x, y) = pixel(center, zoom); center = point(x - drag.x, y - drag.y, zoom); drag = Offset.Zero; positioned = true
                }, onDragCancel = { drag = Offset.Zero }) { change, amount -> change.consume(); drag += amount } }
                .pointerInput(center, zoom, size, canPick) { detectTapGestures { offset ->
                    if (canPick) { val (x, y) = pixel(center, zoom); onPick(point(x + offset.x - size.width / 2, y + offset.y - size.height / 2, zoom)) }
                } }) {
                drawRect(mapBackground)
                tiles.forEach { (position, bitmap, dimensions) -> drawImage(bitmap, dstOffset = position + IntOffset(drag.x.roundToInt(), drag.y.roundToInt()), dstSize = dimensions) }
                selectedPoint?.let {
                    val (x, y) = pixel(it, zoom); val (cx, cy) = pixel(center, zoom)
                    val pin = Offset((x - cx + size.width / 2 + drag.x).toFloat(), (y - cy + size.height / 2 + drag.y).toFloat())
                    if (readOnly) drawCircle(areaColor.copy(alpha = 0.22f), 48.dp.toPx(), pin)
                    else { drawCircle(Color.White, 12.dp.toPx(), pin); drawCircle(Color(0xFFAA4C32), 8.dp.toPx(), pin) }
                }
            }
            Column(Modifier.align(Alignment.TopEnd).padding(4.dp)) {
                FilledTonalButton({ zoom = (zoom + 1).coerceAtMost(17) }, enabled = zoom < 17 && !loading, contentPadding = PaddingValues(4.dp), modifier = Modifier.size(48.dp).semantics { contentDescription = "Phóng to bản đồ" }) { Text("+") }
                FilledTonalButton({ zoom = (zoom - 1).coerceAtLeast(2) }, enabled = zoom > 2 && !loading, contentPadding = PaddingValues(4.dp), modifier = Modifier.size(48.dp).semantics { contentDescription = "Thu nhỏ bản đồ" }) { Text("−") }
            }
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().align(Alignment.TopCenter))
            Surface(Modifier.align(Alignment.BottomEnd)) {
                TextButton({ links.openUri("https://opentopomap.org/about") }, contentPadding = PaddingValues(horizontal = 6.dp)) { Text("© OpenStreetMap contributors, SRTM\nMap: © OpenTopoMap (CC BY-SA)", style = MaterialTheme.typography.labelSmall) }
            }
        }
        if (failed) TroOiButton("Chưa tải được bản đồ · thử lại", { retry++ }, style = TroOiButtonStyle.TERTIARY)
        if (!positioned && !loading) Text("Di chuyển đến khu vực tài sản để chọn vị trí.", style = MaterialTheme.typography.bodySmall)
        if (!readOnly) TroOiButton("Ghim tại tâm bản đồ", { onPick(center) }, Modifier.fillMaxWidth().testTag("asset-pin-center"),
            enabled = canPick, style = TroOiButtonStyle.SECONDARY)
    }
}
