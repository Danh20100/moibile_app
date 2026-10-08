package com.trooi.app.features.discovery

/** These builds have no bundled fixture inventory. */
object ListingFixtures {
    val all: List<ListingFixture> = emptyList()
    fun resolve(listingId: String): ListingFixture? = null
    fun cards(area: String, type: String, minimum: String, maximum: String): List<DiscoveryListingItem> = emptyList()
}
