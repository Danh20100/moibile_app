package com.trooi.app.features.profile

import com.trooi.app.core.model.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class ProfilePresentationTest {
    @Test fun identityAndModesUseSessionRelationships() {
        val tenant = TroOiUiState(isAuthenticated = true, displayName = "  Lan  ", backendUserId = "user", access = AccessCapabilities(linkedTenancyIds = setOf("tenancy")))
        assertEquals("  Lan  ", profilePresentation(tenant).name)
        assertEquals("Thành viên TrọƠi", profilePresentation(tenant.copy(displayName = "")).name)
        assertFalse(profilePresentation(tenant).hasOperator)
        assertEquals("Người thuê", profileContextLabel(tenant))
        assertEquals("Thành viên TrọƠi", profileContextLabel(tenant.copy(access = AccessCapabilities())))
        val both = tenant.copy(access = tenant.access.copy(operatedOrganizationIds = setOf("org")))
        assertTrue(profilePresentation(both).hasOperator)
        assertEquals("Chủ trọ", profileContextLabel(both))
        assertTrue(profilePresentation(both).operatorDefault)
        assertEquals("Quản lý tài sản cho thuê", profilePresentation(both).landlordTitle)
        assertTrue(profilePresentation(both.copy(access = both.access.copy(linkedTenancyIds = emptySet()))).operatorDefault)
        assertEquals(setOf("tenancy"), both.access.linkedTenancyIds)
        assertEquals(setOf("org"), both.access.operatedOrganizationIds)
    }

    @Test fun availabilityAndEntriesRequireActualOperatorRelationships() {
        val tenant = TroOiUiState(isAuthenticated = true, displayName = "Lan", access = AccessCapabilities(linkedTenancyIds = setOf("t")))
        assertEquals(LandlordEntry.ONBOARDING, profilePresentation(tenant).landlordEntry)
        assertFalse(profilePresentation(tenant).canSwitch)
        assertFalse(profilePresentation(tenant).operatorDefault)
        val operator = tenant.copy(access = tenant.access.copy(operatedOrganizationIds = setOf("o")))
        assertEquals(LandlordEntry.REAL_OPERATIONS, profilePresentation(operator).landlordEntry)
        assertTrue(profilePresentation(operator).hasOperator)
        assertFalse(profilePresentation(operator.copy(isAuthenticated = false)).hasOperator)
        assertEquals(setOf("t"), operator.access.linkedTenancyIds)
    }

    @Test fun onboardingDoesNotPersistIdentityMediaOrOfferInstantUnlock() {
        val source = File("src/main/java/com/trooi/app/features/profile/LandlordOnboardingScreen.kt").readText()
        assertTrue(source.contains("TakePicturePreview"))
        assertTrue(source.contains("identityPhoto(context, uri)"))
        assertTrue(source.contains("onComplete(application)"))
        listOf("CHẾ ĐỘ DEMO", "Dữ liệu minh họa", "readOnly = true", "rememberSaveable", "SharedPreferences", "createOrganization").forEach { assertFalse(it, source.contains(it)) }
        assertFalse(source.contains("khu trọ"))
    }
    @Test fun existingRoutesAndUnsupportedActionsRemainExplicit() {
        fun source(path: String) = File("src/main/java/com/trooi/app/$path").readText()
        val screen = source("features/profile/ProfileScreen.kt")
        val app = source("ui/TroOiApp.kt")
        val model = source("ui/TroOiViewModel.kt")
        assertFalse(screen.contains("khu trọ"))
        assertFalse(screen.contains("Thợ sửa chữa · Dịch vụ vận hành"))
        assertTrue(screen.contains("snackbar.showSnackbar(PROFILE_CONNECTIONS_MESSAGE)"))
        listOf("onLogin = viewModel::openLogin", "onNotifications = viewModel::openNotifications", "onSettings = viewModel::openSettings", "onHelp = viewModel::openHelp", "onLogout = viewModel::logout", "onOpenWorkspace = viewModel::openCoreWorkspace").forEach { assertTrue(app.contains(it)) }
        assertTrue(app.contains("AppPage.AuthLogin -> LoginScreen("))
        assertTrue(app.contains("TroOiBottomNavigation("))
        assertTrue(app.contains("onCompleteLandlord = viewModel::completeLocalLandlordOnboarding"))
        assertTrue(model.contains("fun openOwnerProperties() = openContext(AppContext.OPERATIONS, AppPage.OwnerProperties)"))
        assertTrue(screen.contains("if (state.isAuthenticated) ActionRow("))
        assertFalse(screen.contains("profile-mode-tenant"))
        assertFalse(screen.contains("profile-mode-operator"))
        assertFalse(screen.contains("selectContext("))
        assertFalse(screen.contains("repository"))
        assertFalse(screen.contains("USER.role"))
        assertTrue(screen.contains("snackbar.showSnackbar(PROFILE_UNSUPPORTED_MESSAGE)"))
        assertEquals("Tính năng đang được phát triển.", PROFILE_UNSUPPORTED_MESSAGE)
        val nav = source("ui/navigation/TroOiBottomNavigation.kt")
        assertTrue(nav.contains("notch_center_x"))
        assertTrue(nav.contains("animatedCenterX"))
        assertFalse(nav.contains("nav-tab-favorites"))
    }
}
