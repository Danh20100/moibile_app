package com.trooi.app.features

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.trooi.app.BuildConfig
import com.trooi.app.core.model.ListingVisibility
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.features.discovery.LocationFormState
import com.trooi.app.features.discovery.NativeMapView
import com.trooi.app.features.discovery.PublicDiscoveryFilters
import com.trooi.app.features.discovery.cameraSearch
import com.trooi.app.features.discovery.canCreateProperty
import com.trooi.app.features.discovery.publicMapMarkers
import com.trooi.app.features.discovery.setPrivateAddress
import com.trooi.app.features.discovery.setPrivatePin
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeMapSmokeTest {
    @get:Rule val compose = createComposeRule()

    private val listings = listOf(
        PublicListingCard(
            "pub-1",
            "Phòng A",
            "Vị trí công khai",
            PublicGeoPoint(10.77, 106.69),
            "3500000.00",
            ListingVisibility.PUBLISHED,
        ),
        PublicListingCard(
            "draft-1",
            "Phòng ẩn",
            "12 Nguyễn Huệ",
            PublicGeoPoint(10.80, 106.70),
            "2000000.00",
            ListingVisibility.DRAFT,
        ),
    )

    @Test
    fun publishedMarkersAndCameraSearchStayPublicOnly() {
        assertEquals(listOf("pub-1"), publicMapMarkers(listings).map { it.listingId })
        val query = cameraSearch(PublicGeoPoint(10.77, 106.69), PublicDiscoveryFilters(radiusMeters = 3000))
        assertEquals(10.77, query!!.latitude, 0.0)
        assertEquals(3000.0, query.radiusMeters, 0.0)
    }

    @Test
    fun missingMapsKeyRendersConfigState() {
        assumeTrue(BuildConfig.MAPS_API_KEY.isBlank())
        compose.setContent {
            TroOiTheme {
                NativeMapView(
                    publicMarkers = listings,
                    selectedPoint = null,
                    onCameraCenter = {},
                    onMarkerListing = {},
                    onPick = {},
                )
            }
        }
        compose.onNodeWithTag("native-map-unconfigured").assertIsDisplayed()
        compose.onNodeWithText("Chưa cấu hình bản đồ").assertIsDisplayed()
        assertTrue(publicMapMarkers(listings).isNotEmpty())
    }

    @Test
    fun privatePickerDoesNotFillPublicPin() {
        val form = setPrivatePin(
            setPrivateAddress(LocationFormState(), "12 Nguyễn Huệ"),
            PublicGeoPoint(10.76, 106.68),
        )
        assertEquals(null, form.publicLocation.point)
        assertEquals(false, canCreateProperty("Nhà A", form))
    }
}
