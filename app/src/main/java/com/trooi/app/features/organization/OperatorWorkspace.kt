package com.trooi.app.features.organization

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.LedgerSurface
import com.trooi.app.features.discovery.LocationFormState
import com.trooi.app.features.discovery.LocationPickerMap
import com.trooi.app.features.discovery.canCreateListing
import com.trooi.app.features.discovery.canCreateProperty
import com.trooi.app.features.discovery.confirmPublicPin
import com.trooi.app.features.discovery.setPrivateAddress
import com.trooi.app.features.discovery.setPrivatePin
import com.trooi.app.features.discovery.setPublicPin
import com.trooi.app.features.shared.*
import com.trooi.app.features.tenancy.RentalRoute
import com.trooi.app.ui.components.*
import com.trooi.app.features.tenancy.V1RentalWorkspace

/** Visual composition is independent from backend commands and route state. */
@Composable
fun V1OperatorWorkspace(
    access: AccessCapabilities,
    organizationId: String,
    entry: OperatorRoute? = null,
    onUnauthorized: () -> Unit,
    onMessageContext: (String, String) -> Unit = { _, _ -> },
    onWorkspaceCreated: () -> Unit,
    model: OperatorViewModel = hiltViewModel(),
) {
    val ui by model.ui.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(access, organizationId, entry) { model.begin(access, organizationId, entry) }
    DisposableEffect(Unit) { onDispose { model.reset() } }
    LaunchedEffect(ui.errorKind) { if (ui.errorKind == "AUTH_EXPIRED") onUnauthorized() }
    LaunchedEffect(ui.organizationCreatedRevision) {
        if (ui.organizationCreatedRevision > 0) onWorkspaceCreated()
    }
    BackHandler(enabled = ui.stack.size > 1) { model.back() }
    var name by remember(ui.route) { mutableStateOf("") }
    var description by remember(ui.route) { mutableStateOf("") }
    var price by remember(ui.route) { mutableStateOf("") }
    var locationForm by remember(ui.route) { mutableStateOf(LocationFormState()) }
    var confirmationName by remember { mutableStateOf<String?>(null) }
    var confirmationPassword by remember { mutableStateOf("") }
    if (ui.route is OperatorRoute.Rentals) {
        val rental = ui.route as OperatorRoute.Rentals
        V1RentalWorkspace(
            roomId = rental.roomId,
            linkedTenancyId = rental.tenancyId,
            entry = operatorRentalEntry(rental),
            focusId = rental.focusId,
            onExit = { model.back() },
            onUnauthorized = onUnauthorized,
            onMessageContext = onMessageContext,
        )
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("operator-feature-list"),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        val route = ui.route
        item {
            TroOiPageHeader(
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
        if (ui.stack.size > 1) item { TroOiButton("← Quay lại", { model.back() }, style = TroOiButtonStyle.TERTIARY) }
        if (ui.busy) item { TroOiStateMessage(TroOiStateKind.LOADING, "", Modifier.testTag("operator-loading")) }
        if (ui.error != null) item {
            TroOiCard("Không thể hoàn thành yêu cầu") {
                TroOiStateMessage(TroOiStateKind.ERROR, ui.error.orEmpty(), Modifier.testTag("operator-error"))
                TroOiButton("Thử lại", model::load, enabled = !ui.busy)
            }
        }
        if (ui.success != null) item {
            TroOiCard("Đã xác nhận") {
                Text(ui.success.orEmpty(), modifier = Modifier.testTag("operator-success"))
            }
        }
        when (route) {
            is OperatorRoute.Rentals -> Unit // Rendered above as a separate nested workflow.
            OperatorRoute.Organizations -> {
                if (!ui.busy && ui.organizations.isEmpty()) item {
                    TroOiCard("Chưa có khu trọ") { TroOiStateMessage(TroOiStateKind.EMPTY, "Tạo khu trọ mới hoặc chờ được cấp quyền quản lý.") }
                }
                items(ui.organizations, key = { "org-" + it.id }) { org ->
                    TroOiListRow(org.name, "Mở khu trọ", action = "Mở chi tiết →", modifier = Modifier.testTag("org-" + org.id), onClick = {
                        model.open(OperatorRoute.Organization(org.id))
                    })
                }
                item {
                    TroOiCard("Tạo khu trọ") {
                        TroOiFormField(value = name, onValueChange = { name = it }, label = { Text("Tên workspace") }, modifier = Modifier.fillMaxWidth().testTag("organization-name"), singleLine = true)
                        TroOiButton("Tạo khu trọ", {
                            confirmationPassword = ""
                            confirmationName = name.trim()
                        }, enabled = !ui.busy && name.isNotBlank(), modifier = Modifier.fillMaxWidth())
                    }
                }
            }
            is OperatorRoute.Organization -> {
                ui.organization?.takeIf { it.id == route.id }?.let { org ->
                    item {
                        TroOiCard(org.name) {
                            TroOiFormField(value = name, onValueChange = { name = it }, label = { Text("Tên khu trọ mới") }, modifier = Modifier.fillMaxWidth().testTag("organization-edit-name"), singleLine = true)
                            TroOiButton("Lưu tên", { model.renameOrganization(org.id, name) }, enabled = !ui.busy && name.isNotBlank())
                            TroOiButton("Tổng quan", { model.open(OperatorRoute.Dashboard(org.id)) })
                            TroOiButton("Quản lý khu nhà", { model.open(OperatorRoute.Properties(org.id)) })
                        }
                    }
                }
            }
            is OperatorRoute.Dashboard -> {
                ui.dashboard?.takeIf { it.organizationId == route.organizationId }?.let { dashboard ->
                    item {
                        TroOiCard("Tổng quan") {
                            TroOiInformationRow("Phòng trống", dashboard.roomsByState.vacant.toString())
                            TroOiInformationRow("Có người thuê", dashboard.roomsByState.occupied.toString())
                            TroOiInformationRow("Đang bảo trì", dashboard.roomsByState.maintenance.toString())
                            TroOiInformationRow("Ngừng sử dụng", dashboard.roomsByState.inactive.toString())
                            TroOiInformationRow("Lượt thuê đang hoạt động", dashboard.activeTenancyCount.toString())
                            TroOiInformationRow("Sự cố đang mở", dashboard.openIncidentCount.toString())
                            TroOiInformationRow(
                                "Khoản còn cần thu",
                                dashboard.outstandingReceivable ?: "Chưa có số liệu tổng hợp",
                            )
                            TroOiInformationRow(
                                "Tiền đã nhận",
                                dashboard.confirmedPaymentTotal ?: "Chưa có số liệu tổng hợp",
                            )
                        }
                    }
                }
            }
            is OperatorRoute.Properties -> {
                if (!ui.busy && ui.properties.isEmpty()) item { TroOiCard("Khu nhà") { TroOiStateMessage(TroOiStateKind.EMPTY, "Chưa có khu nhà trong khu trọ này.") } }
                items(ui.properties, key = { "property-" + it.id }) { property ->
                    TroOiListRow(property.name, "Mở khu nhà", action = "Mở chi tiết →", modifier = Modifier.testTag("property-" + property.id), onClick = {
                        model.open(OperatorRoute.Property(property.id, route.organizationId))
                    })
                }
                item {
                    TroOiCard("Tạo khu nhà") {
                        Text("Địa chỉ vận hành được giữ riêng với vị trí công khai.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        TroOiFormField(value = name, onValueChange = { name = it }, label = { Text("Tên khu nhà") }, modifier = Modifier.fillMaxWidth().testTag("property-name"), singleLine = true)
                        TroOiFormField(
                            value = locationForm.privateLocation.address,
                            onValueChange = { locationForm = setPrivateAddress(locationForm, it) },
                            label = { Text("Địa chỉ vận hành (riêng tư)") },
                            modifier = Modifier.fillMaxWidth().testTag("private-address"), singleLine = true,
                        )
                        LocationPickerMap(
                            "pin vận hành",
                            locationForm.privateLocation.point,
                            { locationForm = setPrivatePin(locationForm, it) },
                            "private-pin-map",
                        )
                        LocationPickerMap(
                            "pin công khai",
                            locationForm.publicLocation.point,
                            { locationForm = setPublicPin(locationForm, it) },
                            "public-pin-map",
                        )
                        TroOiButton(
                            if (locationForm.publicLocation.confirmed) "Đã xác nhận pin công khai" else "Xác nhận pin công khai",
                            { locationForm = confirmPublicPin(locationForm) },
                            enabled = locationForm.publicLocation.point != null && !locationForm.publicLocation.confirmed,
                            modifier = Modifier.fillMaxWidth().testTag("confirm-public-pin"),
                        )
                        TroOiFeedback("Pin công khai phải chọn và xác nhận riêng; không sao chép từ địa chỉ hoặc pin vận hành.")
                        TroOiButton("Tạo khu nhà", {
                            val privatePoint = locationForm.privateLocation.point ?: return@TroOiButton
                            val publicPoint = locationForm.publicLocation.point ?: return@TroOiButton
                            model.createProperty(
                                route.organizationId,
                                name,
                                locationForm.privateLocation.address,
                                privatePoint,
                                publicPoint,
                            )
                        }, enabled = !ui.busy && canCreateProperty(name, locationForm),
                            modifier = Modifier.fillMaxWidth())
                    }
                }
            }
            is OperatorRoute.Property -> {
                ui.property?.takeIf { it.id == route.id }?.let { property ->
                    item {
                        TroOiCard(property.name) {
                            Text("Địa chỉ vận hành không xuất hiện trên tin đăng công khai.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            TroOiFormField(value = name, onValueChange = { name = it }, label = { Text("Tên khu nhà mới") }, modifier = Modifier.fillMaxWidth().testTag("property-edit-name"), singleLine = true)
                            TroOiButton("Lưu tên", {
                                model.renameProperty(route.id, route.organizationId, name)
                            }, enabled = !ui.busy && name.isNotBlank())
                            TroOiButton("Danh sách phòng", {
                                model.open(OperatorRoute.Rooms(route.id, route.organizationId))
                            })
                        }
                    }
                }
            }
            is OperatorRoute.Rooms -> {
                if (!ui.busy && ui.rooms.isEmpty()) item { TroOiCard("Phòng") { TroOiStateMessage(TroOiStateKind.EMPTY, "Chưa có phòng nào.") } }
                items(ui.rooms, key = { "room-" + it.id }) { room ->
                    TroOiListRow(room.name, operatorRoomStateLabel(room.state) + " · " + recordLifecycleLabel(room.lifecycle),
                        action = "Mở chi tiết →", modifier = Modifier.testTag("room-" + room.id), onClick = {
                        model.open(OperatorRoute.Room(room.id, route.propertyId, route.organizationId))
                    })
                }
                item {
                    TroOiCard("Tạo phòng") {
                        TroOiFormField(value = name, onValueChange = { name = it }, label = { Text("Tên hoặc mã phòng") }, modifier = Modifier.fillMaxWidth().testTag("room-name"), singleLine = true)
                        TroOiButton("Tạo phòng", {
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
                        val listing = ui.listing?.takeIf { it.roomId == route.id }
                        LedgerNavStrip(
                            active = LedgerSurface.OVERVIEW,
                            items = LedgerSurface.ALL,
                            enabledItems = buildSet {
                                add(LedgerSurface.OVERVIEW)
                                add(LedgerSurface.TENANCY)
                                add(LedgerSurface.FINANCE)
                                add(LedgerSurface.INCIDENT)
                                add(LedgerSurface.HISTORY)
                                if (listing != null) add(LedgerSurface.LISTING)
                            },
                            onSelect = { label ->
                                when (label) {
                                    LedgerSurface.OVERVIEW -> Unit
                                    LedgerSurface.LISTING -> listing?.let {
                                        model.open(OperatorRoute.Listing(it.id, route.id, route.propertyId, route.organizationId))
                                    }
                                    LedgerSurface.TENANCY -> model.open(OperatorRoute.Rentals(route.id, route.organizationId, LedgerSurface.TENANCY))
                                    LedgerSurface.FINANCE -> model.open(OperatorRoute.Rentals(route.id, route.organizationId, LedgerSurface.FINANCE))
                                    LedgerSurface.INCIDENT -> model.open(OperatorRoute.Rentals(route.id, route.organizationId, LedgerSurface.INCIDENT))
                                    LedgerSurface.HISTORY -> model.open(OperatorRoute.RoomHistory(route.id, route.propertyId, route.organizationId))
                                }
                            },
                        )
                    }
                    item {
                        LedgerSectionTitle("Thông tin hiện tại", "Trạng thái phòng và tin đăng đang áp dụng")
                        Spacer(Modifier.height(8.dp))
                        TroOiInformationRow("Trạng thái vận hành", room.state)
                        TroOiInformationRow("Vòng đời record", room.lifecycle)
                        ui.listing?.takeIf { it.roomId == route.id }?.let { listing ->
                            TroOiInformationRow("Tin đăng hiện tại", "${listing.status} · ${listing.price}")
                        }
                    }
                    item {
                        TroOiCard("Thao tác phòng") {
                            TroOiFormField(value = name, onValueChange = { name = it }, label = { Text("Tên phòng mới") }, modifier = Modifier.fillMaxWidth().testTag("room-edit-name"), singleLine = true)
                            TroOiButton("Lưu tên", { model.renameRoom(room.id, name) }, enabled = !ui.busy && name.isNotBlank())
                            val targets = legalRoomTargets(room.state)
                            if (room.state.equals("occupied", true)) {
                                TroOiFeedback("Phòng đang có người thuê. Trạng thái trống chỉ sau khi lượt thuê được checkout trên Backend.")
                                TroOiButton("Mở lượt thuê để checkout", {
                                    model.open(OperatorRoute.Rentals(room.id, route.organizationId))
                                }, enabled = !ui.busy, style = TroOiButtonStyle.SECONDARY)
                            } else if (targets.isEmpty()) {
                                TroOiFeedback("Không có chuyển trạng thái thủ công hợp lệ từ ${room.state}.")
                            } else {
                                targets.forEach { target ->
                                    TroOiButton(manualRoomTargetLabel(target), {
                                        model.transitionRoomState(route, target)
                                    }, enabled = !ui.busy, style = TroOiButtonStyle.SECONDARY)
                                }
                            }
                        }
                    }
                    item {
                        LedgerSectionTitle("Mở bản ghi nguồn")
                        Spacer(Modifier.height(8.dp))
                        TroOiButton("Lượt thuê · Tài chính · Sự cố", {
                            model.open(OperatorRoute.Rentals(room.id, route.organizationId))
                        }, modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
                        Spacer(Modifier.height(8.dp))
                        TroOiButton("Lịch sử đầy đủ", {
                            model.open(OperatorRoute.RoomHistory(room.id, route.propertyId, route.organizationId))
                        }, modifier = Modifier.fillMaxWidth(), style = TroOiButtonStyle.SECONDARY)
                    }
                }
                if (!ui.busy && ui.listing?.roomId != route.id) item {
                    TroOiCard("Tạo tin đăng cho phòng") {
                        TroOiFeedback("Mỗi phòng chỉ có một tin đăng hiện hành.")
                        TroOiFormField(value = name, onValueChange = { name = it }, label = { Text("Tiêu đề công khai") }, modifier = Modifier.fillMaxWidth().testTag("listing-title"), singleLine = true)
                        TroOiFormField(value = description, onValueChange = { description = it }, label = { Text("Mô tả công khai") }, modifier = Modifier.fillMaxWidth().testTag("listing-description"), singleLine = true)
                        TroOiFormField(value = price, onValueChange = { price = it.filter(Char::isDigit).take(16) }, label = { Text("Giá công khai (VND)") }, modifier = Modifier.fillMaxWidth().testTag("listing-price"), singleLine = true)
                        LocationPickerMap(
                            "pin công khai của tin đăng",
                            locationForm.publicLocation.point,
                            { locationForm = setPublicPin(locationForm, it) },
                            "listing-public-pin-map",
                        )
                        TroOiButton(
                            if (locationForm.publicLocation.confirmed) "Đã xác nhận pin công khai" else "Xác nhận pin công khai",
                            { locationForm = confirmPublicPin(locationForm) },
                            enabled = locationForm.publicLocation.point != null && !locationForm.publicLocation.confirmed,
                            modifier = Modifier.fillMaxWidth().testTag("confirm-listing-public-pin"),
                        )
                        TroOiButton("Tạo bản nháp", {
                            val publicPoint = locationForm.publicLocation.point ?: return@TroOiButton
                            model.createListing(route, name, description, price, publicPoint)
                        }, enabled = !ui.busy && canCreateListing(name, description, price, locationForm.publicLocation))
                    }
                }
                ui.listing?.takeIf { it.roomId == route.id }?.let { listing ->
                    item {
                        TroOiCard("Tin đăng hiện tại") {
                            TroOiInformationRow("Mã tin đăng", listing.id)
                            TroOiInformationRow("Trạng thái", listingStatusLabel(listing.status))
                            TroOiButton("Mở tin đăng", {
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
                            TroOiFeedback("Chưa có lịch sử tin đăng.")
                        } else {
                            history.listings.forEach { entry ->
                                LedgerAttentionRow(
                                    title = "Listing ${entry.listing.id}",
                                    supporting = entry.listing.status,
                                    tone = LedgerTone.Neutral,
                                    onClick = {
                                        model.open(
                                            OperatorRoute.Listing(
                                                entry.listing.id,
                                                route.id,
                                                route.propertyId,
                                                route.organizationId,
                                            ),
                                        )
                                    },
                                )
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
                    item {
                        LedgerDivider()
                        LedgerSectionTitle("Lượt thuê & tài chính", "Lịch sử liên quan đến phòng")
                        Spacer(Modifier.height(8.dp))
                        if (history.tenancies.isEmpty()) {
                            TroOiFeedback("Chưa có lịch sử lượt thuê.")
                        } else {
                            history.tenancies.forEach { entry ->
                                LedgerAttentionRow(
                                    title = "Lượt thuê ${entry.tenancy.id}",
                                    supporting = "${entry.tenancy.status} · ${entry.billingCycles.size} kỳ thanh toán",
                                    tone = LedgerTone.Neutral,
                                    onClick = {
                                        model.open(
                                            OperatorRoute.Rentals(
                                                route.id,
                                                route.organizationId,
                                                LedgerSurface.TENANCY,
                                                entry.tenancy.id,
                                            ),
                                        )
                                    },
                                )
                                entry.payments.forEach { paymentEntry ->
                                    LedgerAttentionRow(
                                        title = "Thanh toán ${paymentEntry.payment.id}",
                                        supporting = paymentEntry.payment.confirmedAt,
                                        amount = paymentEntry.payment.amount,
                                        tone = LedgerTone.Success,
                                        onClick = {
                                            model.open(
                                                OperatorRoute.Rentals(
                                                    route.id,
                                                    route.organizationId,
                                                    LedgerSurface.FINANCE,
                                                    entry.tenancy.id,
                                                    paymentEntry.payment.id,
                                                    "PAYMENT",
                                                ),
                                            )
                                        },
                                    )
                                    paymentEntry.receipts.forEach { receipt ->
                                        LedgerAttentionRow(
                                            title = "Biên nhận ${receipt.id}",
                                            supporting = receipt.status,
                                            tone = LedgerTone.Neutral,
                                            onClick = {
                                                model.open(
                                                    OperatorRoute.Rentals(
                                                        route.id,
                                                        route.organizationId,
                                                        LedgerSurface.FINANCE,
                                                        entry.tenancy.id,
                                                        receipt.id,
                                                        "RECEIPT",
                                                    ),
                                                )
                                            },
                                        )
                                    }
                                }
                                entry.deposit?.let { depositHistory ->
                                    TroOiInformationRow("Tiền cọc đang giữ", depositHistory.projection.heldAmount)
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
                            TroOiFeedback("Chưa có lịch sử sự cố.")
                        } else {
                            history.incidents.forEach { entry ->
                                if (entry.events.isEmpty()) {
                                    LedgerAttentionRow(
                                        title = entry.incident.category,
                                        supporting = entry.incident.status,
                                        tone = LedgerTone.Warning,
                                        onClick = {
                                            model.open(
                                                OperatorRoute.Rentals(
                                                    route.id,
                                                    route.organizationId,
                                                    LedgerSurface.INCIDENT,
                                                    focusId = entry.incident.id,
                                                    sourceType = "INCIDENT",
                                                ),
                                            )
                                        },
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
                        TroOiCard(listing.title) {
                            TroOiInformationRow("Trạng thái", listingStatusLabel(listing.status))
                            TroOiInformationRow("Giá công khai", listing.price)
                            TroOiFormField(value = name, onValueChange = { name = it }, label = { Text("Tiêu đề mới") }, modifier = Modifier.fillMaxWidth().testTag("listing-edit-title"), singleLine = true)
                            TroOiFormField(value = description, onValueChange = { description = it }, label = { Text("Mô tả mới") }, modifier = Modifier.fillMaxWidth().testTag("listing-edit-description"), singleLine = true)
                            TroOiFormField(value = price, onValueChange = { price = it.filter(Char::isDigit).take(16) }, label = { Text("Giá mới (VND)") }, modifier = Modifier.fillMaxWidth().testTag("listing-edit-price"), singleLine = true)
                            TroOiButton("Lưu tin đăng", { model.editListing(route, name, description, price) },
                                enabled = !ui.busy && listing.status != "archived" &&
                                    name.isNotBlank() && description.isNotBlank() &&
                                    price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")))
                            if (listing.status == "draft" || listing.status == "unpublished") {
                                TroOiButton("Đăng tin", { model.publishListing(route) }, enabled = !ui.busy)
                            }
                            if (listing.status == "published") {
                                TroOiButton("Ẩn tin", { model.unpublishListing(route) }, enabled = !ui.busy)
                            }
                            if (listing.status != "archived") {
                                TroOiButton("Lưu trữ", { model.archiveListing(route) }, enabled = !ui.busy)
                            }
                            TroOiButton("Inbox liên hệ", { model.open(OperatorRoute.Inquiries(listing.id)) })
                        }
                    }
                }
            }
            is OperatorRoute.Inquiries -> {
                if (!ui.busy && ui.inquiries.isEmpty()) item { TroOiCard("Yêu cầu liên hệ") { TroOiStateMessage(TroOiStateKind.EMPTY, "Chưa có yêu cầu liên hệ cho tin đăng này.") } }
                items(ui.inquiries, key = { "inquiry-" + it.id }) { entry ->
                    TroOiListRow(entry.message, entry.status, action = "Mở chi tiết →", modifier = Modifier.testTag("inquiry-" + entry.id), onClick = {
                        model.open(OperatorRoute.Inquiry(entry.id, route.listingId))
                    })
                }
            }
            is OperatorRoute.Inquiry -> {
                ui.inquiry?.takeIf { it.id == route.id && it.listingId == route.listingId }?.let { entry ->
                    item {
                        TroOiCard("Yêu cầu liên hệ") {
                            Text(entry.message)
                            TroOiButton("Nhắn tin", { onMessageContext("inquiry", entry.id) }, modifier = Modifier.testTag("operator-inquiry-message-context"))
                            TroOiInformationRow("Trạng thái", entry.status)
                            TroOiFeedback("Yêu cầu liên hệ không tự động giữ phòng hoặc tạo lượt thuê.")
                        }
                    }
                }
            }
        }
    }
    if (confirmationName != null && ui.route == OperatorRoute.Organizations) {
        val pendingName = confirmationName.orEmpty()
        TroOiActionDialog(
            onDismissRequest = { if (!ui.busy) { confirmationPassword = ""; confirmationName = null } },
            title = { Text("Xác nhận tạo khu trọ") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Nhập mật khẩu tài khoản TrọƠi hiện tại để tạo khu trọ “$pendingName”.")
                    TroOiFormField(
                        value = confirmationPassword,
                        onValueChange = { confirmationPassword = it },
                        label = { Text("Mật khẩu hiện tại") },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth().testTag("organization-confirm-password"),
                        singleLine = true,
                    )
                }
            },
            confirmButton = {
                TroOiButton("Xác nhận tạo", {
                    val password = confirmationPassword
                    confirmationPassword = ""
                    confirmationName = null
                    model.createOrganizationWithPassword(pendingName, password)
                }, enabled = !ui.busy && confirmationPassword.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().testTag("organization-confirm-create"))
            },
            dismissButton = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    TroOiButton("Hủy", {
                        confirmationPassword = ""
                        confirmationName = null
                    }, enabled = !ui.busy, style = TroOiButtonStyle.SECONDARY, modifier = Modifier.fillMaxWidth())
                    TroOiButton("Dùng Google", {
                        confirmationPassword = ""
                        confirmationName = null
                        model.createOrganizationWithGoogle(pendingName, context)
                    }, enabled = !ui.busy, style = TroOiButtonStyle.TERTIARY, modifier = Modifier.fillMaxWidth())
                }
            },
        )
    }
}

private fun operatorRentalEntry(route: OperatorRoute.Rentals): RentalRoute? = when (route.rentalSurface) {
    LedgerSurface.INCIDENT -> if (!route.focusId.isNullOrBlank()) {
        RentalRoute.Incident(route.focusId, route.roomId)
    } else {
        RentalRoute.Incidents(route.roomId)
    }
    LedgerSurface.FINANCE -> route.tenancyId?.let { tenancyId ->
        when (route.sourceType?.uppercase()) {
            "RECEIPT" -> RentalRoute.ReceiptDetail(tenancyId, route.focusId ?: return@let RentalRoute.Receipts(tenancyId))
            "PAYMENT" -> RentalRoute.Payment(tenancyId)
            "BILLING_CYCLE" -> RentalRoute.BillingDetail(tenancyId, route.focusId.orEmpty())
            "CHARGE" -> RentalRoute.BillingDetail(tenancyId, "", route.focusId)
            "DEPOSIT" -> RentalRoute.Deposit(tenancyId)
            else -> RentalRoute.Billing(tenancyId)
        }
    }
    LedgerSurface.TENANCY -> route.tenancyId?.let(RentalRoute::Tenancy)
    LedgerSurface.HISTORY -> route.tenancyId?.let(RentalRoute::History)
    else -> null
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
