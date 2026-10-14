package com.trooi.app.features.ledger

import com.trooi.app.core.model.*
import org.junit.Assert.*
import org.junit.Test

class LocalManagementTest {
    private fun asset(id: String) = LocalRentalAsset(id, "property-$id", "Phòng trọ", "Phòng $id", "12 Đường A", "Thủ Đức", "24", "3200000", "3200000", "Sáng thoáng", photoUris = listOf("file:///local/photo.jpg"))
    @Test fun draftCapacityPurchaseActivationArchiveAndIdempotency() {
        val first = LocalManagement().save(asset("a"), true, false)
        assertEquals(1, first.used)
        assertEquals(1, first.save(asset("a"), false, false).used)
        val draft = first.save(asset("b"), false, false)
        assertEquals(1, draft.used)
        assertEquals(2, draft.assets.size)
        assertThrows(IllegalArgumentException::class.java) { draft.save(asset("b"), true, true) }
        val purchased = draft.purchase("purchase-1")
        assertEquals(2, purchased.capacity())
        assertEquals(purchased, purchased.purchase("purchase-1"))
        assertEquals(1, purchased.capacity(purchased.entitlements.single().validUntilEpochMillis))
        val published = purchased.save(asset("b"), true, true)
        assertEquals(2, published.used)
        assertEquals(ListingVisibility.PUBLISHED, published.assets.last().listingStatus)
        val archived = published.archive("b")
        assertEquals(1, archived.used)
        assertEquals(2, archived.capacity())
        assertEquals(ListingVisibility.UNPUBLISHED, archived.assets.last().listingStatus)
    }
    @Test fun occupiedOrIncompleteAssetsCannotBecomePublic() {
        assertFalse(asset("a").copy(maxOccupants = 0).valid())
        assertFalse(asset("a").copy(bathroomArrangement = BathroomArrangement.SHARED, amenities = listOf("Phòng tắm riêng")).valid())
        assertThrows(IllegalArgumentException::class.java) { LocalManagement().save(asset("a").copy(occupied = true), true, true) }
        assertThrows(IllegalArgumentException::class.java) { LocalManagement().save(asset("a").copy(photoUris = emptyList()), true, true) }
        val occupied = LocalManagement().save(asset("a").copy(occupied = true), true, false)
        assertThrows(IllegalArgumentException::class.java) { occupied.save(asset("a"), true, true) }
        val partial = LocalManagement().save(asset("b").copy(monthlyRent = "", photoUris = emptyList()), false, false)
        assertEquals(0, partial.used)
    }

    @Test fun ownerPhotoConsentSurvivesAssetSaveAndDraftSerialization() {
        val photo = "93000000-0000-4000-8000-000000000001"
        val selected = asset("a").copy(photoMediaIds = listOf(photo), publicPhotoMediaIds = setOf(photo))
        val saved = LocalManagement().save(selected, activate = false, publish = false).assets.single()
        val restored = com.google.gson.Gson().fromJson(com.google.gson.Gson().toJson(saved), LocalRentalAsset::class.java)
        assertEquals(setOf(photo), restored.publicPhotoMediaIds)
        assertTrue(restored.publicPhotoMediaIds.all { it in restored.photoMediaIds })
    }
}
