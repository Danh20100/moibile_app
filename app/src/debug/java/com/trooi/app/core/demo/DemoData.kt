package com.trooi.app.core.demo

import com.trooi.app.core.data.UserSession
import com.trooi.app.core.model.*
import com.trooi.app.features.discovery.ListingFixtures

/** Canonical debug-only graph. Seed history is never a runtime payment confirmation. */
object DemoData {
    const val ORGANIZATION = "e0080000-0000-4000-8000-000000000004"
    const val PROPERTY = "e0080000-0000-4000-8000-000000000005"
    const val ROOM = "e0080000-0000-4000-8000-000000000006"
    const val TENANCY = "e0080000-0000-4000-8000-000000000007"
    val accounts = listOf(
        UserSession("fixture-user-lan", "Nguyễn Ngọc Lan", AccessCapabilities(linkedTenancyIds = setOf(TENANCY))),
        UserSession("fixture-user-ha", "Trần Thu Hà", AccessCapabilities(operatedOrganizationIds = setOf(ORGANIZATION))),
        UserSession("fixture-user-linh", "Phạm Thảo Linh", AccessCapabilities()),
    )
    val ownerManagement = DemoRentalGraph.ownerSeed
    val occupiedAsset = DemoRentalGraph.occupied
    /** Shared seed dialogue references the same rental/listing and account identities as the ledger. */
    fun conversations(userId: String): List<ConversationCard> {
        val tenant = accounts[0]
        val owner = accounts[1]
        val other = when (userId) { tenant.userId -> owner; owner.userId -> tenant; else -> return emptyList() }
        val apartment = ListingFixtures.resolve("demo-studio")!!
        return listOf(
            ConversationCard("conversation-a02", other.userId, other.displayName, occupiedAsset.name, ROOM,
                occupiedAsset.photoResources.firstOrNull(), listOf(
                    ConversationMessage("a02-message-1", tenant.userId, "Chị Hà ơi, vòi nước bếp đang rò nhẹ. Chị xem giúp em nhé.", "2026-10-06T02:15:00Z"),
                    ConversationMessage("a02-message-2", owner.userId, "Chị đã tiếp nhận rồi. Chị hẹn thợ đến vào sáng 09/10, em sắp xếp giúp chị nhé.", "2026-10-07T08:30:00Z"),
                    ConversationMessage("a02-message-3", tenant.userId, "Dạ, sáng đó em ở nhà. Cảm ơn chị!", "2026-10-07T08:35:00Z"),
                )),
            ConversationCard("conversation-an-nhien", other.userId, other.displayName, apartment.card.title, DemoRentalGraph.AN_NHIEN,
                apartment.images.firstOrNull(), listOf(
                    ConversationMessage("an-message-1", tenant.userId, "Em muốn tìm hiểu thêm về ${apartment.card.title}, chị nhé.", "2026-05-20T03:00:00Z"),
                    ConversationMessage("an-message-2", owner.userId, "Căn hộ có bếp riêng và góc làm việc cạnh cửa sổ. Em muốn hỏi thêm về tiện ích nào?", "2026-05-20T03:12:00Z"),
                )),
        )
    }
    fun authenticate(identifier: String, password: String): UserSession? {
        if (password != "TroOi2026!") return null
        return when (identifier.trim().lowercase()) {
            "tenant@trooi.local" -> accounts[0]
            "owner@trooi.local" -> accounts[1]
            "onboarding@trooi.local" -> accounts[2]
            else -> null
        }
    }
    private val charges = listOf(
        ChargeCard("fixture-charge-rent-oct", "Tiền thuê tháng 10", "5.200.000đ", "5.200.000đ"),
        ChargeCard("fixture-charge-electricity-oct", "Điện · 86 kWh", "301.000đ", "301.000đ"),
        ChargeCard("fixture-charge-water-oct", "Nước · 5 m³", "100.000đ", "100.000đ"),
    )
    private val payments = listOf(PaymentCard("fixture-payment-sep", "5.560.000đ", "Chuyển khoản · 05/09/2026"))
    private val deposits = listOf(DepositCard(TENANCY, "5.200.000đ", "5.200.000đ", null,
        "fixture-deposit-lan", "5.200.000đ", "HELD"))
    val read = FrontendReadSnapshot(
        rentalHistory = listOf(RentalHistoryCard("fixture-tenancy-previous-lan", DemoRentalGraph.previous.id, DemoRentalGraph.previous.name, DemoRentalGraph.previous.publicArea, "03/2025 – 05/2026", "Đã kết thúc", DemoRentalGraph.previous.photoResources)),
        publicListings = DemoRentalGraph.all.filter { it.asset.listingStatus == ListingVisibility.PUBLISHED && !it.asset.occupied }
            .map { DemoRentalGraph.publicListing(it) },
        rentalAssetPresentationByRoom = mapOf(ROOM to RentalAssetPresentation("Căn hộ", "Phường 7, Phú Nhuận", ListingFixtures.resolve("demo-mini")!!.images)),
        organizations = listOf(OrganizationCard(ORGANIZATION, "Tài sản của Thu Hà")),
        properties = listOf(PropertyCard(PROPERTY, ORGANIZATION, "Nhà Phú Nhuận")),
        operationalRooms = listOf(OperationalRoomCard(ROOM, PROPERTY, "Căn hộ A02", RoomOperationalState.OCCUPIED, RecordLifecycle.ACTIVE)),
        operatorListings = listOf(OperatorListingCard("demo-mini", ROOM, "Căn hộ A02", ListingVisibility.UNPUBLISHED)),
        tenancies = listOf(TenancyCard(TENANCY, ROOM, "Căn hộ A02", TenancyLifecycle.ACTIVE, "5.200.000đ/tháng · 01/06/2026 – 31/05/2027", accounts[0].displayName)),
        tenantFinanceByTenancy = mapOf(TENANCY to TenantFinanceProjection(TENANCY, charges, payments, deposits)),
        operatorFinanceByOrganization = mapOf(ORGANIZATION to OperatorFinanceProjection(charges, payments, deposits = deposits)),
        operatorFinanceByRoom = mapOf(ROOM to OperatorFinanceProjection(charges, payments, deposits = deposits)),
        noticesByTenancy = mapOf(TENANCY to listOf(
            TenancyNoticeCard("fixture-notice-start", TENANCY, "RENTAL", "Bắt đầu thuê Căn hộ A02", "01/06/2026"),
            TenancyNoticeCard("fixture-notice-oct", TENANCY, "BILLING", "Ghi nhận điện, nước tháng 10", "01/10/2026"),
        )),
        incidents = listOf(IncidentCard("fixture-incident-tap", ROOM, "Vòi nước bếp rò nhẹ", IncidentLifecycle.IN_PROGRESS,
            listOf(IncidentEventCard("fixture-event-tap-1", "Đã tiếp nhận yêu cầu", "06/10/2026"),
                IncidentEventCard("fixture-event-tap-2", "Hẹn sửa vào sáng 09/10", "07/10/2026")))),
        dashboardByOrganization = mapOf(ORGANIZATION to DashboardReadModel(
            mapOf(RoomOperationalState.OCCUPIED to 1), 1, "5.601.000đ", "5.560.000đ", 1)),
    )
    fun authorizedRead(access: AccessCapabilities): FrontendReadSnapshot {
        val properties = read.properties.filter { it.organizationId in access.operatedOrganizationIds }
        val rooms = read.operationalRooms.filter { room -> properties.any { it.propertyId == room.propertyId } }
        val tenancies = read.tenancies.filter { it.tenancyId in access.linkedTenancyIds || rooms.any { room -> room.roomId == it.roomId } }
        return read.copy(
            rentalHistory = if (TENANCY in access.linkedTenancyIds) read.rentalHistory else emptyList(),
            rentalAssetPresentationByRoom = read.rentalAssetPresentationByRoom.filterKeys { id -> tenancies.any { it.roomId == id } },
            organizations = read.organizations.filter { it.organizationId in access.operatedOrganizationIds },
            properties = properties, operationalRooms = rooms,
            operatorListings = read.operatorListings.filter { listing -> rooms.any { it.roomId == listing.roomId } },
            tenancies = tenancies,
            tenantFinanceByTenancy = read.tenantFinanceByTenancy.filterKeys { it in access.linkedTenancyIds },
            noticesByTenancy = read.noticesByTenancy.filterKeys { id -> tenancies.any { it.tenancyId == id } },
            operatorFinanceByOrganization = read.operatorFinanceByOrganization.filterKeys { it in access.operatedOrganizationIds },
            operatorFinanceByRoom = read.operatorFinanceByRoom.filterKeys { id -> rooms.any { it.roomId == id } },
            incidents = read.incidents.filter { incident -> tenancies.any { it.roomId == incident.roomId } },
            dashboardByOrganization = read.dashboardByOrganization.filterKeys { it in access.operatedOrganizationIds },
        )
    }
}
