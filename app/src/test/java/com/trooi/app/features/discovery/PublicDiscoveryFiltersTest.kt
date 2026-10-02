package com.trooi.app.features.discovery

import com.trooi.app.core.model.ListingVisibility
import com.trooi.app.core.model.PublicListingCard
import org.junit.Assert.*
import org.junit.Test

class PublicDiscoveryFiltersTest {
    private val sample = listOf(
        PublicListingCard("1", "Room A", "Phú Nhuận, HCM", null, "3500000.00", ListingVisibility.PUBLISHED),
        PublicListingCard("2", "Room B", "Quận 3, HCM", null, "5000000.00", ListingVisibility.PUBLISHED),
        PublicListingCard("3", "Secret", "Phú Nhuận, HCM", null, "2000000.00", ListingVisibility.DRAFT),
        PublicListingCard("4", "Hidden", "Quận 3, HCM", null, "5000000.00", ListingVisibility.UNPUBLISHED),
    )

    @Test fun onlyPublishedCardsAppearInUnfilteredPublicFeed() {
        assertEquals(listOf("1", "2"), PublicDiscoveryFilters().apply(sample).map { it.listingId })
        // A constant public-area placeholder must never masquerade as searchable geography.
        val placeholderOnly = sample.map { it.copy(publicAreaLabel = "Vị trí công khai") }
        assertEquals(listOf("1", "2"), PublicDiscoveryFilters().apply(placeholderOnly).map { it.listingId })
    }

    @Test fun inclusivePublicPriceRangeNeverIncludesDraft() {
        assertEquals(listOf("1"), PublicDiscoveryFilters(minPrice = "3500000", maxPrice = "3500000").apply(sample).map { it.listingId })
        assertEquals(listOf("2"), PublicDiscoveryFilters(minPrice = "4000000").apply(sample).map { it.listingId })
    }

    @Test fun invalidFilterReportsErrorWithoutLosingPublicFeed() {
        val bad = PublicDiscoveryFilters(minPrice = "5000000", maxPrice = "3500000")
        assertNotNull(bad.validationMessage())
        assertEquals(listOf("1", "2"), bad.apply(sample).map { it.listingId })
        assertNotNull(PublicDiscoveryFilters(minPrice = "-1").validationMessage())
        assertNotNull(PublicDiscoveryFilters(maxPrice = "wrong").validationMessage())
    }

    @Test fun missingNumericPublicPriceCannotBeAssumedToMatchBudget() {
        val one = sample.first().copy(askingPriceLabel = "Liên hệ")
        assertTrue(PublicDiscoveryFilters(minPrice = "1000").apply(listOf(one)).isEmpty())
        assertEquals(listOf("1"), PublicDiscoveryFilters().apply(listOf(one)).map { it.listingId })
    }
}
