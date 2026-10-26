package com.trooi.app.features.ledger

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import com.trooi.app.core.model.*

@Composable
internal fun BookRoomIdentity(room: OperationalRoomCard?, property: String?) {
    BookCard {
        BookIllustration(Icons.Rounded.MeetingRoom)
        BookHeading(room?.label ?: "Phòng không khả dụng", Icons.Rounded.MeetingRoom)
        BookPair("Tài sản", property)
        BookPair("Trạng thái phòng", room?.operationalState?.name?.let(::bookLabel))
        BookPair("Trạng thái hồ sơ", room?.lifecycle?.name?.let(::bookLabel))
    }
}

@Composable
internal fun BookPersonIdentity(tenancy: TenancyCard?) {
    BookCard {
        Icon(Icons.Rounded.AccountCircle, null, Modifier.align(Alignment.CenterHorizontally).size(52.dp),
            tint = MaterialTheme.colorScheme.primary)
        BookHeading(tenancy?.primaryTenantName ?: "Người đứng tên chưa có tên hiển thị")
        BookPair("Phòng", tenancy?.roomLabel)
        BookPair("Trạng thái", tenancy?.lifecycle?.let(::rentalLifecycleLabel))
        BookPair("Điều khoản", tenancy?.termsVersionLabel)
    }
}

@Composable
internal fun BookListingIdentity(detail: JsonObject?) {
    BookCard {
        BookIllustration(Icons.Rounded.Apartment)
        BookHeading(detail?.field("publicTitle") ?: "Đang tải tin đăng", Icons.Rounded.Campaign)
        Text(moneyDisplay(detail?.field("publicPriceProjection")) + "/tháng",
            style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        BookPair("Trạng thái", detail?.field("status")?.let(::bookLabel))
        Text(detail?.field("publicDescription") ?: "Chưa tải nội dung", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
internal fun BookIncidentIdentity(detail: JsonObject?, room: String?) {
    BookCard {
        BookHeading("Thông tin sự cố", Icons.Rounded.Build)
        BookPair("Phòng", room)
        BookPair("Loại sự cố", detail?.field("category")?.let(::bookLabel))
        BookPair("Trạng thái", detail?.field("status")?.let(::bookLabel))
        BookPair("Thời gian báo", detail?.field("createdAt"))
        detail?.field("closureReason")?.let { BookPair("Lý do kết thúc", it) }
    }
}

@Composable
internal fun BookReceiptIdentity(detail: JsonObject?, payment: JsonObject?) {
    BookCard {
        BookIllustration(Icons.Rounded.ReceiptLong)
        BookHeading("Chứng từ thanh toán", Icons.Rounded.ReceiptLong)
        Text(detail?.field("status")?.let(::bookLabel) ?: "Đang tải biên nhận", color = MaterialTheme.colorScheme.primary)
        Text(moneyDisplay(payment?.field("amount")), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        HorizontalDivider()
        BookPair("Mã biên nhận", detail?.field("id"))
        BookPair("Ngày phát hành", detail?.field("issuedAt"))
        detail?.field("voidedAt")?.let { BookPair("Ngày hủy", it) }
        BookPair("Thanh toán liên quan", detail?.field("paymentId"))
        BookPair("Nguồn thanh toán", payment?.field("source")?.let(::bookLabel))
        detail?.field("replacementReceiptId")?.let { BookPair("Biên nhận thay thế", it) }
    }
}

@Composable
internal fun BookCycleIdentity(detail: JsonObject?) {
    BookCard {
        BookHeading("Còn phải thu", Icons.Rounded.AccountBalanceWallet)
        Text(moneyDisplay(detail?.let(::dueValue)?.toPlainString()), style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        HorizontalDivider()
        BookPair("Bắt đầu", detail?.field("periodStart"))
        BookPair("Kết thúc", detail?.field("periodEnd"))
        BookPair("Hạn thu", detail?.field("dueDate"))
        BookPair("Điều khoản áp dụng", detail?.field("tenancyTermsId"))
    }
}

@Composable
internal fun BookChargeIdentity(charge: JsonObject?, cycleId: String) {
    BookCard {
        BookHeading("Chi tiết khoản thu", Icons.Rounded.Payments)
        BookPair("Loại khoản", charge?.field("type")?.let(::bookLabel))
        BookPair("Số tiền phải thu", moneyDisplay(charge?.field("amount")))
        BookPair("Còn phải thu", moneyDisplay(charge?.field("outstandingAmount")))
        BookPair("Kỳ tính tiền", cycleId)
    }
}

@Composable
internal fun BookPaymentIdentity(detail: JsonObject?) {
    BookCard {
        BookHeading("Thanh toán đã xác nhận", Icons.Rounded.Payments)
        Text(moneyDisplay(detail?.field("amount")), style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        HorizontalDivider()
        BookPair("Nguồn", detail?.field("source")?.let(::bookLabel))
        BookPair("Xác minh", detail?.field("verification")?.let(::bookLabel))
        BookPair("Ngày xác nhận", detail?.field("confirmedAt"))
    }
}
