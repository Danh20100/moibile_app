package com.trooi.app.features.tenant

import androidx.activity.compose.BackHandler
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
import androidx.compose.ui.platform.testTag
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
    onProbeTransport: (() -> Unit)? = null,
) {
    // Do not render Room or locally invented listings: only public PUBLISHED projection.
    var minPrice by rememberSaveable { mutableStateOf("") }
    var maxPrice by rememberSaveable { mutableStateOf("") }
    val filter = PublicDiscoveryFilters(minPrice.trim(), maxPrice.trim())
    val listings = filter.apply(state.read.publicListings)
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-discovery-list"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        item { V1PageTitle("Tìm phòng", "Khám phá tin đăng đang công khai") }
        if (onProbeTransport != null) {
            item {
                V1Panel("Kiểm tra kết nối API · Backend Debug") {
                    V1Pending("HTTP diagnostic trên backendDebug; business UI dùng DTO OpenAPI đã GREEN.")
                    V1Action("Kiểm tra GET /listings/public", onProbeTransport)
                }
            }
        }
        if (state.demoPreview) item { V1PreviewNotice() }
        item {
            V1Panel("Lọc trên tin đăng công khai") {
                V1Pending("Tìm theo khu vực tạm thời chưa khả dụng: đang chờ Backend cung cấp hợp đồng tìm kiếm vị trí công khai.")
                OutlinedTextField(
                    value = minPrice, onValueChange = { minPrice = it },
                    label = { Text("Giá thấp nhất (VND)") },
                    modifier = Modifier.fillMaxWidth().testTag("discovery-filter-min-price"),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = maxPrice, onValueChange = { maxPrice = it },
                    label = { Text("Giá cao nhất (VND)") },
                    modifier = Modifier.fillMaxWidth().testTag("discovery-filter-max-price"),
                    singleLine = true,
                )
                filter.validationMessage()?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("discovery-filter-error"))
                }
                Text(
                    "Bộ lọc giá áp dụng trên kết quả GET /listings/public đã tải. " +
                        "Tìm kiếm khu vực và Availability chưa có hợp đồng Backend; không dùng địa chỉ vận hành.",
                    color = TroOiMuted,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
        if (state.runtimeLoading && listings.isEmpty()) {
            item { V1Panel("Đang tải tin đăng") { V1Pending("Đang đọc public Listing projection từ Backend.") } }
        } else if (listings.isEmpty()) {
            item { V1Panel("Không có kết quả") {
                V1Pending(if (filter.minPrice.isNotBlank() || filter.maxPrice.isNotBlank()) {
                    "Không có tin đăng PUBLISHED phù hợp bộ lọc trong dữ liệu đang tải."
                } else "Chưa có dữ liệu Listing PUBLISHED từ Backend.")
            } }
        } else {
            items(listings, key = { "public-listing-" + it.listingId }) { listing ->
                V1Panel(
                    listing.title,
                    modifier = Modifier
                        .testTag("public-listing-" + listing.listingId)
                        .clickable { onOpenListing(listing.listingId) },
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.LocationOn, null, tint = TroOiGreen)
                        Spacer(Modifier.width(8.dp))
                        Text(listing.publicAreaLabel, style = MaterialTheme.typography.bodyMedium, color = TroOiMuted)
                    }
                    Text(listing.askingPriceLabel ?: "Giá chưa được công khai", style = MaterialTheme.typography.titleLarge, color = TroOiGreen)
                    if (listing.amenities.isNotEmpty()) {
                        Text(listing.amenities.joinToString(" · "), color = TroOiMuted, style = MaterialTheme.typography.labelMedium)
                    }
                    Text("Xem thông tin và liên hệ →", style = MaterialTheme.typography.labelMedium, color = TroOiGreen)
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
) {
    BackHandler(onBack = onBack)
    val listing = publicDiscoveryFeed(state.read.publicListings).firstOrNull { it.listingId == listingId }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("v1-listing-detail"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        item { TextButton(onClick = onBack) { Text("← Quay lại", color = TroOiGreen) } }
        if (state.demoPreview) item { V1PreviewNotice() }
        if (listing == null) {
            item { V1Panel("Tin đăng không khả dụng") { V1Pending("Chỉ tin đăng PUBLISHED mới xuất hiện trong Discovery.") } }
        } else {
            item { V1PageTitle(listing.title, listing.publicAreaLabel) }
            item {
                V1Panel("Thông tin công khai") {
                    V1Metric("Giá đề xuất của tin đăng", listing.askingPriceLabel ?: "Chưa công khai")
                    if (listing.amenities.isNotEmpty()) Text(listing.amenities.joinToString(" · "), color = TroOiMuted)
                    Text("Vị trí trên bản đồ chỉ dùng projection công khai do Backend cung cấp.", color = TroOiMuted)
                    if (listing.publicGeoPoint == null) V1Pending("Chưa có public map projection.")
                }
            }
            item { InquiryComposer(state, listing.listingId, onOpenLogin, onSubmitInquiry) }
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
        item { V1PageTitle("Khu vực người thuê", "Dữ liệu được cấp theo quan hệ Tenancy Participant") }
        if (state.demoPreview) item { V1PreviewNotice() }
        item {
            V1Panel(selected.title) {
                when (selected) {
                    PortalArea.MY_RENTAL -> {
                        if (rentals.isEmpty()) V1Pending("Không có lượt thuê được Backend liên kết với tài khoản.")
                        else rentals.forEach {
                            Text(it.roomLabel, fontWeight = FontWeight.SemiBold)
                            Text("Tenancy: ${it.lifecycle}", color = TroOiMuted)
                        }
                    }
                    PortalArea.TERMS -> {
                        if (rentals.isEmpty()) V1Pending("Chưa có Terms theo quan hệ thuê.")
                        else rentals.forEach { V1Metric(it.roomLabel, it.termsVersionLabel ?: "Chưa có Terms") }
                        V1Pending("Xác nhận Terms chỉ khả dụng khi Backend cung cấp action hợp lệ.")
                    }
                    PortalArea.DEPOSIT -> {
                        val deposits = scopedFinance.flatMap { it.deposits }
                        if (deposits.isEmpty()) V1Pending()
                        else deposits.forEach {
                            V1Metric("Yêu cầu cọc theo Terms", it.requiredLabel ?: "Chưa có")
                            V1Metric("Cọc đã thực sự ghi nhận", it.fundedLabel ?: "Chưa có")
                            V1Pending(it.settlementLabel ?: "Chưa có trạng thái settlement")
                        }
                    }
                    PortalArea.BILLING -> {
                        val charges = scopedFinance.flatMap { it.charges }
                        if (charges.isEmpty()) V1Pending()
                        else charges.forEach {
                            V1Metric(it.label, it.amountLabel)
                            V1Pending(it.outstandingLabel ?: "Chưa có số liệu outstanding")
                        }
                    }
                    PortalArea.PAYMENT -> {
                        val payments = scopedFinance.flatMap { it.payments }
                        V1Pending("MoMo chỉ là kênh chuyển. Mở app chưa phải Payment. Claim ≠ Payment và đang chờ API.")
                        if (payments.isEmpty()) V1Pending("Chưa có Payment đã xác nhận theo Tenancy.")
                        else payments.forEach {
                            V1Metric("Payment đã xác nhận", it.amountLabel)
                            V1Pending(it.confirmationLabel ?: "Chưa có trạng thái xác nhận")
                        }
                    }
                    PortalArea.RECEIPTS -> {
                        val receipts = scopedFinance.flatMap { it.receipts }
                        if (receipts.isEmpty()) V1Pending("Chưa có Receipt từ confirmed Payment.")
                        else receipts.forEach { V1Metric("Biên nhận " + it.receiptId, it.issuedAtLabel) }
                    }
                    PortalArea.NOTICES -> {
                        val notices = linked.flatMap { state.read.noticesByTenancy[it].orEmpty() }
                        if (notices.isEmpty()) V1Pending("Chưa có Notice theo Tenancy.")
                        else notices.forEach { notice ->
                            V1Metric(notice.type, notice.content)
                            V1Pending(
                                notice.acknowledgedAtLabel?.let { "Đã xác nhận: $it" }
                                    ?: "Phát hành: ${notice.issuedAtLabel}",
                            )
                        }
                    }
                    PortalArea.FIND_ROOMS -> V1Action("Mở Discovery", onFindRooms)
                    else -> V1Pending("Đang chờ Backend cung cấp dữ liệu và quyền cụ thể cho ${selected.title}. Không tạo trạng thái nghiệp vụ giả ở client.")
                }
            }
        }
        items(PortalArea.entries.toList(), key = { it.name }) { section ->
            Surface(
                modifier = Modifier.fillMaxWidth().clickable { selected = section },
                color = if (selected == section) TroOiGreenSoft else Color.White,
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, TroOiLine),
            ) {
                Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Apartment, null, tint = TroOiGreen)
                    Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f)) {
                        Text(section.title, fontWeight = FontWeight.Bold, color = TroOiText)
                        Text(section.description, style = MaterialTheme.typography.labelMedium, color = TroOiMuted)
                    }
                    Text("›", style = MaterialTheme.typography.titleLarge, color = TroOiGreen)
                }
            }
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
    onTenantPortal: () -> Unit,
    onOperations: () -> Unit,
    onLogout: () -> Unit,
) {
    LazyColumn(contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { V1PageTitle("Tài khoản", "Quyền được xác định bằng quan hệ thực tế, không phải vai trò toàn cục") }
        if (state.demoPreview) item { V1PreviewNotice() }
        item {
            V1Panel(state.displayName.ifBlank { "Khách truy cập" }) {
                V1Pending(if (state.isAuthenticated) "Đã đăng nhập" else "Bạn vẫn có thể tìm phòng công khai khi chưa đăng nhập.")
                V1Action("Tìm phòng", onDiscovery, modifier = Modifier.fillMaxWidth())
                if (!state.isAuthenticated) {
                    V1Action(
                        if (googleOnly) "Đăng nhập với Google" else "Đăng nhập",
                        onLogin,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (!googleOnly) TextButton(onClick = onSignUp) { Text("Tạo tài khoản") }
                } else {
                    if (state.access.allows(ClientArea.TENANT_PORTAL)) {
                        V1Action("My Rental / Tenant Portal", onTenantPortal, modifier = Modifier.fillMaxWidth())
                    }
                    if (state.access.allows(ClientArea.OPERATIONS)) {
                        V1Action("Không gian vận hành", onOperations, modifier = Modifier.fillMaxWidth())
                    }
                    OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) { Text("Đăng xuất") }
                }
            }
        }
    }
}
