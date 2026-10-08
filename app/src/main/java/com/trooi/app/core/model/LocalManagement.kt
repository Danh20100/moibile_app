package com.trooi.app.core.model

enum class ManagedAssetStatus { DRAFT, ACTIVE, ARCHIVED }
enum class BathroomArrangement { PRIVATE, SHARED }

/** Local product metadata. Offered costs are not agreed tenancy terms or billing records. */
data class LocalRentalAsset(
    val id: String,
    val propertyId: String,
    val type: String,
    val name: String,
    val operationalAddress: String,
    val publicArea: String,
    val area: String,
    val monthlyRent: String,
    val advertisedDeposit: String,
    val description: String = "",
    val bedrooms: String = "1",
    val bathrooms: String = "1",
    val furnishing: String = "Chưa có nội thất",
    val amenities: List<String> = emptyList(),
    val rules: List<String> = emptyList(),
    val photoUris: List<String> = emptyList(),
    val photoResources: List<Int> = emptyList(),
    val status: ManagedAssetStatus = ManagedAssetStatus.DRAFT,
    val listingStatus: ListingVisibility = ListingVisibility.DRAFT,
    val occupied: Boolean = false,
    val electricityOffer: String = "",
    val waterOffer: String = "",
    val serviceOffer: String = "",
    val minimumTermMonths: String = "12",
    val availableFrom: String = "",
    val operationalLatitude: String = "",
    val operationalLongitude: String = "",
    val bathroomArrangement: BathroomArrangement? = null,
    val maxOccupants: Int? = null,
    val floorLabel: String? = null,
    val publicListingId: String? = null,
) {
    val listingId: String get() = publicListingId ?: "local-listing-$id"
    fun valid(): Boolean = type in listOf("Phòng trọ", "Căn hộ") && name.isNotBlank() &&
        operationalAddress.isNotBlank() && publicArea.isNotBlank() &&
        area.toBigDecimalOrNull()?.let { it.signum() > 0 } == true &&
        monthlyRent.toBigDecimalOrNull()?.let { it.signum() > 0 } == true &&
        advertisedDeposit.toBigDecimalOrNull()?.let { it.signum() >= 0 } == true &&
        (maxOccupants == null || maxOccupants > 0) &&
        !(type == "Phòng trọ" && bathroomArrangement == BathroomArrangement.SHARED && "Phòng tắm riêng" in amenities)
    fun readyToPublish(): Boolean = valid() && !occupied && description.isNotBlank() &&
        (photoUris.isNotEmpty() || photoResources.isNotEmpty())
}

/** Public-only supplement: never includes the exact address or operational coordinates. */
data class PublicRentalDetails(
    val type: String, val area: String, val bedrooms: String, val bathrooms: String,
    val furnishing: String, val description: String, val host: String,
    val photoUris: List<String>, val photoResources: List<Int>, val rules: List<String>,
    val advertisedDeposit: String, val electricityOffer: String, val waterOffer: String,
    val serviceOffer: String, val minimumTermMonths: String, val availableFrom: String,
    val bathroomArrangement: BathroomArrangement? = null, val maxOccupants: Int? = null, val floorLabel: String? = null,
)

fun LocalRentalAsset.publicDetails(host: String) = PublicRentalDetails(type, area, bedrooms, bathrooms,
    furnishing, description, host, photoUris, photoResources, rules, advertisedDeposit,
    electricityOffer, waterOffer, serviceOffer, minimumTermMonths, availableFrom, bathroomArrangement, maxOccupants, floorLabel)

data class LocalSlotEntitlement(val purchaseId: String, val validUntilEpochMillis: Long)

/** Dedicated product entitlement; it never creates rental-finance entities. */
data class LocalManagement(
    val assets: List<LocalRentalAsset> = emptyList(),
    val entitlements: List<LocalSlotEntitlement> = emptyList(),
) {
    val used: Int get() = assets.count { it.status == ManagedAssetStatus.ACTIVE }
    fun capacity(now: Long = System.currentTimeMillis()): Int = 1 + entitlements.count { it.validUntilEpochMillis > now }
    fun purchase(purchaseId: String, now: Long = System.currentTimeMillis()): LocalManagement {
        require(purchaseId.isNotBlank()) { "Thiếu mã xác nhận mua dung lượng." }
        if (entitlements.any { it.purchaseId == purchaseId }) return this
        val expiry = java.time.Instant.ofEpochMilli(now).atZone(java.time.ZoneOffset.UTC).plusYears(1).toInstant().toEpochMilli()
        return copy(entitlements = entitlements + LocalSlotEntitlement(purchaseId, expiry))
    }
    fun save(asset: LocalRentalAsset, activate: Boolean, publish: Boolean): LocalManagement {
        require(asset.id.isNotBlank() && asset.propertyId.isNotBlank() && asset.name.isNotBlank() && asset.type in listOf("Phòng trọ", "Căn hộ")) { "Nhập tên và loại tài sản." }
        val previous = assets.firstOrNull { it.id == asset.id }
        val protected = if (previous == null) asset else asset.copy(propertyId = previous.propertyId, occupied = previous.occupied,
            publicListingId = previous.publicListingId)
        require(!publish || protected.readyToPublish()) { "Cần ảnh, nội dung hợp lệ và tài sản còn trống trước khi đăng." }
        require(!(activate || publish) || protected.valid()) { "Hoàn tất thông tin tài sản trước khi quản lý." }
        require(!(activate || publish) || previous?.status == ManagedAssetStatus.ACTIVE || used < capacity()) { "Dung lượng quản lý đã đầy." }
        val next = protected.copy(
            status = if (activate || publish || previous?.status == ManagedAssetStatus.ACTIVE) ManagedAssetStatus.ACTIVE else ManagedAssetStatus.DRAFT,
            listingStatus = if (publish) ListingVisibility.PUBLISHED else if (previous?.listingStatus == ListingVisibility.PUBLISHED) ListingVisibility.UNPUBLISHED else ListingVisibility.DRAFT,
        )
        return copy(assets = assets.filterNot { it.id == next.id } + next)
    }
    fun archive(id: String): LocalManagement {
        require(assets.any { it.id == id }) { "Không tìm thấy tài sản." }
        return copy(assets = assets.map {
            if (it.id == id) it.copy(status = ManagedAssetStatus.ARCHIVED,
                listingStatus = if (it.listingStatus == ListingVisibility.PUBLISHED) ListingVisibility.UNPUBLISHED else it.listingStatus) else it
        })
    }
}
