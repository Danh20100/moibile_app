package com.trooi.app.features.discovery

import org.junit.Assert.assertEquals
import org.junit.Test

class MapProviderPolicyTest {
    @Test
    fun freeProviderIsDefaultEvenIfGoogleKeyExists() {
        assertEquals(MapProvider.MAPLIBRE, selectMapProvider("", "google-key"))
        assertEquals(MapProvider.MAPLIBRE, selectMapProvider("maplibre", "google-key"))
        assertEquals(MapProvider.MAPLIBRE, selectMapProvider("unknown", "google-key"))
    }

    @Test
    fun googleRequiresExplicitOptInAndKey() {
        assertEquals(MapProvider.GOOGLE, selectMapProvider("google", "google-key"))
        assertEquals(MapProvider.MAPLIBRE, selectMapProvider("google", ""))
        assertEquals(MapProvider.MAPLIBRE, selectMapProvider("AUTO", ""))
        assertEquals(MapProvider.GOOGLE, selectMapProvider("auto", "google-key"))
    }

    @Test
    fun freeTilesHaveKnownOpenStyleAndRejectUnsafeOverrides() {
        assertEquals(
            "https://tiles.openfreemap.org/styles/liberty",
            selectMapLibreStyle(""),
        )
        assertEquals(OPENFREEMAP_LIBERTY_STYLE, selectMapLibreStyle("http://tiles.example/style"))
        assertEquals(OPENFREEMAP_LIBERTY_STYLE, selectMapLibreStyle("https://user:secret@example.org/style"))
        assertEquals(OPENFREEMAP_LIBERTY_STYLE, selectMapLibreStyle("invalid-url"))
        assertEquals(
            "https://tiles.custom.example/style.json",
            selectMapLibreStyle("https://tiles.custom.example/style.json"),
        )
    }
}
