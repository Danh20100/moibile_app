package com.trooi.app.features.discovery

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import android.annotation.SuppressLint
import android.content.Context
import android.location.LocationManager
import com.trooi.app.core.model.ListingVisibility
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.publicDiscoveryFeed
import com.trooi.app.ui.components.*
import java.math.BigDecimal
import java.text.Normalizer

/**
 * Isolated presentation taxonomy for discovery category chips.
 * Purely presentation-only; no irreversible domain or backend concepts are bound.
 */
object DiscoveryDemoTaxonomy {
    val TAGS = listOf("Tất cả", "Phòng trọ", "Căn hộ")
}

/**
 * Presentation card data for discovery sections.
 */
data class DiscoveryListingItem(
    val listingId: String,
    val title: String,
    val publicAreaLabel: String,
    val askingPriceLabel: String,
    val metadataLabel: String,
    val badge: String? = null,
    val category: String = "Phòng trọ",
    val rating: String? = null,
    val photoUris: List<String> = emptyList(),
    val photoResources: List<Int> = emptyList(),
)

/**
 * Main consumer-first Explore / Khám phá screen.
 * Composition: Search Entry -> Horizontal Tag Row -> Discovery Content Sections -> Visual Listing Cards.
 */
@Composable
fun ExploreScreen(
    state: TroOiUiState,
    onOpenListing: (String) -> Unit,
    modifier: Modifier = Modifier,
    onSearch: ((Double, Double, Double, String?, String?) -> Unit)? = null,
    onResetSearch: (() -> Unit)? = null,
    allowDemoFallback: Boolean = true,
) {
    var isSearchExperienceOpen by rememberSaveable { mutableStateOf(false) }
    var selectedTag by rememberSaveable { mutableStateOf("Tất cả") }
    val favoritedIds = remember { mutableStateListOf<String>() }

    var areaFilter by rememberSaveable { mutableStateOf("") }
    var roomFilter by rememberSaveable { mutableStateOf("") }
    var minimumFilter by rememberSaveable { mutableStateOf("") }
    var maximumFilter by rememberSaveable { mutableStateOf("") }
    val allItems = discoveryCards(
        state.read.publicListings, allowDemoFallback,
        areaFilter, roomFilter.ifBlank { selectedTag }, minimumFilter, maximumFilter,
    )

    Box(modifier = modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().testTag("explore-main-feed"),
            contentPadding = PaddingValues(bottom = 90.dp),
        ) {
            // 1. Subtle Header Bar & Search Entry
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                ) {
                    // Subtle brand identity
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(
                                text = "Trọ",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 22.sp,
                                ),
                                color = MaterialTheme.colorScheme.onBackground,
                            )
                            Text(
                                text = "Ơi",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 22.sp,
                                ),
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }

                    // Prominent Rounded Search Entry Control
                    ExploreSearchBar(
                        onClick = { isSearchExperienceOpen = true },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            // 2. Horizontal Taxonomy Tag Row
            item {
                ExploreTaxonomyRow(
                    tags = DiscoveryDemoTaxonomy.TAGS,
                    selectedTag = selectedTag,
                    onTagSelect = { selectedTag = it },
                    modifier = Modifier.padding(bottom = 16.dp),
                )
            }

            item {
                Text("Tìm nơi ở lâu dài", Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                    style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            }
            items(allItems, key = { it.listingId }) { item ->
                ExploreListingCard(item, item.listingId in favoritedIds,
                    { if (item.listingId in favoritedIds) favoritedIds.remove(item.listingId) else favoritedIds.add(item.listingId) },
                    onClick = { onOpenListing(item.listingId) },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 28.dp))
            }

            if (allItems.isEmpty()) {
                item {
                    TroOiStateMessage(TroOiStateKind.EMPTY,
                        "Chưa có phòng phù hợp. Thử đổi khu vực hoặc khoảng giá.", Modifier.padding(20.dp))
                }
            }
        }

        // Dedicated Full-Screen Search Experience Modal
        if (isSearchExperienceOpen) {
            Dialog(
                onDismissRequest = { isSearchExperienceOpen = false },
                properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
            ) {
                SearchExperienceScreen(
                    onClose = { isSearchExperienceOpen = false },
                    initialArea = areaFilter,
                    initialRoomType = roomFilter.ifBlank { "Tất cả" },
                    initialMinPrice = minimumFilter,
                    initialMaxPrice = maximumFilter,
                    onSearchSubmitted = { lat, lng, radius, minPrice, maxPrice ->
                        isSearchExperienceOpen = false
                        if (lat != null && lng != null && onSearch != null) {
                            onSearch(lat, lng, radius.toDouble(), minPrice, maxPrice)
                        }
                    },
                    onLocalSearch = { area, type, min, max ->
                        areaFilter = area
                        roomFilter = type
                        minimumFilter = min
                        maximumFilter = max
                    },
                    onResetSearch = {
                        areaFilter = ""
                        roomFilter = ""
                        minimumFilter = ""
                        maximumFilter = ""
                        onResetSearch?.invoke()
                        isSearchExperienceOpen = false
                    },
                )
            }
        }
    }
}

