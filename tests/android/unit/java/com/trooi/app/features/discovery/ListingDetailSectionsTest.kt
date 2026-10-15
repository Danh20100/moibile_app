package com.trooi.app.features.discovery

import org.junit.Assert.*
import org.junit.Test

class ListingDetailSectionsTest {
    @Test fun commonAmenityLabelsUseAppropriateIcons() {
        assertEquals(AmenityVisual.WIFI, amenityVisual("Wi-Fi"))
        assertEquals(AmenityVisual.AIR_CONDITIONING, amenityVisual("Máy lạnh"))
        assertEquals(AmenityVisual.LAUNDRY, amenityVisual("Máy giặt chung"))
        assertEquals(AmenityVisual.PARKING, amenityVisual("Chỗ để xe"))
        assertEquals(AmenityVisual.KITCHEN, amenityVisual("Bếp riêng"))
        assertEquals(AmenityVisual.CAMERA, amenityVisual("Camera khu vực chung"))
        assertEquals(AmenityVisual.BATHROOM, amenityVisual("Phòng tắm riêng"))
        assertEquals(AmenityVisual.ELEVATOR, amenityVisual("Thang máy"))
    }

    @Test fun unknownAmenityGetsNeutralIconWithoutInventingFeatures() {
        assertEquals(AmenityVisual.OTHER, amenityVisual("Tiện ích tùy chỉnh"))
        assertEquals(AmenityVisual.OTHER, amenityVisual(""))
    }

    @Test fun costsAreOnlyReformattedNotRecalculated() {
        assertEquals(
            CostDisplayRow("Cọc dự kiến", "2.800.000đ"),
            costDisplayRow("Cọc dự kiến: 2.800.000đ"),
        )
        assertEquals(
            CostDisplayRow("Điện", "Trao đổi với chủ trọ"),
            costDisplayRow("Điện: Trao đổi với chủ trọ"),
        )
        assertEquals(
            CostDisplayRow("Phí", "Liên hệ: trao đổi thêm"),
            costDisplayRow("Phí: Liên hệ: trao đổi thêm"),
        )
        assertEquals(
            CostDisplayRow("Chưa có thông tin", ""),
            costDisplayRow("Chưa có thông tin"),
        )
    }

    @Test fun allFixtureAmenitiesAndCostLinesRetainDisplayMapping() {
        ListingFixtures.all.forEach { fixture ->
            fixture.amenities.forEach { amenity ->
                assertTrue("Empty amenity label", amenity.isNotBlank())
                assertNotNull(amenityVisual(amenity))
            }
            fixture.costs.forEach { source ->
                val display = costDisplayRow(source)
                assertEquals(source, if (display.value.isEmpty()) display.label else
                    "${display.label}: ${display.value}")
            }
        }
    }
}
