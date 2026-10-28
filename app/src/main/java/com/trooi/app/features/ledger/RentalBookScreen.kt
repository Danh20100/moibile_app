package com.trooi.app.features.ledger

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.gson.JsonObject
import com.trooi.app.BuildConfig
import com.trooi.app.core.data.RuntimeDataSource
import com.trooi.app.core.model.*
import com.trooi.app.features.tenancy.launchableHttpsPayUrl
import com.trooi.app.features.tenancy.releasePaymentPublicOrigin
import com.trooi.app.ui.components.TroOiPage
import com.trooi.app.ui.components.TroOiFormField
import com.trooi.app.ui.theme.TroOiDimens
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale
import kotlinx.coroutines.launch

internal data class BookDestination(val section: String, val id: String = "", val auxiliary: String = "")

internal fun moneyDisplay(value: String?): String {
    if (value == null) return "Chưa đối chiếu"
    val numeric = value.toBigDecimalOrNull() ?: return value
    return NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN")).format(numeric) + "đ"
}

internal fun JsonObject.field(name: String): String? = string(name)
internal fun JsonObject.children(name: String): List<JsonObject> =
    get(name)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }.orEmpty()

internal fun dueValue(cycle: JsonObject): BigDecimal? {
    val charges = cycle.children("charges")
    if (charges.any { it.field("outstandingAmount") == null }) return null
    return charges.fold(BigDecimal.ZERO) { sum, charge ->
        sum + (charge.field("outstandingAmount")?.toBigDecimalOrNull() ?: BigDecimal.ZERO)
    }
}

private fun roomStateLabel(value: RoomOperationalState?): String? = when (value) {
    RoomOperationalState.VACANT -> "Còn trống"
    RoomOperationalState.OCCUPIED -> "Có người thuê"
    RoomOperationalState.MAINTENANCE -> "Đang bảo trì"
    RoomOperationalState.INACTIVE -> "Ngừng sử dụng"
    null -> null
}

