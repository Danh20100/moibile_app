package com.trooi.app.core.model

import com.trooi.app.core.data.TroOiRepositoryImpl
import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.demo.DemoRentalGraph
import com.trooi.app.features.discovery.publicRentalDetail
import com.trooi.app.features.discovery.useFixtureDetail
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class DemoRentalGraphTest {
    @Test fun savedCatalogImportPreservesExistingFactsAndRequiresExplicitActivation() {
        val saved = LocalManagement(listOf(DemoData.occupiedAsset.copy(photoUris = listOf("file:///saved.jpg"))),
            listOf(LocalSlotEntitlement("existing-purchase", Long.MAX_VALUE)))
        val upgraded = DemoRentalGraph.reconcileSavedOwner(saved)
        assertEquals(saved.assets, upgraded.assets.take(saved.assets.size))
        assertEquals(saved.entitlements, upgraded.entitlements)
        assertEquals(saved.used, upgraded.used)
        assertEquals(saved.capacity(), upgraded.capacity())
        assertEquals(ManagedAssetStatus.DRAFT, upgraded.assets.last().status)
        assertEquals(ListingVisibility.DRAFT, upgraded.assets.last().listingStatus)
        assertEquals(upgraded, DemoRentalGraph.reconcileSavedOwner(upgraded))
        val archived = upgraded.archive(DemoRentalGraph.AN_NHIEN)
        assertEquals(archived, DemoRentalGraph.reconcileSavedOwner(archived))
    }
    @Test fun ownerListingConversationAndCatalogStayOneGraphAcrossEditsAndArchive() = runBlocking {
        val repository = TroOiRepositoryImpl()
        val owner = repository.login("owner@trooi.local", "TroOi2026!").getOrThrow()
        val before = repository.refreshAuthorizedRead(owner.access).getOrThrow()
        val asset = before.localManagement!!.assets.single { it.id == DemoRentalGraph.AN_NHIEN }
        val card = before.publicListings.single { it.listingId == asset.listingId }
        assertEquals(asset.name, card.title)
        assertEquals(asset.photoResources, publicRentalDetail(card)!!.images)
        assertEquals(asset.publicArea, card.publicAreaLabel)
        assertEquals(DemoRentalGraph.OWNER_NAME, card.rentalDetails!!.host)
        assertEquals(asset.propertyId, before.operationalRooms.single { it.roomId == asset.id }.propertyId)
        assertEquals(asset.id, before.conversations.single { it.id == "conversation-an-nhien" }.contextId)
        val edited = repository.saveLocalAsset(asset.copy(name = "An Nhiên mới", monthlyRent = "3300000"), true, true).getOrThrow()
        assertEquals("An Nhiên mới", edited.publicListings.single { it.listingId == asset.listingId }.title)
        assertEquals("An Nhiên mới", edited.conversations.single { it.contextId == asset.id }.rentalLabel)
        val archived = repository.archiveLocalAsset(asset.id).getOrThrow()
        assertTrue(archived.publicListings.none { it.listingId == asset.listingId })
        assertFalse(useFixtureDetail(asset.listingId, archived.publicListings, debugFixtures = true))
        assertEquals(before.tenantFinanceByTenancy, archived.tenantFinanceByTenancy)
        assertEquals(before.operatorFinanceByRoom, archived.operatorFinanceByRoom)
        assertEquals(before.localManagement!!.capacity(), archived.localManagement!!.capacity())
        assertTrue(repository.saveLocalAsset(asset.copy(id = "unowned", propertyId = "unowned-property"), false, false).isFailure)
        assertTrue(repository.saveLocalAsset(asset.copy(id = "fixture-room-window", propertyId = "foreign-property", publicListingId = null), false, false).isFailure)
        repository.clearSession()
        repository.login("onboarding@trooi.local", "TroOi2026!").getOrThrow()
        val application = LocalLandlordApplication("Phạm Thảo Linh", "1995-06-15", "0901234567", "linh@example.test", true, true, true,
            asset.copy(id = "new-onboarding-room", propertyId = "new-onboarding-property", publicListingId = "demo-room"), true)
        assertTrue(repository.completeLocalLandlordOnboarding(application).isFailure)
        assertTrue(repository.refreshSessionContext().getOrThrow().access.operatedOrganizationIds.isEmpty())
    }
}
