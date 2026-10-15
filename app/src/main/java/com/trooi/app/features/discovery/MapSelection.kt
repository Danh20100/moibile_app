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

data class PrivateOperationalLocation(
    val address: String = "",
    val point: PublicGeoPoint? = null,
)

data class PublicListingLocation(
    val point: PublicGeoPoint? = null,
    val confirmed: Boolean = false,
)

data class LocationFormState(
    val privateLocation: PrivateOperationalLocation = PrivateOperationalLocation(),
    val publicLocation: PublicListingLocation = PublicListingLocation(),
)

fun setPrivateAddress(state: LocationFormState, address: String): LocationFormState =
    state.copy(privateLocation = state.privateLocation.copy(address = address))

fun setPrivatePin(state: LocationFormState, point: PublicGeoPoint): LocationFormState =
    state.copy(privateLocation = state.privateLocation.copy(point = point))

fun setPublicPin(state: LocationFormState, point: PublicGeoPoint): LocationFormState =
    state.copy(publicLocation = PublicListingLocation(point = point, confirmed = false))

fun confirmPublicPin(state: LocationFormState): LocationFormState {
    val point = state.publicLocation.point ?: return state
    return state.copy(publicLocation = PublicListingLocation(point = point, confirmed = true))
}

fun canCreateProperty(name: String, state: LocationFormState): Boolean =
    name.isNotBlank() &&
        state.privateLocation.address.isNotBlank() &&
        state.privateLocation.point != null &&
        state.publicLocation.point != null &&
        state.publicLocation.confirmed

fun canCreateListing(title: String, description: String, price: String, publicLocation: PublicListingLocation): Boolean =
    title.isNotBlank() &&
        description.isNotBlank() &&
        price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?")) &&
        publicLocation.point != null &&
        publicLocation.confirmed
