package com.trooi.app.core.demo

import com.trooi.app.R
import com.trooi.app.core.model.*

/** Debug-only asset facts; all public and operational views share these identities. */
object DemoRentalGraph {
    const val AN_NHIEN = "fixture-room-an-nhien"
    const val OWNER_ID = "fixture-user-ha"
    const val OWNER_NAME = "Trần Thu Hà"
    data class Rental(val ownerId: String, val ownerName: String, val organizationId: String,
        val asset: LocalRentalAsset, val publicPoint: PublicGeoPoint? = null)
    val occupied = LocalRentalAsset(DemoData.ROOM, DemoData.PROPERTY, "Căn hộ", "Căn hộ A02",
        "Nhà Phú Nhuận · Căn hộ A02", "Phường 7, Phú Nhuận", "32", "5200000", "5200000",
        "Căn hộ với phòng khách thoáng và khu bếp riêng. Có ban công, tủ đồ rộng và chỗ để xe. Không gian phù hợp sinh hoạt dài hạn.",
        furnishing = "Đủ nội thất", amenities = listOf("Wi-Fi", "Máy lạnh", "Bếp riêng", "Ban công", "Chỗ để xe"),
        rules = listOf("Giữ yên tĩnh sau 22:30", "Không hút thuốc", "Tối đa 2 người"),
        photoResources = listOf(R.drawable.rental_living, R.drawable.rental_bedroom, R.drawable.rental_kitchen),
        status = ManagedAssetStatus.ACTIVE, listingStatus = ListingVisibility.UNPUBLISHED, occupied = true,
        electricityOffer = "3.500đ/kWh", waterOffer = "20.000đ/m³", maxOccupants = 2, publicListingId = "demo-mini")
    val apartment = LocalRentalAsset(AN_NHIEN, "fixture-property-linh-trung", "Căn hộ", "Căn hộ An Nhiên",
        "Nhà Linh Trung · Căn hộ An Nhiên", "Linh Trung, Thủ Đức", "28", "3200000", "3200000",
        "Căn hộ sáng thoáng với góc làm việc cạnh cửa sổ và bếp riêng. Khu dân cư yên tĩnh, thuận tiện đi chợ và di chuyển đến các trường đại học.",
        furnishing = "Đủ nội thất", amenities = listOf("Wi-Fi", "Máy lạnh", "Bếp riêng", "Máy giặt chung", "Chỗ để xe", "Camera khu vực chung"),
        rules = listOf("Giữ yên tĩnh sau 22:00", "Tối đa 2 người", "Thú cưng: trao đổi trước"),
        photoResources = listOf(R.drawable.rental_studio, R.drawable.rental_kitchen, R.drawable.rental_balcony),
        status = ManagedAssetStatus.ACTIVE, listingStatus = ListingVisibility.PUBLISHED,
        electricityOffer = "3.500đ/kWh", waterOffer = "20.000đ/m³", maxOccupants = 2, availableFrom = "2026-10-15", publicListingId = "demo-studio")
    private val room = LocalRentalAsset("fixture-room-window", "fixture-property-binh-thanh", "Phòng trọ", "Phòng trọ có cửa sổ",
        "Nhà Bình Thạnh · Phòng có cửa sổ", "Bình Thạnh, TP.HCM", "22", "2800000", "2800000",
        "Phòng riêng gọn gàng, nhiều ánh sáng và có khu để xe chung. Có sẵn giường, tủ và bàn làm việc, gần tiện ích hằng ngày.",
        furnishing = "Đủ nội thất", amenities = listOf("Wi-Fi", "Máy lạnh", "Máy giặt chung", "Chỗ để xe"),
        rules = listOf("Giữ yên tĩnh sau 22:00", "Tối đa 2 người", "Thú cưng: trao đổi trước"),
        photoResources = listOf(R.drawable.rental_bedroom, R.drawable.rental_balcony),
        status = ManagedAssetStatus.ACTIVE, listingStatus = ListingVisibility.PUBLISHED,
        electricityOffer = "Trao đổi với chủ trọ", waterOffer = "Trao đổi với chủ trọ",
        bathroomArrangement = BathroomArrangement.PRIVATE, maxOccupants = 2, publicListingId = "demo-room")
    val previous = room.copy(id = "fixture-room-previous-lan", name = "Phòng B03", status = ManagedAssetStatus.ARCHIVED,
        listingStatus = ListingVisibility.ARCHIVED, publicListingId = "fixture-listing-previous-b03")
    val all = listOf(
        Rental(OWNER_ID, OWNER_NAME, DemoData.ORGANIZATION, occupied),
        Rental(OWNER_ID, OWNER_NAME, DemoData.ORGANIZATION, apartment, PublicGeoPoint(10.87, 106.80)),
        Rental("fixture-user-nam", "Hoàng Nam", "fixture-organization-nam", room, PublicGeoPoint(10.81, 106.71)),
        Rental("fixture-user-nam", "Hoàng Nam", "fixture-organization-nam", previous))
    fun publicListing(rental: Rental, asset: LocalRentalAsset = rental.asset) = PublicListingCard(
        asset.listingId, asset.name, asset.publicArea, rental.publicPoint.takeIf { asset.publicArea == rental.asset.publicArea },
        "${asset.monthlyRent}đ/tháng", asset.listingStatus, asset.amenities, rentalDetails = asset.publicDetails(rental.ownerName))
    /** Historical fixture entitlement, not a runtime purchase or rent payment. */
    val ownerSeed = LocalManagement(listOf(occupied, apartment), listOf(LocalSlotEntitlement(
        "fixture-history-an-nhien-capacity", java.time.Instant.parse("2027-10-01T00:00:00Z").toEpochMilli())))
    /** Saved portfolios gain a draft only; activation still needs the capacity review. */
    fun reconcileSavedOwner(saved: LocalManagement): LocalManagement = if (saved.assets.any { it.id == AN_NHIEN }) saved else
        saved.copy(assets = saved.assets + apartment.copy(status = ManagedAssetStatus.DRAFT, listingStatus = ListingVisibility.DRAFT))
}