/**
 * Clean, prominent rounded search entry bar.
 */
@Composable
fun ExploreSearchBar(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        modifier = modifier
            .testTag("explore-search-entry")
            .heightIn(min = 54.dp),
        shape = RoundedCornerShape(27.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.8f)),
        shadowElevation = 2.dp,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Circular search icon badge
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
                modifier = Modifier.size(36.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Rounded.Search,
                        contentDescription = "Tìm kiếm",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Bắt đầu tìm kiếm",
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    ),
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = "Khu vực · Khoảng giá · Loại phòng",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 11.sp,
                    ),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Tune filter icon
            Icon(
                imageVector = Icons.Rounded.Tune,
                contentDescription = "Bộ lọc",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

/**
 * Horizontally scrolling taxonomy tag/category row.
 */
@Composable
fun ExploreTaxonomyRow(
    tags: List<String>,
    selectedTag: String,
    onTagSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyRow(
        modifier = modifier
            .fillMaxWidth()
            .testTag("explore-taxonomy-row"),
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(tags) { tag ->
            val isSelected = tag == selectedTag
            val primaryColor = MaterialTheme.colorScheme.primary
            Surface(
                onClick = { onTagSelect(tag) },
                shape = RoundedCornerShape(20.dp),
                color = if (isSelected) primaryColor.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface,
                border = BorderStroke(
                    width = if (isSelected) 1.5.dp else 1.dp,
                    color = if (isSelected) primaryColor else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.7f),
                ),
                modifier = Modifier.height(48.dp),
            ) {
                Box(
                    modifier = Modifier.padding(horizontal = 14.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = tag,
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 13.sp,
                        ),
                        color = if (isSelected) primaryColor else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

/**
 * Section with title, subtitle, and horizontally scrolling listing cards.
 * Peek factor: 250dp card width ensures 1 full card + part of the next card is visible.
 */
@Composable
fun ExploreSectionRow(
    sectionTitle: String,
    sectionSubtitle: String,
    items: List<DiscoveryListingItem>,
    favoritedIds: List<String>,
    onToggleFavorite: (String) -> Unit,
    onOpenListing: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        // Section Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = sectionTitle,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.2).sp,
                    ),
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = "Xem tất cả →",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.SemiBold,
                    ),
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Spacer(Modifier.height(2.dp))
            Text(
                text = sectionSubtitle,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // Horizontally scrolling cards
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            items(items, key = { it.listingId + "_" + sectionTitle }) { item ->
                ExploreListingCard(
                    item = item,
                    isFavorited = favoritedIds.contains(item.listingId),
                    onToggleFavorite = { onToggleFavorite(item.listingId) },
                    onClick = { onOpenListing(item.listingId) },
                )
            }
        }
    }
}

/**
 * Visual Listing Card: Dominant image, heart icon top-right, title, monthly price, and metadata.
 */
@Composable
fun ExploreListingCard(
    item: DiscoveryListingItem,
    isFavorited: Boolean,
    onToggleFavorite: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier.width(250.dp),
) {
    Column(
        modifier = modifier
            .testTag("explore-card-${item.listingId}")
            .clickable(onClick = onClick),
    ) {
        // 1. Dominant Room Image Container (~4:3 ratio)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1.45f)
                .clip(RoundedCornerShape(16.dp)),
        ) {
            val fixture = ListingFixtures.resolve(item.listingId)?.takeIf { it.card == item }
            if (item.photoUris.isNotEmpty() || item.photoResources.isNotEmpty()) {
                com.trooi.app.ui.components.LocalRentalPhoto(item.photoUris.firstOrNull(), item.photoResources.firstOrNull(), item.title, Modifier.fillMaxSize())
            } else if (fixture != null) {
                androidx.compose.foundation.Image(
                    painter = androidx.compose.ui.res.painterResource(fixture.images.first()),
                    contentDescription = "${item.title}",
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                ExploreRoomImage(item.listingId, item.title, item.category)
            }

            // Optional Badge on top-left
            item.badge?.let { badgeText ->
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = Color.Black.copy(alpha = 0.65f),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(10.dp),
                ) {
                    Text(
                        text = badgeText,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                        ),
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }

            // Favorite Heart Icon Button top-right
            Surface(
                shape = CircleShape,
                color = Color.Black.copy(alpha = 0.35f),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
                    .size(48.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        role = Role.Button,
                        onClick = onToggleFavorite,
                    ),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (isFavorited) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                        contentDescription = "Yêu thích",
                        tint = if (isFavorited) Color(0xFFE53935) else Color.White,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // 2. Title / Area line
        Text(
            text = item.title,
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
            ),
            color = MaterialTheme.colorScheme.onBackground,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )

        item.rating?.let {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Rounded.Star, "Đánh giá minh họa", modifier = Modifier.size(16.dp))
                Text(it, style = MaterialTheme.typography.bodySmall)
            }
        }

        // 3. Monthly price
        Text(
            text = item.askingPriceLabel,
            style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
            ),
            color = MaterialTheme.colorScheme.primary,
        )

        // 4. One short metadata row
        Text(
            text = item.metadataLabel,
            style = MaterialTheme.typography.bodySmall.copy(
                fontSize = 12.sp,
            ),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * Deterministic presentation room imagery fallback.
 * Renders an isolated, tasteful architectural gradient scene with clear room iconography.
 */
@Composable
fun ExploreRoomImage(
    listingId: String,
    title: String,
    category: String,
    modifier: Modifier = Modifier,
) {
    // Generate deterministic harmonic gradient based on listingId
    val hash = listingId.hashCode()
    val baseGradients = listOf(
        listOf(Color(0xFF2C5E4F), Color(0xFF16342D)),
        listOf(Color(0xFF386657), Color(0xFF1E4338)),
        listOf(Color(0xFF245041), Color(0xFF102822)),
        listOf(Color(0xFF3B6B5E), Color(0xFF234B3F)),
    )
    val gradientColors = baseGradients[Math.floorMod(hash, baseGradients.size)]

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(gradientColors)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.HomeWork,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.85f),
                modifier = Modifier.size(36.dp),
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = category,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                ),
                color = Color.White.copy(alpha = 0.9f),
            )
            Text(
                text = "Ảnh minh họa",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 10.sp,
                ),
                color = Color.White.copy(alpha = 0.5f),
            )
        }
    }
}

