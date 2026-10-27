package com.trooi.app.features.ledger

import com.trooi.app.core.model.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class LedgerPresentationTest {
    @Test fun lifecycleIsPreservedAndCurrentRentalWinsOverHistoryOrUnavailableRead() {
        val state = TroOiUiState(isAuthenticated = true, access = AccessCapabilities(linkedTenancyIds = setOf("ended", "ending", "missing", "cancelled")),
            read = FrontendReadSnapshot(tenancies = listOf(
                TenancyCard("ended", "r1", "Lượt thuê cũ", TenancyLifecycle.ENDED, "v1"),
                TenancyCard("ending", "r2", "Lượt thuê hiện tại", TenancyLifecycle.ENDING, "Điều khoản đang hiệu lực"),
                TenancyCard("cancelled", "r3", "Lượt thuê hủy", TenancyLifecycle.CANCELLED, null))))
        val assets = ledgerTenancies(state)
        assertEquals("ending", selectedLedgerTenancy(assets, null)?.tenancyId)
        assertTrue(assets.single { it.tenancyId == "ending" }.lifecycle.isCurrentRental())
        assertFalse(assets.single { it.tenancyId == "ended" }.lifecycle.isCurrentRental())
        assertEquals("Đã hủy lượt thuê", rentalLifecycleLabel(assets.single { it.tenancyId == "cancelled" }.lifecycle))
        val missing = assets.single { it.tenancyId == "missing" }
        assertNull(missing.lifecycle)
        assertFalse(missing.label.contains("missing"))
        assertEquals("Chưa có thông tin lượt thuê", rentalLifecycleLabel(missing.lifecycle))
    }
    private val tenant = TroOiUiState(isAuthenticated = true, access = AccessCapabilities(linkedTenancyIds = setOf("t1", "t2")))
    private fun source(path: String) = File("src/main/java/com/trooi/app/$path").readText()

    @Test fun noRelationshipNeverFabricatesTenancyEvenWithDemoUnlock() {
        val empty = tenant.copy(access = AccessCapabilities(), demoPreview = true)
        assertTrue(ledgerTenancies(empty).isEmpty())
        assertTrue(ledgerTenancies(empty.copy(demoPreview = false)).isEmpty())
        assertEquals(LedgerMode.TENANT, ledgerPresentation(empty).resolve(null))
        assertTrue(source("features/ledger/LedgerScreen.kt").contains("Chưa có lượt thuê được liên kết với tài khoản."))
    }

    @Test fun linkedAssetsAndSelectorUseSeparateFinanceProjections() {
        val state = tenant.copy(read = FrontendReadSnapshot(tenancies = listOf(
            TenancyCard("t1", "r1", "Studio A", TenancyLifecycle.ACTIVE, "v1"),
            TenancyCard("t2", "r2", "Căn hộ B", TenancyLifecycle.ACTIVE, "v2"),
            TenancyCard("other", "r3", "Không được cấp quyền", TenancyLifecycle.ACTIVE, null),
        )))
        val assets = ledgerTenancies(state)
        assertEquals(2, assets.size)
        assertEquals("Studio A", selectedLedgerTenancy(assets, null)?.label)
        assertEquals("Căn hộ B", selectedLedgerTenancy(assets, "t2")?.label)
        assertEquals("Studio A", selectedLedgerTenancy(assets, "expired")?.label)
        assertNull(ledgerTenancies(tenant).first().roomId)
        assertTrue(ledgerTenancies(state.copy(isAuthenticated = false)).isEmpty())
        val screen = source("features/ledger/LedgerScreen.kt")
        listOf("Tổng quan", "Tiền cọc", "Thanh toán / xác nhận", "Sự cố", "Lịch sử")
            .forEach { assertTrue(it, screen.contains(it)) }
        assertTrue(screen.contains("tenantFinanceByTenancy[selected.tenancyId]"))
        assertTrue(screen.contains("selectedId = asset.tenancyId"))
    }

    @Test fun presentationIsLocalAndLeavesRelationshipsUntouched() {
        assertEquals(LedgerMode.TENANT, ledgerPresentation(tenant).resolve(LedgerMode.OWNER))
        val operator = tenant.copy(access = AccessCapabilities(operatedOrganizationIds = setOf("o")))
        assertEquals(LedgerMode.OWNER, ledgerPresentation(operator).resolve(null))
        val both = tenant.copy(access = tenant.access.copy(operatedOrganizationIds = setOf("o")))
        listOf(ledgerPresentation(both)).forEach {
            assertFalse(it.canSwitch)
            assertEquals(LedgerMode.OWNER, it.resolve(null))
            assertEquals(LedgerMode.OWNER, it.resolve(LedgerMode.OWNER))
            assertEquals(LedgerMode.OWNER, it.resolve(LedgerMode.TENANT))
        }
        assertEquals(setOf("t1", "t2"), both.access.linkedTenancyIds)
        assertEquals(setOf("o"), both.access.operatedOrganizationIds)
        val app = source("ui/TroOiApp.kt")
        assertFalse(app.contains("onMode ="))
        assertFalse(app.contains("onOpenDemoWorkspace"))
        assertTrue(source("features/profile/ProfileScreen.kt").contains("LandlordEntry.ONBOARDING -> onboarding = true"))
    }

    @Test fun financialWordingAndPaymentEntryNeverInferSettlement() {
        val screen = source("features/ledger/LedgerScreen.kt")
        assertFalse(screen.contains("Hóa đơn đã tất toán"))
        assertTrue(screen.contains("Thanh toán đã được xác nhận"))
        assertTrue(screen.contains("Việc ghi nhận thanh toán không xác định khoản phải trả đã được phân bổ đầy đủ."))
        assertTrue(screen.contains("LedgerTenantOverview(state, selected, onFinance)"))
        listOf("createPayment", "createCharge", "createReceipt", "Gateway", "repository", "BackendApi").forEach { assertFalse(it, screen.contains(it)) }
        ownerLedgerSections.forEach { assertTrue(it, screen.contains(it)) }
        assertFalse(screen.contains("createOrganization("))
    }

    @Test fun detailedWorkspacesKeepLedgerTabSelected() {
        listOf(AppPage.TenantHome, AppPage.TenantRental, AppPage.TenantFinance, AppPage.TenantIncidents,
            AppPage.OwnerDashboard, AppPage.OwnerProperties, AppPage.OwnerFinance, AppPage.OwnerIncidents).forEach {
            assertEquals(AppPage.CoreWorkspace, ledgerRootTab(it))
        }
        listOf(AppPage.Discovery, AppPage.Messages, AppPage.Account, AppPage.CoreWorkspace).forEach {
            assertEquals(it, ledgerRootTab(it))
        }
    }

    @Test fun rootRemainsFourTabsAndTravellingNotch() {
        val nav = source("ui/navigation/TroOiBottomNavigation.kt")
        listOf("nav-tab-discovery", "nav-tab-core", "nav-tab-messages", "nav-tab-profile", "animatedCenterX", "notch_center_x").forEach { assertTrue(nav.contains(it)) }
        assertFalse(nav.contains("nav-tab-favorites"))
        assertTrue(source("ui/TroOiApp.kt").contains("AppPage.CoreWorkspace, AppPage.OwnerDashboard -> RentalBookScreen("))
    }
}
