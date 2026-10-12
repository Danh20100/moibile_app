package com.trooi.app.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SourceNavigationTest {
    private val access = AccessCapabilities(setOf("t-1"), setOf("o-1"))

    @Test
    fun sixLedgerTargetsCarryRoomTenancyAndOrganizationIds() {
        val targets = ledgerTargets(roomId = "r-1", organizationId = "o-1", tenancyId = "t-1")
        assertEquals(LedgerSurface.ALL, targets.map { it.first })
        targets.forEach { (label, target) ->
            assertEquals(label, "r-1", target.roomId)
            assertEquals(label, "t-1", target.tenancyId)
            assertEquals(label, "o-1", target.organizationId)
        }
    }

    @Test
    fun notificationPaymentAndIncidentOpenExactAuthorizedDetails() {
        val payment = resolveSource(SourceTarget("PAYMENT", "pay-1", tenancyId = "t-1"), access)
        val receipt = resolveSource(SourceTarget("RECEIPT", "rcpt-1", tenancyId = "t-1"), access)
        val incident = resolveSource(
            SourceTarget("INCIDENT", "inc-1", tenancyId = "t-1", organizationId = "o-1", roomId = "r-1"),
            access,
        )
        assertEquals(LedgerSurface.FINANCE, (payment as SourceResolution.Authorized).surface)
        assertEquals(AppPage.TenantRental, payment.page)
        assertEquals("pay-1", payment.target.id)
        assertEquals(LedgerSurface.FINANCE, (receipt as SourceResolution.Authorized).surface)
        assertEquals(LedgerSurface.INCIDENT, (incident as SourceResolution.Authorized).surface)
        assertEquals("inc-1", incident.target.id)
    }

    @Test
    fun backFromSourceReturnsNotificationThenAuthorizedCaller() {
        val origin = SourceNavigation(
            AppPage.NotificationDetail("n-1"),
            SelectedContext.Tenant("t-1"),
            SourceTarget("PAYMENT", "pay-1", tenancyId = "t-1"),
        )
        val (page, context) = returnFromSource(origin)
        assertEquals(AppPage.NotificationDetail("n-1"), page)
        assertEquals(SelectedContext.Tenant("t-1"), context)
    }

    @Test
    fun missingOrRevokedSourceIsUnavailable() {
        assertEquals(
            SourceResolution.Unavailable,
            resolveSource(SourceTarget("PAYMENT", "pay-1", tenancyId = "t-1"), AccessCapabilities()),
        )
        assertEquals(
            SourceResolution.Unavailable,
            resolveSource(SourceTarget("INCIDENT", "inc-1"), access),
        )
        assertEquals(
            SourceResolution.Unavailable,
            resolveSource(SourceTarget("ROOM", "r-1", organizationId = "other"), access),
        )
    }

    @Test
    fun operatorOrgIsNeverInferredFromMissingScope() {
        val room = resolveSource(SourceTarget("ROOM", "r-1", roomId = "r-1"), access)
        assertEquals(SourceResolution.Unavailable, room)
        val authorized = resolveSource(
            SourceTarget("ROOM", "r-1", organizationId = "o-1", roomId = "r-1", propertyId = "p-1"),
            access,
        )
        assertTrue(authorized is SourceResolution.Authorized)
        assertEquals(SelectedContext.Operations("o-1"), (authorized as SourceResolution.Authorized).context)
    }
}