/**
 * Dedicated Full-Screen Search Experience:
 * Location-first -> Price Range -> Room Type -> Bottom action bar.
 * Strictly excludes Time / Guests travel semantics.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SearchExperienceScreen(
    onClose: () -> Unit,
    onSearchSubmitted: (lat: Double?, lng: Double?, radius: Int, minPrice: String?, maxPrice: String?) -> Unit,
    onResetSearch: () -> Unit,
    modifier: Modifier = Modifier,
    onLocalSearch: (String, String, String, String) -> Unit = { _, _, _, _ -> },
    initialArea: String = "",
    initialRoomType: String = "Tất cả",
    initialMinPrice: String = "",
    initialMaxPrice: String = "",
) {
    val context = LocalContext.current
    var queryText by rememberSaveable { mutableStateOf(initialArea) }
    var selectedLocationName by rememberSaveable { mutableStateOf<String?>(null) }
    var centerLat by rememberSaveable { mutableStateOf<Double?>(null) }
    var centerLng by rememberSaveable { mutableStateOf<Double?>(null) }
    var selectedPriceRange by rememberSaveable { mutableStateOf<String?>(null) }
    var minPrice by rememberSaveable { mutableStateOf(initialMinPrice) }
    var maxPrice by rememberSaveable { mutableStateOf(initialMaxPrice) }
    var selectedRoomType by rememberSaveable { mutableStateOf(initialRoomType) }

    BackHandler(onBack = onClose)

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            val pt = lastKnownPublicCenter(context)
            if (pt != null) {
                centerLat = pt.latitude
                centerLng = pt.longitude
                selectedLocationName = "Vị trí hiện tại của bạn"
            }
        }
    }

    TroOiScreenScaffold(
        modifier = modifier.fillMaxSize().testTag("search-experience-screen"),
        contentWindowInsets = WindowInsets.safeDrawing,
        topBar = {
            TroOiPageTopAppBar(title = { Text("Tìm phòng") }, navigationIcon = {
                IconButton(onClick = onClose) { Icon(Icons.Rounded.Close, "Đóng tìm kiếm") }
            })
        },
        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding()
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    TroOiButton("Xóa tất cả", style = TroOiButtonStyle.TERTIARY,
                        onClick = {
                            queryText = ""
                            selectedLocationName = null
                            centerLat = null
                            centerLng = null
                            selectedPriceRange = null
                            minPrice = ""
                            maxPrice = ""
                            selectedRoomType = "Tất cả"
                            onResetSearch()
                        },
                    )

                    TroOiButton("Tìm kiếm",
                        onClick = {
                            onLocalSearch(
                                if (centerLat != null && centerLng != null) "" else queryText,
                                selectedRoomType, minPrice, maxPrice,
                            )
                            onSearchSubmitted(
                                centerLat,
                                centerLng,
                                3000,
                                minPrice.takeIf { it.isNotBlank() },
                                maxPrice.takeIf { it.isNotBlank() },
                            )
                        },
                    )
                }
            }
        },
    ) { insets ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(insets)
                .consumeWindowInsets(insets)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 12.dp),
        ) {
            // 1. KHU VỰC (Location/Area Card)
            item {
                TroOiCard("Khu vực", Modifier.testTag("search-location-card")) {

                    // Text input field
                    TroOiFormField(
                        value = queryText,
                        onValueChange = { queryText = it; centerLat = null; centerLng = null },
                        placeholder = { Text("Tìm khu vực, trường hoặc địa điểm") },
                        leadingIcon = {
                            Icon(Icons.Rounded.Search, null, tint = MaterialTheme.colorScheme.primary)
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("search-location-input"),
                    )

                    Spacer(Modifier.height(14.dp))
                    Text(
                        text = "Gợi ý",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.SemiBold,
                        ),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(8.dp))

                    // Suggestions List
                    SearchSuggestionItem(
                        icon = Icons.Rounded.MyLocation,
                        title = "Gần bạn",
                        subtitle = "Tìm phòng quanh vị trí hiện tại",
                        onClick = {
                            if (ContextCompat.checkSelfPermission(
                                    context,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                                ) == PackageManager.PERMISSION_GRANTED
                            ) {
                                val pt = lastKnownPublicCenter(context)
                                if (pt != null) {
                                    centerLat = pt.latitude
                                    centerLng = pt.longitude
                                    selectedLocationName = "Vị trí hiện tại của bạn"
                                }
                            } else {
                                locationPermissionLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                            }
                        },
                    )

                    SearchSuggestionItem(
                        icon = Icons.Rounded.School,
                        title = "Làng Đại học",
                        subtitle = "TP. Thủ Đức",
                        onClick = {
                            queryText = "Làng Đại học"
                            centerLat = null
                            centerLng = null
                        },
                    )

                    SearchSuggestionItem(
                        icon = Icons.Rounded.School,
                        title = "Đại học FPT",
                        subtitle = "TP. Thủ Đức",
                        onClick = {
                            queryText = "Đại học FPT"
                            centerLat = null
                            centerLng = null
                        },
                    )

                    SearchSuggestionItem(
                        icon = Icons.Rounded.LocationCity,
                        title = "Thủ Đức",
                        subtitle = "TP. Hồ Chí Minh",
                        onClick = {
                            queryText = "Thủ Đức"
                            centerLat = null
                            centerLng = null
                        },
                    )
                }
            }

            // 2. KHOẢNG GIÁ (Price Range Card)
            item {
                TroOiCard("Khoảng giá", Modifier.testTag("search-price-card")) {

                    // Quick Price Chips
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        listOf(
                            "Dưới 3 tr" to ("" to "3000000"),
                            "3 - 5 tr" to ("3000000" to "5000000"),
                            "5 - 8 tr" to ("5000000" to "8000000"),
                            "Trên 8 tr" to ("8000000" to ""),
                        ).forEach { (label, range) ->
                            val isSelected = selectedPriceRange == label
                            FilterChip(
                                selected = isSelected,
                                onClick = {
                                    if (isSelected) {
                                        selectedPriceRange = null
                                        minPrice = ""
                                        maxPrice = ""
                                    } else {
                                        selectedPriceRange = label
                                        minPrice = range.first
                                        maxPrice = range.second
                                    }
                                },
                                label = { Text(label) },
                            )
                        }
                    }


                    // Min / Max text fields
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        maxItemsInEachRow = if (LocalDensity.current.fontScale > 1.2f) 1 else 2,
                    ) {
                        TroOiFormField(
                            value = minPrice,
                            onValueChange = { minPrice = it.filter(Char::isDigit).take(12) },
                            label = { Text("Tối thiểu (₫)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                        )
                        TroOiFormField(
                            value = maxPrice,
                            onValueChange = { maxPrice = it.filter(Char::isDigit).take(12) },
                            label = { Text("Tối đa (₫)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            // 3. LOẠI PHÒNG (Room Type Card)
            item {
                TroOiCard("Loại phòng", Modifier.testTag("search-room-type-card")) {

                    // Room type choices
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        DiscoveryDemoTaxonomy.TAGS.forEach { type ->
                            val isSelected = selectedRoomType == type
                            FilterChip(
                                selected = isSelected,
                                onClick = { selectedRoomType = type },
                                label = { Text(type) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchSuggestionItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    TroOiListRow(title, subtitle, onClick, leading = {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp))
    })
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

fun explorePriceVnd(label: String?): BigDecimal? {
    if (label.isNullOrBlank()) return null
    val trimmed = label.trim()
    if (trimmed.contains("triệu", ignoreCase = true)) {
        val regex = Regex("""([0-9]+(?:[.,][0-9]+)?)\s*triệu""", RegexOption.IGNORE_CASE)
        val match = regex.find(trimmed) ?: return null
        val numStr = match.groupValues[1].replace(',', '.')
        val value = BigDecimal(numStr).multiply(BigDecimal("1000000"))
        if (value <= BigDecimal.ZERO) return null
        return value
    }
    val formatted = Regex("""^([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+)\s*[đ₫]\s*(?:/\s*tháng)?$""").matchEntire(trimmed)
    if (formatted != null) return formatted.groupValues[1].filter(Char::isDigit)
        .toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO }
    return try {
        val parsed = BigDecimal(trimmed)
        if (parsed <= BigDecimal.ZERO) null else parsed
    } catch (_: Exception) {
        null
    }
}

internal fun unaccent(src: String?): String {
    if (src.isNullOrEmpty()) return ""
    val decomposed = Normalizer.normalize(src, Normalizer.Form.NFD)
        .replace(Regex("\\p{M}"), "")
    return decomposed
        .replace('đ', 'd').replace('Đ', 'D')
        .replace('ư', 'u').replace('Ư', 'U')
        .replace('ơ', 'o').replace('Ơ', 'O')
}

fun exploreFilteredListings(
    listings: List<PublicListingCard>,
    areaQuery: String = "",
    roomType: String = "",
    minPrice: String = "",
    maxPrice: String = "",
): List<PublicListingCard> {
    return listings.filter { listing ->
        if (listing.visibility != ListingVisibility.PUBLISHED) return@filter false
        if (areaQuery.isNotBlank()) {
            val q = areaQuery.trim()
            val matchesArea = unaccent(listing.publicAreaLabel).contains(unaccent(q), ignoreCase = true)
            val matchesTitle = unaccent(listing.title).contains(unaccent(q), ignoreCase = true)
            if (!matchesArea && !matchesTitle) return@filter false
        }
        if (roomType.isNotBlank() && !roomType.equals("Tất cả", ignoreCase = true)) {
            val matchesType = unaccent(listing.rentalDetails?.type ?: listing.title).contains(unaccent(roomType), ignoreCase = true)
            if (!matchesType) return@filter false
        }
        if (minPrice.isNotBlank()) {
            val min = try { BigDecimal(minPrice.trim()) } catch (_: Exception) { null }
            if (min != null) {
                val price = explorePriceVnd(listing.askingPriceLabel) ?: return@filter false
                if (price < min) return@filter false
            }
        }
        if (maxPrice.isNotBlank()) {
            val max = try { BigDecimal(maxPrice.trim()) } catch (_: Exception) { null }
            if (max != null) {
                val price = explorePriceVnd(listing.askingPriceLabel) ?: return@filter false
                if (price > max) return@filter false
            }
        }
        true
    }
}
