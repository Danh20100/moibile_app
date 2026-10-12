package com.trooi.app.features.discovery

import android.content.ActivityNotFoundException
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import com.trooi.app.ui.components.*

@Composable
fun ListingDetailScreen(listingId: String, onBack: () -> Unit, presentation: ListingFixture? = ListingFixtures.resolve(listingId), preview: Boolean = false) {
    BackHandler(onBack = onBack)
    val fixture = presentation
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var favorite by rememberSaveable(listingId) { mutableStateOf(false) }
    val feedback: (String) -> Unit = { scope.launch { snackbar.showSnackbar(it) } }
    TroOiScreenScaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            if (fixture != null && !preview) Surface(shadowElevation = 3.dp) {
                Row(
                    Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp).testTag("listing-sticky-action"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(fixture.card.askingPriceLabel, fontWeight = FontWeight.Bold)
                        Text("Xem chi phí thuê", style = MaterialTheme.typography.bodySmall)
                    }
                    TroOiButton("Đặt lịch xem", onClick = { feedback("Tính năng đặt lịch xem đang được phát triển.") },
                        modifier = Modifier.testTag("listing-viewing-cta"))
                }
            }
        },
    ) { padding ->
        if (fixture == null) {
            Column(Modifier.padding(padding).padding(20.dp)) {
                TroOiButton("Quay lại", onClick = onBack, modifier = Modifier.testTag("listing-back"), style = TroOiButtonStyle.TERTIARY)
                TroOiStateMessage(TroOiStateKind.UNAVAILABLE, "Tin đăng hiện không khả dụng.")
            }
        } else {
            val photoCount = fixture.photoUris.size + fixture.images.size
            val pager = rememberPagerState { photoCount }
            LazyColumn(
                Modifier.fillMaxSize().padding(padding).testTag("listing-detail-$listingId"),
                contentPadding = PaddingValues(bottom = 24.dp),
            ) {
                item {
                    Box(Modifier.fillMaxWidth().height(300.dp)) {
                        HorizontalPager(pager, modifier = Modifier.fillMaxSize().testTag("listing-hero-pager")) { page ->
                            com.trooi.app.ui.components.LocalRentalPhoto(fixture.photoUris.getOrNull(page),
                                fixture.images.getOrNull(page - fixture.photoUris.size), "Ảnh tài sản ${page + 1}", Modifier.fillMaxSize())
                        }
                        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Surface(shape = androidx.compose.foundation.shape.CircleShape) {
                                IconButton(onBack, Modifier.testTag("listing-back")) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Quay lại") }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (!preview) Surface(shape = androidx.compose.foundation.shape.CircleShape) {
                                    IconButton({
                                        try {
                                            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                                                type = "text/plain"
                                                putExtra(Intent.EXTRA_TEXT, fixture.shareText())
                                            }, "Chia sẻ tin đăng"))
                                        } catch (_: ActivityNotFoundException) {
                                            feedback("Chưa mở được chia sẻ. Vui lòng thử lại.")
                                        }
                                    }, Modifier.testTag("listing-share")) { Icon(Icons.Rounded.Share, "Chia sẻ") }
                                }
                                Surface(shape = androidx.compose.foundation.shape.CircleShape) {
                                    IconButton({ favorite = !favorite }, Modifier.testTag("listing-favorite").semantics { selected = favorite }) {
                                        Icon(if (favorite) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder, if (favorite) "Bỏ yêu thích" else "Yêu thích")
                                    }
                                }
                            }
                        }
                        Surface(modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp), shape = MaterialTheme.shapes.small) {
                            Text("${pager.currentPage + 1}/$photoCount", Modifier.padding(horizontal = 12.dp, vertical = 6.dp).testTag("listing-image-indicator"))
                        }
                    }
                }
                item {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(fixture.card.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text(fixture.card.category, style = MaterialTheme.typography.labelLarge, modifier = Modifier.testTag("listing-rental-type"))
                        Text(fixture.card.publicAreaLabel)
                        Text(fixture.summary, style = MaterialTheme.typography.bodyMedium)
                        Text(fixture.card.askingPriceLabel, fontWeight = FontWeight.Bold)
                    }
                }
                item {
                    HorizontalDivider(Modifier.padding(horizontal = 20.dp))
                    Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Surface(shape = androidx.compose.foundation.shape.CircleShape, color = MaterialTheme.colorScheme.primaryContainer, modifier = Modifier.size(56.dp)) {
                            Box(contentAlignment = Alignment.Center) { Text(fixture.host.take(1), style = MaterialTheme.typography.headlineSmall) }
                        }
                        Column {
                            Text("Chủ trọ · ${fixture.host}", fontWeight = FontWeight.SemiBold)
                            Text("Chủ trọ", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                item { DetailSection("Về căn phòng", listOf(fixture.description)) }
                item { DetailSection("Tiện nghi", fixture.amenities) }
                if (fixture.costs.isNotEmpty()) item { DetailSection("Chi phí thuê", fixture.costs) }
                item {
                    DetailSection("Khu vực quanh bạn", listOf(fixture.card.publicAreaLabel, fixture.locationDescription))
                    if (!preview) fixture.publicGeoPoint?.let { publicPoint ->
                        Box(Modifier.padding(horizontal = 20.dp).padding(bottom = 20.dp)) {
                            StreetMapPicker(fixture.card.publicAreaLabel, publicPoint, {}, readOnly = true)
                        }
                    }
                }
                item { DetailSection("Điều cần biết", fixture.rules) }
            }
        }
    }
}

@Composable
private fun DetailSection(title: String, lines: List<String>) {
    HorizontalDivider(Modifier.padding(horizontal = 20.dp))
    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        lines.ifEmpty { listOf("Chủ trọ chưa bổ sung thông tin.") }.forEach { Text(it, style = MaterialTheme.typography.bodyLarge) }
    }
}
