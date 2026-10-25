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
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.features.inquiry.InquiryComposer

@Composable
fun ListingDetailScreen(
    listingId: String,
    onBack: () -> Unit,
    presentation: ListingFixture? = ListingFixtures.resolve(listingId),
    preview: Boolean = false,
    state: TroOiUiState? = null,
    onOpenLogin: () -> Unit = {},
    onSubmitInquiry: (String, String) -> Unit = { _, _ -> },
    onOpenReport: (String) -> Unit = {},
) {
    BackHandler(onBack = onBack)
    val fixture = presentation
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()
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
                    TroOiButton("Liên hệ", onClick = {
                        scope.launch { listState.animateScrollToItem((listState.layoutInfo.totalItemsCount - 2).coerceAtLeast(0)) }
                    }, modifier = Modifier.testTag("listing-contact-cta"))
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
            val suppliedPhotoCount = fixture.photoUris.size + fixture.images.size
            val photoCount = maxOf(1, suppliedPhotoCount, fixture.publicPhotoIds.size)
            val pager = rememberPagerState { photoCount }
            LazyColumn(
                Modifier.fillMaxSize().padding(padding).testTag("listing-detail-$listingId"),
                state = listState,
                contentPadding = PaddingValues(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
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
                                    IconButton({ onOpenReport(listingId) }, Modifier.testTag("listing-open-report")) {
                                        Icon(Icons.Rounded.Flag, "Báo cáo tin đăng")
                                    }
                                }
                            }
                        }
                        Surface(modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp), shape = MaterialTheme.shapes.small) {
                            Text(if (suppliedPhotoCount == 0 && fixture.publicPhotoIds.isNotEmpty()) "Ảnh công khai"
                                else if (suppliedPhotoCount == 0) "Chưa có ảnh" else "${pager.currentPage + 1}/$photoCount",
                                Modifier.padding(horizontal = 12.dp, vertical = 6.dp).testTag("listing-image-indicator"))
                        }
                    }
                }
                item {
                    DetailSectionCard("Thông tin tổng quan", "listing-section-overview",
                        Modifier.padding(horizontal = 20.dp)) {
                        Text(fixture.card.title, style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold)
                        Text(fixture.card.category, style = MaterialTheme.typography.labelLarge,
                            modifier = Modifier.testTag("listing-rental-type"),
                            color = MaterialTheme.colorScheme.primary)
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Rounded.LocationOn, contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(fixture.card.publicAreaLabel, style = MaterialTheme.typography.bodyMedium)
                        }
                        if (fixture.summary.isNotBlank()) {
                            Text(fixture.summary, style = MaterialTheme.typography.bodyMedium)
                        }
                        Text(fixture.card.askingPriceLabel, style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                }
                item {
                    DetailSectionCard("Người đăng tin", "listing-section-host",
                        Modifier.padding(horizontal = 20.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            Surface(shape = androidx.compose.foundation.shape.CircleShape,
                                color = MaterialTheme.colorScheme.primaryContainer,
                                modifier = Modifier.size(52.dp)) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(fixture.host.take(1),
                                        style = MaterialTheme.typography.headlineSmall)
                                }
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(fixture.host.ifBlank { "Chưa công khai tên" },
                                    fontWeight = FontWeight.SemiBold)
                                Text("Chủ trọ", style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
                item {
                    DetailSectionCard("Về căn phòng", "listing-section-description",
                        Modifier.padding(horizontal = 20.dp)) {
                        DetailTextBlock(listOf(fixture.description))
                    }
                }
                item {
                    DetailSectionCard("Tiện nghi", "listing-section-amenities",
                        Modifier.padding(horizontal = 20.dp)) {
                        DetailAmenityGrid(fixture.amenities)
                    }
                }
                if (fixture.costs.isNotEmpty()) item {
                    DetailSectionCard("Chi phí thuê", "listing-section-costs",
                        Modifier.padding(horizontal = 20.dp)) {
                        DetailCostRows(fixture.costs)
                    }
                }
                item {
                    DetailSectionCard("Bản đồ", "listing-section-location",
                        Modifier.padding(horizontal = 20.dp)) {
                        Text(fixture.card.publicAreaLabel, style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold)
                        DetailPublicLocationNote()
                        if (!preview) fixture.publicGeoPoint?.let { publicPoint ->
                            StreetMapPicker(fixture.card.publicAreaLabel, publicPoint, {}, readOnly = true)
                        }
                    }
                }
                item {
                    DetailSectionCard("Điều cần biết", "listing-section-rules",
                        Modifier.padding(horizontal = 20.dp)) {
                        DetailTextBlock(fixture.rules)
                    }
                }
                if (!preview && state != null) {
                    item {
                        Box(Modifier.padding(horizontal = 20.dp).testTag("listing-contact-section")) {
                            InquiryComposer(state, listingId, onOpenLogin, onSubmitInquiry)
                        }
                    }
                    item {
                        TextButton(onClick = { onOpenReport(listingId) },
                            modifier = Modifier.fillMaxWidth().testTag("listing-report-action")) {
                            Text("Báo cáo tin đăng")
                        }
                    }
                }
            }
        }
    }
}
