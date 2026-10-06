package com.trooi.app.features

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UxWarningRegressionTest {
    private fun source(relative: String): String =
        File(System.getProperty("user.dir"), "src/main/java/" + relative).readText()

    @Test
    fun discoveryDoesNotExposeRawSpatialContractInputs() {
        val ui = source("com/trooi/app/features/tenant/TenantScreens.kt")
        assertFalse(ui.contains("Vĩ độ tâm tìm kiếm"))
        assertFalse(ui.contains("Kinh độ tâm tìm kiếm"))
        assertFalse(ui.contains("discovery-search-latitude"))
        assertFalse(ui.contains("discovery-search-longitude"))
        assertTrue(ui.contains("Dùng vị trí hiện tại"))
        assertTrue(ui.contains("1 km"))
        assertTrue(ui.contains("3 km"))
        assertTrue(ui.contains("5 km"))
        assertFalse(ui.contains("Backend Debug"))
        assertFalse(ui.contains("discovery-open-map-picker"))
    }

    @Test
    fun appUsesContextSwitcherAndTenantSpecificShell() {
        val app = source("com/trooi/app/ui/TroOiApp.kt")
        val switcher = source("com/trooi/app/features/shared/ContextSwitcherScreen.kt")
        assertTrue(app.contains("V1ContextSwitcherScreen"))
        assertTrue(app.contains("V1TenantNavigation"))
        listOf("Trang chủ", "Nhà tôi", "Thanh toán", "Sự cố", "Tài khoản").forEach {
            assertTrue(app.contains("\"$it\""))
        }
        assertTrue(switcher.contains("Chọn nơi bạn muốn sử dụng"))
    }

    @Test
    fun authenticatedLandingIsResolvedFromRelationships() {
        val viewModel = source("com/trooi/app/ui/TroOiViewModel.kt")
        val reducer = source("com/trooi/app/core/model/ContextSelection.kt")
        assertTrue(viewModel.contains("landingFor(session.access, remembered)"))
        assertTrue(viewModel.contains("reconcileContext"))
        assertTrue(viewModel.contains("selectContext"))
        assertTrue(reducer.contains("linkedTenancyIds"))
        assertTrue(reducer.contains("operatedOrganizationIds"))
        assertTrue(viewModel.contains("AppPage.ContextSwitcher"))
        assertTrue(viewModel.contains("AppPage.TenantHome"))
        assertTrue(viewModel.contains("AppPage.OwnerDashboard"))
    }
}
