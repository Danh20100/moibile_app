package com.trooi.app.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ContextSelectionTest {
    @Test
    fun rememberedValidIdIsRetained() {
        val access = AccessCapabilities(
            linkedTenancyIds = setOf("t-1", "t-2"),
            operatedOrganizationIds = setOf("org-1"),
        )
        val remembered = SelectedContext.Tenant("t-2")
        val resolution = reconcileContext(remembered, access)
        assertFalse(resolution.needsPicker)
        assertEquals(remembered, resolution.selection)
    }

    @Test
    fun multiple_contexts_require_picker() {
        val access = AccessCapabilities(linkedTenancyIds = setOf("t-1", "t-2"))
        val resolution = reconcileContext(null, access)
        val readsFromArbitraryFirstTenancy =
            if (resolution.selection is SelectedContext.Tenant && !resolution.needsPicker) 1 else 0
        assertTrue(resolution.needsPicker)
        assertEquals(SelectedContext.Discovery, resolution.selection)
        assertEquals(0, readsFromArbitraryFirstTenancy)
    }

    @Test
    fun twoOrganizationsNeverAutoSelectFirst() {
        val access = AccessCapabilities(operatedOrganizationIds = setOf("org-1", "org-2"))
        val resolution = reconcileContext(null, access)
        assertTrue(resolution.needsPicker)
        assertEquals(SelectedContext.Discovery, resolution.selection)
    }

    @Test
    fun removedIdPicksUniqueRemainingTenancy() {
        val access = AccessCapabilities(linkedTenancyIds = setOf("t-2"))
        val resolution = reconcileContext(SelectedContext.Tenant("t-1"), access)
        assertFalse(resolution.needsPicker)
        assertEquals(SelectedContext.Tenant("t-2"), resolution.selection)
    }

    @Test
    fun removedIdOpensPickerWhenMultipleRemain() {
        val access = AccessCapabilities(
            linkedTenancyIds = setOf("t-2"),
            operatedOrganizationIds = setOf("org-1"),
        )
        val resolution = reconcileContext(SelectedContext.Tenant("t-1"), access)
        assertTrue(resolution.needsPicker)
        assertEquals(SelectedContext.Discovery, resolution.selection)
    }

    @Test
    fun zeroCapabilitiesLandOnDiscovery() {
        val resolution = reconcileContext(SelectedContext.Operations("org-gone"), AccessCapabilities())
        assertFalse(resolution.needsPicker)
        assertEquals(SelectedContext.Discovery, resolution.selection)
    }

    @Test
    fun formerTenancyHistoryDoesNotGainWrites() {
        val access = AccessCapabilities(linkedTenancyIds = setOf("t-ended"))
        val resolution = reconcileContext(SelectedContext.Tenant("t-ended"), access)
        val ended = TenancyCard("t-ended", "r-1", "P101", TenancyLifecycle.ENDED, null)
        assertEquals(SelectedContext.Tenant("t-ended"), resolution.selection)
        assertFalse(tenancyAllowsWrites(ended.lifecycle))
        assertFalse(tenancyAllowsWrites(TenancyLifecycle.CANCELLED))
        assertTrue(tenancyAllowsWrites(TenancyLifecycle.ACTIVE))
    }

    @Test
    fun missingProjectionUsesNeutralLabelNotFabricatedRelationship() {
        val unlabeled = SelectedContext.Tenant("t-unknown")
        assertEquals(NEUTRAL_TENANCY_LABEL, contextLabel(unlabeled, FrontendReadSnapshot()))
        assertEquals(
            NEUTRAL_ORGANIZATION_LABEL,
            contextLabel(SelectedContext.Operations("org-unknown"), FrontendReadSnapshot()),
        )
        val labeled = FrontendReadSnapshot(
            tenancies = listOf(TenancyCard("t-1", "r-1", "Phòng 2", TenancyLifecycle.ACTIVE, null)),
        )
        assertEquals("Phòng 2", contextLabel(SelectedContext.Tenant("t-1"), labeled))
    }

    @Test
    fun scopedReadsDoNotUseArbitraryFirstMembership() {
        val read = FrontendReadSnapshot(
            tenancies = listOf(
                TenancyCard("t-1", "r-1", "A", TenancyLifecycle.ACTIVE, null),
                TenancyCard("t-2", "r-2", "B", TenancyLifecycle.ACTIVE, null),
            ),
            organizations = listOf(
                OrganizationCard("org-1", "Khu 1"),
                OrganizationCard("org-2", "Khu 2"),
            ),
        )
        val access = AccessCapabilities(setOf("t-1", "t-2"), setOf("org-1", "org-2"))
        assertEquals(
            listOf("t-2"),
            scopedTenancies(read, access, SelectedContext.Tenant("t-2")).map { it.tenancyId },
        )
        assertEquals(
            listOf("org-1"),
            scopedOrganizations(read, access, SelectedContext.Operations("org-1")).map { it.organizationId },
        )
        assertTrue(scopedTenancies(read, access, SelectedContext.Discovery).isEmpty())
    }
}
