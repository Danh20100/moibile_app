package com.trooi.app.features.discovery

import com.trooi.app.core.model.PublicGeoPoint
import org.junit.Assert.*
import org.junit.Test

class StreetMapProjectionTest {
    @Test fun visibleMapPixelRoundTripsAndWrapsAtDateLine() {
        listOf(PublicGeoPoint(0.0, 0.0), PublicGeoPoint(10.8, 106.7), PublicGeoPoint(-45.0, -170.0)).forEach { point ->
            val (x, y) = mapPixel(point, 15)
            val restored = mapPoint(x, y, 15)
            assertEquals(point.latitude, restored.latitude, 0.000001)
            assertEquals(point.longitude, restored.longitude, 0.000001)
        }
        assertEquals(-180.0, mapPoint(256.0 * (1 shl 2), 512.0, 2).longitude, 0.000001)
        assertTrue(mapPoint(0.0, -10000.0, 2).latitude <= 85.052)
    }
}
