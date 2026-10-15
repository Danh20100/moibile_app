package com.trooi.app.features.discovery

import com.trooi.app.core.model.ListingVisibility
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.PublicRentalDetails
import org.junit.Assert.*
import org.junit.Test
import java.math.BigDecimal

class DiscoveryDecisionTest {
    private fun listing(id: String, price: String?, visibility: ListingVisibility = ListingVisibility.PUBLISHED) =
        PublicListingCard(id, "Phòng số $id", "Thủ Đức", null, price, visibility)

    @Test fun priceParserCoversRawFormattedAndUnknown() {
        assertEquals(BigDecimal("3200000"), explorePriceVnd("3.200.000đ/tháng"))
        assertEquals(0, explorePriceVnd("3,2 triệu")!!.compareTo(BigDecimal("3200000")))
        assertEquals(BigDecimal("3200000"), explorePriceVnd("3200000"))
        assertNull(explorePriceVnd("Liên hệ để biết giá"))
    }

    @Test fun publicFilterNeverLeaksUnpublishedInventory() {
        val cards = listOf(
            listing("public", "3200000"),
            listing("draft", "3000000", ListingVisibility.DRAFT),
            listing("inactive", "2900000", ListingVisibility.UNPUBLISHED),
        )
        val visible = PublicDiscoveryFilters(minPrice = "3000000", maxPrice = "3500000").apply(cards)
        assertEquals(listOf("public"), visible.map { it.listingId })
        assertEquals(listOf("public"),
            PublicDiscoveryFilters("3000000", "3500000")
                .apply(listOf(listing("public", "3.200.000đ/tháng")))
                .map { it.listingId })
    }

    @Test fun invalidPriceRangesAreRejected() {
        assertNotNull(PublicDiscoveryFilters("5000000", "3000000").validationMessage())
        assertNotNull(PublicDiscoveryFilters("-1", "").validationMessage())
        assertNotNull(PublicDiscoveryFilters("abc", "").validationMessage())
        assertNull(PublicDiscoveryFilters("3000000", "5000000").validationMessage())
        assertNull(PublicDiscoveryFilters().validationMessage())
    }

    @Test fun displayFilteringUnderstandsFormattedPrices() {
        val filtered = exploreFilteredListings(listOf(
            listing("a", "3.200.000đ/tháng"), listing("b", "5.500.000đ/tháng"),
            listing("draft", "3.500.000đ/tháng", ListingVisibility.DRAFT)),
            minPrice = "3000000", maxPrice = "5000000")
        assertEquals(listOf("a"), filtered.map { it.listingId })
    }

    @Test fun invalidFilteringFailsClosed() {
        val public = listOf(listing("p", "3200000"))
        assertTrue(exploreFilteredListings(public, minPrice = "invalid").isEmpty())
        assertTrue(exploreFilteredListings(public, minPrice = "5000000", maxPrice = "3000000").isEmpty())
    }

    @Test fun realPublicListingsNeverFallBackToDemoWhenEmpty() {
        assertTrue(discoveryCards(emptyList(), allowDemoFallback = false).isEmpty())
    }

    @Test fun missingPriceIsNotInvented() {
        val result = discoveryCards(listOf(listing("p", null)), allowDemoFallback = false)
        assertEquals("Liên hệ để biết giá", result.single().askingPriceLabel)
    }
}
