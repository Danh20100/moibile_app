package com.trooi.app.core.model

import org.junit.Assert.*
import org.junit.Test

class ContractBoundaryTest {
    private val access = AccessCapabilities(
        linkedTenancyIds = setOf("my-tenancy"),
        operatedOrganizationIds = setOf("my-org"),
    )

    @Test fun unauthorizedContextsAreNotNavigationTargets() {
        assertTrue(canOpenPage(AppPage.Discovery, false, AccessCapabilities()))
        assertFalse(canOpenPage(AppPage.OwnerFinance, true, AccessCapabilities()))
        assertFalse(canOpenPage(AppPage.TenantHome, true, AccessCapabilities()))
        assertFalse(canOpenPage(AppPage.OwnerDashboard, false, access))
        assertTrue(canOpenPage(AppPage.OwnerDashboard, true, access))
        assertTrue(canOpenPage(AppPage.TenantHome, true, access))
    }

    @Test fun scopedOwnerProjectionHidesOtherOrganizationsResources() {
        val source = FrontendReadSnapshot(
            properties = listOf(PropertyCard("my-property", "my-org", "Mine"), PropertyCard("foreign-property", "foreign-org", "Other")),
            operationalRooms = listOf(
                OperationalRoomCard("my-room", "my-property", "A", RoomOperationalState.VACANT, RecordLifecycle.ACTIVE),
                OperationalRoomCard("foreign-room", "foreign-property", "B", RoomOperationalState.OCCUPIED, RecordLifecycle.ACTIVE),
            ),
            operatorListings = listOf(
                OperatorListingCard("my-listing", "my-room", "Mine", ListingVisibility.DRAFT),
                OperatorListingCard("foreign-listing", "foreign-room", "Other", ListingVisibility.PUBLISHED),
            ),
            incidents = listOf(
                IncidentCard("my-incident", "my-room", "A", IncidentLifecycle.REPORTED, emptyList()),
                IncidentCard("foreign-incident", "foreign-room", "B", IncidentLifecycle.REPORTED, emptyList()),
            ),
        )
        assertEquals(listOf("my-property"), accessibleProperties(source, access).map { it.propertyId })
        assertEquals(listOf("my-room"), accessibleRooms(source, access).map { it.roomId })
        assertEquals(listOf("my-listing"), accessibleOperatorListings(source, access).map { it.listingId })
        assertEquals(listOf("my-incident"), accessibleIncidents(source, access).map { it.incidentId })
    }

    @Test fun chargesAfterPaymentsReduceOutstandingByConfirmedPayments() {
        val charges = listOf(ChargeCard("c1", "RENT", "5000.00", null))
        val payments = listOf(PaymentCard("p1", "2000.00", "ok"))
        assertEquals("3000.00", chargesAfterPayments(charges, payments).single().outstandingLabel)
        assertEquals(
            "0.00",
            chargesAfterPayments(charges, listOf(PaymentCard("p2", "5000.00", "ok"))).single().outstandingLabel,
        )
    }

    @Test fun financeAndDashboardAreScopedContainersNotCalculatedFromRooms() {
        val empty = FrontendReadSnapshot(
            operationalRooms = listOf(OperationalRoomCard("my-room", "my-property", "Mine", RoomOperationalState.OCCUPIED, RecordLifecycle.ACTIVE)),
        )
        assertTrue(empty.dashboardByOrganization.isEmpty())
        assertTrue(empty.operatorFinanceByOrganization.isEmpty())
        assertTrue(empty.tenantFinanceByTenancy.isEmpty())
    }
}
