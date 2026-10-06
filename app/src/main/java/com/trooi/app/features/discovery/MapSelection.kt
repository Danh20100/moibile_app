package com.trooi.app.features.discovery

import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.publicMapPoint

data class MapSearchQuery(
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Double,
    val minPrice: String?,
    val maxPrice: String?,
)

fun publicMapMarkers(listings: List<PublicListingCard>): List<PublicListingCard> =
    listings.mapNotNull { listing ->
        val point = publicMapPoint(listing) ?: return@mapNotNull null
        listing.copy(publicGeoPoint = point)
    }

fun cameraSearch(center: PublicGeoPoint, filters: PublicDiscoveryFilters): MapSearchQuery? {
    if (filters.validationMessage() != null) return null
    val radius = filters.searchRadiusMeters() ?: return null
    return MapSearchQuery(
        latitude = center.latitude,
        longitude = center.longitude,
        radiusMeters = radius.toDouble(),
        minPrice = filters.minPrice.trim().takeIf { it.isNotEmpty() },
        maxPrice = filters.maxPrice.trim().takeIf { it.isNotEmpty() },
    )
}

fun usableCamera(
    current: PublicGeoPoint?,
    approximateFix: PublicGeoPoint?,
    locationDenied: Boolean,
): PublicGeoPoint? {
    if (locationDenied) return current
    return current ?: approximateFix
}

fun mapPick(point: PublicGeoPoint): PublicGeoPoint = PublicGeoPoint(point.latitude, point.longitude)
