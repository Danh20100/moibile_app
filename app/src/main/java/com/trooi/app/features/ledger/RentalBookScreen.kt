package com.trooi.app.features.ledger

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.gson.JsonObject
import com.trooi.app.core.model.*
import com.trooi.app.ui.components.TroOiPage
import com.trooi.app.ui.components.TroOiPageHeader
import com.trooi.app.ui.components.TroOiListRow
import com.trooi.app.ui.components.TroOiButton
import com.trooi.app.ui.components.TroOiButtonStyle
import com.trooi.app.ui.components.TroOiFormField
import com.trooi.app.ui.theme.TroOiDimens
import java.math.BigDecimal
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale
import kotlinx.coroutines.launch

private data class BookDestination(val section: String, val id: String = "", val auxiliary: String = "")

private fun moneyDisplay(value: String?): String {
    if (value == null) return "Chưa đối chiếu"
    val numeric = value.toBigDecimalOrNull() ?: return value
    return NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN")).format(numeric) + "đ"
}

private fun JsonObject.field(name: String): String? = string(name)
private fun JsonObject.children(name: String): List<JsonObject> =
    get(name)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }.orEmpty()

private fun dueValue(cycle: JsonObject): BigDecimal? {
    val charges = cycle.children("charges")
    if (charges.any { it.field("outstandingAmount") == null }) return null
    return charges.fold(BigDecimal.ZERO) { sum, charge ->
        sum + (charge.field("outstandingAmount")?.toBigDecimalOrNull() ?: BigDecimal.ZERO)
    }
}

private fun roomStateLabel(value: RoomOperationalState?): String? = when (value) {
    RoomOperationalState.VACANT -> "C\u00f2n tr\u1ed1ng"
    RoomOperationalState.OCCUPIED -> "C\u00f3 ng\u01b0\u1eddi thu\u00ea"
    RoomOperationalState.MAINTENANCE -> "\u0110ang b\u1ea3o tr\u00ec"
    RoomOperationalState.INACTIVE -> "Ng\u1eebng s\u1eed d\u1ee5ng"
    null -> null
}

private fun recordStateLabel(value: RecordLifecycle?): String? = when (value) {
    RecordLifecycle.ACTIVE -> "\u0110ang ho\u1ea1t \u0111\u1ed9ng"
    RecordLifecycle.ARCHIVED -> "\u0110\u00e3 l\u01b0u tr\u1eef"
    null -> null
}

@Composable
private fun BookCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(TroOiDimens.panelPadding),
            verticalArrangement = Arrangement.spacedBy(TroOiDimens.contentGap),
            content = content,
        )
    }
}

@Composable
private fun BookRow(label: String, detail: String?, icon: ImageVector, onClick: () -> Unit) {
    TroOiListRow(
        title = label,
        subtitle = detail.orEmpty(),
        onClick = onClick,
        leading = {
            Icon(icon, contentDescription = null, modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.primary)
        },
    )
}

@Composable
private fun BookPair(label: String, value: String?) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(TroOiDimens.contentGap),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(value ?: "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u", style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f),
            textAlign = androidx.compose.ui.text.style.TextAlign.End)
    }
}

