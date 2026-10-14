package com.trooi.app.core.model

import com.trooi.app.core.data.TroOiRepositoryImpl
import com.trooi.app.core.demo.DemoData
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test

class DebugProjectionTest {
    @Test fun occupiedAssetDetailMatchesCanonicalSizeAndPublicMapsStaySeparate() {
        val asset = DemoData.occupiedAsset
        val detail = com.trooi.app.features.discovery.ListingFixtures.resolve("demo-mini")!!
        assertEquals(asset.name, detail.card.title)
        assertEquals(asset.publicArea, detail.card.publicAreaLabel)
        assertTrue(detail.summary.contains("${asset.area} m²"))
        assertEquals(null, detail.publicGeoPoint)
        assertTrue(DemoData.read.publicListings.all { it.publicGeoPoint != null })
        assertTrue(DemoData.read.publicListings.none { it.title == asset.name })
    }
    @Test fun onboardingGrantsOnlyOwnOrganizationAndRetainsTenantFinance() = runBlocking {
        val repository = TroOiRepositoryImpl()
        val tenant = repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
        val before = repository.refreshAuthorizedRead(tenant.access).getOrThrow()
        val asset = LocalRentalAsset("lan-first", "lan-property", "Phòng trọ", "Phòng L01", "Địa chỉ riêng", "Bình Thạnh", "24", "3200000", "3200000",
            "Phòng sáng", photoResources = DemoData.occupiedAsset.photoResources)
        val application = LocalLandlordApplication("Nguyễn Ngọc Lan", "1995-06-15", "0901234567", "lan@example.com", true, true, true, asset, false)
        assertTrue(repository.completeLocalLandlordOnboarding(application.copy(identityDetailsReviewed = false)).isFailure)
        assertEquals(tenant, repository.refreshSessionContext().getOrThrow())
        val operator = repository.completeLocalLandlordOnboarding(application).getOrThrow()
        assertEquals(tenant.access.linkedTenancyIds, operator.access.linkedTenancyIds)
        assertEquals(setOf("local-organization-${tenant.userId}"), operator.access.operatedOrganizationIds)
        val after = repository.refreshAuthorizedRead(operator.access).getOrThrow()
        assertEquals(before.tenantFinanceByTenancy, after.tenantFinanceByTenancy)
        assertEquals(1, after.localManagement!!.used)
        assertEquals(listOf(asset.id), accessibleRooms(after, operator.access).map { it.roomId })
        assertTrue(after.operatorFinanceByRoom.isEmpty())
        assertTrue(repository.completeLocalLandlordOnboarding(application).isFailure)
        val owner = repository.login("owner@trooi.local", "TroOi2026!").getOrThrow()
        assertEquals(DemoData.accounts[1].access, owner.access)
        assertTrue(repository.refreshAuthorizedRead(owner.access).getOrThrow().localManagement!!.assets.none { it.id == asset.id })
        assertTrue(repository.saveLocalAsset(asset, true, false).isFailure)
        assertEquals(operator.access, repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow().access)
    }
    @Test fun debugPublicFixturesContainOnlyPublishedListings() {
        assertTrue(DemoData.read.publicListings.all { it.visibility == ListingVisibility.PUBLISHED })
    }

    @Test fun debugInquiryDoesNotClaimBackendSuccess() = runBlocking {
        val result = TroOiRepositoryImpl().submitInquiry("preview-listing-a", "Tôi quan tâm")
        assertTrue(result.isFailure)
    }

    @Test fun loginRestoreLogoutAndAccountChangePreserveBoundaries() = runBlocking {
        val repository = TroOiRepositoryImpl()
        assertTrue(repository.refreshSessionContext().isFailure)
        val tenant = repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
        assertEquals(tenant, repository.refreshSessionContext().getOrThrow())
        assertTrue(repository.login("owner@trooi.local", "incorrect").isFailure)
        assertEquals(tenant, repository.refreshSessionContext().getOrThrow())
        repository.clearSession()
        assertTrue(repository.refreshSessionContext().isFailure)
        val owner = repository.login("owner@trooi.local", "TroOi2026!").getOrThrow()
        assertTrue(owner.access.linkedTenancyIds.isEmpty())
        assertTrue(owner.access.operatedOrganizationIds.isNotEmpty())
    }

    @Test fun assetCatalogIsScopedAndNeverCreatesRentalFinance() = runBlocking {
        val repository = TroOiRepositoryImpl()
        val tenant = repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
        assertTrue(repository.purchaseLocalCapacity("unauthorized").isFailure)
        assertTrue(repository.refreshAuthorizedRead(DemoData.accounts[1].access).isFailure)
        assertEquals(null, repository.refreshAuthorizedRead(tenant.access).getOrThrow().localManagement)
        val owner = repository.login("owner@trooi.local", "TroOi2026!").getOrThrow()
        val original = repository.refreshAuthorizedRead(owner.access).getOrThrow()
        val draft = LocalRentalAsset("new-room", "new-property", "Phòng trọ", "Phòng C01",
            "PRIVATE ADDRESS", "Bình Thạnh", "20", "3000000", "3000000", "Phòng sáng",
            photoResources = DemoData.occupiedAsset.photoResources)
        assertTrue(repository.saveLocalAsset(draft, true, true).isFailure)
        val draftRead = repository.saveLocalAsset(draft, false, false).getOrThrow()
        assertEquals(original.localManagement!!.used, draftRead.localManagement!!.used)
        assertTrue(draftRead.operationalRooms.none { it.roomId == draft.id })
        repository.purchaseLocalCapacity("order-1").getOrThrow()
        val published = repository.saveLocalAsset(draft, true, true).getOrThrow()
        assertEquals(original.localManagement!!.used + 1, published.localManagement!!.used)
        assertEquals(original.operatorFinanceByOrganization, published.operatorFinanceByOrganization)
        assertEquals(original.tenancies, published.tenancies)
        repository.clearSession()
        val restoredTenant = repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
        val tenantRead = repository.refreshAuthorizedRead(restoredTenant.access).getOrThrow()
        assertEquals(null, tenantRead.localManagement)
        assertTrue(tenantRead.properties.isEmpty())
        assertEquals("Bình Thạnh", tenantRead.publicListings.single { it.listingId == draft.listingId }.publicAreaLabel)
        repository.login("owner@trooi.local", "TroOi2026!").getOrThrow()
        val archived = repository.archiveLocalAsset(draft.id).getOrThrow()
        assertEquals(original.localManagement!!.used, archived.localManagement!!.used)
        assertEquals(original.localManagement!!.capacity() + 1, archived.localManagement!!.capacity())
        assertTrue(archived.publicListings.none { it.listingId == draft.listingId })
        assertEquals(RoomOperationalState.INACTIVE, archived.operationalRooms.single { it.roomId == draft.id }.operationalState)
        val stoppedOccupied = repository.archiveLocalAsset(DemoData.ROOM).getOrThrow()
        assertEquals(original.tenancies, stoppedOccupied.tenancies)
        assertEquals(original.operationalRooms.single { it.roomId == DemoData.ROOM }.operationalState, stoppedOccupied.operationalRooms.single { it.roomId == DemoData.ROOM }.operationalState)
        assertEquals(original.operatorFinanceByRoom, stoppedOccupied.operatorFinanceByRoom)
    }
}
