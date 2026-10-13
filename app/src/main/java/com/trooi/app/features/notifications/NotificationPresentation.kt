package com.trooi.app.features.notifications

import com.trooi.app.core.model.NotificationCard

fun notificationTitle(category: String): String = when (category) {
    "PAYMENT_CONFIRMED" -> "Đã ghi nhận thanh toán"
    "PAYMENT_DUE" -> "Có khoản cần thanh toán"
    "NEW_INCIDENT" -> "Có sự cố mới"
    "INCIDENT_STATUS_CHANGED" -> "Sự cố có cập nhật"
    "NEW_INQUIRY" -> "Có người quan tâm phòng"
    "MOVE_OUT" -> "Có yêu cầu trả phòng"
    "TENANCY_NOTICE" -> "Thông báo về lượt thuê"
    else -> "Thông báo mới"
}

fun notificationMessage(notification: NotificationCard): String {
    val text = notification.message.trim()
    val internalReference = Regex("^[A-Za-z_]+:[A-Za-z0-9_-]+$").matches(text)
    if (text.isNotBlank() && !internalReference && !text.startsWith("{")) return text
    return when (notification.category) {
        "PAYMENT_CONFIRMED" -> "Khoản thanh toán đã được ghi nhận. Mở chi tiết để kiểm tra số tiền và thời gian."
        "PAYMENT_DUE" -> "Khoản phải thu mới đã được cập nhật trong hồ sơ thuê của bạn."
        "NEW_INCIDENT" -> "Một sự cố vừa được báo. Mở chi tiết để xem nội dung."
        "INCIDENT_STATUS_CHANGED" -> "Tiến trình xử lý sự cố đã thay đổi. Mở chi tiết để xem cập nhật."
        "NEW_INQUIRY" -> "Bạn có liên hệ mới về phòng đang đăng."
        "MOVE_OUT" -> "Yêu cầu trả phòng đã được gửi để người quản lý xem xét."
        "TENANCY_NOTICE" -> "Bạn có thông báo mới liên quan đến lượt thuê."
        else -> "Bạn có cập nhật mới. Mở nội dung liên quan để xem chi tiết."
    }
}

fun notificationSourceLabel(sourceType: String?): String = when (sourceType) {
    "PAYMENT" -> "Xem thanh toán"
    "BILLING_CYCLE", "CHARGE" -> "Xem khoản phải thu"
    "INCIDENT", "INCIDENT_EVENT" -> "Xem sự cố"
    "TENANCY_NOTICE" -> "Xem thông báo thuê"
    "TENANCY" -> "Xem hồ sơ thuê"
    else -> "Xem nội dung liên quan"
}
