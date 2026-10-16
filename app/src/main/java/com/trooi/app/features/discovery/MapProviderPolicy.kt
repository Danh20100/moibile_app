package com.trooi.app.features.discovery

/**
 * MapLibre + OpenFreeMap is the no-billing default.
 * Google is opt-in; missing Google credentials always resolve to MapLibre.
 * This decision never makes a network/billing API request.
 */
internal enum class MapProvider {
    MAPLIBRE,
    GOOGLE,
}

internal fun selectMapProvider(
    preference: String,
    googleApiKey: String,
): MapProvider = when (preference.trim().lowercase()) {
    "google" -> if (googleApiKey.isNotBlank()) MapProvider.GOOGLE else MapProvider.MAPLIBRE
    "auto" -> if (googleApiKey.isNotBlank()) MapProvider.GOOGLE else MapProvider.MAPLIBRE
    else -> MapProvider.MAPLIBRE
}

internal const val OPENFREEMAP_LIBERTY_STYLE =
    "https://tiles.openfreemap.org/styles/liberty"

/** Prevent silently using an unencrypted tile source or malformed URL. */
internal fun selectMapLibreStyle(configuredStyle: String): String {
    val value = configuredStyle.trim()
    if (value.isBlank()) return OPENFREEMAP_LIBERTY_STYLE
    val uri = runCatching { java.net.URI(value) }.getOrNull()
    if (uri?.scheme?.lowercase() != "https" ||
        uri.host.isNullOrBlank() ||
        uri.userInfo != null ||
        uri.fragment != null
    ) return OPENFREEMAP_LIBERTY_STYLE
    return value
}
