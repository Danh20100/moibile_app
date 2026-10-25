package com.trooi.app.core.model

/**
 * Derive an *area name only from the already-published listing description*.
 * Never infer or expose a private Property street address from coordinates.
 *
 * This format is present in the local university-seed catalog. Real listings
 * without a named public area should be marked as unavailable, not fabricated.
 */
fun publicAreaNameFromPublishedDescription(description: String): String {
    val address = description.substringAfter("Địa chỉ nguồn:", "")
        .substringBefore(" [DEMO")
        .trim()
        .trimEnd('.', ' ')
    return address.takeIf { it.isNotBlank() } ?: "Chưa công khai tên khu vực"
}

/** Source address is presented in Overview and Map, not repeated in room details. */
fun roomDescriptionWithoutPublicAddress(description: String): String =
    description.substringBefore("Địa chỉ nguồn:")
        .substringBefore("[DEMO")
        .trim()
        .trimEnd(';', '.', ' ')