@Composable
fun RentalBookScreen(
    state: TroOiUiState,
    onNotifications: () -> Unit,
    onRetry: () -> Unit,
    onPurchaseSlot: suspend (String) -> Result<Unit>,
    onLinked: () -> Unit,
    pendingJoinToken: String? = null,
    model: RentalBookViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val owner = state.access.operatedOrganizationIds.isNotEmpty()
    fun openPay(raw: String) {
        val url = launchableHttpsPayUrl(
            raw,
            BuildConfig.DEBUG && RuntimeDataSource.isBackendBacked(),
            if (BuildConfig.DEBUG) BuildConfig.PAYMENT_PUBLIC_ORIGIN
            else releasePaymentPublicOrigin(BuildConfig.PAYMENT_PUBLIC_ORIGIN),
        ) ?: throw IllegalStateException("Chưa mở được trang thanh toán. Thử lại để lấy liên kết mới.")
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            .getOrElse { throw IllegalStateException("Không mở được trình duyệt. Kiểm tra ứng dụng trình duyệt rồi thử lại.") }
    }
    val rooms = remember(state.read, state.access) { accessibleRooms(state.read, state.access) }
    val allowedRooms = rooms.map { it.roomId }.toSet()
    val organizations = state.access.operatedOrganizationIds
    val properties = state.read.properties.filter { it.organizationId in organizations }
    val people = state.read.tenancies.filter {
        it.roomId in allowedRooms && it.lifecycle in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING, TenancyLifecycle.DRAFT)
    }
    val listings = accessibleOperatorListings(state.read, state.access)
    val receipts = state.read.operatorFinanceByOrganization
        .filterKeys { it in organizations }.values.flatMap { it.receipts }.distinctBy { it.receiptId }
    val tenantTenancies = state.read.tenancies.filter { it.tenancyId in state.access.linkedTenancyIds }
    val destinations = remember(state.backendUserId) { mutableStateListOf(BookDestination("home")) }
    val current = destinations.last()
    val sourceReady = !state.runtimeLoading && !state.authorizedReadFailed && state.read.recoverableReadErrors.isEmpty()
    val scrollPositions = remember(state.backendUserId) { mutableMapOf<BookDestination, LazyListState>() }
    val listState = scrollPositions.getOrPut(current) { LazyListState() }
    val queries = remember(state.backendUserId) { mutableMapOf<BookDestination, MutableState<String>>() }
    var query by queries.getOrPut(current) { mutableStateOf("") }
    var assetFilter by remember(state.backendUserId) { mutableStateOf("") }
    val filters = remember(state.backendUserId) { mutableMapOf<BookDestination, MutableState<String>>() }
    var statusFilter by filters.getOrPut(current) { mutableStateOf("all") }
    var showJoin by remember { mutableStateOf(false) }
    var showInvite by remember { mutableStateOf(false) }
    var actionConfirm by remember { mutableStateOf("") }
    var amount by remember(current) { mutableStateOf("") }
    var method by remember(current) { mutableStateOf("MANUAL_TRANSFER") }
    var note by remember(current) { mutableStateOf("") }
    var nextStatus by remember(current) { mutableStateOf("") }
    var pickedCharge by remember(current) { mutableStateOf("") }
    var name by remember(current) { mutableStateOf(if (current.section == "listing-edit") model.detail?.field("publicTitle").orEmpty() else "") }
    var description by remember(current) { mutableStateOf(if (current.section == "listing-edit") model.detail?.field("publicDescription").orEmpty() else "") }
    var price by remember(current) { mutableStateOf(if (current.section == "listing-edit") model.detail?.field("publicPriceProjection").orEmpty() else "") }
    var roomSelection by remember(current.section) { mutableStateOf("") }
    var category by remember(current.section) { mutableStateOf("ELECTRICAL") }
    val add = { destination: BookDestination ->
        destinations.add(destination)
        model.clearMessage()
    }
    val back = { if (destinations.size > 1) { destinations.removeAt(destinations.lastIndex); model.clearMessage() } }
    BackHandler(enabled = destinations.size > 1 && !showInvite && !showJoin) { back() }
    BackHandler(enabled = showJoin && !showInvite) { showJoin = false }

    LaunchedEffect(pendingJoinToken, state.isAuthenticated) {
        if (!pendingJoinToken.isNullOrBlank() && state.isAuthenticated) {
            showJoin = true
            model.prepareJoin(pendingJoinToken)
        }
    }
    LaunchedEffect(owner, state.backendUserId) {
        if (owner) model.loadCycles() else {
            tenantTenancies.firstOrNull()?.let { model.loadCycles(it.tenancyId) }
        }
    }
    LaunchedEffect(current) {
        val kinds = mapOf("property-detail" to "property", "room-detail" to "room",
            "person-detail" to "tenancy", "listing-detail" to "listing",
            "incident-detail" to "incident", "receipt-detail" to "receipt",
            "cycle-detail" to "cycle", "payment-detail" to "payment", "charge-detail" to "cycle")
        val kind = kinds[current.section]
        if (kind != null) model.load(kind, if (current.section == "charge-detail") current.auxiliary else current.id)
        if (current.section == "incident-detail") model.loadIncidentEvents(current.id)
        if (current.section == "receipts" && current.id.isNotBlank()) model.loadPayments(current.id)
        if (current.section == "payment-detail") {
            val tenancy = state.read.tenancies.firstOrNull { it.roomId == current.auxiliary }
            tenancy?.let { model.loadPayments(it.tenancyId) }
        }
        if (current.section == "rent" && model.cycles == null) {
            val tenancyId = current.id.ifBlank { tenantTenancies.firstOrNull()?.tenancyId }
            model.loadCycles(if (owner || tenancyId == null) null else tenancyId)
        }
    }

    LaunchedEffect(current.section, current.id, model.detail?.field("paymentId")) {
        if (current.section == "receipt-detail" && model.detail?.field("id") == current.id) {
            model.detail?.field("paymentId")?.let(model::loadReceiptPayment)
        }
    }

    if (showInvite) {
        RentalInviteSheet(model.invitation, model.busy, {
            val tenancy = state.read.tenancies.firstOrNull {
                it.roomId == current.id && it.lifecycle in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING)
            }
            if (tenancy != null) model.createInvitation(tenancy.tenancyId)
        }, { showInvite = false }, eligible = state.read.tenancies.any {
            it.roomId == current.id && it.lifecycle in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING)
        })
    }

    TroOiPage {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = listState,
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(TroOiDimens.contentGap),
        ) {
            item {
                BookPageHeader(
                    title = if (current.section == "home") "Sổ của tôi" else when (current.section) {
                            "assets" -> "Tài sản"
                            "people" -> "Người thuê"
                            "rent" -> "Tiền thuê"
                            "incidents" -> "Sự cố"
                            "listings" -> "Tin đăng"
                            "receipts" -> "Biên nhận"
                            "property-detail" -> "Chi tiết tài sản"
                            "room-detail" -> "Chi tiết phòng"
                            "person-detail" -> "Chi tiết người thuê"
                            "cycle-detail" -> "Chi tiết kỳ thu"
                            "charge-detail" -> "Chi tiết khoản thu"
                            "payment-detail" -> "Chi tiết thanh toán"
                            "listing-detail" -> "Chi tiết tin đăng"
                            "receipt-detail" -> "Chi tiết biên nhận"
                            "incident-detail" -> "Chi tiết sự cố"
                            "record-payment" -> "Ghi nhận đã thu"
                            "listing-edit" -> "Chỉnh sửa tin đăng"
                            "incident-create" -> "Báo sự cố"
                            "person-create" -> "Thêm người thuê"
                            "payment-list" -> "Lịch sử thanh toán"
                            "rental-history" -> "Lịch sử thuê"
                            "room-history" -> "Lịch sử phòng"
                            else -> "Sổ thuê"
                        },
                    subtitle = when (current.section) {
                        "home" -> if (owner) "Tổng quan hoạt động cho thuê"
                            else "Nhà và tiền thuê của tôi"
                        "assets" -> "Quản lý tài sản và phòng"
                        "property-detail" -> properties.firstOrNull { it.propertyId == current.id }?.displayName.orEmpty()
                        "room-detail" -> rooms.firstOrNull { it.roomId == current.id }?.label.orEmpty()
                        "person-detail" -> "Người đứng tên thuê phòng"
                        "rent", "cycle-detail", "charge-detail", "payment-detail" -> "Kỳ thu và thanh toán"
                        "receipts", "receipt-detail" -> "Chứng từ thanh toán"
                        "incidents", "incident-detail" -> "Theo dõi xử lý sự cố"
                        "listings", "listing-detail", "listing-edit" -> "Quản lý tin cho thuê"
                        else -> if (owner) "Hoạt động cho thuê" else "Phòng thuê của tôi"
                    },
                    onBack = if (destinations.size > 1) back else null,
                    actions = {
                    if (current.section == "home") {
                        IconButton(onClick = onNotifications) { Icon(Icons.Rounded.NotificationsNone, "Thông báo") }
                    } else if (current.section == "room-detail" && owner) {
                        IconButton(onClick = { model.clearInvitation(); showInvite = true }) { Icon(Icons.Rounded.QrCode2, "Link và QR liên kết") }
                    } else if (current.section == "cycle-detail" && owner) {
                        IconButton(onClick = { add(BookDestination("record-payment", current.id)) }) {
                            Icon(Icons.Rounded.Payments, "Ghi nhận đã thu")
                        }
                    } else if (current.section == "listing-detail" && owner) {
                        IconButton(onClick = {
                            name = model.detail?.field("publicTitle").orEmpty()
                            description = model.detail?.field("publicDescription").orEmpty()
                            price = model.detail?.field("publicPriceProjection").orEmpty()
                            add(BookDestination("listing-edit", current.id))
                        }) { Icon(Icons.Rounded.Edit, "Chỉnh sửa") }
                        val managed = listings.firstOrNull { it.listingId == current.id }
                        val room = rooms.firstOrNull { it.roomId == managed?.roomId }
                        if (managed != null) {
                            if (managed.visibility == ListingVisibility.PUBLISHED) {
                                IconButton(onClick = {
                                    model.changeListing(current.id, "unpublish") {
                                        model.load("listing", current.id)
                                        onRetry()
                                    }
                                }, enabled = !model.busy) { Icon(Icons.Rounded.VisibilityOff, "Ẩn tin") }
                            } else if (managed.visibility in setOf(ListingVisibility.DRAFT, ListingVisibility.UNPUBLISHED) &&
                                room?.operationalState == RoomOperationalState.VACANT) {
                                IconButton(onClick = {
                                    model.changeListing(current.id, "publish") {
                                        model.load("listing", current.id)
                                        onRetry()
                                    }
                                }, enabled = !model.busy) { Icon(Icons.Rounded.Send, "Đăng tin") }
                            }
                        }
                        IconButton(onClick = { actionConfirm = "listing" }) { Icon(Icons.Rounded.MoreVert, "Thao tác") }
                    }
                    }
                )
            }
            if (state.authorizedReadFailed || state.read.recoverableReadErrors.isNotEmpty()) {
                item {
                    BookCard {
                        Text("Một phần dữ liệu nguồn chưa được tải đầy đủ.")
                        BookOutlinedButton(onClick = onRetry) { Text("Thử tải lại") }
                    }
                }
            }
            if (model.error != null) item {
                BookCard {
                    BookHeading("Không thể hoàn tất yêu cầu", Icons.Rounded.ErrorOutline)
                    Text(model.error.orEmpty(), color = MaterialTheme.colorScheme.error)
                }
            }
            if (model.feedback != null) item {
                Text(model.feedback.orEmpty(), color = MaterialTheme.colorScheme.primary)
            }
            if (model.busy || state.runtimeLoading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }

            if (showJoin) {
                item {
                    BookCard {
                        RentalJoinPrompt(model.joinToken, model.preview, model.busy,
                            { model.prepareJoin(it) },
                            { model.acceptJoin { showJoin = false; onLinked() } })
                        BookTextButton(onClick = { showJoin = false }) { Text("Đóng") }
                    }
                }
            }

            when (current.section) {
                "home" -> item {
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                        if (owner) OwnerBookOverview(state,
                            model.cycles?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null },
                            model.error != null, assetFilter, { assetFilter = it }, add)
                        else TenantBookOverview(state, tenantTenancies, add, { showJoin = true })
                    }
                }
                "assets" -> {
                    item {
                        val catalog = state.read.localManagement
                        BookCard {
                            BookHeading("Chỗ quản lý", Icons.Rounded.Apartment)
                            if (catalog == null || !catalog.entitlementsLoaded) {
                                Text("Chưa tải được dung lượng. Vui lòng tải lại dữ liệu.")
                                BookOutlinedButton(onClick = onRetry) { Text("Thử tải lại") }
                            } else {
                                val used = catalog.used
                                val max = catalog.capacity()
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("$used / $max chỗ", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                    Text("Còn ${(max - used).coerceAtLeast(0)}", color = MaterialTheme.colorScheme.primary)
                                }
                                LinearProgressIndicator(progress = { (used.toFloat() / max.coerceAtLeast(1)).coerceIn(0f, 1f) },
                                    modifier = Modifier.fillMaxWidth())
                                if (used >= max) Text("Đã dùng hết chỗ quản lý. Mua thêm chỗ để mở rộng.", style = MaterialTheme.typography.bodySmall)
                            }
                            Text("Mua thêm chỗ · 259.000đ/năm", style = MaterialTheme.typography.bodySmall)
                            var purchasePending by remember { mutableStateOf(false) }
                            var purchaseError by remember { mutableStateOf<String?>(null) }
                            val scope = rememberCoroutineScope()
                            BookOutlinedButton(onClick = {
                                if (!purchasePending) {
                                    purchasePending = true
                                    scope.launch {
                                        onPurchaseSlot(java.util.UUID.randomUUID().toString()).fold(
                                            onSuccess = { onRetry() },
                                            onFailure = { purchaseError = it.message },
                                        )
                                        purchasePending = false
                                    }
                                }
                            }, enabled = !purchasePending) {
                                Text(if (purchasePending) "Đang mở thanh toán" else "Mua thêm chỗ")
                            }
                            if (purchaseError != null) Text(purchaseError.orEmpty(), color = MaterialTheme.colorScheme.error)
                        }
                    }
                    item {
                        BookSelect("Tất cả tài sản", assetFilter,
                            listOf("" to "Tất cả tài sản") + properties.map { it.propertyId to it.displayName }, { assetFilter = it })
                    }
                    items(properties.filter { assetFilter.isBlank() || it.propertyId == assetFilter }, key = { it.propertyId }) { property ->
                        BookCard {
                            BookRow(property.displayName, "${rooms.count { it.propertyId == property.propertyId }} phòng", Icons.Rounded.Apartment) {
                                add(BookDestination("property-detail", property.propertyId))
                            }
                            HorizontalDivider()
                            val nested = rooms.filter { it.propertyId == property.propertyId && it.lifecycle == RecordLifecycle.ACTIVE }
                            if (nested.isEmpty()) BookEmpty(Icons.Rounded.MeetingRoom, "Chưa có phòng", "Các phòng tại tài sản này sẽ xuất hiện tại đây.")
                            nested.forEach { room ->
                                BookRow(room.label, roomStateLabel(room.operationalState), Icons.Rounded.MeetingRoom) {
                                    add(BookDestination("room-detail", room.roomId))
                                }
                            }
                        }
                    }
                    if (properties.isEmpty()) item {
                        BookCard { BookEmpty(Icons.Rounded.Apartment, "Chưa có tài sản", "Tài sản được cấp quyền quản lý sẽ xuất hiện tại đây.") }
                    }
                }


                "property-detail" -> {
                    val property = properties.firstOrNull { it.propertyId == current.id }
                    item {
                        BookCard {
                            BookIllustration(Icons.Rounded.Apartment)
                            BookHeading(property?.displayName ?: "Không tìm thấy tài sản", Icons.Rounded.Apartment)
                            Text("Các phòng đang được quản lý tại tài sản này.")
                        }
                    }
                    item {
                        BookCard {
                            BookHeading("Các phòng", Icons.Rounded.MeetingRoom)
                            val nested = rooms.filter { it.propertyId == current.id }
                            if (nested.isEmpty()) BookEmpty(Icons.Rounded.MeetingRoom, "Chưa có phòng", "Các phòng được cấp quyền sẽ xuất hiện tại đây.")
                            nested.forEach { room ->
                                BookRow(room.label, roomStateLabel(room.operationalState), Icons.Rounded.MeetingRoom) {
                                    add(BookDestination("room-detail", room.roomId))
                                }
                            }
                        }
                    }
                }

                "room-detail" -> {
                    val room = rooms.firstOrNull { it.roomId == current.id }
                        ?: state.read.operationalRooms.firstOrNull { it.roomId == current.id }
                    val tenancy = state.read.tenancies.firstOrNull {
                        it.roomId == current.id && it.lifecycle in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING)
                    }
                    item { BookRoomIdentity(room, properties.firstOrNull { it.propertyId == room?.propertyId }?.displayName) }
                    item {
                        BookCard {
                            BookHeading("Lượt thuê hiện tại", Icons.Rounded.People)
                            BookPair("Người đứng tên", tenancy?.primaryTenantName)
                            BookPair("Lượt thuê", tenancy?.tenancyId)
                            BookPair("Liên kết tài khoản", if (tenancy != null) "Xem qua QR / Link" else "Chưa có lượt thuê")

                        }
                    }
                    if (owner && room != null && room.operationalState != RoomOperationalState.OCCUPIED) {
                        item {
                            BookCard {
                                BookHeading("Thao tác phòng", Icons.Rounded.Settings)
                                val choices = when (room.operationalState) {
                                    RoomOperationalState.VACANT -> listOf("MAINTENANCE", "INACTIVE")
                                    RoomOperationalState.MAINTENANCE -> listOf("VACANT", "INACTIVE")
                                    RoomOperationalState.INACTIVE -> listOf("VACANT")
                                    RoomOperationalState.OCCUPIED -> emptyList()
                                }
                                BookSelect("Chuyển trạng thái", "", choices.map { it to bookLabel(it) },
                                    { model.changeRoom(current.id, it, onRetry) }, Icons.Rounded.MeetingRoom)
                            }
                        }
                    }

                    item {
                        BookCard {
                            BookHeading("Quản lý liên quan", Icons.Rounded.GridView)
                            if (tenancy != null) {
                                BookRow("Người thuê", "Chi tiết người đứng tên", Icons.Rounded.People) {
                                    add(BookDestination("person-detail", tenancy.tenancyId))
                                }
                                BookRow("Tiền thuê", "Kỳ thu và thanh toán", Icons.Rounded.Payments) {
                                    add(BookDestination("rent", tenancy.tenancyId))
                                }
                                BookRow("Biên nhận", "Chứng từ của lượt thuê", Icons.Rounded.ReceiptLong) {
                                    add(BookDestination("receipts", tenancy.tenancyId))
                                }
                            }
                            BookRow("Sự cố", "Các báo cáo gắn với phòng", Icons.Rounded.Build) {
                                add(BookDestination("incidents", current.id))
                            }
                            listings.filter { it.roomId == current.id }.forEach { listing ->
                                BookRow("Tin đăng", listing.title, Icons.Rounded.Campaign) {
                                    add(BookDestination("listing-detail", listing.listingId))
                                }
                            }
                            BookRow("Lịch sử phòng", "Các lượt thuê được cấp quyền", Icons.Rounded.History) {
                                add(BookDestination("room-history", current.id))
                            }
                        }
                    }
                }


                "people" -> {
                    bookPeopleList(people.filter { current.id.isBlank() || it.roomId == current.id },
                        query, statusFilter, sourceReady, { query = it }, { statusFilter = it },
                        { add(BookDestination("person-detail", it)) })
                    if (owner) item { BookButton({ add(BookDestination("person-create")) }, Modifier.fillMaxWidth()) {
                        Icon(Icons.Rounded.Add, null); Spacer(Modifier.width(8.dp)); Text("Thêm lượt thuê")
                    } }
                }

                "person-detail" -> {
                    val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == current.id }
                    item { BookPersonIdentity(tenancy) }
                    item { BookHeading("Thông tin liên quan") }
                    item {
                        BookRow("Tiền thuê", "Khoản phải thu và thanh toán", Icons.Rounded.Payments) {
                            add(BookDestination("rent", current.id))
                        }
                    }
                    item {
                        BookRow("Biên nhận", "Chứng từ của lượt thuê", Icons.Rounded.ReceiptLong) {
                            add(BookDestination("receipts", current.id))
                        }
                    }
                    if (tenancy != null) item {
                        BookRow("Sự cố", "Sự cố của phòng", Icons.Rounded.Build) {
                            add(BookDestination("incidents", tenancy.roomId))
                        }
                    }
                    if (tenancy != null) item {
                        BookRow("Thông tin phòng", tenancy.roomLabel, Icons.Rounded.Home) {
                            add(BookDestination("room-detail", tenancy.roomId))
                        }
                    }
                }

                "rental-history", "room-history" -> {
                    val history = if (current.section == "room-history") state.read.tenancies.filter {
                        it.roomId == current.id && (owner && it.roomId in allowedRooms || it.tenancyId in state.access.linkedTenancyIds)
                    } else tenantTenancies.filter { it.tenancyId in state.access.linkedTenancyIds }
                    item { BookHeading("Lượt thuê được cấp quyền", Icons.Rounded.History) }
                    items(history, key = { it.tenancyId }) { tenancy ->
                        BookCard {
                            BookRow(tenancy.roomLabel, rentalLifecycleLabel(tenancy.lifecycle), Icons.Rounded.Home) {
                                add(BookDestination("person-detail", tenancy.tenancyId))
                            }
                            BookPair("Điều khoản", tenancy.termsVersionLabel)
                        }
                    }
                    if (history.isEmpty()) item { BookCard { BookEmpty(Icons.Rounded.History, "Chưa có lịch sử thuê", "Lượt thuê được cấp quyền sẽ xuất hiện tại đây.") } }
                }

                "person-create" -> {
                    val vacantRooms = rooms.filter { it.operationalState == RoomOperationalState.VACANT && it.lifecycle == RecordLifecycle.ACTIVE }
                    item {
                        BookCard {
                            BookHeading("Tạo lượt thuê bản nháp")
                            Text("Người đứng tên được liên kết ở bước quản lý lượt thuê; không chuyển trạng thái phòng ngay.")
                            BookSelect("Chọn phòng", roomSelection, vacantRooms.map { it.roomId to it.label },
                                { roomSelection = it }, Icons.Rounded.MeetingRoom)
                            BookButton(onClick = { model.createTenancy(roomSelection, onRetry) },
                                enabled = roomSelection.isNotBlank() && !model.busy) {
                                Text("Tạo bản nháp")
                            }
                        }
                    }
                }

                "listings" -> bookListingList(listings.filter { current.id.isBlank() || it.roomId == current.id }, rooms,
                    query, statusFilter, sourceReady, { query = it }, { statusFilter = it },
                    { add(BookDestination("listing-detail", it)) })

                "listing-detail" -> {
                    val detail = model.detail?.takeIf { it.field("id") == current.id }
                    item { BookListingIdentity(detail) }
                    if (actionConfirm == "listing") item {
                        BookCard {
                            BookHeading("Quản lý tin đăng")
                            listOf("archive" to "Lưu trữ").forEach { (action, label) ->
                                BookTextButton(onClick = { model.changeListing(current.id, action) {
                                    model.load("listing", current.id)
                                    onRetry()
                                }; actionConfirm = "" },
                                    enabled = !model.busy) { Text(label) }
                            }
                        }
                    }
                }

                "listing-edit" -> {
                    item {
                        BookCard {
                            TroOiFormField(name, { name = it }, label = { Text("Tiêu đề") }, modifier = Modifier.fillMaxWidth())
                            TroOiFormField(description, { description = it }, label = { Text("Mô tả") },
                                minLines = 3, modifier = Modifier.fillMaxWidth())
                            TroOiFormField(price, { price = it.filter(Char::isDigit) }, label = { Text("Giá công khai") },
                                modifier = Modifier.fillMaxWidth())
                            BookButton(onClick = { model.editListing(current.id, name, description, price) {
                                    model.load("listing", current.id)
                                    onRetry()
                                    back()
                                } },
                                enabled = name.isNotBlank() && description.isNotBlank() && price.toLongOrNull() != null && !model.busy,
                                modifier = Modifier.fillMaxWidth()) { Text("Lưu thay đổi") }
                        }
                    }
                }
                "incidents" -> {
                    val linkedRooms = if (owner) allowedRooms else tenantTenancies.map { it.roomId }.toSet()
                    val matching = state.read.incidents.filter {
                        it.roomId in linkedRooms && (current.id.isBlank() || it.roomId == current.id)
                    }
                    bookIncidentList(matching, state.read.operationalRooms.filter { it.roomId in linkedRooms },
                        query, statusFilter, sourceReady, { query = it }, { statusFilter = it },
                        { add(BookDestination("incident-detail", it)) },
                        if (linkedRooms.isNotEmpty()) ({ add(BookDestination("incident-create")) }) else null)
                }

                "incident-detail" -> {
                    val detail = model.detail?.takeIf { it.field("id") == current.id }
                    item { BookIncidentIdentity(detail, state.read.operationalRooms.find { it.roomId == detail?.field("roomId") }?.label) }
                    item { BookHeading("Lịch sử xử lý") }
                    items(model.incidents?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }.orEmpty(),
                        key = { it.field("id").orEmpty() }) { event ->
                        BookCard {
                            Text(bookLabel(event.field("eventType")))
                            Text(event.field("occurredAt").orEmpty(), style = MaterialTheme.typography.bodySmall)
                            event.field("note")?.let { Text(it) }
                        }
                    }
                    if (owner) item {
                        BookCard {
                            val currentStatus = detail?.field("status")
                            val transitions = when (currentStatus) {
                                "REPORTED" -> listOf("ACKNOWLEDGED", "REJECTED")
                                "ACKNOWLEDGED" -> listOf("IN_PROGRESS", "REJECTED")
                                "IN_PROGRESS" -> listOf("RESOLVED")
                                "RESOLVED" -> listOf("IN_PROGRESS", "CLOSED")
                                else -> emptyList()
                            }
                            if (transitions.isNotEmpty()) {
                                BookHeading("Cập nhật xử lý")
                                BookSelect("Chọn trạng thái", nextStatus, transitions.map { it to bookLabel(it) },
                                    { nextStatus = it }, Icons.Rounded.Build)
                                TroOiFormField(note, { note = it }, label = { Text("Ghi chú xử lý") },
                                    modifier = Modifier.fillMaxWidth())
                                BookButton(onClick = {
                                    model.updateIncident(current.id, nextStatus, note) {
                                        model.load("incident", current.id)
                                        model.loadIncidentEvents(current.id)
                                        onRetry()
                                    }
                                }, enabled = nextStatus in transitions && !model.busy) { Text("Lưu cập nhật") }
                            }
                        }
                    }
                }

                "incident-create" -> {
                    val options = if (owner) rooms else state.read.operationalRooms.filter { it.roomId in tenantTenancies.map { t -> t.roomId } }
                    item {
                        BookCard {
                            BookHeading("Báo sự cố")
                            BookSelect("Chọn phòng", roomSelection, options.map { it.roomId to it.label },
                                { roomSelection = it }, Icons.Rounded.MeetingRoom)
                            BookSelect("Loại sự cố", category,
                                listOf("ELECTRICAL", "PLUMBING", "ACCESS_SECURITY", "ROOM_FACILITY", "APPLIANCE", "OTHER").map { it to bookLabel(it) },
                                { category = it }, Icons.Rounded.Build)
                            BookButton(onClick = { model.createIncident(roomSelection, category, onRetry) },
                                enabled = options.any { it.roomId == roomSelection } && !model.busy) { Text("Báo sự cố") }
                        }
                    }
                }

                "receipts" -> {
                    val scoped = if (owner) receipts else state.read.tenantFinanceByTenancy.values
                        .filter { it.tenancyId in state.access.linkedTenancyIds }
                        .flatMap { it.receipts }.distinctBy { it.receiptId }
                    val paymentIds = if (current.id.isNotBlank() && model.paymentScopeId == current.id)
                        model.payments?.mapNotNull { if (it.isJsonObject) it.asJsonObject.string("id") else null }?.toSet()
                    else null
                    val visible = scoped.filter { receipt ->
                        current.id.isBlank() || paymentIds?.contains(receipt.confirmedPaymentId) == true
                    }
                    bookReceiptList(visible, query, { query = it },
                        current.id.isNotBlank() && model.payments == null,
                        !sourceReady || model.error != null,
                        { add(BookDestination("receipt-detail", it)) })
                }

                "receipt-detail" -> {
                    val detail = model.detail?.takeIf { it.field("id") == current.id }
                    item { BookReceiptIdentity(detail, model.receiptPayment?.takeIf { it.field("id") == detail?.field("paymentId") }) }
                    detail?.field("paymentId")?.let { payment ->
                        item {
                            BookRow("Xem thanh toán", "Giao dịch gắn với chứng từ", Icons.Rounded.Payments) {
                                add(BookDestination("payment-detail", payment))
                            }
                        }
                    }
                    detail?.field("replacementReceiptId")?.let { replacement ->
                        item {
                            BookRow("Biên nhận thay thế", "Mở chứng từ tiếp theo", Icons.Rounded.ReceiptLong) {
                                add(BookDestination("receipt-detail", replacement))
                            }
                        }
                    }
                    item {
                        Text("Biên nhận không đồng nghĩa toàn bộ công nợ đã được thanh toán.",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                "rent" -> {
                    val payTenancy = current.id.takeIf { !owner && it in state.access.linkedTenancyIds }
                    if (payTenancy != null) item {
                        BookCard {
                            BookHeading("Thanh toán chuyển khoản", Icons.Rounded.QrCode2)
                            TenantPayQr(amount, { amount = it }, model.busy) {
                                model.createPaymentQr(payTenancy, amount) { openPay(it) }
                            }
                        }
                    }
                    val currentCycles = model.cycles?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }
                        ?.filter { cycle ->
                            val tenancy = state.read.tenancies.find { it.tenancyId == cycle.field("tenancyId") }
                            (owner && tenancy?.roomId in allowedRooms || !owner && cycle.field("tenancyId") in state.access.linkedTenancyIds) &&
                                (current.id.isBlank() || cycle.field("tenancyId") == current.id)
                        }
                    val scopeVerified = owner || current.id.isNotBlank() && current.id == tenantTenancies.firstOrNull()?.tenancyId
                    bookRentList(if (scopeVerified) currentCycles else null, state.read.tenancies, owner, query, statusFilter,
                        { query = it }, { statusFilter = it }, !sourceReady || model.error != null || !scopeVerified,
                        { add(BookDestination("cycle-detail", it)) },
                        { model.loadCycles(if (owner) null else tenantTenancies.firstOrNull()?.tenancyId); onRetry() })
                }

                "cycle-detail" -> {
                    val detail = model.detail?.takeIf { it.field("id") == current.id }
                    item { BookCycleIdentity(detail) }
                    item { BookHeading("Các khoản trong kỳ") }
                    items(detail?.children("charges").orEmpty(), key = { it.field("id").orEmpty() }) { charge ->
                        BookRow(when (charge.field("type")) {
                            "RENT" -> "Tiền phòng"; "ELECTRICITY" -> "Tiền điện"; "WATER" -> "Tiền nước"; else -> "Khoản thu"
                        }, "Phải thu " + moneyDisplay(charge.field("amount")) +
                            " · Còn " + moneyDisplay(charge.field("outstandingAmount")), Icons.Rounded.AccountBalanceWallet) {
                            add(BookDestination("charge-detail", charge.field("id").orEmpty(), current.id))
                        }
                    }
                    if (owner) item {
                        BookButton(onClick = { add(BookDestination("record-payment", current.id)) },
                            modifier = Modifier.fillMaxWidth()) { Text("Ghi nhận tiền đã nhận") }
                    } else detail?.field("tenancyId")?.let { tenancyId ->
                        item {
                            BookCard {
                                BookHeading("Thanh toán chuyển khoản", Icons.Rounded.QrCode2)
                                TenantPayQr(amount, { amount = it }, model.busy) {
                                    model.createPaymentQr(tenancyId, amount) { openPay(it) }
                                }
                            }
                        }
                    }
                    detail?.field("tenancyId")?.let { tenancyId ->
                        item {
                            BookTextButton(onClick = { model.loadPayments(tenancyId); add(BookDestination("payment-list", tenancyId)) }) {
                                Text("Lịch sử thanh toán")
                            }
                        }
                    }
                }

                "charge-detail" -> {
                    val charge = model.detail?.takeIf { it.field("id") == current.auxiliary }?.children("charges")?.find { it.field("id") == current.id }
                    item { BookChargeIdentity(charge, current.auxiliary) }
                }

                "payment-list" -> {
                    val scoped = model.payments?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }
                        .orEmpty().filter { it.field("tenancyId") == current.id }
                    if (scoped.isEmpty()) item {
                        BookCard { BookEmpty(Icons.Rounded.Payments,
                            if (model.payments == null) "Chưa tải được thanh toán" else "Chưa có thanh toán",
                            "Các khoản đã xác nhận trong lượt thuê sẽ xuất hiện tại đây.") }
                    }
                    item { BookHeading("Lịch sử thanh toán", Icons.Rounded.History) }
                    items(scoped, key = { it.field("id").orEmpty() }) { pay ->
                        BookRow(moneyDisplay(pay.field("amount")), pay.field("confirmedAt"), Icons.Rounded.Payments) {
                            add(BookDestination("payment-detail", pay.field("id").orEmpty()))
                        }
                    }
                }

                "payment-detail" -> {
                    val detail = model.detail?.takeIf { it.field("id") == current.id }
                    item { BookPaymentIdentity(detail) }
                    if (detail != null) item {
                        BookCard {
                            BookHeading("Phân bổ đã ghi nhận", Icons.Rounded.AccountBalanceWallet)
                            val allocations = detail.children("allocations")
                            if (allocations.isEmpty()) Text("Chưa có phân bổ trong dữ liệu chi tiết được cấp quyền.",
                                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            allocations.forEach { allocation ->
                                BookPair("Khoản thu", allocation.field("chargeId"))
                                BookPair("Đã phân bổ", moneyDisplay(allocation.field("amount")))
                            }
                            val linkedReceipts = if (owner) receipts else state.read.tenantFinanceByTenancy
                                .filterKeys { it in state.access.linkedTenancyIds }.values.flatMap { it.receipts }
                            linkedReceipts.filter { it.confirmedPaymentId == current.id }.distinctBy { it.receiptId }.forEach { receipt ->
                                BookRow("Biên nhận", receipt.issuedAtLabel, Icons.Rounded.ReceiptLong) {
                                    add(BookDestination("receipt-detail", receipt.receiptId))
                                }
                            }
                        }
                    }
                    if (owner && detail != null) item {
                        BookCard {
                            BookHeading("Phân bổ thanh toán")
                            val tenancyId = detail.field("tenancyId")
                            val chargeOptions = model.cycles?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }
                                .orEmpty().filter { it.field("tenancyId") == tenancyId }
                                .flatMap { it.children("charges") }
                                .filter { it.field("outstandingAmount")?.toBigDecimalOrNull()?.signum() == 1 }
                            BookSelect("Chọn khoản thu", pickedCharge, chargeOptions.map {
                                it.field("id").orEmpty() to (bookLabel(it.field("type")) + " · " + moneyDisplay(it.field("outstandingAmount")))
                            }, { pickedCharge = it }, Icons.Rounded.AccountBalanceWallet)
                            TroOiFormField(amount, { amount = it.filter(Char::isDigit) }, label = { Text("Số tiền phân bổ") },
                                modifier = Modifier.fillMaxWidth())
                            BookButton(onClick = { model.allocate(current.id, pickedCharge, amount) {
                                model.loadCycles()
                                model.load("payment", current.id)
                                onRetry()
                            } }, enabled = pickedCharge.isNotBlank() &&
                                amount.toBigDecimalOrNull()?.signum() == 1 &&
                                amount.toBigDecimalOrNull()!! <= (chargeOptions.find { it.field("id") == pickedCharge }
                                    ?.field("outstandingAmount")?.toBigDecimalOrNull() ?: BigDecimal.ZERO) && !model.busy) {
                                Text("Xác nhận phân bổ")
                            }
                        }
                    }
                }

                "record-payment" -> {
                    val cycle = model.cycles?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }
                        ?.find { it.field("id") == current.id }
                    item {
                        BookCard {
                            BookHeading("Ghi nhận tiền thực nhận")
                            TroOiFormField(amount, { amount = it.filter(Char::isDigit) }, label = { Text("Số tiền đã nhận (VND)") },
                                modifier = Modifier.fillMaxWidth())
                            BookSelect("Hình thức nhận tiền", method,
                                listOf("MANUAL_CASH" to "Tiền mặt", "MANUAL_TRANSFER" to "Chuyển khoản"),
                                { method = it }, Icons.Rounded.Payments)
                            Text("Chỉ dùng khi đã nhận tiền thật. Công nợ chỉ giảm sau khi phân bổ vào Charge.",
                                style = MaterialTheme.typography.bodySmall)
                            BookButton(onClick = { actionConfirm = "payment" },
                                enabled = amount.toBigDecimalOrNull()?.signum() == 1 && !model.busy) {
                                Text("Tiếp tục xác nhận")
                            }
                            if (actionConfirm == "payment") {
                                BookPair("Xác nhận đã nhận", moneyDisplay(amount))
                                BookButton(onClick = {
                                    cycle?.field("tenancyId")?.let { model.confirmPayment(it, amount, method) { savedId ->
                                        model.loadCycles()
                                        onRetry()
                                        add(BookDestination("payment-detail", savedId))
                                    } }
                                    actionConfirm = ""
                                }, enabled = cycle?.field("tenancyId") != null && !model.busy) { Text("Xác nhận đã nhận") }
                            }
                        }
                    }
                }
            }
        }
    }
}
