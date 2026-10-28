package com.trooi.app.features.ledger

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import com.trooi.app.core.model.*
import com.trooi.app.features.tenancy.validGatewayAmount
import com.trooi.app.ui.components.TroOiFormField
import java.math.BigDecimal
import java.time.LocalDate

@Composable
internal fun OwnerBookOverview(
    state: TroOiUiState,
    cycles: List<JsonObject>?,
    cycleError: Boolean,
    propertyId: String,
    onProperty: (String) -> Unit,
    onOpen: (BookDestination) -> Unit,
) {
    val properties = accessibleProperties(state.read, state.access)
    val rooms = accessibleRooms(state.read, state.access)
    val roomIds = rooms.filter { propertyId.isBlank() || it.propertyId == propertyId }.map { it.roomId }.toSet()
    val scoped = cycles?.filter { cycle -> state.read.tenancies.any { it.tenancyId == cycle.field("tenancyId") && it.roomId in roomIds } }
    val incomplete = state.runtimeLoading || state.authorizedReadFailed || state.read.recoverableReadErrors.isNotEmpty()
    val dashboards = state.read.dashboardByOrganization.filterKeys { it in state.access.operatedOrganizationIds }.values
    val financeSources = if (propertyId.isBlank()) {
        state.read.operatorFinanceByOrganization.filterKeys { it in state.access.operatedOrganizationIds }
            .takeIf { it.keys.containsAll(state.access.operatedOrganizationIds) }?.values
    } else {
        state.read.operatorFinanceByRoom.filterKeys { it in roomIds }
            .takeIf { it.keys.containsAll(roomIds) && roomIds.isNotEmpty() }?.values
    }
    val verifiedNoPayments = !incomplete && financeSources != null && financeSources.all { it.confirmedPayments.isEmpty() }
    val totalPaid = if (verifiedNoPayments) "0" else if (!incomplete && propertyId.isBlank() && dashboards.size == 1)
        dashboards.first().confirmedPaymentTotalLabel else null
    val totalDue = if (!incomplete && propertyId.isBlank() && dashboards.size == 1)
        dashboards.first().outstandingReceivableLabel else null
    val amounts = scoped?.map(::dueValue)
    val sourceComplete = !incomplete && !cycleError && amounts != null && amounts.none { it == null }
    val scopedDue = if (sourceComplete) amounts.orEmpty().filterNotNull().fold(BigDecimal.ZERO, BigDecimal::add) else null
    val datesComplete = scoped.orEmpty().all { cycle ->
        dueValue(cycle)?.signum() == 0 || cycle.field("dueDate")?.let { runCatching { LocalDate.parse(it) }.isSuccess } == true
    }
    val overdue = if (sourceComplete && datesComplete) scoped.orEmpty().filter {
        it.field("dueDate")?.let { date -> runCatching { LocalDate.parse(date).isBefore(LocalDate.now()) }.getOrDefault(false) } == true
    }.fold(BigDecimal.ZERO) { sum, cycle -> sum + (dueValue(cycle) ?: BigDecimal.ZERO) } else null
    val due = scoped.orEmpty().filter { (dueValue(it)?.signum() ?: 0) > 0 }.sortedBy { it.field("dueDate") }
    val issues = accessibleIncidents(state.read, state.access).filter {
        it.roomId in roomIds && it.lifecycle !in setOf(IncidentLifecycle.CLOSED, IncidentLifecycle.REJECTED)
    }
    BookSelect("Tất cả tài sản", propertyId,
        listOf("" to "Tất cả tài sản") + properties.map { it.propertyId to it.displayName }, onProperty)
    BookCard {
        BookHeading("Tổng quan tài chính", Icons.Rounded.BarChart)
        BookStat("Đã thu", moneyDisplay(totalPaid))
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            BookStat("Chưa thu", moneyDisplay(totalDue ?: scopedDue?.toPlainString()), Modifier.weight(1f))
            BookStat("Trong đó quá hạn", moneyDisplay(overdue?.toPlainString()), Modifier.weight(1f))
        }
        if (totalPaid == null) Text("Tổng tiền đã nhận chưa có dữ liệu đối chiếu cho phạm vi này.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    BookCard {
        BookHeading("Cần thu tiền", Icons.Rounded.AccountBalanceWallet)
        if (due.isEmpty()) {
            BookEmpty(Icons.Rounded.AccountBalanceWallet,
                if (!sourceComplete) "Đang chờ dữ liệu kỳ thu" else "Chưa có khoản cần thu",
                if (!sourceComplete) "Mở tiền thuê để kiểm tra tình trạng tải dữ liệu." else "Các kỳ thu trong phạm vi này không còn khoản phải thu.")
        } else due.take(3).forEach { cycle ->
            val tenancy = state.read.tenancies.find { it.tenancyId == cycle.field("tenancyId") }
            BookRow(tenancy?.primaryTenantName ?: tenancy?.roomLabel ?: "Kỳ thu",
                "${tenancy?.roomLabel.orEmpty()} · ${cycle.field("periodStart").orEmpty()} · Còn ${moneyDisplay(dueValue(cycle)?.toPlainString())}",
                Icons.Rounded.Payments) { onOpen(BookDestination("cycle-detail", cycle.field("id").orEmpty())) }
        }
        BookOutlinedButton({ onOpen(BookDestination("rent")) }, Modifier.fillMaxWidth()) { Text("Xem tiền thuê") }
    }
    BookCard {
        BookHeading("Cần xử lý", Icons.Rounded.Build)
        if (issues.isEmpty()) BookEmpty(Icons.Rounded.Build,
            if (incomplete) "Chưa tải đủ sự cố" else "Không có sự cố cần xử lý",
            if (incomplete) "Tải lại để kiểm tra tình trạng báo cáo." else "Các báo cáo mới sẽ xuất hiện tại đây.")
        else issues.take(2).forEach { issue ->
            BookRow(issue.title, bookLabel(issue.lifecycle.name), Icons.Rounded.Build) {
                onOpen(BookDestination("incident-detail", issue.incidentId))
            }
        }
        BookOutlinedButton({ onOpen(BookDestination("incidents")) }, Modifier.fillMaxWidth()) { Text("Xem sự cố") }
    }
    BookHeading("Quản lý của tôi", Icons.Rounded.GridView)
    BookTiles(listOf(
        Triple("Tài sản", Icons.Rounded.Apartment, { onOpen(BookDestination("assets")) }),
        Triple("Người thuê", Icons.Rounded.People, { onOpen(BookDestination("people")) }),
        Triple("Tiền thuê", Icons.Rounded.Payments, { onOpen(BookDestination("rent")) }),
        Triple("Sự cố", Icons.Rounded.Build, { onOpen(BookDestination("incidents")) }),
        Triple("Tin đăng", Icons.Rounded.Campaign, { onOpen(BookDestination("listings")) }),
        Triple("Biên nhận", Icons.Rounded.ReceiptLong, { onOpen(BookDestination("receipts")) }),
    ))
}

