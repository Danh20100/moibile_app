package com.trooi.app.core.model

import com.trooi.app.core.network.dto.BackendJsonCodec
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
}
