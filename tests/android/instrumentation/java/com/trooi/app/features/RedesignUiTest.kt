package com.trooi.app.features

import androidx.compose.ui.test.*
import androidx.compose.runtime.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.trooi.app.core.model.*
import com.trooi.app.features.discovery.*
import com.trooi.app.features.auth.AuthWelcomeActions
import com.trooi.app.features.profile.*
import com.trooi.app.ui.theme.TroOiTheme
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class RedesignUiTest {
    @get:Rule val compose = createComposeRule()

    @Test fun welcomeHasOnlyLoginAndRegisterEntries() {
        var logins = 0
        var registrations = 0
        compose.setContent { TroOiTheme { AuthWelcomeActions({ logins++ }, { registrations++ }) } }
        compose.onNodeWithText("Khám phá phòng").assertDoesNotExist()
        compose.onNodeWithText("Đăng nhập").performClick()
        compose.onNodeWithText("Đăng ký").performClick()
        assertEquals(1, logins)
        assertEquals(1, registrations)
    }

    @Test fun cardOpensMatchingDetail() {
        var opened: String? = null
        val card = ListingFixtures.all.first().card
        compose.setContent {
            var page by remember { mutableStateOf<AppPage>(AppPage.Discovery) }
            TroOiTheme {
                if (page is AppPage.ListingDetail) ListingDetailScreen((page as AppPage.ListingDetail).listingId, { page = AppPage.Discovery })
                else ExploreListingCard(card, false, {}, { opened = card.listingId; page = AppPage.ListingDetail(card.listingId) })
            }
        }
        compose.onNodeWithTag("explore-card-${card.listingId}").performClick()
        compose.onNodeWithTag("listing-detail-${card.listingId}").assertExists()
        compose.onNodeWithText(card.title).assertExists()
        assertEquals(card.listingId, opened)
        assertEquals(card, ListingFixtures.resolve(opened!!)!!.card)
    }

    @Test fun detailPagerFavoriteBackAndLocalCta() {
        var backs = 0
        compose.setContent { TroOiTheme { ListingDetailScreen("demo-studio", { backs++ }) } }
        compose.onNodeWithTag("listing-image-indicator").assertTextEquals("1/3")
        compose.onNodeWithTag("listing-hero-pager").performTouchInput { swipeLeft() }
        compose.onNodeWithTag("listing-image-indicator").assertTextEquals("2/3")
        // No local favorite or fake viewing CTA: published listings offer verified contact/report affordances.
        compose.onNodeWithTag("listing-share").assertExists()
        compose.onNodeWithTag("listing-open-report").assertExists()
        compose.onNodeWithTag("listing-contact-cta").assertIsDisplayed().performClick()
        // Contact CTA scrolls to the bottom, where the hero back button is lazily uncomposed.
        compose.onNodeWithTag("listing-detail-demo-studio").performScrollToIndex(0)
        compose.onNodeWithTag("listing-back").performClick()
        assertEquals(1, backs)
    }

    @Test fun unauthenticatedProfileIsNotPresented() {
        compose.setContent { TroOiTheme { ProfileScreen(TroOiUiState(displayName = "Fake")) } }
        compose.onNodeWithTag("profile-scroll").assertDoesNotExist()
        compose.onNodeWithText("Fake").assertDoesNotExist()
    }

    @Test fun privateAvatarActionIsExposedOnlyWhenBackendUploadIsAvailable() {
        val authenticated = TroOiUiState(isAuthenticated = true, displayName = "Lan", backendUserId = "user-1")
        var backendAvailable by mutableStateOf(false)
        compose.setContent {
            TroOiTheme {
                ProfileScreen(
                    authenticated,
                    onUploadAvatar = if (backendAvailable) ({ _, _ -> Result.success(Unit) }) else null,
                )
            }
        }
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("profile-personal"))
        compose.onNodeWithTag("profile-personal").performClick()
        compose.onNodeWithTag("profile-avatar-change").assertDoesNotExist()
        compose.runOnIdle { backendAvailable = true }
        compose.onNodeWithTag("profile-avatar-change").assertExists()
    }

    @Test fun tenantCannotGainOperatorCapabilityWithoutCompletingOnboarding() {
        val state = TroOiUiState(isAuthenticated = true, displayName = "Lan", backendUserId = "u",
            access = AccessCapabilities(linkedTenancyIds = setOf("t")))
        var completions = 0
        compose.setContent { TroOiTheme { ProfileScreen(state, onCompleteLandlord = { completions++; Result.success(Unit) }) } }
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("profile-landlord-cta"))
        compose.onNodeWithTag("profile-landlord-cta").performClick()
        compose.onNodeWithText("CHẾ ĐỘ DEMO").assertDoesNotExist()
        // Step 0 intro leads to mandatory CCCD capture; birthday is on the next guarded step.
        compose.onNodeWithTag("onboarding-next").performClick()
        compose.onNodeWithTag("onboarding-id-front").assertExists()
        compose.onNodeWithTag("onboarding-id-back").assertExists()
        compose.onNodeWithTag("onboarding-next").assertIsNotEnabled()
        compose.onNodeWithTag("onboarding-birthday").assertDoesNotExist()
        assertEquals(0, completions)
        assertTrue(state.access.operatedOrganizationIds.isEmpty())
    }
    @Test fun operatorOnlyOpensRealOperationsWithoutFakeTenantSwitch() {
        var opened = 0
        compose.setContent { TroOiTheme { ProfileScreen(TroOiUiState(isAuthenticated = true, displayName = "Lan",
            access = AccessCapabilities(operatedOrganizationIds = setOf("o"))), onOpenWorkspace = { opened++ }) } }
        compose.onNodeWithTag("profile-mode-tenant").assertDoesNotExist()
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("profile-landlord-cta"))
        compose.onNodeWithText("Quản lý tài sản cho thuê").assertExists()
        compose.onNodeWithTag("profile-landlord-cta").performClick()
        compose.onNodeWithTag("onboarding-scroll").assertDoesNotExist()
        assertEquals(1, opened)
    }

    @Test fun dualContextSwitchOnlyChangesPresentationAndUnsupportedShowsSnackbar() {
        val state = TroOiUiState(isAuthenticated = true, displayName = "Lan", access = AccessCapabilities(linkedTenancyIds = setOf("t"), operatedOrganizationIds = setOf("o")))
        var workspaces = 0
        compose.setContent { TroOiTheme { ProfileScreen(state, onOpenWorkspace = { workspaces++ }) } }
        compose.onNodeWithTag("profile-mode-operator").assertDoesNotExist()
        compose.onNodeWithTag("profile-mode-tenant").assertDoesNotExist()
        compose.onNodeWithText("Chủ trọ · Người thuê").assertExists()
        assertEquals(setOf("t"), state.access.linkedTenancyIds)
        assertEquals(setOf("o"), state.access.operatedOrganizationIds)
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("profile-landlord-cta"))
        compose.onNodeWithTag("profile-landlord-cta").performClick()
        assertEquals(1, workspaces)
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("profile-connections"))
        compose.onNodeWithTag("profile-connections").performClick()
        compose.onNodeWithText(PROFILE_CONNECTIONS_MESSAGE).assertExists()
    }

    @Test fun realProfileCallbacksRemainReachable() {
        var notifications = 0
        var settings = 0
        var help = 0
        var logout = 0
        compose.setContent { TroOiTheme { ProfileScreen(
            TroOiUiState(isAuthenticated = true, displayName = "Lan"),
            onNotifications = { notifications++ },
            onSettings = { settings++ },
            onHelp = { help++ },
            onLogout = { logout++ },
        ) } }
        compose.onNodeWithTag("profile-notification-bell").performClick()
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("account-settings"))
        compose.onNodeWithTag("account-settings").performClick()
        // Settings and help are caller-owned navigation callbacks; Profile must not show fake local pages.
        compose.runOnIdle { assertEquals(1, settings) }
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("account-help"))
        compose.onNodeWithTag("account-help").performClick()
        compose.runOnIdle { assertEquals(1, help) }
        compose.onNodeWithTag("profile-scroll").performScrollToNode(hasTestTag("account-logout"))
        compose.onNodeWithTag("account-logout").performClick()
        compose.runOnIdle { assertEquals(0, logout) }
        compose.onAllNodesWithText("Đăng xuất").onLast().performClick()
        compose.runOnIdle { assertEquals(listOf(1, 1, 1, 1), listOf(notifications, settings, help, logout)) }
    }

}
