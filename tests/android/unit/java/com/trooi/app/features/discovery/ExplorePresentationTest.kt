package com.trooi.app.features.discovery

import com.trooi.app.core.model.ListingVisibility
import com.trooi.app.core.model.PublicListingCard
import org.junit.Assert.*
import org.junit.Test
import java.math.BigDecimal

class ExplorePresentationTest {
    private val studio = PublicListingCard("studio", "Studio sáng thoáng", "Linh Trung, Thủ Đức", null, "3200000.00", ListingVisibility.PUBLISHED)
    private val room = PublicListingCard("room", "Phòng trọ có cửa sổ", "Phú Nhuận", null, "5,2 triệu/tháng", ListingVisibility.PUBLISHED)

    @Test fun filtersLoadedPublicContentWithoutInventingAreaOrRoomType() {
        val input = listOf(studio, room, studio.copy(listingId = "draft", visibility = ListingVisibility.DRAFT))
        assertEquals(listOf("studio"), exploreFilteredListings(input, "thu duc", "Studio", "", "").map { it.listingId })
        assertEquals(listOf("room"), exploreFilteredListings(input, "", "Phòng trọ", "5000000", "6000000").map { it.listingId })
        assertTrue(exploreFilteredListings(input, "Làng Đại học", "", "", "").isEmpty())
        assertEquals(2, exploreFilteredListings(input, "", "", "", "").size)
    }

    @Test fun pricesRespectActualNumericOrExplicitMillionLabels() {
        assertEquals(BigDecimal("3200000.00"), explorePriceVnd("3200000.00"))
        assertEquals(BigDecimal("5200000.0"), explorePriceVnd("5,2 triệu/tháng"))
        assertNull(explorePriceVnd("Liên hệ"))
        assertNull(explorePriceVnd("-1"))
        assertTrue(exploreFilteredListings(listOf(studio.copy(askingPriceLabel = null)), "", "", "1000", "").isEmpty())
    }
}
