package com.trooi.app.features.tenant

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Apartment
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import com.trooi.app.features.discovery.PublicDiscoveryFilters
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.core.content.ContextCompat
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.trooi.app.core.model.*
import com.trooi.app.features.inquiry.InquiryComposer
import com.trooi.app.ui.components.*
import com.trooi.app.ui.theme.*

@Composable
fun V1DiscoveryScreen(
    state: TroOiUiState,
    onOpenListing: (String) -> Unit,
    onContextSwitcher: (() -> Unit)? = null,
    onSearch: ((Double, Double, Double, String?, String?) -> Unit)? = null,
    onResetSearch: (() -> Unit)? = null,
) {
    // Public coordinates are an internal search contract, never raw product inputs.
    val context = LocalContext.current
    var minPrice by rememberSaveable { mutableStateOf("") }
    var maxPrice by rememberSaveable { mutableStateOf("") }
    var centerLat by rememberSaveable { mutableStateOf<Double?>(null) }
    var centerLng by rememberSaveable { mutableStateOf<Double?>(null) }
    var radiusMeters by rememberSaveable { mutableStateOf(3000) }
    var locationMessage by rememberSaveable { mutableStateOf<String?>(null) }
    val filter = PublicDiscoveryFilters(minPrice.trim(), maxPrice.trim())
    val listings = filter.apply(state.read.publicListings)

    fun captureLastKnownLocation() {
        val point = lastKnownPublicCenter(context)
        if (point == null) {
            locationMessage = "Chưa lấy được vị trí thiết bị. Hãy bật vị trí rồi thử lại."
        } else {
            centerLat = point.latitude
            centerLng = point.longitude
            locationMessage = "Đã chọn vị trí hiện tại làm tâm tìm kiếm."
        }
    }
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) captureLastKnownLocation()
        else locationMessage = "Cần quyền vị trí gần đúng để tìm phòng quanh bạn."
    }
    val useCurrentLocation = {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        ) captureLastKnownLocation()
        else locationPermissionLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
    }
    val spatialSearchValid = centerLat != null && centerLng != null &&
        filter.validationMessage() == null
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-discovery-list"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        item { TroOiPageHeader("TrọƠi", "Khám phá phòng") }
        if (onContextSwitcher != null) {
            item {
                TroOiButton(
                    "Không gian khám phá",
                    onContextSwitcher,
                    style = TroOiButtonStyle.SECONDARY,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        item {
            Text(
                "Tìm phòng\nquanh bạn.",
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )
        }
        if (state.demoPreview) item { V1PreviewNotice() }
        item {
            TroOiCard("Bạn muốn ở đâu?") {
                Text("Khu vực tìm kiếm", fontWeight = FontWeight.Bold)
                TroOiFeedback(locationMessage ?: "Chọn vị trí để app tạo tâm spatial search ở lớp nội bộ.")
                TroOiButton(
                    "Dùng vị trí hiện tại",
                    useCurrentLocation,
                    modifier = Modifier.fillMaxWidth().testTag("discovery-use-current-location"),
                )
                Text("Bán kính", fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(1000 to "1 km", 3000 to "3 km", 5000 to "5 km").forEach { (meters, label) ->
                        FilterChip(
                            selected = radiusMeters == meters,
                            onClick = { radiusMeters = meters },
                            label = { Text(label) },
                            modifier = Modifier.testTag("discovery-radius-$meters"),
                        )
                    }
                }
                TroOiFormField(
                    value = minPrice, onValueChange = { minPrice = it.filter(Char::isDigit).take(16) },
                    label = { Text("Giá thấp nhất (VND)") },
                    modifier = Modifier.fillMaxWidth().testTag("discovery-filter-min-price"),
                    singleLine = true,
                )
                TroOiFormField(
                    value = maxPrice, onValueChange = { maxPrice = it.filter(Char::isDigit).take(16) },
                    label = { Text("Giá cao nhất (VND)") },
                    modifier = Modifier.fillMaxWidth().testTag("discovery-filter-max-price"),
                    singleLine = true,
                )
                filter.validationMessage()?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("discovery-filter-error"))
                }
                if (onSearch != null) {
                    TroOiButton(
                        "Tìm theo bán kính",
                        {
                            onSearch(
                                centerLat!!,
                                centerLng!!,
                                radiusMeters.toDouble(),
                                minPrice.trim().takeIf { it.isNotEmpty() },
                                maxPrice.trim().takeIf { it.isNotEmpty() },
                            )
                        },
                        enabled = spatialSearchValid && !state.runtimeLoading,
                    )
                }
                if (onResetSearch != null) {
                    TroOiButton("Hiển thị lại tất cả tin công khai", {
                        centerLat = null
                        centerLng = null
                        radiusMeters = 3000
                        locationMessage = null
                        minPrice = ""
                        maxPrice = ""
                        onResetSearch()
                    }, enabled = !state.runtimeLoading)
                }
                Text(
                    "Kết quả tìm kiếm chỉ dùng vị trí công khai của tin đăng.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
        item {
            LedgerSectionTitle(
                "Quanh vị trí đã chọn",
                "Các phòng đang được công khai",
            )
        }
        if (state.runtimeLoading && listings.isEmpty()) {
            item { TroOiStateMessage(TroOiStateKind.LOADING, "Đang đọc public Listing projection từ Backend.", title = "Đang tải tin đăng") }
        } else if (listings.isEmpty()) {
            item { TroOiStateMessage(TroOiStateKind.EMPTY, if (filter.minPrice.isNotBlank() || filter.maxPrice.isNotBlank()) {
                    "Không có tin đăng PUBLISHED phù hợp bộ lọc trong dữ liệu đang tải."
                } else "Hiện chưa có phòng nào được đăng công khai.", title = "Không có kết quả") }
        } else {
            items(listings, key = { "public-listing-" + it.listingId }) { listing ->
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("public-listing-" + listing.listingId)
                        .clickable(role = androidx.compose.ui.semantics.Role.Button) { onOpenListing(listing.listingId) },
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                ) {
                    Column(
                        Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        LedgerMediaPlaceholder(
                            title = "Không gian minh họa · Chưa có ảnh phòng",
                            subtitle = "Ảnh minh họa không phải bằng chứng tài sản.",
                            modifier = Modifier.height(118.dp),
                        )
                        Text(listing.title, style = MaterialTheme.typography.titleLarge)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.LocationOn, null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                listing.publicAreaLabel,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Text(
                            listing.askingPriceLabel ?: "Giá chưa được công khai",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold,
                        )
                        listing.distanceMeters?.let {
                            Text(
                                "Khoảng cách công khai: ${it.toInt()} m",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        if (listing.amenities.isNotEmpty()) {
                            Text(
                                listing.amenities.joinToString(" · "),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.labelMedium,
                            )
                        }
                        Text(
                            "Xem thông tin và liên hệ →",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun V1ListingDetailScreen(
    state: TroOiUiState,
    listingId: String,
    onBack: () -> Unit,
    onOpenLogin: () -> Unit,
    onSubmitInquiry: (String, String) -> Unit,
    onOpenReport: (String) -> Unit,
) {
    BackHandler(onBack = onBack)
    val listing = publicDiscoveryFeed(state.read.publicListings).firstOrNull { it.listingId == listingId }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-listing-detail"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        item { TroOiButton("← Quay lại", onBack, style = TroOiButtonStyle.TERTIARY) }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (listing == null) {
            item { TroOiStateMessage(TroOiStateKind.UNAVAILABLE, "Chỉ tin đăng PUBLISHED mới xuất hiện trong Discovery.", title = "Tin đăng không khả dụng") }
        } else {
            item {
                LedgerMediaPlaceholder(
                    title = "Không gian minh họa · Chưa có ảnh phòng",
                    subtitle = "Media placeholder được gắn nhãn; không trình bày như ảnh thật của tài sản.",
                    modifier = Modifier.height(220.dp),
                )
            }
            item { TroOiPageHeader(listing.title, listing.publicAreaLabel) }
            item {
                LedgerMoney(
                    amount = listing.askingPriceLabel ?: "Giá chưa công khai",
                    context = "Giá đang được công khai trên tin đăng",
                )
            }
            item {
                LedgerStateLabel("Tin đăng đang công khai", LedgerTone.Success)
            }
            item {
                LedgerSectionTitle("Thông tin công khai")
                Spacer(Modifier.height(8.dp))
                if (listing.amenities.isNotEmpty()) {
                    Text(
                        listing.amenities.joinToString(" · "),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Spacer(Modifier.height(8.dp))
                }
                Text(
                    "Tin đăng chỉ hiển thị vị trí công khai; địa chỉ vận hành chi tiết không được công khai.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                if (listing.publicGeoPoint == null) {
                    Spacer(Modifier.height(8.dp))
                    TroOiFeedback("Tin đăng chưa có vị trí hiển thị trên bản đồ.")
                }
            }
            item { LedgerDivider() }
            item { InquiryComposer(state, listing.listingId, onOpenLogin, onSubmitInquiry) }
            item {
                TroOiButton(
                    "Báo cáo tin đăng",
                    { onOpenReport(listing.listingId) },
                    modifier = Modifier.fillMaxWidth().testTag("listing-open-report"),
                )
            }
        }
    }
}

private enum class PortalArea(val title: String, val description: String) {
    MY_RENTAL("My Rental", "Lượt thuê của bạn"),
    TERMS("Terms", "Điều khoản và các phiên bản"),
    DEPOSIT("Deposit", "Yêu cầu cọc và số tiền thực tế"),
    BILLING("Billing", "Khoản phải thu"),
    PAYMENT("Payment", "Ghi nhận thanh toán và bằng chứng"),
    RECEIPTS("Receipts", "Biên nhận từ Payment đủ điều kiện"),
    TICKETS("Tickets", "Sự cố liên quan tới lượt thuê"),
    NOTICES("Notices", "Thông báo và xác nhận"),
    MOVE_OUT("Move-out", "Yêu cầu trả phòng, không tự checkout"),
    HISTORY("History", "Lịch sử lượt thuê theo quyền"),
    FIND_ROOMS("Find Rooms", "Tìm tin đăng công khai khác"),
}

@Composable
fun V1TenantPortalScreen(state: TroOiUiState, onFindRooms: () -> Unit) {
    val linked = state.access.linkedTenancyIds
    val rentals = state.read.tenancies.filter { it.tenancyId in linked }
    val scopedFinance = linked.mapNotNull { state.read.tenantFinanceByTenancy[it] }
    var selected by remember { mutableStateOf(PortalArea.MY_RENTAL) }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-tenant-portal"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { TroOiPageHeader("Khu vực người thuê", "Dữ liệu được cấp theo quan hệ Tenancy Participant") }
        if (state.demoPreview) item { V1PreviewNotice() }
        item {
            TroOiCard(selected.title) {
                when (selected) {
                    PortalArea.MY_RENTAL -> {
                        if (rentals.isEmpty()) TroOiFeedback("Không có lượt thuê được Backend liên kết với tài khoản.")
                        else rentals.forEach {
                            Text(it.roomLabel, fontWeight = FontWeight.SemiBold)
                            Text("Tenancy: ${it.lifecycle}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    PortalArea.TERMS -> {
                        if (rentals.isEmpty()) TroOiFeedback("Chưa có Terms theo quan hệ thuê.")
                        else rentals.forEach { TroOiInformationRow(it.roomLabel, it.termsVersionLabel ?: "Chưa có Terms") }
                        TroOiFeedback("Xác nhận Terms chỉ khả dụng khi Backend cung cấp action hợp lệ.")
                    }
                    PortalArea.DEPOSIT -> {
                        val deposits = scopedFinance.flatMap { it.deposits }
                        if (deposits.isEmpty()) TroOiFeedback("Đang chờ dữ liệu có phân quyền từ Backend.")
                        else deposits.forEach {
                            TroOiInformationRow("Yêu cầu cọc theo Terms", it.requiredLabel ?: "Chưa có")
                            TroOiInformationRow("Cọc đã thực sự ghi nhận", it.fundedLabel ?: "Chưa có")
                            TroOiFeedback(it.settlementLabel ?: "Chưa có trạng thái settlement")
                        }
                    }
                    PortalArea.BILLING -> {
                        val charges = scopedFinance.flatMap { it.charges }
                        if (charges.isEmpty()) TroOiFeedback("Đang chờ dữ liệu có phân quyền từ Backend.")
                        else charges.forEach {
                            TroOiInformationRow(it.label, it.amountLabel)
                            TroOiFeedback(it.outstandingLabel ?: "Chưa có số liệu outstanding")
                        }
                    }
                    PortalArea.PAYMENT -> {
                        val payments = scopedFinance.flatMap { it.payments }
                        if (payments.isEmpty()) TroOiFeedback("Chưa có Payment theo Tenancy.")
                        else payments.forEach {
                            TroOiInformationRow("Payment", it.amountLabel)
                            TroOiFeedback(it.confirmationLabel ?: "Chưa có trạng thái xác nhận")
                        }
                        TroOiFeedback("MoMo là kênh tuỳ chọn. URI quay về không phải bằng chứng đã trả; người thuê không tự xác nhận tiền thủ công.")
                    }
                    PortalArea.RECEIPTS -> {
                        val receipts = scopedFinance.flatMap { it.receipts }
                        if (receipts.isEmpty()) TroOiFeedback("Chưa có Receipt từ confirmed Payment.")
                        else receipts.forEach { TroOiInformationRow("Biên nhận " + it.receiptId, it.issuedAtLabel) }
                    }
                    PortalArea.NOTICES -> {
                        val notices = linked.flatMap { state.read.noticesByTenancy[it].orEmpty() }
                        if (notices.isEmpty()) TroOiFeedback("Chưa có thông báo cho lượt thuê đang chọn.")
                        else notices.forEach { notice ->
                            TroOiInformationRow(notice.type, notice.content)
                            TroOiFeedback(
                                notice.acknowledgedAtLabel?.let { "Đã xác nhận: $it" }
                                    ?: "Phát hành: ${notice.issuedAtLabel}",
                            )
                        }
                    }
                    PortalArea.FIND_ROOMS -> TroOiButton("Mở Discovery", onFindRooms)
                    else -> TroOiFeedback("Đang chờ Backend cung cấp dữ liệu và quyền cụ thể cho ${selected.title}. Không tạo trạng thái nghiệp vụ giả ở client.")
                }
            }
        }
        items(PortalArea.entries.toList(), key = { it.name }) { section ->
            TroOiListRow(section.title, section.description, onClick = { selected = section },
                selected = selected == section,
                modifier = Modifier.testTag("tenant-portal-${section.name.lowercase()}"),
                leading = { Icon(Icons.Rounded.Apartment, null, tint = MaterialTheme.colorScheme.primary) })
        }
    }
}

@Composable
fun V1AccountScreen(
    state: TroOiUiState,
    googleOnly: Boolean = false,
    onLogin: () -> Unit,
    onSignUp: () -> Unit,
    onDiscovery: () -> Unit,
    onContextSwitcher: () -> Unit,
    onNotifications: () -> Unit,
    onSettings: () -> Unit,
    onHelp: () -> Unit,
    onLogout: () -> Unit,
    onSaveDisplayName: suspend (String) -> Result<Unit> = { Result.failure(IllegalStateException("Cập nhật hồ sơ chưa khả dụng.")) },
    onCompleteLandlord: suspend (com.trooi.app.core.model.LocalLandlordApplication) -> Result<Unit> = { Result.failure(IllegalStateException("Tính năng đang được phát triển.")) },
    onOpenWorkspace: () -> Unit = {},
    onPrivacy: (() -> Unit)? = null,
) {
    com.trooi.app.features.profile.ProfileScreen(
        state = state,
        googleOnly = googleOnly,
        onLogin = onLogin,
        onSignUp = onSignUp,
        onDiscovery = onDiscovery,
        onContextSwitcher = onContextSwitcher,
        onNotifications = onNotifications,
        onSettings = onSettings,
        onHelp = onHelp,
        onPrivacy = onPrivacy,
        onLogout = onLogout,
        onSaveDisplayName = onSaveDisplayName,
        onCompleteLandlord = onCompleteLandlord,
        onOpenWorkspace = onOpenWorkspace,
    )
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
