package com.trooi.app.features.organization

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.features.shared.*
import com.trooi.app.ui.components.*
import com.trooi.app.features.tenancy.V1RentalWorkspace
import com.trooi.app.ui.theme.TroOiMuted

/** Visual composition is independent from backend commands and route state. */
@Composable
fun V1OperatorWorkspace(
    access: AccessCapabilities,
    organizationId: String,
    onUnauthorized: () -> Unit,
    onWorkspaceCreated: () -> Unit,
    model: OperatorViewModel = hiltViewModel(),
) {
    val ui by model.ui.collectAsStateWithLifecycle()
    LaunchedEffect(access, organizationId) { model.begin(access, organizationId) }
    DisposableEffect(Unit) { onDispose { model.reset() } }
    LaunchedEffect(ui.errorKind) { if (ui.errorKind == "AUTH_EXPIRED") onUnauthorized() }
    LaunchedEffect(ui.organizationCreatedRevision) {
        if (ui.organizationCreatedRevision > 0) onWorkspaceCreated()
    }
    BackHandler(enabled = ui.stack.size > 1) { model.back() }
    var name by remember(ui.route) { mutableStateOf("") }
    var address by remember(ui.route) { mutableStateOf("") }
    var opLat by remember(ui.route) { mutableStateOf("") }
    var opLng by remember(ui.route) { mutableStateOf("") }
    var publicLat by remember(ui.route) { mutableStateOf("") }
    var publicLng by remember(ui.route) { mutableStateOf("") }
    var description by remember(ui.route) { mutableStateOf("") }
    var price by remember(ui.route) { mutableStateOf("") }
    if (ui.route is OperatorRoute.Rentals) {
        val rental = ui.route as OperatorRoute.Rentals
        V1RentalWorkspace(roomId = rental.roomId, onExit = { model.back() }, onUnauthorized = onUnauthorized)
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("operator-feature-list"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        val route = ui.route
        item {
            V1PageTitle(
                when (route) {
                    OperatorRoute.Organizations -> "Không gian vận hành"
                    is OperatorRoute.Organization -> "Khu trọ"
                    is OperatorRoute.Dashboard -> "Tổng quan"
                    is OperatorRoute.Properties -> "Khu nhà"
                    is OperatorRoute.Property -> "Chi tiết khu nhà"
                    is OperatorRoute.Rooms -> "Phòng"
                    is OperatorRoute.Room -> "Chi tiết phòng"
                    is OperatorRoute.RoomHistory -> "Lịch sử phòng"
                    is OperatorRoute.Listing -> "Quản lý tin đăng"
                    is OperatorRoute.Rentals -> "Quản lý lượt thuê"
                    is OperatorRoute.Inquiries -> "Yêu cầu liên hệ"
                    is OperatorRoute.Inquiry -> "Chi tiết liên hệ"
                },
                "Quản lý thông tin và trạng thái vận hành.",
            )
        }
        if (ui.stack.size > 1) item { TextButton(onClick = { model.back() }) { Text("← Quay lại") } }
        if (ui.busy) item { LinearProgressIndicator(Modifier.fillMaxWidth().testTag("operator-loading")) }
        if (ui.error != null) item {
            V1Panel("Không thể hoàn thành yêu cầu") {
                Text(ui.error.orEmpty(), color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("operator-error"))
                V1Action("Thử lại", model::load, enabled = !ui.busy)
            }
        }
        if (ui.success != null) item {
            V1Panel("Đã xác nhận") {
                Text(ui.success.orEmpty(), modifier = Modifier.testTag("operator-success"))
            }
        }
        when (route) {
            is OperatorRoute.Rentals -> Unit // Rendered above as a separate nested workflow.
            OperatorRoute.Organizations -> {
                if (!ui.busy && ui.organizations.isEmpty()) item {
                    V1Panel("Chưa có khu trọ") { V1Pending("Tạo khu trọ mới hoặc chờ được cấp quyền quản lý.") }
                }
                items(ui.organizations, key = { "org-" + it.id }) { org ->
                    V1Row(org.name, "Mở khu trọ", "org-" + org.id) {
                        model.open(OperatorRoute.Organization(org.id))
                    }
                }
                item {
                    V1Panel("Tạo khu trọ") {
                        V1Input(name, { name = it }, "Tên workspace", "organization-name")
                        V1Action("Tạo khu trọ", { model.createOrganization(name) },
                            enabled = !ui.busy && name.isNotBlank(), modifier = Modifier.fillMaxWidth())
                    }
                }
            }
            is OperatorRoute.Organization -> {
                ui.organization?.takeIf { it.id == route.id }?.let { org ->
                    item {
                        V1Panel(org.name) {
                            V1Input(name, { name = it }, "Tên khu trọ mới", "organization-edit-name")
                            V1Action("Lưu tên", { model.renameOrganization(org.id, name) }, enabled = !ui.busy && name.isNotBlank())
                            V1Action("Tổng quan", { model.open(OperatorRoute.Dashboard(org.id)) })
                            V1Action("Quản lý khu nhà", { model.open(OperatorRoute.Properties(org.id)) })
                        }
                    }
                }
            }
            is OperatorRoute.Dashboard -> {
                ui.dashboard?.takeIf { it.organizationId == route.organizationId }?.let { dashboard ->
                    item {
                        V1Panel("Tổng quan") {
                            V1Metric("Phòng trống", dashboard.roomsByState.vacant.toString())
                            V1Metric("Có người thuê", dashboard.roomsByState.occupied.toString())
                            V1Metric("Đang bảo trì", dashboard.roomsByState.maintenance.toString())
                            V1Metric("Ngừng sử dụng", dashboard.roomsByState.inactive.toString())
                            V1Metric("Lượt thuê đang hoạt động", dashboard.activeTenancyCount.toString())
                            V1Metric("Sự cố đang mở", dashboard.openIncidentCount.toString())
                            V1Metric(
                                "Khoản còn cần thu",
                                dashboard.outstandingReceivable ?: "Chưa có số liệu tổng hợp",
                            )
                            V1Metric(
                                "Tiền đã nhận",
                                dashboard.confirmedPaymentTotal ?: "Chưa có số liệu tổng hợp",
                            )
                        }
                    }
                }
            }
            is OperatorRoute.Properties -> {
                if (!ui.busy && ui.properties.isEmpty()) item { V1Panel("Khu nhà") { V1Pending("Chưa có khu nhà trong khu trọ này.") } }
                items(ui.properties, key = { "property-" + it.id }) { property ->
                    V1Row(property.name, "Mở khu nhà", "property-" + property.id) {
                        model.open(OperatorRoute.Property(property.id, route.organizationId))
                    }
                }
                item {
                    V1Panel("Tạo khu nhà") {
                        Text("Địa chỉ vận hành được giữ riêng với vị trí công khai.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        V1Input(name, { name = it }, "Tên khu nhà", "property-name")
                        V1Input(address, { address = it }, "Địa chỉ vận hành (riêng tư)", "private-address")
                        V1Input(opLat, { opLat = it }, "Operational latitude", "operational-latitude")
                        V1Input(opLng, { opLng = it }, "Operational longitude", "operational-longitude")
                        V1Input(publicLat, { publicLat = it }, "Public latitude (tọa độ công khai)", "public-latitude")
                        V1Input(publicLng, { publicLng = it }, "Public longitude (tọa độ công khai)", "public-longitude")
                        V1Action("Tạo khu nhà", {
                            val coordinates = listOf(opLat, opLng, publicLat, publicLng).map(String::toDoubleOrNull)
                            if (coordinates.all { it != null }) model.createProperty(
                                route.organizationId, name, address,
                                coordinates[0]!!, coordinates[1]!!, coordinates[2]!!, coordinates[3]!!,
                            )
                        }, enabled = !ui.busy && name.isNotBlank() && address.isNotBlank() &&
                            listOf(opLat, opLng, publicLat, publicLng).all { it.toDoubleOrNull() != null },
                            modifier = Modifier.fillMaxWidth())
                    }
                }
            }
            is OperatorRoute.Property -> {
                ui.property?.takeIf { it.id == route.id }?.let { property ->
                    item {
                        V1Panel(property.name) {
                            Text("Địa chỉ vận hành không xuất hiện trên tin đăng công khai.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            V1Input(name, { name = it }, "Tên khu nhà mới", "property-edit-name")
                            V1Action("Lưu tên", {
                                model.renameProperty(route.id, route.organizationId, name)
                            }, enabled = !ui.busy && name.isNotBlank())
                            V1Action("Danh sách phòng", {
                                model.open(OperatorRoute.Rooms(route.id, route.organizationId))
                            })
                        }
                    }
                }
            }
            is OperatorRoute.Rooms -> {
                if (!ui.busy && ui.rooms.isEmpty()) item { V1Panel("Phòng") { V1Pending("Chưa có phòng nào.") } }
                items(ui.rooms, key = { "room-" + it.id }) { room ->
                    V1Row(room.name, operatorRoomStateLabel(room.state) + " · " + recordLifecycleLabel(room.lifecycle), "room-" + room.id) {
                        model.open(OperatorRoute.Room(room.id, route.propertyId, route.organizationId))
                    }
                }
                item {
                    V1Panel("Tạo phòng") {
                        V1Input(name, { name = it }, "Tên hoặc mã phòng", "room-name")
                        V1Action("Tạo phòng", {
                            model.createRoom(route.propertyId, route.organizationId, name)
                        }, enabled = !ui.busy && name.isNotBlank())
                    }
                }
            }
            is OperatorRoute.Room -> {
                ui.room?.takeIf { it.id == route.id }?.let { room ->
                    item {
                        val roomStateLabel = when (room.state.lowercase()) {
                            "occupied" -> "Có người thuê"
                            "vacant" -> "Phòng trống"
                            "maintenance" -> "Đang bảo trì"
                            "inactive" -> "Ngừng sử dụng"
                            else -> room.state
                        }
                        RoomLedgerPlate(
                            roomLabel = room.name,
                            contextLabel = "Sổ phòng",
                            stateLabel = roomStateLabel,
                        )
                    }
                    item {
                        LedgerNavStrip(
                            active = "Tổng quan",
                            items = listOf("Tổng quan", "Tin đăng", "Lượt thuê", "Tài chính", "Sự cố", "Lịch sử"),
                        )
                    }
                    item {
                        LedgerSectionTitle("Thông tin hiện tại", "Trạng thái phòng và tin đăng đang áp dụng")
                        Spacer(Modifier.height(8.dp))
                        V1Metric("Trạng thái vận hành", room.state)
                        V1Metric("Vòng đời record", room.lifecycle)
                        ui.listing?.takeIf { it.roomId == route.id }?.let { listing ->
                            V1Metric("Tin đăng hiện tại", "${listing.status} · ${listing.price}")
                        }
                    }
                    item {
                        V1Panel("Thao tác phòng") {
                            V1Input(name, { name = it }, "Tên phòng mới", "room-edit-name")
                            V1Action("Lưu tên", { model.renameRoom(room.id, name) }, enabled = !ui.busy && name.isNotBlank())
                            val targets = legalRoomTargets(room.state)
                            if (room.state.equals("occupied", true)) {
                                V1Pending("Phòng đang có người thuê. Trạng thái trống chỉ sau khi lượt thuê được checkout trên Backend.")
                                V1SecondaryAction("Mở lượt thuê để checkout", {
                                    model.open(OperatorRoute.Rentals(room.id, route.organizationId))
                                }, enabled = !ui.busy)
                            } else if (targets.isEmpty()) {
                                V1Pending("Không có chuyển trạng thái thủ công hợp lệ từ ${room.state}.")
                            } else {
                                targets.forEach { target ->
                                    V1SecondaryAction(manualRoomTargetLabel(target), {
                                        model.transitionRoomState(route, target)
                                    }, enabled = !ui.busy)
                                }
                            }
                        }
                    }
                    item {
                        LedgerSectionTitle("Mở bản ghi nguồn")
                        Spacer(Modifier.height(8.dp))
                        V1SecondaryAction("Lượt thuê · Tài chính · Sự cố", {
                            model.open(OperatorRoute.Rentals(room.id, route.organizationId))
                        }, modifier = Modifier.fillMaxWidth())
                        Spacer(Modifier.height(8.dp))
                        V1SecondaryAction("Lịch sử đầy đủ", {
                            model.open(OperatorRoute.RoomHistory(room.id, route.propertyId, route.organizationId))
                        }, modifier = Modifier.fillMaxWidth())
                    }
                }
                if (!ui.busy && ui.listing?.roomId != route.id) item {
                    V1Panel("Tạo tin đăng cho phòng") {
                        V1Pending("Mỗi phòng chỉ có một tin đăng hiện hành.")
                        V1Input(name, { name = it }, "Tiêu đề công khai", "listing-title")
                        V1Input(description, { description = it }, "Mô tả công khai", "listing-description")
                        V1Input(price, { price = it.filter(Char::isDigit).take(16) }, "Giá công khai (VND)", "listing-price")
                        V1Input(publicLat, { publicLat = it }, "Vĩ độ công khai · thiết lập nâng cao", "listing-public-latitude")
                        V1Input(publicLng, { publicLng = it }, "Kinh độ công khai · thiết lập nâng cao", "listing-public-longitude")
                        V1Action("Tạo bản nháp", {
                            model.createListing(route, name, description, price,
                                publicLat.toDouble(), publicLng.toDouble())
                        }, enabled = !ui.busy && name.isNotBlank() && description.isNotBlank() &&
                            price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")) &&
                            (publicLat.toDoubleOrNull()?.let { it in -90.0..90.0 } == true) &&
                            (publicLng.toDoubleOrNull()?.let { it in -180.0..180.0 } == true))
                    }
                }
                ui.listing?.takeIf { it.roomId == route.id }?.let { listing ->
                    item {
                        V1Panel("Tin đăng hiện tại") {
                            V1Metric("Mã tin đăng", listing.id)
                            V1Metric("Trạng thái", listingStatusLabel(listing.status))
                            V1Action("Mở tin đăng", {
                                model.open(OperatorRoute.Listing(listing.id, route.id, route.propertyId, route.organizationId))
                            }, enabled = !ui.busy)
                        }
                    }
                }
            }
            is OperatorRoute.RoomHistory -> {
                ui.roomHistory?.takeIf { it.room.id == route.id }?.let { history ->
                    item {
                        RoomLedgerPlate(
                            roomLabel = history.room.nameOrLabel,
                            contextLabel = "Lịch sử phòng",
                            stateLabel = history.room.operationalState,
                        )
                    }
                    item {
                        LedgerSectionTitle("Lịch sử tin đăng", "Chỉ đọc")
                        Spacer(Modifier.height(8.dp))
                        if (history.listings.isEmpty()) {
                            V1Pending("Chưa có lịch sử tin đăng.")
                        } else {
                            history.listings.forEach { entry ->
                                if (entry.events.isEmpty()) {
                                    LedgerAttentionRow(
                                        title = "Listing ${entry.listing.id}",
                                        supporting = entry.listing.status,
                                        tone = LedgerTone.Neutral,
                                    )
                                } else {
                                    entry.events.forEach { event ->
                                        LedgerHistoryEvent(
                                            source = "Tin đăng",
                                            title = "${event.fromStatus} → ${event.toStatus}",
                                            occurredAt = event.occurredAt,
                                            supporting = "Listing ${entry.listing.id}",
                                        )
                                    }
                                }
                            }
                        }
                    }
                    item {
                        LedgerDivider()
                        LedgerSectionTitle("Lượt thuê & tài chính", "Lịch sử liên quan đến phòng")
                        Spacer(Modifier.height(8.dp))
                        if (history.tenancies.isEmpty()) {
                            V1Pending("Chưa có lịch sử lượt thuê.")
                        } else {
                            history.tenancies.forEach { entry ->
                                LedgerAttentionRow(
                                    title = "Lượt thuê ${entry.tenancy.id}",
                                    supporting = "${entry.tenancy.status} · ${entry.billingCycles.size} kỳ thanh toán",
                                    tone = LedgerTone.Neutral,
                                )
                                entry.payments.forEach { paymentEntry ->
                                    LedgerAttentionRow(
                                        title = "Thanh toán ${paymentEntry.payment.id}",
                                        supporting = paymentEntry.payment.confirmedAt,
                                        amount = paymentEntry.payment.amount,
                                        tone = LedgerTone.Success,
                                    )
                                    paymentEntry.receipts.forEach { receipt ->
                                        LedgerAttentionRow(
                                            title = "Biên nhận ${receipt.id}",
                                            supporting = receipt.status,
                                            tone = LedgerTone.Neutral,
                                        )
                                    }
                                }
                                entry.deposit?.let { depositHistory ->
                                    V1Metric("Tiền cọc đang giữ", depositHistory.projection.heldAmount)
                                    LedgerStateLabel(
                                        depositHistory.projection.state ?: "Chưa có trạng thái",
                                        LedgerTone.Clay,
                                    )
                                }
                            }
                        }
                    }
                    item {
                        LedgerDivider()
                        LedgerSectionTitle("Sự cố", "Lịch sử xử lý")
                        Spacer(Modifier.height(8.dp))
                        if (history.incidents.isEmpty()) {
                            V1Pending("Chưa có lịch sử sự cố.")
                        } else {
                            history.incidents.forEach { entry ->
                                if (entry.events.isEmpty()) {
                                    LedgerAttentionRow(
                                        title = entry.incident.category,
                                        supporting = entry.incident.status,
                                        tone = LedgerTone.Warning,
                                    )
                                } else {
                                    entry.events.forEach { event ->
                                        LedgerHistoryEvent(
                                            source = "Sự cố",
                                            title = event.eventType,
                                            occurredAt = event.occurredAt,
                                            supporting = entry.incident.category,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            is OperatorRoute.Listing -> {
                ui.listing?.takeIf { it.id == route.id && it.roomId == route.roomId }?.let { listing ->
                    item {
                        V1Panel(listing.title) {
                            V1Metric("Trạng thái", listingStatusLabel(listing.status))
                            V1Metric("Giá công khai", listing.price)
                            V1Input(name, { name = it }, "Tiêu đề mới", "listing-edit-title")
                            V1Input(description, { description = it }, "Mô tả mới", "listing-edit-description")
                            V1Input(price, { price = it.filter(Char::isDigit).take(16) }, "Giá mới (VND)", "listing-edit-price")
                            V1Action("Lưu tin đăng", { model.editListing(route, name, description, price) },
                                enabled = !ui.busy && listing.status != "archived" &&
                                    name.isNotBlank() && description.isNotBlank() &&
                                    price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")))
                            if (listing.status == "draft" || listing.status == "unpublished") {
                                V1Action("Đăng tin", { model.publishListing(route) }, enabled = !ui.busy)
                            }
                            if (listing.status == "published") {
                                V1Action("Ẩn tin", { model.unpublishListing(route) }, enabled = !ui.busy)
                            }
                            if (listing.status != "archived") {
                                V1Action("Lưu trữ", { model.archiveListing(route) }, enabled = !ui.busy)
                            }
                            V1Action("Inbox liên hệ", { model.open(OperatorRoute.Inquiries(listing.id)) })
                        }
                    }
                }
            }
            is OperatorRoute.Inquiries -> {
                if (!ui.busy && ui.inquiries.isEmpty()) item { V1Panel("Yêu cầu liên hệ") { V1Pending("Chưa có yêu cầu liên hệ cho tin đăng này.") } }
                items(ui.inquiries, key = { "inquiry-" + it.id }) { entry ->
                    V1Row(entry.message, entry.status, "inquiry-" + entry.id) {
                        model.open(OperatorRoute.Inquiry(entry.id, route.listingId))
                    }
                }
            }
            is OperatorRoute.Inquiry -> {
                ui.inquiry?.takeIf { it.id == route.id && it.listingId == route.listingId }?.let { entry ->
                    item {
                        V1Panel("Yêu cầu liên hệ") {
                            Text(entry.message)
                            V1Metric("Trạng thái", entry.status)
                            V1Pending("Yêu cầu liên hệ không tự động giữ phòng hoặc tạo lượt thuê.")
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun V1Input(
    value: String, onValue: (String) -> Unit, label: String, tag: String,
) {
    OutlinedTextField(
        value = value, onValueChange = onValue, label = { Text(label) },
        modifier = Modifier.fillMaxWidth().testTag(tag), singleLine = true,
    )
}

@Composable private fun V1Row(title: String, detail: String, tag: String, onOpen: () -> Unit) {
    V1Panel(title, modifier = Modifier.fillMaxWidth().testTag(tag).clickable(onClick = onOpen)) {
        Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Mở chi tiết →", fontWeight = FontWeight.SemiBold)
    }
}

private fun operatorRoomStateLabel(value: String): String = when (value.lowercase()) {
    "occupied" -> "Có người thuê"
    "vacant" -> "Phòng trống"
    "maintenance" -> "Đang bảo trì"
    "inactive" -> "Ngừng sử dụng"
    else -> value
}

private fun manualRoomTargetLabel(target: String): String = when (target.uppercase()) {
    "VACANT" -> "Đánh dấu phòng trống"
    "MAINTENANCE" -> "Chuyển sang bảo trì"
    "INACTIVE" -> "Ngừng sử dụng phòng"
    else -> target
}

private fun recordLifecycleLabel(value: String): String = when (value.lowercase()) {
    "active" -> "Đang hoạt động"
    "archived" -> "Đã lưu trữ"
    else -> value
}

private fun listingStatusLabel(value: String): String = when (value.lowercase()) {
    "draft" -> "Bản nháp"
    "published" -> "Đang công khai"
    "unpublished" -> "Đang ẩn"
    "archived" -> "Đã lưu trữ"
    else -> value
}
