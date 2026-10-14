package com.trooi.app.features.discovery

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.CompareArrows
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.publicDiscoveryFeed
import com.trooi.app.ui.components.LocalRentalPhoto
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.components.TroOiButtonStyle
import com.trooi.app.ui.components.TroOiStateKind
import com.trooi.app.ui.components.TroOiStateMessage
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale

private enum class DiscoverySort(val label: String) {
    DEFAULT("Mặc định"), PRICE_ASC("Giá thấp trước"), PRICE_DESC("Giá cao trước")
}

private fun priced(items: List<DiscoveryListingItem>, sort: DiscoverySort): List<DiscoveryListingItem> {
    if (sort == DiscoverySort.DEFAULT) return items
    val comparator = compareBy<DiscoveryListingItem> { explorePriceVnd(it.askingPriceLabel) == null }
        .thenBy { explorePriceVnd(it.askingPriceLabel) }
        .thenBy { it.listingId }
    return items.sortedWith(if (sort == DiscoverySort.PRICE_ASC) comparator
        else compareBy<DiscoveryListingItem> { explorePriceVnd(it.askingPriceLabel) == null }
            .thenByDescending { explorePriceVnd(it.askingPriceLabel) }
            .thenBy { it.listingId })
}

/**
 * One public Discovery POV for guest, tenant and operator.
 * No operational property/tenancy records are consulted for comparison or insight.
 */
