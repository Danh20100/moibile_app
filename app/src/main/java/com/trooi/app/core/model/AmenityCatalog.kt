package com.trooi.app.core.model

data class AmenityOption(val id: String, val label: String, val icon: String)

/** Stable identifiers stay independent of Vietnamese labels so Discovery can reuse this catalog. */
object AmenityCatalog {
    val options = listOf(
        AmenityOption("wifi", "Wi-Fi", "wifi"),
        AmenityOption("air_conditioning", "Điều hòa", "air_conditioning"),
        AmenityOption("washing_machine", "Máy giặt", "washing_machine"),
        AmenityOption("kitchen", "Bếp", "kitchen"),
        AmenityOption("private_bathroom", "Phòng tắm riêng", "bathroom"),
        AmenityOption("balcony", "Ban công", "balcony"),
        AmenityOption("parking", "Chỗ để xe", "parking"),
        AmenityOption("elevator", "Thang máy", "elevator"),
        AmenityOption("security_camera", "Camera an ninh", "security_camera"),
    )

    private val byId = options.associateBy(AmenityOption::id)
    fun label(value: String): String = byId[value]?.label ?: value
    fun isPrivateBathroom(value: String): Boolean = value == "private_bathroom" || value == "Phòng tắm riêng"
}