@Composable
internal fun TenantBookOverview(
    state: TroOiUiState,
    tenancies: List<TenancyCard>,
    onOpen: (BookDestination) -> Unit,
    onJoin: () -> Unit,
) {
    val linked = tenancies.filter { it.lifecycle in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING) }
    if (linked.isEmpty()) {
        if (state.runtimeLoading || state.access.linkedTenancyIds.isNotEmpty()) {
            BookCard {
                BookHeading("Phòng thuê của tôi", Icons.Rounded.Home)
                Text(if (state.runtimeLoading) "Đang tải phòng thuê…" else "Chưa tải được phòng đã liên kết.")
            }
            return
        }
        BookCard {
            BookHeading("Phòng thuê của tôi", Icons.Rounded.Home)
            BookEmpty(Icons.Rounded.MenuBook, "Chưa liên kết phòng",
                "Nhận link hoặc mã QR từ chủ trọ để xem phòng, tiền thuê và các báo cáo của bạn.")
            BookPair("1. Nhận lời mời", "Chủ trọ gửi link hoặc QR của phòng đang thuê")
            BookPair("2. Kiểm tra phòng", "Xem trước thông tin trước khi xác nhận")
            BookButton(onJoin, Modifier.fillMaxWidth()) { Text("Mở link / Quét QR / Nhập mã") }
        }
        return
    }
    BookHeading("Phòng đang thuê", Icons.Rounded.Home)
    linked.forEach { tenancy ->
        BookCard {
            BookRow(tenancy.roomLabel, rentalLifecycleLabel(tenancy.lifecycle), Icons.Rounded.MeetingRoom) {
                onOpen(BookDestination("room-detail", tenancy.roomId))
            }
            BookPair("Người đứng tên", tenancy.primaryTenantName)
            BookPair("Điều khoản", tenancy.termsVersionLabel)
        }
    }
    BookCard {
        BookHeading("Khoản cần thanh toán", Icons.Rounded.Payments)
        linked.forEach { tenancy ->
            val finance = state.read.tenantFinanceByTenancy[tenancy.tenancyId]
            BookRow(tenancy.roomLabel, finance?.charges?.takeIf { it.isNotEmpty() }?.joinToString(" · ") {
                "${it.label}: ${it.outstandingLabel ?: "Chưa đối chiếu"}"
            } ?: if (finance != null && !state.authorizedReadFailed && state.read.recoverableReadErrors.isEmpty())
                "Chưa có khoản thu" else "Chưa tải đủ dữ liệu thanh toán", Icons.Rounded.AccountBalanceWallet) {
                onOpen(BookDestination("rent", tenancy.tenancyId))
            }
        }
    }
    BookCard {
        BookHeading("Theo dõi phòng thuê", Icons.Rounded.MenuBook)
        BookRow("Biên nhận", "Chứng từ gắn với thanh toán", Icons.Rounded.ReceiptLong) { onOpen(BookDestination("receipts")) }
        BookRow("Sự cố", "Báo và theo dõi tiến độ xử lý", Icons.Rounded.Build) { onOpen(BookDestination("incidents")) }
        BookRow("Lịch sử thuê", "Các lượt thuê được cấp quyền", Icons.Rounded.History) { onOpen(BookDestination("rental-history")) }
    }
    BookOutlinedButton(onJoin, Modifier.fillMaxWidth()) { Text("Liên kết phòng khác") }
}

@Composable
internal fun TenantPayQr(
    amount: String,
    onAmount: (String) -> Unit,
    busy: Boolean,
    onCreate: () -> Unit,
) {
    val payable = validGatewayAmount(amount.removeSuffix(".00") + ".00")
    TroOiFormField(
        value = amount,
        onValueChange = { value -> if (value.length <= 8 && value.all(Char::isDigit)) onAmount(value) },
        label = { Text("Số tiền (đồng)") },
        supportingText = { Text("Từ 1.000 đến 50.000.000 đồng, không nhập phần lẻ.") },
        singleLine = true,
        enabled = !busy,
        modifier = Modifier.fillMaxWidth(),
    )
    BookButton(onCreate, Modifier.fillMaxWidth(), enabled = !busy && payable) { Text("Tạo QR thanh toán") }
    Text(
        "Mở trang thanh toán chưa có nghĩa là đã trả tiền.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