@Composable
fun DiscoveryExperience(
    state: TroOiUiState,
    onOpenListing: (String) -> Unit,
    onLoadPublicPhoto: (String, String) -> Unit = { _, _ -> },
    onOpenMap: () -> Unit,
    onSearch: ((Double, Double, Double, String?, String?) -> Unit)? = null,
    onResetSearch: (() -> Unit)? = null,
    onRetrySearch: (() -> Unit)? = null,
    allowDemoFallback: Boolean = true,
) {
    var showSearch by rememberSaveable { mutableStateOf(false) }
    var showCompare by rememberSaveable { mutableStateOf(false) }
    var area by rememberSaveable { mutableStateOf("") }
    var type by rememberSaveable { mutableStateOf("Tất cả") }
    var min by rememberSaveable { mutableStateOf("") }
    var max by rememberSaveable { mutableStateOf("") }
    var radius by rememberSaveable { mutableIntStateOf(3000) }
    var sort by rememberSaveable { mutableStateOf(DiscoverySort.DEFAULT) }
    var geoSearch by rememberSaveable { mutableStateOf(false) }
    var compareIds by rememberSaveable { mutableStateOf(emptyList<String>()) }
    val listState = rememberLazyListState()
    val invalidPrice = PublicDiscoveryFilters(min, max).validationMessage()
    val results = remember(state.read.publicListings, allowDemoFallback, area, type, min, max, sort) {
        priced(discoveryCards(state.read.publicListings, allowDemoFallback, area, type, min, max), sort)
    }
    val eligible = results.map { it.listingId }.toSet()
    // Drop selections no longer present in the current public projection.
    LaunchedEffect(eligible) { compareIds = compareIds.filter { it in eligible } }

    fun clearFilters() {
        area = ""
        type = "Tất cả"
        min = ""
        max = ""
        geoSearch = false
        radius = 3000
        sort = DiscoverySort.DEFAULT
        onResetSearch?.invoke()
    }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().testTag("discovery-results"),
            contentPadding = PaddingValues(bottom = if (compareIds.isEmpty()) 96.dp else 150.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp).statusBarsPadding().padding(top = 12.dp)) {
                    Text("TrọƠi", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(12.dp))
                    Surface(
                        onClick = { showSearch = true },
                        modifier = Modifier.fillMaxWidth().testTag("explore-search-entry"),
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    ) {
                        Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.Search, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    if (geoSearch) "Phòng quanh vị trí đã chọn"
                                    else area.ifBlank { "Bạn muốn thuê ở đâu?" },
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text("Khu vực · Giá thuê · Loại phòng",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Icon(Icons.Rounded.Tune, contentDescription = "Mở bộ lọc")
                        }
                    }
                }
            }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.testTag("discovery-quick-filters"),
                ) {
                    item {
                        FilterChip(selected = false, onClick = { showSearch = true },
                            label = { Text("Bộ lọc") }, leadingIcon = { Icon(Icons.Rounded.Tune, null, Modifier.size(16.dp)) })
                    }
                    items(DiscoveryDemoTaxonomy.TAGS) { tag ->
                        FilterChip(selected = type == tag, onClick = { type = tag },
                            label = { Text(tag) }, modifier = Modifier.testTag("discovery-type-" + tag))
                    }
                    item {
                        FilterChip(selected = min.isBlank() && max == "3000000",
                            onClick = { if (min.isBlank() && max == "3000000") max = "" else { min = ""; max = "3000000" } },
                            label = { Text("Dưới 3 triệu") }, modifier = Modifier.testTag("discovery-budget-3m"))
                    }
                    item {
                        FilterChip(selected = min == "3000000" && max == "5000000",
                            onClick = { if (min == "3000000" && max == "5000000") { min = ""; max = "" }
                                else { min = "3000000"; max = "5000000" } },
                            label = { Text("3–5 triệu") })
                    }
                }
            }
            if (area.isNotBlank() || min.isNotBlank() || max.isNotBlank() || geoSearch) {
                item {
                    Row(Modifier.padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            listOfNotNull(area.takeIf { it.isNotBlank() },
                                (min.takeIf { it.isNotBlank() }?.let { "Từ ${rentalPriceLabel(it)}" }),
                                (max.takeIf { it.isNotBlank() }?.let { "Đến ${rentalPriceLabel(it)}" }),
                                "Trong bán kính ${radius / 1000} km".takeIf { geoSearch })
                                .joinToString(" · "),
                            modifier = Modifier.weight(1f).testTag("discovery-active-filters"),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        TextButton(onClick = ::clearFilters) { Text("Xóa lọc") }
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text("Phòng đang cho thuê", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold)
                        Text("${results.size} tin đăng phù hợp",
                            modifier = Modifier.testTag("discovery-result-count"),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TextButton(onClick = onOpenMap, modifier = Modifier.testTag("discovery-open-map")) {
                        Icon(Icons.Rounded.Map, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Bản đồ")
                    }
                }
            }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(DiscoverySort.entries.toList()) { choice ->
                        FilterChip(selected = sort == choice, onClick = { sort = choice },
                            label = { Text(choice.label) }, modifier = Modifier.testTag("discovery-sort-" + choice.name))
                    }
                }
            }
            if (state.publicDiscoveryLoading) {
                item { LinearProgressIndicator(Modifier.fillMaxWidth().testTag("discovery-loading")) }
            }
            if (state.publicDiscoveryError != null && !state.publicDiscoveryLoading) {
                item {
                    Column(Modifier.padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        TroOiStateMessage(TroOiStateKind.ERROR, state.publicDiscoveryError, title = "Không tải được tin đăng")
                        onRetrySearch?.let { retry ->
                            TroOiButton("Thử lại", retry, modifier = Modifier.testTag("discovery-retry"))
                        }
                    }
                }
            }
            if (invalidPrice != null) {
                item { Text(invalidPrice, Modifier.padding(horizontal = 18.dp), color = MaterialTheme.colorScheme.error) }
            }
            if (results.isEmpty() && !state.publicDiscoveryLoading && state.publicDiscoveryError == null) {
                item {
                    Column(Modifier.padding(horizontal = 18.dp)) {
                        TroOiStateMessage(TroOiStateKind.EMPTY,
                            "Chưa có tin đăng phù hợp. Hãy thử mở rộng khu vực hoặc khoảng giá.")
                        Spacer(Modifier.height(10.dp))
                        TroOiButton("Xóa bộ lọc", ::clearFilters, modifier = Modifier.testTag("discovery-empty-reset"))
                    }
                }
            }
            items(results, key = { it.listingId }) { item ->
                val projection = publicDiscoveryFeed(state.read.publicListings)
                    .firstOrNull { it.listingId == item.listingId }
                DiscoveryDecisionCard(
                    item = item, public = projection,
                    onLoadPublicPhoto = onLoadPublicPhoto,
                    compared = item.listingId in compareIds,
                    onCompare = {
                        if (item.listingId in compareIds) compareIds = compareIds - item.listingId
                        else if (compareIds.size < 3) compareIds = compareIds + item.listingId
                    },
                    compareFull = compareIds.size >= 3,
                    onOpen = { onOpenListing(item.listingId) },
                    modifier = Modifier.padding(horizontal = 18.dp).padding(bottom = 6.dp),
                )
            }
            if (!allowDemoFallback && state.access.operatedOrganizationIds.isNotEmpty()) {
                item {
                    val amounts = results.mapNotNull { explorePriceVnd(it.askingPriceLabel) }.sorted()
                    if (amounts.size >= 5) {
                        val median = if (amounts.size % 2 == 1) amounts[amounts.size / 2]
                            else amounts[amounts.size / 2 - 1].add(amounts[amounts.size / 2])
                                .divide(BigDecimal(2))
                        Surface(Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                            shape = RoundedCornerShape(16.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Tham khảo giá chào", fontWeight = FontWeight.SemiBold)
                                Text("${rentalPriceLabel(median.toPlainString())}/tháng",
                                    style = MaterialTheme.typography.titleLarge,
                                    color = MaterialTheme.colorScheme.primary)
                                Text("Trung vị từ ${amounts.size} tin đang hiển thị; không phải giá giao dịch hoặc mức giá đại diện toàn khu vực.",
                                    style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }
        if (compareIds.isNotEmpty()) {
            Surface(Modifier.align(Alignment.BottomCenter).fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 8.dp) {
                Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Đã chọn ${compareIds.size}/3 phòng",
                        Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                    TextButton(onClick = { compareIds = emptyList() }) { Text("Bỏ chọn") }
                    Button(onClick = { showCompare = true }, enabled = compareIds.size >= 2,
                        modifier = Modifier.testTag("discovery-compare-open")) { Text("So sánh") }
                }
            }
        }
    }

    if (showSearch) {
        Dialog(onDismissRequest = { showSearch = false },
            properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
            SearchExperienceScreen(
                onClose = { showSearch = false },
                initialArea = area,
                initialRoomType = type,
                initialMinPrice = min,
                initialMaxPrice = max,
                initialRadiusMeters = radius,
                onLocalSearch = { nextArea, nextType, nextMin, nextMax ->
                    area = nextArea
                    type = nextType
                    min = nextMin
                    max = nextMax
                },
                onSearchSubmitted = { lat, lng, selectedRadius, low, high ->
                    radius = selectedRadius
                    showSearch = false
                    geoSearch = lat != null && lng != null && onSearch != null
                    if (geoSearch) onSearch?.invoke(lat!!, lng!!, selectedRadius.toDouble(), low, high)
                    else onResetSearch?.invoke()
                },
                onResetSearch = { clearFilters(); showSearch = false },
            )
        }
    }
    if (showCompare) {
        val selected = results.filter { it.listingId in compareIds }
        Dialog(onDismissRequest = { showCompare = false }) {
            Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface,
                modifier = Modifier.fillMaxWidth().testTag("discovery-compare-dialog")) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("So sánh phòng", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold)
                        IconButton(onClick = { showCompare = false }) {
                            Icon(Icons.Rounded.Close, "Đóng so sánh")
                        }
                    }
                    Column(Modifier.heightIn(max = 530.dp).verticalScroll(androidx.compose.foundation.rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        selected.forEach { item ->
                            val public = state.read.publicListings.firstOrNull { it.listingId == item.listingId }
                            val detail = public?.rentalDetails
                            Surface(shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp,
                                MaterialTheme.colorScheme.outlineVariant)) {
                                Column(Modifier.fillMaxWidth().padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Text(item.title, fontWeight = FontWeight.Bold)
                                    CompareLine("Khu vực", item.publicAreaLabel)
                                    CompareLine("Giá chào", item.askingPriceLabel)
                                    CompareLine("Diện tích", detail?.area?.takeIf { it.isNotBlank() }?.let { "$it m²" }
                                        ?: item.metadataLabel.takeIf { public == null })
                                    CompareLine("Loại", detail?.type ?: item.category)
                                    CompareLine("Nội thất", detail?.furnishing)
                                    CompareLine("Cọc dự kiến", detail?.advertisedDeposit?.takeIf { it.isNotBlank() }?.let(::rentalPriceLabel))
                                    TextButton(onClick = { showCompare = false; onOpenListing(item.listingId) }) {
                                        Text("Xem chi tiết")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CompareLine(label: String, value: String?) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, Modifier.width(104.dp), style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value?.takeIf { it.isNotBlank() } ?: "Chưa cung cấp",
            style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun DiscoveryDecisionCard(
    item: DiscoveryListingItem,
    public: PublicListingCard?,
    onLoadPublicPhoto: (String, String) -> Unit,
    compared: Boolean,
    onCompare: () -> Unit,
    compareFull: Boolean,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val detail = public?.rentalDetails
    LaunchedEffect(public?.listingId, public?.publicPhotoIds?.firstOrNull(), public?.photoUris?.firstOrNull()) {
        val listingId = public?.listingId
        val photoId = public?.publicPhotoIds?.firstOrNull()
        if (listingId != null && photoId != null && public?.photoUris?.isEmpty() == true) onLoadPublicPhoto(listingId, photoId)
    }
    Surface(
        modifier = modifier.fillMaxWidth().testTag("discovery-card-" + item.listingId),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        shadowElevation = 1.dp,
    ) {
        Column {
            Box(Modifier.fillMaxWidth().height(175.dp).clickable(onClick = onOpen)) {
                LocalRentalPhoto(public?.photoUris?.firstOrNull() ?: item.photoUris.firstOrNull(), item.photoResources.firstOrNull(),
                    item.title, Modifier.fillMaxSize())
                item.badge?.let {
                    SuggestionBadge(it, Modifier.align(Alignment.TopStart).padding(12.dp))
                }
            }
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(item.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold,
                    maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.clickable(onClick = onOpen))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.LocationOn, null, Modifier.size(15.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(4.dp))
                    Text(item.publicAreaLabel.ifBlank { "Chưa có khu vực công khai" },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1)
                }
                Text(item.askingPriceLabel,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary)
                val specs = listOfNotNull(
                    detail?.area?.takeIf { it.isNotBlank() }?.let { "$it m²" },
                    detail?.type?.takeIf { it.isNotBlank() } ?: item.category.takeIf { it.isNotBlank() },
                    detail?.furnishing?.takeIf { it.isNotBlank() }
                ).joinToString(" · ").ifBlank { item.metadataLabel }
                Text(specs, style = MaterialTheme.typography.bodySmall, maxLines = 2)
                if (detail?.advertisedDeposit?.isNotBlank() == true) {
                    Text("Cọc dự kiến: ${rentalPriceLabel(detail.advertisedDeposit)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween) {
                    OutlinedButton(onClick = onCompare,
                        enabled = compared || !compareFull,
                        modifier = Modifier.testTag("discovery-compare-" + item.listingId)) {
                        Icon(if (compared) Icons.Rounded.CheckCircle else Icons.AutoMirrored.Rounded.CompareArrows,
                            null, Modifier.size(17.dp))
                        Spacer(Modifier.width(5.dp))
                        Text(if (compared) "Đã chọn" else "So sánh")
                    }
                    TextButton(onClick = onOpen, modifier = Modifier.testTag("discovery-detail-" + item.listingId)) {
                        Text("Xem chi tiết")
                        Icon(Icons.Rounded.ChevronRight, null)
                    }
                }
            }
        }
    }
}

@Composable
private fun SuggestionBadge(title: String, modifier: Modifier) {
    Surface(modifier = modifier, shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f)) {
        Text(title, Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall)
    }
}
