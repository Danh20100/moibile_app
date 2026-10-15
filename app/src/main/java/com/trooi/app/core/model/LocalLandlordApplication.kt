package com.trooi.app.core.model

/** Transient onboarding input. Identity images are never submitted or persisted. */
data class LocalLandlordApplication(
    val fullName: String,
    val birthDate: String,
    val phone: String,
    val email: String,
    val identityDetailsReviewed: Boolean,
    val contactConfirmed: Boolean,
    val termsAccepted: Boolean,
    val firstAsset: LocalRentalAsset?,
    val publish: Boolean,
) {
    fun valid(): Boolean = fullName.trim().length >= 2 &&
        runCatching { java.time.LocalDate.parse(birthDate).isBefore(java.time.LocalDate.now()) }.getOrDefault(false) &&
        phone.replace(" ", "").matches(Regex("(0|\\+84)\\d{9,10}")) && email.trim().matches(Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) &&
        identityDetailsReviewed && contactConfirmed && termsAccepted &&
        (firstAsset == null && !publish || firstAsset != null &&
            firstAsset.valid() && !firstAsset.occupied &&
            (firstAsset.photoUris.isNotEmpty() || firstAsset.photoResources.isNotEmpty()) &&
            (!publish || firstAsset.readyToPublish()))
}
