package com.trooi.app.features.auth

import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.*
import org.junit.Assert.*
import org.junit.Test

class DemoAccountsTest {
    @Test fun seededAccountsHaveSeparateRelationshipsAndDirectLanding() {
        val tenant = DemoData.authenticate("tenant@trooi.local", "TroOi2026!")!!
        val owner = DemoData.authenticate("owner@trooi.local", "TroOi2026!")!!
        assertNotEquals(tenant.userId, owner.userId)
        assertTrue(tenant.access.operatedOrganizationIds.isEmpty())
        assertTrue(owner.access.linkedTenancyIds.isEmpty())
        assertEquals(AppPage.TenantHome, destinationPage(reconcileContext(null, tenant.access)))
        assertEquals(AppPage.OwnerDashboard, destinationPage(reconcileContext(null, owner.access)))
        assertNull(DemoData.authenticate("tenant@trooi.local", "wrong-password"))
        assertNull(DemoData.authenticate("unknown@trooi.local", "TroOi2026!"))
    }

    @Test fun graphAndAuthorizedReadsShareCanonicalRoomIds() {
        val tenant = DemoData.authenticate("tenant@trooi.local", "TroOi2026!")!!
        val owner = DemoData.authenticate("owner@trooi.local", "TroOi2026!")!!
        val tenantRead = DemoData.authorizedRead(tenant.access)
        val ownerRead = DemoData.authorizedRead(owner.access)
        assertTrue(tenantRead.organizations.isEmpty())
        assertTrue(tenantRead.operationalRooms.isEmpty())
        assertTrue(ownerRead.tenantFinanceByTenancy.isEmpty())
        val tenancy = tenantRead.tenancies.single()
        assertTrue(ownerRead.operationalRooms.any { it.roomId == tenancy.roomId })
        assertTrue(tenantRead.incidents.all { it.roomId == tenancy.roomId })
        assertEquals(3, tenantRead.tenantFinanceByTenancy.getValue(tenancy.tenancyId).charges.size)
        assertTrue(ownerRead.operationalRooms.all { room -> ownerRead.properties.any { it.propertyId == room.propertyId } })
    }
}
