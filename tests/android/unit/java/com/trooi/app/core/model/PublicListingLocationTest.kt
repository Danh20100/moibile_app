package com.trooi.app.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class PublicListingLocationTest {
    @Test fun namedSourceAreaStaysInPublicOverviewAndMap() {
        val description = "Duplex full nội thất; giờ giấc tự do. Địa chỉ nguồn: Lê Quý Đôn, phường Bình Thọ, Thủ Đức."
        assertEquals(
            "Lê Quý Đôn, phường Bình Thọ, Thủ Đức",
            publicAreaNameFromPublishedDescription(description),
        )
        assertEquals("Duplex full nội thất; giờ giấc tự do", roomDescriptionWithoutPublicAddress(description))
    }

    @Test fun absentPublishedLocationNeverInventsPreciseAddress() {
        assertEquals("Chưa công khai tên khu vực", publicAreaNameFromPublishedDescription("Phòng có điều hòa"))
        assertEquals("Phòng có điều hòa", roomDescriptionWithoutPublicAddress("Phòng có điều hòa"))
    }

    @Test fun legacyDemoSuffixIsNeverVisibleInRoomDescription() {
        val published = "Phòng có bếp; có bảo vệ. Địa chỉ nguồn: Đông Hòa, Dĩ An. [DEMO — vị trí ước lượng]"
        assertEquals("Đông Hòa, Dĩ An", publicAreaNameFromPublishedDescription(published))
        assertEquals("Phòng có bếp; có bảo vệ", roomDescriptionWithoutPublicAddress(published))
    }
}