@Composable
private fun BookHeading(text: String) {
    Text(text, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onBackground)
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
    val owner = state.access.operatedOrganizationIds.isNotEmpty()
    val rooms = remember(state.read, state.access) { accessibleRooms(state.read, state.access) }
    val allowedRooms = rooms.map { it.roomId }.toSet()
    val organizations = state.access.operatedOrganizationIds
    val properties = state.read.properties.filter { it.organizationId in organizations }
    val people = state.read.tenancies.filter {
        it.roomId in allowedRooms && it.lifecycle in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING, TenancyLifecycle.DRAFT)
    }
    val listings = accessibleOperatorListings(state.read, state.access)
    val incidents = accessibleIncidents(state.read, state.access)
    val receipts = state.read.operatorFinanceByOrganization
        .filterKeys { it in organizations }.values.flatMap { it.receipts }.distinctBy { it.receiptId }
    val tenantTenancies = state.read.tenancies.filter { it.tenancyId in state.access.linkedTenancyIds }
    val destinations = remember(state.backendUserId) { mutableStateListOf(BookDestination("home")) }
    val current = destinations.last()
    var query by remember(current.section) { mutableStateOf("") }
    var assetFilter by remember { mutableStateOf("") }
    var statusFilter by remember(current.section) { mutableStateOf("all") }
    var showJoin by remember { mutableStateOf(false) }
    var showInvite by remember { mutableStateOf(false) }
    var actionConfirm by remember { mutableStateOf("") }
    var amount by remember(current) { mutableStateOf("") }
    var method by remember(current) { mutableStateOf("MANUAL_TRANSFER") }
    var note by remember(current) { mutableStateOf("") }
    var nextStatus by remember(current) { mutableStateOf("") }
    var pickedCharge by remember(current) { mutableStateOf("") }
    var name by remember(current) { mutableStateOf("") }
    var description by remember(current) { mutableStateOf("") }
    var price by remember(current) { mutableStateOf("") }
    var roomSelection by remember(current.section) { mutableStateOf("") }
    var category by remember(current.section) { mutableStateOf("ELECTRICAL") }
    val add = { destination: BookDestination ->
        destinations.add(destination)
        model.clearMessage()
    }
    val back = { if (destinations.size > 1) { destinations.removeAt(destinations.lastIndex); model.clearMessage() } }
    BackHandler(enabled = destinations.size > 1 && !showInvite && !showJoin) { back() }

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
        }, { showInvite = false })
    }

    TroOiPage {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = TroOiDimens.pagePadding, vertical = TroOiDimens.pagePadding),
            verticalArrangement = Arrangement.spacedBy(TroOiDimens.contentGap),
        ) {
            item {
                TroOiPageHeader(
                    title = if (current.section == "home") "S\u1ed5 c\u1ee7a t\u00f4i" else when (current.section) {
                            "assets" -> "T\u00e0i s\u1ea3n"
                            "people" -> "Ng\u01b0\u1eddi thu\u00ea"
                            "rent" -> "Ti\u1ec1n thu\u00ea"
                            "incidents" -> "S\u1ef1 c\u1ed1"
                            "listings" -> "Tin \u0111\u0103ng"
                            "receipts" -> "Bi\u00ean nh\u1eadn"
                            "property-detail" -> "Chi ti\u1ebft t\u00e0i s\u1ea3n"
                            "room-detail" -> "Chi ti\u1ebft ph\u00f2ng"
                            "person-detail" -> "Chi ti\u1ebft ng\u01b0\u1eddi thu\u00ea"
                            "cycle-detail" -> "Chi ti\u1ebft k\u1ef3 thu"
                            "charge-detail" -> "Chi ti\u1ebft kho\u1ea3n thu"
                            "payment-detail" -> "Chi ti\u1ebft thanh to\u00e1n"
                            "listing-detail" -> "Chi ti\u1ebft tin \u0111\u0103ng"
                            "receipt-detail" -> "Chi ti\u1ebft bi\u00ean nh\u1eadn"
                            "incident-detail" -> "Chi ti\u1ebft s\u1ef1 c\u1ed1"
                            "record-payment" -> "Ghi nh\u1eadn \u0111\u00e3 thu"
                            "listing-edit" -> "Ch\u1ec9nh s\u1eeda tin \u0111\u0103ng"
                            "incident-create" -> "B\u00e1o s\u1ef1 c\u1ed1"
                            "person-create" -> "Th\u00eam ng\u01b0\u1eddi thu\u00ea"
                            else -> "S\u1ed5 thu\u00ea"
                        },
                    subtitle = when (current.section) {
                        "home" -> if (owner) "T\u1ed5ng quan ho\u1ea1t \u0111\u1ed9ng cho thu\u00ea"
                            else "Nh\u00e0 v\u00e0 ti\u1ec1n thu\u00ea c\u1ee7a t\u00f4i"
                        "assets" -> "Qu\u1ea3n l\u00fd t\u00e0i s\u1ea3n v\u00e0 ph\u00f2ng"
                        "property-detail" -> properties.firstOrNull { it.propertyId == current.id }?.displayName.orEmpty()
                        "room-detail" -> rooms.firstOrNull { it.roomId == current.id }?.label.orEmpty()
                        "person-detail" -> "Ng\u01b0\u1eddi \u0111\u1ee9ng t\u00ean thu\u00ea ph\u00f2ng"
                        "rent", "cycle-detail", "charge-detail", "payment-detail" -> "K\u1ef3 thu v\u00e0 thanh to\u00e1n"
                        "receipts", "receipt-detail" -> "Ch\u1ee9ng t\u1eeb thanh to\u00e1n"
                        "incidents", "incident-detail" -> "Theo d\u00f5i x\u1eed l\u00fd s\u1ef1 c\u1ed1"
                        "listings", "listing-detail", "listing-edit" -> "Qu\u1ea3n l\u00fd tin cho thu\u00ea"
                        else -> if (owner) "Ho\u1ea1t \u0111\u1ed9ng cho thu\u00ea" else "Ph\u00f2ng thu\u00ea c\u1ee7a t\u00f4i"
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
                Text(model.error.orEmpty(), color = MaterialTheme.colorScheme.error)
            }
            if (model.feedback != null) item {
                Text(model.feedback.orEmpty(), color = MaterialTheme.colorScheme.primary)
            }
            if (model.busy) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }

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
                "home" -> {
                    if (owner) {
                        item {
                            var opened by remember { mutableStateOf(false) }
                            Column {
                                Text("Tài sản", style = MaterialTheme.typography.labelMedium)
                                BookTextButton(onClick = { opened = true }) {
                                    Text(properties.firstOrNull { it.propertyId == assetFilter }?.displayName ?: "Tất cả tài sản")
                                    Icon(Icons.Rounded.ArrowDropDown, null)
                                }
                                DropdownMenu(expanded = opened, onDismissRequest = { opened = false }) {
                                    DropdownMenuItem(text = { Text("Tất cả tài sản") }, onClick = { assetFilter = ""; opened = false })
                                    properties.forEach { p -> DropdownMenuItem(text = { Text(p.displayName) },
                                        onClick = { assetFilter = p.propertyId; opened = false }) }
                                }
                            }
                        }
                        item {
                            val dashboards = state.read.dashboardByOrganization
                                .filterKeys { it in organizations }.values.toList()
                            val paymentsLabel = if (assetFilter.isEmpty() && dashboards.size == 1) dashboards.first().confirmedPaymentTotalLabel else null
                            val outstandingLabel = if (assetFilter.isEmpty() && dashboards.size == 1) dashboards.first().outstandingReceivableLabel else null
                            val currentCycles = model.cycles?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }
                                ?.filter { c ->
                                    val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == c.field("tenancyId") }
                                    assetFilter.isEmpty() || rooms.firstOrNull { it.roomId == tenancy?.roomId }?.propertyId == assetFilter
                                }
                            val overdue = currentCycles?.filter { c ->
                                c.field("dueDate")?.let { runCatching { LocalDate.parse(it).isBefore(LocalDate.now()) }.getOrDefault(false) } == true
                            }
                            val overdueValid = overdue?.takeIf { list -> !currentCycles.isNullOrEmpty() && list.all { dueValue(it) != null } }
                                ?.fold(BigDecimal.ZERO) { total, c -> total + (dueValue(c) ?: BigDecimal.ZERO) }
                            BookCard {
                                BookHeading("Tổng quan tài chính")
                                Text("Đã thu", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(moneyDisplay(paymentsLabel), style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Bold)
                                HorizontalDivider()
                                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                                    Column(Modifier.weight(1f)) {
                                        Text("Chưa thu", style = MaterialTheme.typography.bodySmall)
                                        Text(moneyDisplay(outstandingLabel), fontWeight = FontWeight.Bold)
                                    }
                                    Column(Modifier.weight(1f)) {
                                        Text("Trong đó quá hạn", style = MaterialTheme.typography.bodySmall)
                                        Text(moneyDisplay(overdueValid?.toPlainString()), fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                        item { BookHeading("Cần thu tiền") }
                        val selectedCycles = model.cycles?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }
                            ?.filter { c ->
                                val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == c.field("tenancyId") }
                                tenancy?.roomId in allowedRooms &&
                                    (assetFilter.isEmpty() || rooms.firstOrNull { it.roomId == tenancy?.roomId }?.propertyId == assetFilter) &&
                                    (dueValue(c)?.signum() ?: 0) > 0
                            }?.sortedBy { it.field("dueDate") }.orEmpty()
                        items(selectedCycles.take(3), key = { it.field("id").orEmpty() }) { cycle ->
                            val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == cycle.field("tenancyId") }
                            BookRow(tenancy?.roomLabel ?: "Kỳ thu", "Hạn thu: " + (cycle.field("dueDate") ?: "Chưa xác định") +
                                " · Còn " + moneyDisplay(dueValue(cycle)?.toPlainString()),
                                Icons.Rounded.AccountBalanceWallet) {
                                add(BookDestination("cycle-detail", cycle.field("id").orEmpty()))
                            }
                        }
                        if (selectedCycles.isEmpty()) item {
                            Text("Chưa có khoản cần thu đã được đối chiếu.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        item { BookTextButton(onClick = { add(BookDestination("rent")) }) { Text("Xem tất cả kỳ thu") } }
                        val openIssues = incidents.filter { it.lifecycle !in setOf(IncidentLifecycle.CLOSED, IncidentLifecycle.REJECTED) &&
                            (assetFilter.isEmpty() || rooms.find { r -> r.roomId == it.roomId }?.propertyId == assetFilter) }
                        if (openIssues.isNotEmpty()) {
                            item { BookHeading("Cần xử lý") }
                            items(openIssues.take(2), key = { it.incidentId }) { issue ->
                                BookRow(issue.title, "Sự cố đang mở", Icons.Rounded.Build) {
                                    add(BookDestination("incident-detail", issue.incidentId))
                                }
                            }
                        }
                        item { BookHeading("Quản lý của tôi") }
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                listOf(
                                    listOf(Triple("Tài sản", Icons.Rounded.Apartment, "assets"), Triple("Người thuê", Icons.Rounded.People, "people")),
                                    listOf(Triple("Tiền thuê", Icons.Rounded.Payments, "rent"), Triple("Sự cố", Icons.Rounded.Build, "incidents")),
                                    listOf(Triple("Tin đăng", Icons.Rounded.Campaign, "listings"), Triple("Biên nhận", Icons.Rounded.ReceiptLong, "receipts")),
                                ).forEach { group ->
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        group.forEach { (label, icon, section) ->
                                            Surface(onClick = { add(BookDestination(section)) }, modifier = Modifier.weight(1f).heightIn(min = 108.dp),
                                                shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface,
                                                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
                                                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                                    Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
                                                    Text(label, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        val linked = tenantTenancies.filter { it.lifecycle in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING) }
                        if (linked.isEmpty()) {
                            item {
                                BookCard {
                                    BookHeading("Chưa liên kết phòng")
                                    Text("Nhận link hoặc quét QR do chủ trọ gửi để thêm phòng thuê vào Sổ.")
                                    BookButton(onClick = { showJoin = true }, modifier = Modifier.fillMaxWidth()) {
                                        Icon(Icons.Rounded.QrCodeScanner, null)
                                        Spacer(Modifier.width(8.dp))
                                        Text("Quét QR / Nhập mã phòng")
                                    }
                                }
                            }
                        } else {
                            items(linked, key = { it.tenancyId }) { t ->
                                BookRow(t.roomLabel, rentalLifecycleLabel(t.lifecycle), Icons.Rounded.Home) {
                                    add(BookDestination("person-detail", t.tenancyId))
                                }
                            }
                            item { BookHeading("Khoản cần thanh toán") }
                            items(linked, key = { "finance-" + it.tenancyId }) { t ->
                                val finance = state.read.tenantFinanceByTenancy[t.tenancyId]
                                BookRow(t.roomLabel, finance?.charges?.joinToString(" · ") {
                                    it.label + ": " + (it.outstandingLabel ?: "Chưa đối chiếu")
                                } ?: "Chưa có dữ liệu", Icons.Rounded.Payments) {
                                    add(BookDestination("rent", t.tenancyId))
                                }
                            }
                            item { BookHeading("Thông tin của tôi") }
                            item {
                                BookRow("Biên nhận", "Chứng từ thanh toán đã phát hành", Icons.Rounded.ReceiptLong) {
                                    add(BookDestination("receipts"))
                                }
                            }
                            item {
                                BookRow("Sự cố", "Báo và theo dõi sự cố phòng thuê", Icons.Rounded.Build) {
                                    add(BookDestination("incidents"))
                                }
                            }
                            item {
                                BookOutlinedButton(onClick = { showJoin = true }, modifier = Modifier.fillMaxWidth()) {
                                    Text("Liên kết phòng khác")
                                }
                            }
                        }
                    }
                }
                "assets" -> {
                    item {
                        val catalog = state.read.localManagement
                        BookCard {
                            BookHeading("Chỗ quản lý")
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
                    item { BookHeading("Danh sách tài sản") }
                    items(properties, key = { it.propertyId }) { p ->
                        BookRow(p.displayName, "${rooms.count { it.propertyId == p.propertyId }} phòng", Icons.Rounded.Apartment) {
                            add(BookDestination("property-detail", p.propertyId))
                        }
                        Spacer(Modifier.height(8.dp))
                        rooms.filter { it.propertyId == p.propertyId && it.lifecycle == RecordLifecycle.ACTIVE }
                            .forEach { room ->
                                BookRow(room.label, when (room.operationalState) {
                                    RoomOperationalState.VACANT -> "Còn trống"
                                    RoomOperationalState.OCCUPIED -> "Có người thuê"
                                    RoomOperationalState.MAINTENANCE -> "Đang bảo trì"
                                    RoomOperationalState.INACTIVE -> "Ngừng sử dụng"
                                }, Icons.Rounded.MeetingRoom) {
                                    add(BookDestination("room-detail", room.roomId))
                                }
                            }
                    }
                    if (properties.isEmpty()) item {
                        Text("Chưa có tài sản. Tạo tài sản đầu tiên trong luồng quản lý vận hành.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                "property-detail" -> {
                    val property = properties.firstOrNull { it.propertyId == current.id }
                    item {
                        BookCard {
                            BookHeading(property?.displayName ?: "Không tìm thấy tài sản")
                            Text("Các phòng đang được quản lý tại tài sản này.")
                        }
                    }
                    items(rooms.filter { it.propertyId == current.id }, key = { it.roomId }) { room ->
                        BookRow(room.label, room.operationalState.name, Icons.Rounded.MeetingRoom) {
                            add(BookDestination("room-detail", room.roomId))
                        }
                    }
                }

                "room-detail" -> {
                    val room = rooms.firstOrNull { it.roomId == current.id }
                        ?: state.read.operationalRooms.firstOrNull { it.roomId == current.id }
                    val tenancy = state.read.tenancies.firstOrNull {
                        it.roomId == current.id && it.lifecycle in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING)
                    }
                    item {
                        BookCard {
                            BookHeading(room?.label ?: "Phòng không khả dụng")
                            BookPair("Tài sản", properties.firstOrNull { it.propertyId == room?.propertyId }?.displayName)
                            BookPair("Trạng thái phòng", roomStateLabel(room?.operationalState))
                            BookPair("Trạng thái hồ sơ", recordStateLabel(room?.lifecycle))
                            BookPair("Người đứng tên", tenancy?.primaryTenantName)
                            BookPair("Lượt thuê", tenancy?.tenancyId)
                            BookPair("Liên kết tài khoản", if (tenancy != null) "Xem qua QR / Link" else "Chưa có lượt thuê")
                            if (owner && tenancy != null) {
                                BookButton(onClick = { model.clearInvitation(); showInvite = true }, modifier = Modifier.fillMaxWidth()) {
                                    Icon(Icons.Rounded.Link, null)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Tạo link / Hiện QR")
                                }
                            }
                        }
                    }
                    if (owner && room != null && room.operationalState != RoomOperationalState.OCCUPIED) {
                        item {
                            var expanded by remember { mutableStateOf(false) }
                            BookCard {
                                BookHeading("Thao tác phòng")
                                BookTextButton(onClick = { expanded = true }) { Text("Chuyển trạng thái") }
                                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                                    val choices = when (room.operationalState) {
                                        RoomOperationalState.VACANT -> listOf("MAINTENANCE", "INACTIVE")
                                        RoomOperationalState.MAINTENANCE -> listOf("VACANT", "INACTIVE")
                                        RoomOperationalState.INACTIVE -> listOf("VACANT")
                                        RoomOperationalState.OCCUPIED -> emptyList()
                                    }
                                    choices.forEach { value ->
                                        DropdownMenuItem(text = { Text(value) }, onClick = {
                                            expanded = false
                                            model.changeRoom(current.id, value, onRetry)
                                        })
                                    }
                                }
                            }
                        }
                    }
                    item { BookHeading("Quản lý liên quan") }
                    if (tenancy != null) item {
                        BookRow("Người thuê", "Chi tiết người đứng tên", Icons.Rounded.People) {
                            add(BookDestination("person-detail", tenancy.tenancyId))
                        }
                    }
                    if (tenancy != null) item {
                        BookRow("Tiền thuê", "Kỳ thu và thanh toán", Icons.Rounded.Payments) {
                            add(BookDestination("rent", tenancy.tenancyId))
                        }
                    }
                    item {
                        BookRow("Sự cố", "Các báo cáo gắn với phòng", Icons.Rounded.Build) {
                            add(BookDestination("incidents", current.id))
                        }
                    }
                    items(listings.filter { it.roomId == current.id }, key = { it.listingId }) { l ->
                        BookRow("Tin đăng", l.title, Icons.Rounded.Campaign) {
                            add(BookDestination("listing-detail", l.listingId))
                        }
                    }
                }

                "people" -> {
                    item { TroOiFormField(value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(),
                        label = { Text("Tìm người thuê hoặc phòng") }, singleLine = true) }
                    items(people.filter { p ->
                        (current.id.isBlank() || p.roomId == current.id) &&
                            (p.primaryTenantName.orEmpty().contains(query, true) || p.roomLabel.contains(query, true))
                    }, key = { it.tenancyId }) { p ->
                        BookRow(p.primaryTenantName ?: "Chưa có tên người đứng tên", p.roomLabel + " · " +
                            rentalLifecycleLabel(p.lifecycle), Icons.Rounded.Person) {
                            add(BookDestination("person-detail", p.tenancyId))
                        }
                    }
                    if (owner) item {
                        BookButton(onClick = { add(BookDestination("person-create")) }, modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Rounded.Add, null)
                            Spacer(Modifier.width(8.dp))
                            Text("Thêm lượt thuê")
                        }
                    }
                }

                "person-detail" -> {
                    val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == current.id }
                    item {
                        BookCard {
                            Icon(Icons.Rounded.AccountCircle, null, modifier = Modifier.align(Alignment.CenterHorizontally).size(52.dp))
                            BookHeading(tenancy?.primaryTenantName ?: "Người đứng tên chưa có tên hiển thị")
                            BookPair("Phòng", tenancy?.roomLabel)
                            BookPair("Trạng thái", tenancy?.lifecycle?.let(::rentalLifecycleLabel))
                            BookPair("Điều khoản", tenancy?.termsVersionLabel)
                        }
                    }
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

                "person-create" -> {
                    val vacantRooms = rooms.filter { it.operationalState == RoomOperationalState.VACANT && it.lifecycle == RecordLifecycle.ACTIVE }
                    item {
                        BookCard {
                            BookHeading("Tạo lượt thuê bản nháp")
                            Text("Người đứng tên được liên kết ở bước quản lý lượt thuê; không chuyển trạng thái phòng ngay.")
                            var menu by remember { mutableStateOf(false) }
                            BookTextButton(onClick = { menu = true }) {
                                Text(vacantRooms.firstOrNull { it.roomId == roomSelection }?.label ?: "Chọn phòng")
                            }
                            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                                vacantRooms.forEach { room ->
                                    DropdownMenuItem(text = { Text(room.label) }, onClick = { roomSelection = room.roomId; menu = false })
                                }
                            }
                            BookButton(onClick = { model.createTenancy(roomSelection, onRetry) },
                                enabled = roomSelection.isNotBlank() && !model.busy) {
                                Text("Tạo bản nháp")
                            }
                        }
                    }
                }

                "listings" -> {
                    item { TroOiFormField(query, { query = it }, modifier = Modifier.fillMaxWidth(),
                        label = { Text("Tìm tin đăng") }, singleLine = true) }
                    items(listings.filter { l ->
                        (current.id.isBlank() || l.roomId == current.id) &&
                            (l.title.contains(query, true) || rooms.any { it.roomId == l.roomId && it.label.contains(query, true) })
                    }, key = { it.listingId }) { l ->
                        BookRow(l.title, rooms.firstOrNull { it.roomId == l.roomId }?.label + " · " + l.visibility.name,
                            Icons.Rounded.Campaign) {
                            add(BookDestination("listing-detail", l.listingId))
                        }
                    }
                }

                "listing-detail" -> {
                    val detail = model.detail
                    item {
                        BookCard {
                            BookHeading(detail?.field("publicTitle") ?: "Đang tải tin đăng")
                            Text(moneyDisplay(detail?.field("publicPriceProjection")) + "/tháng",
                                style = MaterialTheme.typography.titleLarge)
                            BookPair("Trạng thái", detail?.field("status"))
                            Text(detail?.field("publicDescription") ?: "Chưa tải nội dung",
                                style = MaterialTheme.typography.bodyMedium)
                        }
                    }
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
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                BookHeading("Danh sách sự cố")
                                Text("Đang mở: ${matching.count { it.lifecycle !in setOf(IncidentLifecycle.CLOSED, IncidentLifecycle.REJECTED) }}",
                                    style = MaterialTheme.typography.bodySmall)
                            }
                            IconButton(onClick = { add(BookDestination("incident-create")) }) {
                                Icon(Icons.Rounded.Add, "Báo sự cố")
                            }
                        }
                    }
                    items(matching, key = { it.incidentId }) { incident ->
                        BookRow(incident.title, (rooms.find { it.roomId == incident.roomId }
                            ?: state.read.operationalRooms.find { it.roomId == incident.roomId })?.label +
                            " · " + incident.lifecycle.name, Icons.Rounded.Build) {
                            add(BookDestination("incident-detail", incident.incidentId))
                        }
                    }
                    if (matching.isEmpty()) item { Text("Chưa có sự cố trong phạm vi đang xem.") }
                }

                "incident-detail" -> {
                    val detail = model.detail
                    item {
                        BookCard {
                            BookHeading(detail?.field("category") ?: "Đang tải sự cố")
                            BookPair("Trạng thái", detail?.field("status"))
                            BookPair("Thời gian báo", detail?.field("createdAt"))
                            BookPair("Lý do kết thúc", detail?.field("closureReason"))
                        }
                    }
                    item { BookHeading("Lịch sử xử lý") }
                    items(model.incidents?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }.orEmpty(),
                        key = { it.field("id").orEmpty() }) { event ->
                        BookCard {
                            Text(event.field("eventType") ?: "Cập nhật")
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
                                var expanded by remember { mutableStateOf(false) }
                                BookOutlinedButton(onClick = { expanded = true }) {
                                    Text(nextStatus.ifBlank { "Chọn trạng thái" })
                                }
                                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                                    transitions.forEach { target ->
                                        DropdownMenuItem(text = { Text(target) }, onClick = {
                                            nextStatus = target; expanded = false
                                        })
                                    }
                                }
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
                            var roomsOpen by remember { mutableStateOf(false) }
                            BookOutlinedButton(onClick = { roomsOpen = true }) {
                                Text(options.firstOrNull { it.roomId == roomSelection }?.label ?: "Chọn phòng")
                            }
                            DropdownMenu(expanded = roomsOpen, onDismissRequest = { roomsOpen = false }) {
                                options.forEach { r ->
                                    DropdownMenuItem(text = { Text(r.label) }, onClick = { roomSelection = r.roomId; roomsOpen = false })
                                }
                            }
                            var catsOpen by remember { mutableStateOf(false) }
                            BookOutlinedButton(onClick = { catsOpen = true }) { Text(category) }
                            DropdownMenu(expanded = catsOpen, onDismissRequest = { catsOpen = false }) {
                                listOf("ELECTRICAL","PLUMBING","ACCESS_SECURITY","ROOM_FACILITY","APPLIANCE","OTHER").forEach {
                                    DropdownMenuItem(text = { Text(it) }, onClick = { category = it; catsOpen = false })
                                }
                            }
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
                    item { BookHeading("Danh sách biên nhận") }
                    items(visible, key = { it.receiptId }) { receipt ->
                        BookRow("Biên nhận", "Ngày phát hành " + receipt.issuedAtLabel,
                            Icons.Rounded.ReceiptLong) {
                            add(BookDestination("receipt-detail", receipt.receiptId))
                        }
                    }
                    if (visible.isEmpty()) item {
                        Text("Chưa có biên nhận đã phát hành trong dữ liệu được cấp quyền.")
                    }
                }

                "receipt-detail" -> {
                    val detail = model.detail
                    item {
                        BookCard {
                            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Rounded.ReceiptLong, null, modifier = Modifier.size(44.dp))
                                Text(detail?.field("status") ?: "Đang tải biên nhận", color = MaterialTheme.colorScheme.primary)
                            }
                            Text(moneyDisplay(model.receiptPayment?.field("amount")),
                                style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                            HorizontalDivider()
                            BookPair("Mã biên nhận", detail?.field("id"))
                            BookPair("Ngày phát hành", detail?.field("issuedAt"))
                            BookPair("Ngày hủy", detail?.field("voidedAt"))
                            BookPair("Thanh toán liên quan", detail?.field("paymentId"))
                            detail?.field("replacementReceiptId")?.let { BookPair("Biên nhận thay thế", it) }
                        }
                    }
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
                    val currentCycles = model.cycles?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }
                        .orEmpty().filter { c ->
                            val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == c.field("tenancyId") }
                            (owner && tenancy?.roomId in allowedRooms || !owner && c.field("tenancyId") in state.access.linkedTenancyIds) &&
                                (current.id.isBlank() || c.field("tenancyId") == current.id)
                        }
                    item {
                        val outstanding = currentCycles.map(::dueValue)
                        BookCard {
                            BookHeading(if (owner) "Tổng còn phải thu" else "Khoản cần thanh toán")
                            Text(if (outstanding.isEmpty() || outstanding.any { it == null }) "Chưa đối chiếu đủ"
                                else moneyDisplay(outstanding.filterNotNull().fold(BigDecimal.ZERO, BigDecimal::add).toPlainString()),
                                style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        }
                    }
                    item { BookHeading("Các kỳ thu") }
                    items(currentCycles.sortedByDescending { it.field("periodStart") },
                        key = { it.field("id").orEmpty() }) { cycle ->
                        val tenancy = state.read.tenancies.firstOrNull { it.tenancyId == cycle.field("tenancyId") }
                        BookRow(tenancy?.roomLabel ?: "Kỳ thu " + cycle.field("periodStart"),
                            "Kỳ ${cycle.field("periodStart")} – ${cycle.field("periodEnd")}" +
                                " · Còn " + moneyDisplay(dueValue(cycle)?.toPlainString()), Icons.Rounded.Payments) {
                            add(BookDestination("cycle-detail", cycle.field("id").orEmpty()))
                        }
                    }
                    if (currentCycles.isEmpty()) item {
                        Text("Chưa tải được kỳ thu. Đây không phải xác nhận đã thanh toán đủ.")
                    }
                }

                "cycle-detail" -> {
                    val detail = model.detail
                    item {
                        BookCard {
                            BookHeading("Còn phải thu")
                            Text(moneyDisplay(detail?.let(::dueValue)?.toPlainString()),
                                style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                            BookPair("Bắt đầu", detail?.field("periodStart"))
                            BookPair("Kết thúc", detail?.field("periodEnd"))
                            BookPair("Hạn thu", detail?.field("dueDate"))
                            BookPair("Điều khoản áp dụng", detail?.field("tenancyTermsId"))
                        }
                    }
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
                    val charge = model.detail?.children("charges")?.find { it.field("id") == current.id }
                    item {
                        BookCard {
                            BookHeading("Chi tiết khoản thu")
                            BookPair("Loại khoản", charge?.field("type"))
                            BookPair("Số tiền phải thu", moneyDisplay(charge?.field("amount")))
                            BookPair("Còn phải thu", moneyDisplay(charge?.field("outstandingAmount")))
                            BookPair("Kỳ tính tiền", current.auxiliary)
                        }
                    }
                }

                "payment-list" -> {
                    val scoped = model.payments?.mapNotNull { if (it.isJsonObject) it.asJsonObject else null }
                        .orEmpty().filter { it.field("tenancyId") == current.id }
                    item { BookHeading("Lịch sử thanh toán") }
                    items(scoped, key = { it.field("id").orEmpty() }) { pay ->
                        BookRow(moneyDisplay(pay.field("amount")), pay.field("confirmedAt"), Icons.Rounded.Payments) {
                            add(BookDestination("payment-detail", pay.field("id").orEmpty()))
                        }
                    }
                }

                "payment-detail" -> {
                    val detail = model.detail
                    item {
                        BookCard {
                            BookHeading("Thanh toán đã xác nhận")
                            Text(moneyDisplay(detail?.field("amount")),
                                style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                            BookPair("Nguồn", detail?.field("source"))
                            BookPair("Xác minh", detail?.field("verification"))
                            BookPair("Ngày xác nhận", detail?.field("confirmedAt"))
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
                            var expanded by remember { mutableStateOf(false) }
                            BookOutlinedButton(onClick = { expanded = true }) {
                                Text(chargeOptions.find { it.field("id") == pickedCharge }?.field("type") ?: "Chọn khoản thu")
                            }
                            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                                chargeOptions.forEach { c -> DropdownMenuItem(
                                    text = { Text(c.field("type").orEmpty() + " · " + moneyDisplay(c.field("outstandingAmount"))) },
                                    onClick = { pickedCharge = c.field("id").orEmpty(); expanded = false },
                                ) }
                            }
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
                            var methodMenu by remember { mutableStateOf(false) }
                            BookOutlinedButton(onClick = { methodMenu = true }) {
                                Text(if (method == "MANUAL_CASH") "Tiền mặt" else "Chuyển khoản")
                            }
                            DropdownMenu(expanded = methodMenu, onDismissRequest = { methodMenu = false }) {
                                listOf("MANUAL_CASH" to "Tiền mặt", "MANUAL_TRANSFER" to "Chuyển khoản").forEach { (key,label) ->
                                    DropdownMenuItem(text = { Text(label) }, onClick = { method = key; methodMenu = false })
                                }
                            }
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
