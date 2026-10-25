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
        listing.rentalDetails?.let { return@map publicRentalDetail(listing).card }
        if (allowDemoFallback) ListingFixtures.resolve(listing.listingId)
            ?.takeIf { it.card.title == listing.title && it.card.publicAreaLabel == listing.publicAreaLabel }
            ?.let { return@map it.card }
        DiscoveryListingItem(
            listingId = listing.listingId,
            title = listing.title,
            publicAreaLabel = listing.publicAreaLabel,
            askingPriceLabel = listing.askingPriceLabel?.let(::rentalPriceLabel) ?: "Liên hệ để biết giá",
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

fun publicRentalDetail(listing: PublicListingCard): ListingFixture {
    val detail = listing.rentalDetails
    val card = DiscoveryListingItem(listing.listingId, listing.title, listing.publicAreaLabel,
            listing.askingPriceLabel?.let(::explorePriceVnd)?.let { "${rentalPriceLabel(it.toPlainString())}/tháng" }
                ?: listing.askingPriceLabel?.takeIf { it.isNotBlank() } ?: "Liên hệ để biết giá",
            detail?.let { "${it.area} m² · ${it.furnishing}" }.orEmpty(), category = detail?.type ?: "Phòng cho thuê",
            photoUris = listing.photoUris.ifEmpty { detail?.photoUris.orEmpty() }, photoResources = detail?.photoResources.orEmpty())
    return ListingFixture(
        card = card,
        images = detail?.photoResources.orEmpty(), summary = detail?.let { (listOf(it.type, "${it.area} m²") +
            if (it.type == "Căn hộ") listOf("${it.bedrooms} phòng ngủ", "${it.bathrooms} phòng tắm")
            else listOfNotNull(when (it.bathroomArrangement) { BathroomArrangement.PRIVATE -> "WC riêng"; BathroomArrangement.SHARED -> "WC chung"; null -> null })
            ).plus(listOfNotNull(it.maxOccupants?.let { count -> "Tối đa $count người" }, it.floorLabel?.takeIf(String::isNotBlank)?.let { floor -> "Tầng $floor" })).joinToString(" · ") }.orEmpty(),
        host = detail?.host.orEmpty(), description = detail?.description?.takeIf(String::isNotBlank)
            ?: com.trooi.app.core.model.roomDescriptionWithoutPublicAddress(listing.publicDescription),
        amenities = listing.amenities,
        publicGeoPoint = com.trooi.app.core.model.publicMapPoint(listing),
        locationDescription = "Vị trí công khai ở mức khu vực. Địa chỉ chi tiết được trao đổi khi hẹn xem.",
        rules = detail?.rules.orEmpty().map(String::trim).filter(String::isNotBlank), reviewCount = 0,
        photoUris = listing.photoUris.ifEmpty { detail?.photoUris.orEmpty() }, publicPhotoIds = listing.publicPhotoIds,
        costs = detail?.let { listOf("Cọc dự kiến: ${rentalPriceLabel(it.advertisedDeposit)}", "Thời hạn thuê tối thiểu: ${it.minimumTermMonths} tháng") +
            listOf("Điện" to it.electricityOffer, "Nước" to it.waterOffer, "Dịch vụ" to it.serviceOffer,
                "Có thể nhận phòng từ" to it.availableFrom).filter { it.second.isNotBlank() }.map { "${it.first}: ${it.second}" }
        } ?: emptyList(),
    )
}

/** Even an ID collision must never route a real backend record to a fixture. */
fun useFixtureDetail(listingId: String, listings: List<PublicListingCard>, debugFixtures: Boolean = false): Boolean =
    (if (debugFixtures) publicDiscoveryFeed(listings).any { it.listingId == listingId }
     else publicDiscoveryFeed(listings).none { it.listingId == listingId }) && ListingFixtures.resolve(listingId) != null
