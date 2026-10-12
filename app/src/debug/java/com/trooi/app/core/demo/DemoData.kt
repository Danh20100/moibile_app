package com.trooi.app.core.demo

import com.trooi.app.core.data.UserSession
import com.trooi.app.core.model.*

/** Canonical debug-only graph. Seed history is never a runtime payment confirmation. */
object DemoData {
    val ORGANIZATION get() = DebugFixtureCatalog.current.roles.getValue("organization")
    val PROPERTY get() = DebugFixtureCatalog.current.roles.getValue("property")
    val ROOM get() = DebugFixtureCatalog.current.roles.getValue("room")
    val TENANCY get() = DebugFixtureCatalog.current.roles.getValue("tenancy")
    val accounts = DebugFixtureCatalog.current.accounts.map { it.session() }
    val ownerManagement get() = DemoRentalGraph.ownerSeed
    val occupiedAsset get() = DemoRentalGraph.occupied
    /** Shared seed dialogue references the same rental/listing and account identities as the ledger. */
    fun conversations(userId: String): List<ConversationCard> {
        return DebugFixtureCatalog.current.conversations.filter { userId in it.participantIds }.map { conversation ->
            val other = accounts.single { it.userId == conversation.participantIds.single { id -> id != userId } }
            val asset = DemoRentalGraph.all.single { it.asset.id == conversation.roomId }.asset
            ConversationCard(conversation.id, other.userId, other.displayName, asset.name, asset.id,
                asset.photoResources.firstOrNull(), conversation.messages)
        }
    }
    fun authenticate(identifier: String, password: String): UserSession? {
        // Synthetic sandbox hook; never sent to the backend or packaged in Release.
        if (password != "TroOi2026!") return null
        val id = DebugFixtureCatalog.current.accounts.firstOrNull { it.email == identifier.trim().lowercase() }?.userId
        return accounts.firstOrNull { it.userId == id }
    }
    val read get() = DebugFixtureCatalog.current.domains.read
    fun authorizedRead(access: AccessCapabilities): FrontendReadSnapshot {
        val properties = read.properties.filter { it.organizationId in access.operatedOrganizationIds }
        val rooms = read.operationalRooms.filter { room -> properties.any { it.propertyId == room.propertyId } }
        val tenancies = read.tenancies.filter { it.tenancyId in access.linkedTenancyIds || rooms.any { room -> room.roomId == it.roomId } }
        return read.copy(
            rentalHistory = if (TENANCY in access.linkedTenancyIds) read.rentalHistory else emptyList(),
            rentalAssetPresentationByRoom = read.rentalAssetPresentationByRoom.filterKeys { id -> tenancies.any { it.roomId == id } },
            organizations = read.organizations.filter { it.organizationId in access.operatedOrganizationIds },
            properties = properties, operationalRooms = rooms,
            operatorListings = read.operatorListings.filter { listing -> rooms.any { it.roomId == listing.roomId } },
            tenancies = tenancies,
            tenantFinanceByTenancy = read.tenantFinanceByTenancy.filterKeys { it in access.linkedTenancyIds },
            noticesByTenancy = read.noticesByTenancy.filterKeys { id -> tenancies.any { it.tenancyId == id } },
            operatorFinanceByOrganization = read.operatorFinanceByOrganization.filterKeys { it in access.operatedOrganizationIds },
            operatorFinanceByRoom = read.operatorFinanceByRoom.filterKeys { id -> rooms.any { it.roomId == id } },
            incidents = read.incidents.filter { incident -> tenancies.any { it.roomId == incident.roomId } },
            dashboardByOrganization = read.dashboardByOrganization.filterKeys { it in access.operatedOrganizationIds },
        )
    }
}
