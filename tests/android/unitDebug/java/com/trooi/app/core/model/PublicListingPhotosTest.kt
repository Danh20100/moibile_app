package com.trooi.app.core.model

import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.features.discovery.publicRentalDetail
import org.junit.Assert.assertEquals
import org.junit.Test

class PublicListingPhotosTest {
    @Test fun publicListingAndSearchDecodeOnlyProjectedPhotoIds() {
        val listing = BackendJsonCodec.publicListings("""[{"id":"listing-1","roomId":"room-1","status":"published","publicTitle":"Room","publicDescription":"","publicPriceProjection":"1.00","publicLocationProjection":{"latitude":10.0,"longitude":106.0},"publicPhotoIds":["photo-1"]}]""").single()
        assertEquals(listOf("photo-1"), listing.publicPhotoIds)

        val oldListing = BackendJsonCodec.publicListings("""[{"id":"listing-2","roomId":"room-2","status":"published","publicTitle":"Room","publicDescription":"","publicPriceProjection":"1.00","publicLocationProjection":{"latitude":10.0,"longitude":106.0}}]""").single()
        assertEquals(emptyList<String>(), oldListing.publicPhotoIds)

        val search = BackendJsonCodec.publicSearchResults("""[{"listingId":"listing-1","roomId":"room-1","publicTitle":"Room","publicDescription":"","publicPriceProjection":"1.00","publicLocation":{"latitude":10.0,"longitude":106.0},"distanceMeters":10.0,"publicPhotoIds":["photo-1"]}]""").single()
        assertEquals(listOf("photo-1"), search.publicPhotoIds)
    }

    @Test fun approvedPhotoIdsAndLoadedUrisReachThePublicListingDetail() {
        val photos = listOf("93000000-0000-4000-8000-000000000001")
        val uri = "file:///cache/public-listing-media/${photos.single()}.jpg"
        val details = PublicRentalDetails(
            type = "Phòng trọ", area = "24", bedrooms = "1", bathrooms = "1", furnishing = "Cơ bản",
            description = "Phòng sáng", host = "Chủ trọ", photoUris = emptyList(), photoResources = emptyList(),
            rules = emptyList(), advertisedDeposit = "3000000", electricityOffer = "", waterOffer = "",
            serviceOffer = "", minimumTermMonths = "6", availableFrom = "",
        )
        val listing = PublicListingCard("listing-1", "Phòng", "Quận 3", null, "3200000đ/tháng",
            ListingVisibility.PUBLISHED, rentalDetails = details, publicPhotoIds = photos, photoUris = listOf(uri))
        val presentation = publicRentalDetail(listing)!!
        assertEquals(listOf(uri), presentation.photoUris)
        assertEquals(listOf(uri), presentation.card.photoUris)
        assertEquals(photos, presentation.publicPhotoIds)
    }
}
