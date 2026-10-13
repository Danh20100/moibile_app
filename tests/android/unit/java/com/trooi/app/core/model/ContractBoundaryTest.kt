package com.trooi.app.core.model

import com.trooi.app.support.JsonFixtures
import org.junit.Assert.*
import org.junit.Test

class ContractBoundaryTest {
    private val fixture = JsonFixtures.load("model/contract-boundary")
    private fun value(key: String) = fixture.get(key).asString
    private val access = AccessCapabilities(
        linkedTenancyIds = setOf(value("tenancyId")),
        operatedOrganizationIds = setOf(value("organizationId")),
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
            properties = listOf(PropertyCard(value("propertyId"), value("organizationId"), value("ownName")), PropertyCard(value("foreignPropertyId"), value("foreignOrganizationId"), value("foreignName"))),
            operationalRooms = listOf(
                OperationalRoomCard(value("roomId"), value("propertyId"), value("ownRoomLabel"), RoomOperationalState.VACANT, RecordLifecycle.ACTIVE),
                OperationalRoomCard(value("foreignRoomId"), value("foreignPropertyId"), value("foreignRoomLabel"), RoomOperationalState.OCCUPIED, RecordLifecycle.ACTIVE),
            ),
            operatorListings = listOf(
                OperatorListingCard(value("listingId"), value("roomId"), value("ownName"), ListingVisibility.DRAFT),
                OperatorListingCard(value("foreignListingId"), value("foreignRoomId"), value("foreignName"), ListingVisibility.PUBLISHED),
            ),
            incidents = listOf(
                IncidentCard(value("incidentId"), value("roomId"), value("ownRoomLabel"), IncidentLifecycle.REPORTED, emptyList()),
                IncidentCard(value("foreignIncidentId"), value("foreignRoomId"), value("foreignRoomLabel"), IncidentLifecycle.REPORTED, emptyList()),
            ),
        )
        assertEquals(listOf(value("propertyId")), accessibleProperties(source, access).map { it.propertyId })
        assertEquals(listOf(value("roomId")), accessibleRooms(source, access).map { it.roomId })
        assertEquals(listOf(value("listingId")), accessibleOperatorListings(source, access).map { it.listingId })
        assertEquals(listOf(value("incidentId")), accessibleIncidents(source, access).map { it.incidentId })
    }

    @Test fun outstandingStaysOnTheChargeWhenPaymentsAreUnallocated() {
        val charge = ChargeCard(value("chargeId"), value("chargeType"), value("chargeAmount"), value("chargeAmount"))
        val payments = listOf(PaymentCard(value("partialPaymentId"), value("partialPaymentAmount"), value("activePaymentLabel")), PaymentCard(value("voidedPaymentId"), value("chargeAmount"), value("voidedPaymentLabel")))
        assertEquals(value("chargeAmount"), charge.outstandingLabel)
        assertEquals(value("chargeAmount"), charge.amountLabel)
        assertEquals(fixture.get("paymentCount").asInt, payments.size)
        assertNull(ChargeCard(value("unknownChargeId"), value("unknownChargeType"), value("unknownChargeAmount"), fixture.get("unknownOutstanding").takeUnless { it.isJsonNull }?.asString).outstandingLabel)
    }

    @Test fun financeAndDashboardAreScopedContainersNotCalculatedFromRooms() {
        val empty = FrontendReadSnapshot(
            operationalRooms = listOf(OperationalRoomCard(value("roomId"), value("propertyId"), value("ownName"), RoomOperationalState.OCCUPIED, RecordLifecycle.ACTIVE)),
        )
        assertTrue(empty.dashboardByOrganization.isEmpty())
        assertTrue(empty.operatorFinanceByOrganization.isEmpty())
        assertTrue(empty.tenantFinanceByTenancy.isEmpty())
    }
}
