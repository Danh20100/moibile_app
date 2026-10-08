package com.trooi.app.features.discovery

/** Public metadata projected from the shared debug rental graph. */
object ListingFixtures {
    val all = com.trooi.app.core.demo.DemoRentalGraph.all.filter { it.asset.listingStatus != com.trooi.app.core.model.ListingVisibility.ARCHIVED }
        .map { requireNotNull(publicRentalDetail(com.trooi.app.core.demo.DemoRentalGraph.publicListing(it))) }
    fun resolve(listingId: String): ListingFixture? = all.firstOrNull { it.card.listingId == listingId }
    fun cards(area: String, type: String, minimum: String, maximum: String): List<DiscoveryListingItem> = all
        .filter { it.card.listingId != "demo-mini" }.map { it.card }.filter { card ->
            (area.isBlank() || unaccent(card.publicAreaLabel + " " + card.title).contains(unaccent(area), true)) &&
            (type.isBlank() || type == "Tất cả" || card.category == type) &&
            (minimum.isBlank() || explorePriceVnd(card.askingPriceLabel)?.let { it >= (minimum.toBigDecimalOrNull() ?: return@filter false) } == true) &&
            (maximum.isBlank() || explorePriceVnd(card.askingPriceLabel)?.let { it <= (maximum.toBigDecimalOrNull() ?: return@filter false) } == true)
        }
}
