package com.trooi.app.core.demo

import com.trooi.app.core.model.*

/**
 * UI-only data for debug builds. Production business data must come from the
 * Repository layer backed by the backend OpenAPI contract.
 */
object DemoData {
    val rooms = listOf(
        RoomUi(1, "Joy House · Ban công nội thất", "Phú Nhuận, TP.HCM", "18 Hoa Sứ, Phú Nhuận", 5_200_000, 5_200_000, "3.800đ/kWh", wifi = "Miễn phí", size = "28m²", distance = "1,2 km", type = "Ban công", amenities = listOf("Máy lạnh", "Giặt riêng", "Wifi", "Ban công"), verification = "Xác minh đầy đủ", score = 4.8, reviews = 128, photos = 12, scarcity = "Chỉ còn 2 phòng!", landlord = "Cô Mai", tenant = "Nguyễn Hoàng Nam", tenantPhone = "0901 234 567", rented = true),
        RoomUi(2, "Lina Studio · Cửa sổ lớn", "Quận 3, TP.HCM", "42 Võ Văn Tần, Quận 3", 4_600_000, 4_600_000, "3.800đ/kWh", wifi = "Miễn phí", size = "24m²", distance = "1,8 km", type = "Studio", amenities = listOf("Máy lạnh", "Bếp riêng", "Wifi", "Thang máy"), verification = "Đã xác minh", score = 4.8, reviews = 128, photos = 11, landlord = "Anh Long", tenant = "Trần Thu Trang", tenantPhone = "0988 765 432", debt = 1_500_000, rented = true),
        RoomUi(3, "An House · Gần Landmark 81", "Bình Thạnh, TP.HCM", "91 Nguyễn Hữu Cảnh, Bình Thạnh", 5_100_000, 5_100_000, "3.800đ/kWh", wifi = "Miễn phí", size = "26m²", distance = "2 km", type = "Nội thất cơ bản", amenities = listOf("Máy lạnh", "Tủ đồ", "Wifi", "Giữ xe"), verification = "Xác minh đầy đủ", score = 4.9, reviews = 210, photos = 10, landlord = "Chú Thành"),
        RoomUi(4, "Cozy Room · Thảo Điền", "TP. Thủ Đức, TP.HCM", "12 Quốc Hương, TP. Thủ Đức", 4_200_000, 4_200_000, "3.500đ/kWh", wifi = "Miễn phí", size = "22m²", distance = "2,6 km", type = "Gác lửng", amenities = listOf("Gác lửng", "Máy lạnh", "Wifi", "Tự do"), verification = "Đã xác minh", score = 4.7, reviews = 96, photos = 8, landlord = "Cô Hạnh", tenant = "Lê Văn Luyện", tenantPhone = "0912 333 444", rented = true),
        RoomUi(5, "Campus Nest · Gác lửng", "Gần Làng Đại học, TP. Thủ Đức", "6 Đường 621, Đông Hòa", 3_800_000, 3_800_000, "3.500đ/kWh", wifi = "100.000đ", size = "20m²", distance = "900 m", type = "Gác lửng", amenities = listOf("Gác lửng", "Bếp", "Wifi", "Giữ xe"), verification = "Chủ trọ đã xác minh", score = 4.6, reviews = 74, photos = 9, landlord = "Anh Phúc"),
        RoomUi(6, "Sora Home · Studio sáng", "Gần Khu Công nghệ cao", "28 D1, Tăng Nhơn Phú A", 4_900_000, 4_900_000, "3.700đ/kWh", wifi = "Miễn phí", size = "27m²", distance = "1,5 km", type = "Studio", amenities = listOf("Cửa sổ", "Máy lạnh", "Bếp", "Camera"), verification = "Xác minh đầy đủ", score = 4.9, reviews = 153, photos = 14, scarcity = "Còn 1 phòng", landlord = "Chị Vy"),
    )

    val bookings = listOf(
        BookingUi(1, 1, "25/07/2026", "10:30", BookingStatus.CONFIRMED),
        BookingUi(2, 2, "27/07/2026", "14:00", BookingStatus.PENDING),
    )

    val conversations = listOf(
        ConversationUi(1, 1, 1, "Cô Mai", listOf(
            ChatMessageUi(MessageFrom.TENANT, "Cô cho em xác nhận lịch xem phòng sáng thứ Bảy nhé."),
            ChatMessageUi(MessageFrom.LANDLORD, "Được em, cô đã xác nhận lịch 10:30."),
            ChatMessageUi(MessageFrom.SYSTEM, "Chủ trọ đã xác nhận lịch xem phòng."),
        )),
        ConversationUi(2, 2, 2, "Anh Long", listOf(
            ChatMessageUi(MessageFrom.TENANT, "Em muốn xem Lina Studio vào chiều 27/07 ạ."),
            ChatMessageUi(MessageFrom.LANDLORD, "Anh đã nhận yêu cầu, sẽ phản hồi lịch sớm nhé."),
        )),
    )

    val tickets = listOf(
        TicketUi("TK-0512", 2, "Rò rỉ ống nước bồn rửa", "Ưu tiên cao", "Đang chờ xử lý", "Tâm", listOf("Khách gửi báo cáo", "Chủ trọ phân công thợ", "Chờ nghiệm thu")),
        TicketUi("TK-0513", 4, "Đèn hành lang chập chờn", "Bình thường", "Đang chờ xử lý", "Hùng", listOf("Người thuê báo lỗi", "Đã xác nhận ảnh hiện trường")),
    )

    val finance = listOf(
        FinanceEntryUi(1, "Thu tiền Phòng 201", "Chuyển khoản Vietcombank", 5_200_000, true, "10:30 Hôm nay"),
        FinanceEntryUi(2, "Sửa ống nước", "Thanh toán thợ Tâm", 350_000, false, "Hôm qua"),
    )
}
