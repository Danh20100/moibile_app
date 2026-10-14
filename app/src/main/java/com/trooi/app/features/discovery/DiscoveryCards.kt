package com.trooi.app.features.discovery

import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.publicDiscoveryFeed
import com.trooi.app.core.model.BathroomArrangement

/** Real public inventory wins. Demo fallback is explicitly disabled for backend search. */
fun discoveryCards(
    listings: List<PublicListingCard>,
    allowDemoFallback: Boolean,
    area: String = "",
    type: String = "Tất cả",
    minimum: String = "",
    maximum: String = "",
): List<DiscoveryListingItem> {
    val public = publicDiscoveryFeed(listings)
    if (public.isEmpty() && allowDemoFallback) return ListingFixtures.cards(area, type, minimum, maximum)
    return exploreFilteredListings(public, area, type, minimum, maximum).map { listing ->
        listing.rentalDetails?.let { return@map publicRentalDetail(listing)!!.card }
        if (allowDemoFallback) ListingFixtures.resolve(listing.listingId)
            ?.takeIf { it.card.title == listing.title && it.card.publicAreaLabel == listing.publicAreaLabel }
            ?.let { return@map it.card }
        DiscoveryListingItem(
            listingId = listing.listingId,
            title = listing.title,
            publicAreaLabel = listing.publicAreaLabel,
            askingPriceLabel = listing.askingPriceLabel ?: "Liên hệ để biết giá",
            metadataLabel = listOfNotNull(
                listing.publicAreaLabel.takeIf { it.isNotBlank() },
                listing.distanceMeters?.let { "%.1f km".format(it / 1000.0) },
            ).joinToString(" · "),
            category = "Phòng cho thuê",
        )
    }
}

fun rentalPriceLabel(amount: String): String = amount.toBigDecimalOrNull()?.let {
    java.text.NumberFormat.getNumberInstance(java.util.Locale.forLanguageTag("vi-VN")).format(it) + "đ"
} ?: amount

fun publicRentalDetail(listing: PublicListingCard): ListingFixture? = listing.rentalDetails?.let { detail ->
    ListingFixture(
        card = DiscoveryListingItem(listing.listingId, listing.title, listing.publicAreaLabel,
            listing.askingPriceLabel?.let(::explorePriceVnd)?.let { "${rentalPriceLabel(it.toPlainString())}/tháng" }
                ?: listing.askingPriceLabel?.takeIf { it.isNotBlank() } ?: "Liên hệ để biết giá",
            "${detail.area} m² · ${detail.furnishing}", category = detail.type,
            photoUris = detail.photoUris, photoResources = detail.photoResources),
        images = detail.photoResources, summary = (listOf(detail.type, "${detail.area} m²") +
            if (detail.type == "Căn hộ") listOf("${detail.bedrooms} phòng ngủ", "${detail.bathrooms} phòng tắm")
            else listOfNotNull(when (detail.bathroomArrangement) { BathroomArrangement.PRIVATE -> "WC riêng"; BathroomArrangement.SHARED -> "WC chung"; null -> null })
            ).plus(listOfNotNull(detail.maxOccupants?.let { "Tối đa $it người" }, detail.floorLabel?.takeIf(String::isNotBlank)?.let { "Tầng $it" })).joinToString(" · "),
        host = detail.host, description = detail.description, amenities = listing.amenities,
        publicGeoPoint = com.trooi.app.core.model.publicMapPoint(listing),
        locationDescription = "Vị trí công khai ở mức khu vực. Địa chỉ chi tiết được trao đổi khi hẹn xem.",
        rules = detail.rules.map(String::trim).filter(String::isNotBlank), reviewCount = 0, photoUris = detail.photoUris,
        costs = listOf("Cọc dự kiến: ${rentalPriceLabel(detail.advertisedDeposit)}", "Thời hạn thuê tối thiểu: ${detail.minimumTermMonths} tháng") +
            listOf("Điện" to detail.electricityOffer, "Nước" to detail.waterOffer, "Dịch vụ" to detail.serviceOffer,
                "Có thể nhận phòng từ" to detail.availableFrom).filter { it.second.isNotBlank() }.map { "${it.first}: ${it.second}" },
    )
}

/** Even an ID collision must never route a real backend record to a fixture. */
fun useFixtureDetail(listingId: String, listings: List<PublicListingCard>, debugFixtures: Boolean = false): Boolean =
    (if (debugFixtures) publicDiscoveryFeed(listings).any { it.listingId == listingId }
     else publicDiscoveryFeed(listings).none { it.listingId == listingId }) && ListingFixtures.resolve(listingId) != null
