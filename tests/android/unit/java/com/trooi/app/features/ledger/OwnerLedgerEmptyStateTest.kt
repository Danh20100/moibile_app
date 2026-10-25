package com.trooi.app.features.ledger

import com.trooi.app.core.model.*
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OwnerLedgerEmptyStateTest {
    private val owner = TroOiUiState(
        isAuthenticated = true,
        access = AccessCapabilities(operatedOrganizationIds = setOf("org-me")),
        read = FrontendReadSnapshot(
            organizations = listOf(OrganizationCard("org-me", "Không gian chủ trọ")),
            localManagement = LocalManagement(),
        ),
    )

    @Test fun justCreatingAnOrganizationStillShowsFirstUseIllustration() {
        assertFalse(ownerLedgerHasOperationalContent(owner))
    }

    @Test fun anotherOrganizationPropertyCannotTurnOnMyDashboard() {
        assertFalse(ownerLedgerHasOperationalContent(owner.copy(
            read = owner.read.copy(properties = listOf(PropertyCard("p-other", "org-other", "Phòng người khác"))),
        )))
    }

    @Test fun aPropertyWithoutRoomsStillShowsFirstUseState() {
        assertFalse(ownerLedgerHasOperationalContent(owner.copy(
            read = owner.read.copy(properties = listOf(PropertyCard("p-me", "org-me", "Khu trọ A"))),
        )))
    }

    @Test fun aRealOperationalRoomRevealsOwnerDashboard() {
        assertTrue(ownerLedgerHasOperationalContent(owner.copy(
            read = owner.read.copy(
                properties = listOf(PropertyCard("p-me", "org-me", "Khu trọ A")),
                operationalRooms = listOf(OperationalRoomCard(
                    "r-me", "p-me", "Phòng A", RoomOperationalState.VACANT, RecordLifecycle.ACTIVE,
                )),
            ),
        )))
    }

    @Test fun aSavedDraftRoomPreservesManagementWorkflow() {
        val asset = LocalRentalAsset(
            id = "room-1", propertyId = "p-me", type = "Phòng trọ", name = "Phòng A",
            operationalAddress = "Địa chỉ vận hành", publicArea = "Thủ Đức",
            area = "20", monthlyRent = "3000000", advertisedDeposit = "1000000",
        )
        assertTrue(ownerLedgerHasOperationalContent(owner.copy(
            read = owner.read.copy(localManagement = LocalManagement(assets = listOf(asset))),
        )))
    }

    @Test fun scopedFinanceRecordsCannotDisappearBehindIllustration() {
        val finance = OperatorFinanceProjection(charges = listOf(
            ChargeCard("charge-1", "Tiền thuê", "3000000", "3000000"),
        ))
        assertTrue(ownerLedgerHasOperationalContent(owner.copy(
            read = owner.read.copy(operatorFinanceByOrganization = mapOf("org-me" to finance)),
        )))
        assertFalse(ownerLedgerHasOperationalContent(owner.copy(
            read = owner.read.copy(operatorFinanceByOrganization = mapOf("org-other" to finance)),
        )))
    }
}
