package com.trooi.app.core.demo

import com.trooi.app.core.model.*

/** Screen-preview fixtures exist only in src/debug. They never claim backend confirmation. */
object DemoData {
    val read = FrontendReadSnapshot(
        publicListings = listOf(
            PublicListingCard(
                listingId = "preview-listing-a",
                title = "Căn phòng có ban công",
                publicAreaLabel = "Khu vực Phú Nhuận, TP.HCM",
                publicGeoPoint = null,
                askingPriceLabel = "5,2 triệu/tháng",
                visibility = ListingVisibility.PUBLISHED,
                amenities = listOf("Ban công", "Máy lạnh", "Wifi"),
            ),
            PublicListingCard(
                listingId = "preview-listing-b",
                title = "Studio thoáng sáng",
                publicAreaLabel = "Khu vực Quận 3, TP.HCM",
                publicGeoPoint = null,
                askingPriceLabel = "4,6 triệu/tháng",
                visibility = ListingVisibility.PUBLISHED,
                amenities = listOf("Bếp riêng", "Thang máy", "Wifi"),
            ),
            PublicListingCard(
                listingId = "preview-draft",
                title = "Tin đăng chưa công khai",
                publicAreaLabel = "Chỉ cho người vận hành",
                publicGeoPoint = null,
                askingPriceLabel = null,
                visibility = ListingVisibility.DRAFT,
            ),
        ),
        organizations = listOf(OrganizationCard("demo-organization-1", "Không gian vận hành minh hoạ")),
        properties = listOf(PropertyCard("preview-property-1", "demo-organization-1", "Tòa nhà minh họa")),
        operationalRooms = listOf(
            OperationalRoomCard("preview-room-a", "preview-property-1", "Phòng A01", RoomOperationalState.VACANT, RecordLifecycle.ACTIVE),
            OperationalRoomCard("preview-room-b", "preview-property-1", "Phòng A02", RoomOperationalState.OCCUPIED, RecordLifecycle.ACTIVE),
        ),
        operatorListings = listOf(OperatorListingCard("demo-listing-owner", "preview-room-a", "Tin đăng minh họa", ListingVisibility.DRAFT)),
        tenancies = listOf(TenancyCard("demo-tenancy-1", "Phòng A02", TenancyLifecycle.ACTIVE, "Phiên bản minh họa")),
        incidents = listOf(
            IncidentCard(
                incidentId = "preview-incident-1",
                roomId = "preview-room-b",
                title = "Minh họa sự cố thiết bị",
                lifecycle = IncidentLifecycle.REPORTED,
                timeline = listOf(IncidentEventCard("preview-event-1", "Tiếp nhận mô tả sự cố", "Ví dụ")),
                serverActions = emptyList(),
            ),
        ),
        dashboardByOrganization = mapOf("demo-organization-1" to DashboardReadModel(
            roomsByState = mapOf(RoomOperationalState.VACANT to 1, RoomOperationalState.OCCUPIED to 1),
            activeTenancyCount = 1,
            outstandingReceivableLabel = null,
            confirmedPaymentTotalLabel = null,
            openIncidentCount = 1,
        )),
    )
}
