package com.trooi.app.core.model

import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.features.discovery.publicRentalDetail
import org.junit.Assert.assertEquals
import org.junit.Test

class PublicListingPhotosTest {
    @Test fun publicListingAndSearchDecodeOnlyProjectedPhotoIds() {
        val listing = BackendJsonCodec.publicListings("""[{"id":"listing-1","roomId":"room-1","status":"published","publicTitle":"Room","publicDescription":"","publicPriceProjection":"1.00","publicLocationProjection":{"latitude":10.0,"longitude":106.0},"publicPhotoIds":["photo-1"],"publicAmenityIds":["wifi","private_bathroom"]}]""").single()
        assertEquals(listOf("photo-1"), listing.publicPhotoIds)
        assertEquals(listOf("wifi", "private_bathroom"), listing.publicAmenityIds)

        val oldListing = BackendJsonCodec.publicListings("""[{"id":"listing-2","roomId":"room-2","status":"published","publicTitle":"Room","publicDescription":"","publicPriceProjection":"1.00","publicLocationProjection":{"latitude":10.0,"longitude":106.0}}]""").single()
        assertEquals(emptyList<String>(), oldListing.publicPhotoIds)
        assertEquals(emptyList<String>(), oldListing.publicAmenityIds)

        val search = BackendJsonCodec.publicSearchResults("""[{"listingId":"listing-1","roomId":"room-1","publicTitle":"Room","publicDescription":"","publicPriceProjection":"1.00","publicLocation":{"latitude":10.0,"longitude":106.0},"distanceMeters":10.0,"publicPhotoIds":["photo-1"],"publicAmenityIds":["wifi"]}]""").single()
        assertEquals(listOf("photo-1"), search.publicPhotoIds)
        assertEquals(listOf("wifi"), search.publicAmenityIds)
    }

    @Test fun termsAcceptTextUtilityArrangements() {
        val terms = BackendJsonCodec.terms("""[{"id":"t1","tenancyId":"ten","version":1,"rentAmount":"3100000.00","agreedDepositRequirement":"1.00","termStart":"2026-10-20","termEnd":"2027-10-20","effectiveFromCycleBoundary":"2026-10-20","billingDayOrDueDateRule":{"day":25},"electricityArrangement":"2998 vnd/kWh","waterArrangement":"12.900 vnd/m3","minimalRentalConditions":"note"}]""").single()
        assertEquals(1, terms.version)
        assertEquals("2998 vnd/kWh", terms.electricityArrangement.get("text").asString)
    }

    @Test fun stableAmenityIdsUseTheExistingOwnerCatalogLabels() {
        assertEquals("Wi-Fi", AmenityCatalog.label("wifi"))
        assertEquals("Phòng tắm riêng", AmenityCatalog.label("private_bathroom"))
        assertEquals("unknown_id", AmenityCatalog.label("unknown_id"))
    }

    @Test fun backendListingCanRenderOnlyItsPublicAmenitiesWithoutRentalFixtureData() {
        val listing = PublicListingCard("backend-listing", "Phòng sáng", "Vị trí công khai", null,
            "3500000", ListingVisibility.PUBLISHED, amenities = listOf(AmenityCatalog.label("wifi"), AmenityCatalog.label("private_bathroom")))
        val detail = publicRentalDetail(listing)
        assertEquals(listOf("Wi-Fi", "Phòng tắm riêng"), detail.amenities)
        assertEquals("backend-listing", detail.card.listingId)
        assertEquals("3.500.000đ/tháng", detail.card.askingPriceLabel)
        assertEquals(emptyList<String>(), detail.rules)
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
