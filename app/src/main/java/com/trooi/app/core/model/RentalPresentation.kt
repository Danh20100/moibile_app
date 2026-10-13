package com.trooi.app.core.model

import java.math.BigDecimal
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

fun rentalMoney(value: String): String = runCatching {
    NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN")).apply {
        maximumFractionDigits = 2
    }.format(BigDecimal(value)) + " ₫"
}.getOrDefault(value)

fun rentalDate(value: String, includeTime: Boolean = false): String = runCatching {
    val pattern = if (includeTime) "HH:mm, dd/MM/yyyy" else "dd/MM/yyyy"
    val formatter = DateTimeFormatter.ofPattern(pattern, Locale.forLanguageTag("vi-VN"))
    if (value.length == 10) LocalDate.parse(value).format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
    else Instant.parse(value).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(formatter)
}.getOrDefault(value)

fun paymentSourceLabel(source: String): String = when (source) {
    "MANUAL_CASH" -> "Tiền mặt"
    "MANUAL_TRANSFER" -> "Chuyển khoản được người quản lý ghi nhận"
    "GATEWAY" -> "Qua cổng thanh toán"
    else -> "Nguồn thanh toán khác"
}

fun paymentVerificationLabel(verification: String): String = when (verification) {
    "PROVIDER_VERIFIED" -> "Cổng thanh toán đã xác nhận"
    "USER_RECORDED" -> "Người quản lý đã ghi nhận"
    else -> "Xem chi tiết xác nhận"
}

fun gatewayStatusLabel(status: String): String = when (status) {
    "INITIATED" -> "Đang tạo yêu cầu"
    "CREATED" -> "Chờ thanh toán"
    "UNKNOWN" -> "Đang chờ đối soát"
    "FAILED" -> "Thanh toán chưa hoàn tất"
    "SUCCEEDED" -> "Đã ghi nhận thanh toán"
    else -> "Đang kiểm tra trạng thái"
}

fun chargeTypeLabel(type: String): String = when (type) {
    "RENT" -> "Tiền thuê phòng"
    "ELECTRICITY" -> "Tiền điện"
    "WATER" -> "Tiền nước"
    else -> "Khoản phải thu"
}
