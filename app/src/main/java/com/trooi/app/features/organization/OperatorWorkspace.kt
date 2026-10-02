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
    onUnauthorized: () -> Unit,
    onWorkspaceCreated: () -> Unit,
    model: OperatorViewModel = hiltViewModel(),
) {
    val ui by model.ui.collectAsStateWithLifecycle()
    LaunchedEffect(access) { model.begin(access) }
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
    var existingListingId by remember(ui.route) { mutableStateOf("") }
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
                    is OperatorRoute.Organization -> "Organization"
                    is OperatorRoute.Properties -> "Property"
                    is OperatorRoute.Property -> "Chi tiết Property"
                    is OperatorRoute.Rooms -> "Room"
                    is OperatorRoute.Room -> "Chi tiết Room"
                    is OperatorRoute.Listing -> "Quản lý Listing"
                    is OperatorRoute.Rentals -> "Quản lý lượt thuê"
                    is OperatorRoute.Inquiries -> "Inquiry Inbox"
                    is OperatorRoute.Inquiry -> "Chi tiết Inquiry"
                },
                "Dữ liệu và trạng thái chỉ được cập nhật sau khi Backend xác nhận.",
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
                    V1Panel("Chưa có Organization") { V1Pending("Tạo workspace mới hoặc đợi Backend cấp quyền truy cập.") }
                }
                items(ui.organizations, key = { "org-" + it.id }) { org ->
                    V1Row(org.name, "Mở Organization", "org-" + org.id) {
                        model.open(OperatorRoute.Organization(org.id))
                    }
                }
                item {
                    V1Panel("Tạo Organization") {
                        V1Input(name, { name = it }, "Tên workspace", "organization-name")
                        V1Action("Tạo Organization", { model.createOrganization(name) },
                            enabled = !ui.busy && name.isNotBlank(), modifier = Modifier.fillMaxWidth())
                    }
                }
            }
            is OperatorRoute.Organization -> {
                ui.organization?.takeIf { it.id == route.id }?.let { org ->
                    item {
                        V1Panel(org.name) {
                            V1Input(name, { name = it }, "Tên Organization mới", "organization-edit-name")
                            V1Action("Lưu tên", { model.renameOrganization(org.id, name) }, enabled = !ui.busy && name.isNotBlank())
                            V1Action("Quản lý Property", { model.open(OperatorRoute.Properties(org.id)) })
                        }
                    }
                }
            }
            is OperatorRoute.Properties -> {
                if (!ui.busy && ui.properties.isEmpty()) item { V1Panel("Property") { V1Pending("Chưa có Property trong Organization này.") } }
                items(ui.properties, key = { "property-" + it.id }) { property ->
                    V1Row(property.name, "Mở khu nhà", "property-" + property.id) {
                        model.open(OperatorRoute.Property(property.id, route.organizationId))
                    }
                }
                item {
                    V1Panel("Tạo Property") {
                        Text("Operational location chỉ gửi Backend; public location được nhập riêng.", color = TroOiMuted)
                        V1Input(name, { name = it }, "Tên Property", "property-name")
                        V1Input(address, { address = it }, "Địa chỉ vận hành (riêng tư)", "private-address")
                        V1Input(opLat, { opLat = it }, "Operational latitude", "operational-latitude")
                        V1Input(opLng, { opLng = it }, "Operational longitude", "operational-longitude")
                        V1Input(publicLat, { publicLat = it }, "Public latitude (tọa độ công khai)", "public-latitude")
                        V1Input(publicLng, { publicLng = it }, "Public longitude (tọa độ công khai)", "public-longitude")
                        V1Action("Tạo Property", {
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
                            Text("Mọi thay đổi địa chỉ vận hành phải đi qua Backend.", color = TroOiMuted)
                            V1Input(name, { name = it }, "Tên Property mới", "property-edit-name")
                            V1Action("Lưu tên", {
                                model.renameProperty(route.id, route.organizationId, name)
                            }, enabled = !ui.busy && name.isNotBlank())
                            V1Action("Danh sách Room", {
                                model.open(OperatorRoute.Rooms(route.id, route.organizationId))
                            })
                        }
                    }
                }
            }
            is OperatorRoute.Rooms -> {
                if (!ui.busy && ui.rooms.isEmpty()) item { V1Panel("Room") { V1Pending("Chưa có Room.") } }
                items(ui.rooms, key = { "room-" + it.id }) { room ->
                    V1Row(room.name, room.state + " · " + room.lifecycle, "room-" + room.id) {
                        model.open(OperatorRoute.Room(room.id, route.propertyId, route.organizationId))
                    }
                }
                item {
                    V1Panel("Tạo Room") {
                        V1Input(name, { name = it }, "Tên hoặc mã phòng", "room-name")
                        V1Action("Tạo Room", {
                            model.createRoom(route.propertyId, route.organizationId, name)
                        }, enabled = !ui.busy && name.isNotBlank())
                    }
                }
            }
            is OperatorRoute.Room -> {
                ui.room?.takeIf { it.id == route.id }?.let { room ->
                    item {
                        V1Panel(room.name) {
                            V1Metric("Operational State", room.state)
                            V1Metric("Record Lifecycle", room.lifecycle)
                            V1Input(name, { name = it }, "Tên Room mới", "room-edit-name")
                            V1Action("Lưu tên", { model.renameRoom(room.id, name) }, enabled = !ui.busy && name.isNotBlank())
                            V1Pending("Không cho chỉnh OCCUPIED thủ công. Transition cần command context được Backend chấp nhận.")
                            V1Action("Tenancy / Billing / Incident", {
                                model.open(OperatorRoute.Rentals(room.id, route.organizationId))
                            })
                        }
                    }
                }
                item {
                    V1Panel("Tạo Listing DRAFT cho Room") {
                        V1Pending("Backend kiểm tra tối đa một Listing hiện hành; nếu trùng sẽ từ chối bằng conflict.")
                        V1Input(name, { name = it }, "Tiêu đề công khai", "listing-title")
                        V1Input(description, { description = it }, "Mô tả công khai", "listing-description")
                        V1Input(price, { price = it }, "Giá công khai (số)", "listing-price")
                        V1Input(publicLat, { publicLat = it }, "Vĩ độ công khai", "listing-public-latitude")
                        V1Input(publicLng, { publicLng = it }, "Kinh độ công khai", "listing-public-longitude")
                        V1Action("Tạo DRAFT", {
                            model.createListing(route, name, description, price,
                                publicLat.toDouble(), publicLng.toDouble())
                        }, enabled = !ui.busy && name.isNotBlank() && description.isNotBlank() &&
                            price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")) &&
                            (publicLat.toDoubleOrNull()?.let { it in -90.0..90.0 } == true) &&
                            (publicLng.toDoubleOrNull()?.let { it in -180.0..180.0 } == true))
                    }
                }
                item {
                    V1Panel("Listing đã có") {
                        V1Pending("OpenAPI hiện thiếu GET Listing theo Room: chỉ mở ID đã biết và Backend sẽ kiểm tra liên kết.")
                        V1Input(existingListingId, { existingListingId = it }, "Listing ID", "operator-known-listing-id")
                        V1Action("Xem Listing", {
                            model.open(OperatorRoute.Listing(existingListingId.trim(), route.id, route.propertyId, route.organizationId))
                        }, enabled = !ui.busy && existingListingId.matches(Regex("[A-Za-z0-9_-]{1,128}")))
                    }
                }
            }
            is OperatorRoute.Listing -> {
                ui.listing?.takeIf { it.id == route.id && it.roomId == route.roomId }?.let { listing ->
                    item {
                        V1Panel(listing.title) {
                            V1Metric("Listing Status", listing.status)
                            V1Metric("Giá công khai", listing.price)
                            V1Input(name, { name = it }, "Tiêu đề mới", "listing-edit-title")
                            V1Input(description, { description = it }, "Mô tả mới", "listing-edit-description")
                            V1Input(price, { price = it }, "Giá mới", "listing-edit-price")
                            V1Action("Lưu Listing", { model.editListing(route, name, description, price) },
                                enabled = !ui.busy && listing.status != "archived" &&
                                    name.isNotBlank() && description.isNotBlank() &&
                                    price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")))
                            V1Pending("Publish / unpublish / archive yêu cầu backend công bố reasonCode/actorType/trigger hợp lệ; không tự suy đoán.")
                            V1Action("Inbox liên hệ", { model.open(OperatorRoute.Inquiries(listing.id)) })
                        }
                    }
                }
            }
            is OperatorRoute.Inquiries -> {
                if (!ui.busy && ui.inquiries.isEmpty()) item { V1Panel("Inbox") { V1Pending("Chưa có Inquiry cho Listing này.") } }
                items(ui.inquiries, key = { "inquiry-" + it.id }) { entry ->
                    V1Row(entry.message, entry.status, "inquiry-" + entry.id) {
                        model.open(OperatorRoute.Inquiry(entry.id, route.listingId))
                    }
                }
            }
            is OperatorRoute.Inquiry -> {
                ui.inquiry?.takeIf { it.id == route.id && it.listingId == route.listingId }?.let { entry ->
                    item {
                        V1Panel("Inquiry · " + entry.id) {
                            Text(entry.message)
                            V1Metric("Status do Backend cung cấp", entry.status)
                            Text("Sender ID: " + (entry.senderUserId ?: "Không có thông tin công khai"))
                            V1Pending("Inquiry không tự tạo Booking, Tenancy hoặc Notification.")
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
        Text(detail, style = MaterialTheme.typography.bodySmall, color = TroOiMuted)
        Text("Mở chi tiết →", fontWeight = FontWeight.SemiBold)
    }
}
