package com.trooi.app.features.discovery


/** Local presentation fixtures only; never submitted to discovery or rental APIs. */
data class ListingFixture(
    val card: DiscoveryListingItem,
    val images: List<Int>,
    val summary: String,
    val host: String,
    val description: String,
    val amenities: List<String>,
    val locationDescription: String,
    val rules: List<String>,
    val reviewCount: Int,
    val photoUris: List<String> = emptyList(),
    val costs: List<String> = emptyList(),
    val publicGeoPoint: com.trooi.app.core.model.PublicGeoPoint? = null,
    val publicPhotoIds: List<String> = emptyList(),
) {
    // Share only public card fields; never local media URIs or operational metadata.
    fun shareText(): String = listOf(card.title, card.category, card.publicAreaLabel,
        card.askingPriceLabel, "Tìm nơi ở lâu dài cùng TrọƠi").joinToString("\n")
}

