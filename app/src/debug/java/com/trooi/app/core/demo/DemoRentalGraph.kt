package com.trooi.app.core.demo

import com.trooi.app.core.model.*

/** Debug-only asset facts; all public and operational views share these identities. */
object DemoRentalGraph {
    val AN_NHIEN get() = DebugFixtureCatalog.current.roles.getValue("apartment")
    val OWNER_ID get() = DemoData.accounts[1].userId
    val OWNER_NAME get() = DemoData.accounts[1].displayName
    val all get() = DebugFixtureCatalog.current.domains.rentals
    val occupied get() = all.single { it.asset.id == DemoData.ROOM }.asset
    val apartment get() = all.single { it.asset.id == AN_NHIEN }.asset
    val previous get() = all.single { it.asset.id == DebugFixtureCatalog.current.roles.getValue("previousRoom") }.asset
    fun publicListing(rental: FixtureRental, asset: LocalRentalAsset = rental.asset) = fixturePublicListing(rental, asset)
    /** Historical fixture entitlement, not a runtime purchase or rent payment. */
    val ownerSeed get() = DebugFixtureCatalog.current.domains.ownerSeed
    /** Saved portfolios gain a draft only; activation still needs the capacity review. */
    fun reconcileSavedOwner(saved: LocalManagement): LocalManagement = if (saved.assets.any { it.id == AN_NHIEN }) saved else
        saved.copy(assets = saved.assets + apartment.copy(status = ManagedAssetStatus.DRAFT, listingStatus = ListingVisibility.DRAFT))
}
