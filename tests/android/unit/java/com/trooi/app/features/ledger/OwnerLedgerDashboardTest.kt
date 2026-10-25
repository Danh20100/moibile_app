package com.trooi.app.features.ledger

import com.trooi.app.core.model.*
import org.junit.Assert.*
import org.junit.Test

class OwnerLedgerDashboardTest {
    private val owned = AccessCapabilities(operatedOrganizationIds = setOf("org-a"))
    private val room = OperationalRoomCard("room-a", "prop-a", "Phòng 101",
        RoomOperationalState.OCCUPIED, RecordLifecycle.ACTIVE)
    private val anotherRoom = OperationalRoomCard("room-b", "prop-b", "Phòng 102",
        RoomOperationalState.VACANT, RecordLifecycle.ACTIVE)

    private fun owner(read: FrontendReadSnapshot = FrontendReadSnapshot()) = TroOiUiState(
        isAuthenticated = true, access = owned, read = read,
    )
    private fun scoped(vararg rooms: OperationalRoomCard) = FrontendReadSnapshot(
        properties = listOf(
            PropertyCard("prop-a", "org-a", "Dãy A"),
            PropertyCard("prop-b", "org-b", "Dãy B"),
        ),
        operationalRooms = rooms.toList(),
    )

    @Test fun newOwnerAlwaysHasSixZeroValueCategoriesNotInventedTasks() {
        val result = summarizeOwnerHome(owner())
        assertEquals(0, result.roomCount)
        assertEquals(0, result.tenantCount)
        assertEquals(0, result.chargeCount)
        assertEquals(0, result.incidentCount)
        assertEquals(0, result.listingCount)
        assertEquals(0, result.receiptCount)
        assertTrue(result.pending.isEmpty())
        assertEquals(6, OwnerSection.entries.size)
    }

    @Test fun unrelatedOrganizationsCannotInflateHomeTotals() {
        val read = scoped(room, anotherRoom).copy(
            operatorFinanceByOrganization = mapOf("org-b" to OperatorFinanceProjection(
                charges = listOf(ChargeCard("c2", "Khoản của tổ chức khác", "100000", "100000")))),
            incidents = listOf(IncidentCard("i2", "room-b", "Báo lỗi", IncidentLifecycle.REPORTED, emptyList())),
            operatorListings = listOf(OperatorListingCard("l2", "room-b", "Tin của người khác", ListingVisibility.PUBLISHED)),
        )
        val result = summarizeOwnerHome(owner(read))
        assertEquals(1, result.roomCount)
        assertEquals(0, result.chargeCount)
        assertEquals(0, result.incidentCount)
        assertEquals(0, result.listingCount)
        assertTrue(result.pending.isEmpty())
    }

    @Test fun outstandingFinanceIsAReviewTaskButNeverClaimsOverdue() {
        val finance = OperatorFinanceProjection(charges = listOf(
            ChargeCard("c1", "Tiền phòng 101", "2500000", "2500000đ"),
            ChargeCard("c2", "Khoản đã thu hết", "100000", "0đ"),
            ChargeCard("c3", "Chưa có phân bổ", "120000", null),
        ))
        val result = summarizeOwnerHome(owner(scoped(room).copy(
            operatorFinanceByOrganization = mapOf("org-a" to finance))))
        assertEquals(3, result.chargeCount)
        assertEquals(1, result.pending.size)
        assertEquals(AttentionType.CHARGE, result.pending.single().type)
        assertFalse(result.pending.single().title.contains("quá hạn", ignoreCase = true))
    }

    @Test fun onlyOpenIncidentsRequireAttention() {
        val incidents = listOf(
            IncidentCard("i1", "room-a", "Hỏng đèn", IncidentLifecycle.REPORTED, emptyList()),
            IncidentCard("i2", "room-a", "Đã xử lý", IncidentLifecycle.RESOLVED, emptyList()),
        )
        val result = summarizeOwnerHome(owner(scoped(room).copy(incidents = incidents)))
        assertEquals(1, result.incidentCount)
        assertEquals(1, result.pending.size)
        assertTrue(result.pending.single().title.contains("Phòng 101"))
    }

    @Test fun displayedTenantsListingsAndReceiptsRemainScoped() {
        val read = scoped(room, anotherRoom).copy(
            tenancies = listOf(
                TenancyCard("t1", "room-a", "Phòng 101", TenancyLifecycle.ACTIVE, null, "Lan"),
                TenancyCard("t2", "room-b", "Phòng 102", TenancyLifecycle.ACTIVE, null, "Khác"),
            ),
            operatorListings = listOf(OperatorListingCard("l1", "room-a", "Tin A", ListingVisibility.PUBLISHED)),
            operatorFinanceByOrganization = mapOf("org-a" to OperatorFinanceProjection(
                receipts = listOf(ReceiptCard("r1", "payment-1", "2026-10-25")))),
        )
        val result = summarizeOwnerHome(owner(read))
        assertEquals(1, result.tenantCount)
        assertEquals(1, result.listingCount)
        assertEquals(1, result.receiptCount)
    }
}
