package com.trooi.app.features

import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.AppPage
import com.trooi.app.core.model.canOpenPage
import com.trooi.app.core.model.accountTabSelected
import com.trooi.app.core.model.activityDecisions
import com.trooi.app.core.model.sharedBackPage
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedSurfaceNavigationTest {
    @Test
    fun operationsKeepsAccountSelectedOnSettingsAndHelp() {
        assertTrue(accountTabSelected(AppPage.Account))
        assertTrue(accountTabSelected(AppPage.Settings))
        assertTrue(accountTabSelected(AppPage.Help))
        assertFalse(accountTabSelected(AppPage.OwnerDashboard))
        assertFalse(canOpenPage(AppPage.Settings, false, AccessCapabilities()))
        assertTrue(canOpenPage(AppPage.Settings, true, AccessCapabilities()))
    }

    @Test
    fun settingsAndHelpReturnToTheirCaller() {
        assertEquals(AppPage.Account, sharedBackPage(AppPage.Settings, AppPage.Account))
        assertEquals(AppPage.Settings, sharedBackPage(AppPage.Help, AppPage.Settings))
        assertEquals(AppPage.Account, sharedBackPage(AppPage.Help, null))
    }

    @Test
    fun closedActivityDecisionsStayDisabledAndNoticesStayOnTheSelectedTenancy() {
        val decisions = activityDecisions()
        assertEquals(listOf("CLAIM", "REVIEW", "INQUIRY_ACTIVITY"), decisions.map { it.id })
        assertTrue(decisions.all { !it.enabled && it.reason.isNotBlank() })
        val rental = source("com/trooi/app/features/tenancy/RentalWorkspace.kt")
        val tenant = source("com/trooi/app/features/tenant/TenantScreens.kt")
        assertTrue(rental.contains("Thông báo theo lượt thuê đang chọn"))
        assertTrue(tenant.contains("Chưa có thông báo cho lượt thuê đang chọn."))
        assertFalse(source("com/trooi/app/features/shared/SharedSettingsHelpScreens.kt").contains("http"))
    }

    private fun source(relative: String) =
        File(System.getProperty("user.dir"), "src/main/java/$relative").readText()
}
