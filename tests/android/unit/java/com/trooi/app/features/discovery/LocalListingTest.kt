package com.trooi.app.features.discovery

import com.trooi.app.core.model.*
import org.junit.Assert.*
import org.junit.Test

class LocalListingTest {
    @Test fun roomFactsDescribeWcOccupantsAndFloorWithoutInventingApartmentRooms() {
        val asset = LocalRentalAsset("a", "p", "Phòng trọ", "Phòng C01", "PRIVATE", "Bình Thạnh", "20", "3200000", "3200000",
            bathroomArrangement = BathroomArrangement.SHARED, maxOccupants = 2, floorLabel = "3")
        val listing = PublicListingCard(asset.listingId, asset.name, asset.publicArea, null, "3200000đ/tháng", ListingVisibility.PUBLISHED, rentalDetails = asset.publicDetails("Hà"))
        val summary = publicRentalDetail(listing)!!.summary
        assertTrue(summary.contains("WC chung"))
        assertTrue(summary.contains("Tối đa 2 người"))
        assertTrue(summary.contains("Tầng 3"))
        assertFalse(summary.contains("phòng ngủ"))
    }
    @Test fun newlyPublishedAssetKeepsTypePriceCoverAndPublicOnlyLocation() {
        val asset = LocalRentalAsset("a", "p", "Căn hộ", "An Nhiên", "PRIVATE EXACT ADDRESS", "Bình Thạnh, TP.HCM", "32", "4500000", "4500000",
            "Không gian sáng", photoUris = listOf("file:///cover.jpg", "file:///gallery.jpg"), operationalLatitude = "10.8", operationalLongitude = "106.7")
        val listing = PublicListingCard(asset.listingId, asset.name, asset.publicArea, null, "4500000đ/tháng", ListingVisibility.PUBLISHED, rentalDetails = asset.publicDetails("Thu Hà"))
        val card = discoveryCards(listOf(listing), false, type = "Căn hộ").single()
        assertEquals("4.500.000đ/tháng", card.askingPriceLabel)
        assertEquals(asset.photoUris, card.photoUris)
        assertEquals("Căn hộ", card.category)
        val detail = publicRentalDetail(listing)!!
        assertEquals("Thu Hà", detail.host)
        assertEquals(asset.publicArea, detail.card.publicAreaLabel)
        assertFalse(detail.toString().contains(asset.operationalAddress))
        assertFalse(detail.toString().contains(asset.operationalLatitude))
        assertEquals(null, listing.publicGeoPoint)
        assertNull(detail.publicGeoPoint)
        val publicPoint = PublicGeoPoint(10.8, 106.7)
        assertEquals(publicPoint, publicRentalDetail(listing.copy(publicGeoPoint = publicPoint))!!.publicGeoPoint)
        assertNull(publicRentalDetail(listing.copy(publicGeoPoint = publicPoint, visibility = ListingVisibility.DRAFT))!!.publicGeoPoint)
        assertEquals("An Nhiên\nCăn hộ\nBình Thạnh, TP.HCM\n4.500.000đ/tháng\nTìm nơi ở lâu dài cùng TrọƠi", detail.shareText())
        assertFalse(detail.shareText().contains(asset.operationalAddress))
        assertFalse(detail.shareText().contains("file:///"))
        assertTrue(discoveryCards(listOf(listing.copy(visibility = ListingVisibility.UNPUBLISHED)), false).isEmpty())
    }
}
