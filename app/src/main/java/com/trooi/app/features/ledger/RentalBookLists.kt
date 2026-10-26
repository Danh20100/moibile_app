package com.trooi.app.features.ledger

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import com.trooi.app.core.model.*
import java.math.BigDecimal

internal fun LazyListScope.bookPeopleList(people: List<TenancyCard>, query: String, status: String,
    sourceReady: Boolean, onQuery: (String) -> Unit, onStatus: (String) -> Unit, onOpen: (String) -> Unit) {
    item { BookSearch(query, onQuery, "Tìm người thuê hoặc phòng") }
    item { BookFilters(status, listOf("all" to "Tất cả", "ACTIVE" to "Đang thuê", "ENDING" to "Sắp kết thúc", "DRAFT" to "Bản nháp"), onStatus) }
    val matching = people.filter { (status == "all" || it.lifecycle.name == status) &&
        (it.primaryTenantName.orEmpty().contains(query, true) || it.roomLabel.contains(query, true)) }
    item { BookHeading("Người đứng tên thuê", Icons.Rounded.People) }
    if (matching.isEmpty()) item { BookCard {
        BookEmpty(Icons.Rounded.People,
            when { !sourceReady -> "Dữ liệu người thuê chưa sẵn sàng"; people.isEmpty() -> "Chưa có người thuê"; else -> "Không tìm thấy người thuê" },
            if (people.isEmpty()) "Người đứng tên sẽ xuất hiện khi có lượt thuê trong phạm vi được cấp quyền." else "Thử tên khác hoặc chọn lại trạng thái.")
    } }
    items(matching, key = { it.tenancyId }) { person -> BookCard {
        BookRow(person.primaryTenantName ?: "Chưa có tên người đứng tên", "${person.roomLabel} · ${rentalLifecycleLabel(person.lifecycle)}",
            Icons.Rounded.Person) { onOpen(person.tenancyId) }
    } }
}

internal fun LazyListScope.bookIncidentList(incidents: List<IncidentCard>, rooms: List<OperationalRoomCard>, query: String,
    status: String, sourceReady: Boolean, onQuery: (String) -> Unit, onStatus: (String) -> Unit,
    onOpen: (String) -> Unit, onReport: (() -> Unit)?) {
    val closed = setOf(IncidentLifecycle.CLOSED, IncidentLifecycle.REJECTED)
    item { BookSummary("Tình trạng sự cố", Icons.Rounded.Build,
        "Đang mở" to if (sourceReady) incidents.count { it.lifecycle !in closed }.toString() else "Chưa tải đủ",
        "Đã kết thúc" to if (sourceReady) incidents.count { it.lifecycle in closed }.toString() else "Chưa tải đủ") }
    item { BookSearch(query, onQuery, "Tìm sự cố hoặc phòng") }
    item { BookFilters(status, listOf("all" to "Tất cả", "open" to "Đang mở", "closed" to "Đã kết thúc"), onStatus) }
    val matching = incidents.filter { issue ->
        (status == "all" || status == "open" && issue.lifecycle !in closed || status == "closed" && issue.lifecycle in closed) &&
            (issue.title.contains(query, true) || rooms.find { it.roomId == issue.roomId }?.label?.contains(query, true) == true)
    }
    item { BookHeading("Danh sách sự cố", Icons.Rounded.Handyman) }
    if (matching.isEmpty()) item { BookCard {
        BookEmpty(Icons.Rounded.Build,
            when { !sourceReady -> "Dữ liệu sự cố chưa sẵn sàng"; incidents.isEmpty() -> "Chưa có sự cố"; else -> "Không có kết quả phù hợp" },
            if (incidents.isEmpty()) "Các báo cáo và tiến độ xử lý sẽ được lưu tại đây." else "Thử đổi từ khóa hoặc bộ lọc.")
    } }
    items(matching, key = { it.incidentId }) { issue -> BookCard {
        BookRow(issue.title, "${rooms.find { it.roomId == issue.roomId }?.label.orEmpty()} · ${bookLabel(issue.lifecycle.name)}",
            Icons.Rounded.Build) { onOpen(issue.incidentId) }
    } }
    if (onReport != null) item { BookButton(onReport, Modifier.fillMaxWidth()) {
        Icon(Icons.Rounded.Add, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)); Text("Báo sự cố")
    } }
}

internal fun LazyListScope.bookListingList(listings: List<OperatorListingCard>, rooms: List<OperationalRoomCard>, query: String,
    status: String, sourceReady: Boolean, onQuery: (String) -> Unit, onStatus: (String) -> Unit, onOpen: (String) -> Unit) {
    item { BookSearch(query, onQuery, "Tìm tin đăng hoặc phòng") }
    item { BookFilters(status, listOf("all" to "Tất cả") + ListingVisibility.entries.map { it.name to bookLabel(it.name) }, onStatus) }
    val matching = listings.filter { listing -> (status == "all" || listing.visibility.name == status) &&
        (listing.title.contains(query, true) || rooms.find { it.roomId == listing.roomId }?.label?.contains(query, true) == true) }
    if (matching.isEmpty()) item { BookCard {
        BookHeading("Tin cho thuê", Icons.Rounded.Campaign)
        BookEmpty(Icons.Rounded.Campaign,
            when { !sourceReady -> "Dữ liệu tin đăng chưa sẵn sàng"; listings.isEmpty() -> "Chưa có tin đăng"; else -> "Không tìm thấy tin đăng" },
            if (listings.isEmpty()) "Tin cho thuê được cấp quyền quản lý sẽ xuất hiện tại đây." else "Thử đổi từ khóa hoặc trạng thái.")
    } }
    items(matching, key = { it.listingId }) { listing -> BookCard {
        BookIllustration(Icons.Rounded.Apartment)
        BookRow(listing.title, "${rooms.find { it.roomId == listing.roomId }?.label.orEmpty()} · ${bookLabel(listing.visibility.name)}",
            Icons.Rounded.Campaign) { onOpen(listing.listingId) }
    } }
}

