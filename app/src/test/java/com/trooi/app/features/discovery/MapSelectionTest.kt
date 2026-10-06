package com.trooi.app.features.discovery

import com.trooi.app.core.model.ListingVisibility
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.publicMapPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MapSelectionTest {
    private val publishedPin = PublicListingCard(
        "pub-1",
        "Phòng công khai",
        "Vị trí công khai",
        PublicGeoPoint(10.77, 106.69),
        "3500000.00",
        ListingVisibility.PUBLISHED,
    )
    private val draftPin = publishedPin.copy(
        listingId = "draft-1",
        visibility = ListingVisibility.DRAFT,
        publicGeoPoint = PublicGeoPoint(10.80, 106.70),
    )
    private val publishedNoPin = publishedPin.copy(listingId = "pub-2", publicGeoPoint = null)

    @Test
    fun markersArePublishedPublicLocationOnly() {
        val markers = publicMapMarkers(listOf(publishedPin, draftPin, publishedNoPin))
        assertEquals(listOf("pub-1"), markers.map { it.listingId })
        assertEquals(PublicGeoPoint(10.77, 106.69), markers.single().publicGeoPoint)
        assertNull(publicMapPoint(draftPin))
        assertNull(publicMapPoint(publishedNoPin))
    }

    @Test
    fun nullPublicPinNeverFallsBackToAreaLabelOrDraftCoordinate() {
        val unlabeled = publishedNoPin.copy(publicAreaLabel = "12 Nguyễn Huệ")
        assertTrue(publicMapMarkers(listOf(unlabeled, draftPin)).isEmpty())
        assertNull(publicMapPoint(unlabeled))
    }

    @Test
    fun cameraAndPickerEmitTransportPointsWithoutInventedLabels() {
        val center = PublicGeoPoint(10.78, 106.70)
        val query = cameraSearch(center, PublicDiscoveryFilters("1000000", "5000000", 3000))
        assertEquals(10.78, query!!.latitude, 0.0)
        assertEquals(106.70, query.longitude, 0.0)
        assertEquals(3000.0, query.radiusMeters, 0.0)
        assertEquals("1000000", query.minPrice)
        assertEquals("5000000", query.maxPrice)
        assertEquals(center, mapPick(center))
        assertNull(cameraSearch(center, PublicDiscoveryFilters(minPrice = "x")))
        assertNull(cameraSearch(center, PublicDiscoveryFilters(radiusMeters = 123)))
    }

    @Test
    fun denyOrMissingFixKeepsManualCameraSearchable() {
        val camera = PublicGeoPoint(10.75, 106.66)
        assertEquals(camera, usableCamera(camera, approximateFix = PublicGeoPoint(1.0, 1.0), locationDenied = true))
        assertEquals(camera, usableCamera(camera, approximateFix = null, locationDenied = false))
        assertNull(usableCamera(current = null, approximateFix = null, locationDenied = true))
        val query = cameraSearch(usableCamera(camera, null, true)!!, PublicDiscoveryFilters(radiusMeters = 1000))
        assertEquals(1000.0, query!!.radiusMeters, 0.0)
        assertEquals(10.75, query.latitude, 0.0)
    }
}
