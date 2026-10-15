package com.trooi.app.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FeatureProjectionsTest {
    @Test fun capabilityNavigationIsRelationshipBasedAndSupportsBothContexts() {
        val browseOnly = AccessCapabilities()
        assertEquals(listOf(ClientArea.DISCOVERY), browseOnly.visibleAreas())
        val both = AccessCapabilities(setOf("tenancy-1"), setOf("org-1"))
        assertTrue(both.allows(ClientArea.TENANT_PORTAL))
        assertTrue(both.allows(ClientArea.OPERATIONS))
        assertTrue(both.allows(ClientArea.DISCOVERY))
        assertFalse(browseOnly.allows(ClientArea.OPERATIONS))
    }

    @Test fun publicFeedDoesNotExposeDraftOrUnpublishedListings() {
        fun listing(id: String, status: ListingVisibility) =
            PublicListingCard(id, id, "Quận 3", null, null, status)
        val cards = listOf(
            listing("draft", ListingVisibility.DRAFT),
            listing("public", ListingVisibility.PUBLISHED),
            listing("hidden", ListingVisibility.UNPUBLISHED),
            listing("archived", ListingVisibility.ARCHIVED),
        )
        assertEquals(listOf("public"), publicDiscoveryFeed(cards).map { it.listingId })
    }
}