internal fun LazyListScope.bookReceiptList(receipts: List<ReceiptCard>, query: String, onQuery: (String) -> Unit,
    loading: Boolean, unavailable: Boolean, onOpen: (String) -> Unit) {
    item { BookSearch(query, onQuery, "Tìm mã hoặc ngày phát hành") }
    val matching = receipts.filter { it.receiptId.contains(query, true) || it.issuedAtLabel.contains(query, true) }
    item { BookCard {
        BookHeading("Danh sách biên nhận", Icons.Rounded.ReceiptLong)
        Text(if (loading || unavailable) "Đang kiểm tra chứng từ trong phạm vi đang xem" else "${receipts.size} chứng từ trong phạm vi đang xem",
            style = MaterialTheme.typography.bodySmall)
        if (matching.isEmpty()) BookEmpty(Icons.Rounded.ReceiptLong,
            when { unavailable -> "Chưa tải đủ biên nhận"; loading -> "Đang tải biên nhận"; receipts.isEmpty() -> "Chưa có biên nhận"; else -> "Không tìm thấy biên nhận" },
            when { unavailable -> "Dữ liệu chưa đầy đủ. Hãy tải lại trước khi đối chiếu."; loading -> "Đang kiểm tra chứng từ của lượt thuê.";
                receipts.isEmpty() -> "Chứng từ thanh toán đã phát hành sẽ được lưu tại đây."; else -> "Thử tìm theo mã hoặc ngày khác." })
        Text("Mở chứng từ để xem trạng thái, số tiền và thanh toán liên quan.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    } }
    items(matching, key = { it.receiptId }) { receipt -> BookCard {
        BookRow("Biên nhận ${receipt.receiptId.takeLast(8)}", "Ngày phát hành ${receipt.issuedAtLabel}", Icons.Rounded.ReceiptLong) {
            onOpen(receipt.receiptId)
        }
    } }
}

internal fun LazyListScope.bookRentList(cycles: List<JsonObject>?, tenancies: List<TenancyCard>, owner: Boolean,
    query: String, status: String, onQuery: (String) -> Unit, onStatus: (String) -> Unit,
    unavailable: Boolean, onOpen: (String) -> Unit, onRetry: () -> Unit) {
    val amounts = cycles?.map(::dueValue)
    val complete = !unavailable && amounts != null && amounts.none { it == null }
    item { BookCard {
        BookHeading(if (owner) "Tổng còn phải thu" else "Khoản cần thanh toán", Icons.Rounded.AccountBalanceWallet)
        Text(if (complete) moneyDisplay(amounts.orEmpty().filterNotNull().fold(BigDecimal.ZERO, BigDecimal::add).toPlainString())
            else if (unavailable) "Chưa tải đủ dữ liệu" else "Đang tải kỳ thu",
            style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        Text("Số tiền còn phải thu sau phân bổ thanh toán.", style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    } }
    item { BookSearch(query, onQuery, "Tìm phòng hoặc kỳ thu") }
    item { BookFilters(status, listOf("all" to "Tất cả", "due" to "Còn phải thu", "settled" to "Đã phân bổ đủ"), onStatus) }
    val matching = cycles.orEmpty().filter { cycle ->
        val room = tenancies.find { it.tenancyId == cycle.field("tenancyId") }?.roomLabel.orEmpty()
        val due = dueValue(cycle)
        (status == "all" || status == "due" && due?.signum() == 1 || status == "settled" && due?.signum() == 0) &&
            (room.contains(query, true) || cycle.field("periodStart").orEmpty().contains(query, true))
    }.sortedByDescending { it.field("periodStart") }
    item { BookHeading("Các kỳ thu", Icons.Rounded.CalendarMonth) }
    if (matching.isEmpty()) item { BookCard {
        BookEmpty(Icons.Rounded.AccountBalanceWallet,
            when { unavailable -> "Không thể đối chiếu kỳ thu"; cycles == null -> "Đang tải kỳ thu";
                cycles.isEmpty() -> "Chưa có kỳ thu"; else -> "Không có kỳ thu phù hợp" },
            when { unavailable -> "Dữ liệu kỳ thu chưa đầy đủ cho lượt thuê đang xem."; cycles == null -> "Các kỳ thu sẽ xuất hiện sau khi tải xong.";
                cycles.isEmpty() -> "Kỳ thu mới sẽ được hiển thị tại đây khi phát sinh."; else -> "Thử đổi từ khóa hoặc bộ lọc." })
        if (unavailable) BookOutlinedButton(onRetry, Modifier.fillMaxWidth()) { Text("Tải lại dữ liệu") }
    } }
    items(matching, key = { it.field("id").orEmpty() }) { cycle -> BookCard {
        val tenancy = tenancies.find { it.tenancyId == cycle.field("tenancyId") }
        BookRow(tenancy?.roomLabel ?: "Kỳ thu", "${cycle.field("periodStart").orEmpty()} đến ${cycle.field("periodEnd").orEmpty()} · Còn ${moneyDisplay(dueValue(cycle)?.toPlainString())}",
            Icons.Rounded.Payments) { onOpen(cycle.field("id").orEmpty()) }
    } }
}
