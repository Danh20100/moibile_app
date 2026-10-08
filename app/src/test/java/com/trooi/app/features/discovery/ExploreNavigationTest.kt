package com.trooi.app.features.discovery

import com.trooi.app.core.model.*
import com.trooi.app.ui.navigation.CoreTabIdentity
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class ExploreNavigationTest {

    private fun source(relative: String): String =
        File(System.getProperty("user.dir"), "src/main/java/$relative").readText()

    @Test
    fun unauthenticatedRootNavigationAndProfileAreUnavailable() {
        val unauthenticated = TroOiUiState(splashCompleted = true, page = AppPage.Discovery)
        listOf(AppPage.Discovery, AppPage.Account, AppPage.AuthLogin, AppPage.Messages).forEach {
            assertFalse(rootNavigationVisible(unauthenticated.copy(page = it)))
        }
        assertFalse(canOpenPage(AppPage.Account, false, unauthenticated.access))
        assertTrue(rootNavigationVisible(unauthenticated.copy(isAuthenticated = true)))
        assertFalse(rootNavigationVisible(unauthenticated.copy(isAuthenticated = true, sessionRestoring = true)))
    }

    @Test
    fun authenticatedRootNavigationContainsExpectedFourDestinations() {
        val navSource = source("com/trooi/app/ui/navigation/TroOiBottomNavigation.kt")
        assertTrue("Must contain Khám phá destination", navSource.contains("\"Khám phá\""))
        assertFalse("Must not contain Yêu thích destination in 4-tab nav", navSource.contains("\"Yêu thích\""))
        assertTrue("Must contain core placeholder destination", navSource.contains("CoreTabIdentity.TEMPORARY_LABEL"))
        assertTrue("Must contain Tin nhắn destination", navSource.contains("\"Tin nhắn\""))
        assertTrue("Must contain Hồ sơ destination", navSource.contains("\"Hồ sơ\""))
    }

    @Test
    fun rootBottomNavigationDoesNotContainMapOrActivity() {
        val navSource = source("com/trooi/app/ui/navigation/TroOiBottomNavigation.kt")
        assertFalse("Bottom navigation must not have 'Bản đồ' destination", navSource.contains("\"Bản đồ\""))
        assertFalse("Bottom navigation must not have 'Hoạt động' destination", navSource.contains("\"Hoạt động\""))
    }

    @Test
    fun exploreHomeDoesNotExposeOldDirectSearchForm() {
        val exploreSource = source("com/trooi/app/features/discovery/ExploreScreen.kt")
        assertFalse("Explore Home must not contain raw developer spatial search", exploreSource.contains("spatial search"))
        assertFalse("Explore Home must not contain debug preview banner", exploreSource.contains("DỮ LIỆU MINH HỌA · Chưa kết nối Backend"))
        assertFalse("Explore Home must not contain old radius selector directly", exploreSource.contains("discovery-radius-"))
        assertFalse("Explore Home must not contain old direct min price input directly on feed", exploreSource.contains("discovery-filter-min-price"))
    }

    @Test
    fun searchExperienceDoesNotContainTravelSemantics() {
        val exploreSource = source("com/trooi/app/features/discovery/ExploreScreen.kt")
        assertFalse("Search must not contain 'Thời gian'", exploreSource.contains("Thời gian"))
        assertFalse("Search must not contain 'Khách'", exploreSource.contains("Khách"))
        assertFalse("Search must not contain 'nights'", exploreSource.contains("nights"))
        assertFalse("Search must not contain 'guest count'", exploreSource.contains("guest count"))
        assertTrue("Search experience must contain location card", exploreSource.contains("search-location-card"))
        assertTrue("Search experience must contain price card", exploreSource.contains("search-price-card"))
        assertTrue("Search experience must contain room type card", exploreSource.contains("search-room-type-card"))
    }

    @Test
    fun centerTabIdentityIsIsolatedForEasyRename() {
        assertEquals("Sổ", CoreTabIdentity.TEMPORARY_LABEL)
        assertNotNull(CoreTabIdentity.icon)
    }

    @Test
    fun newDestinationsCanBeNavigatedWhenAuthenticated() {
        val access = AccessCapabilities()
        assertTrue(canOpenPage(AppPage.Discovery, true, access))
        assertTrue(canOpenPage(AppPage.Favorites, true, access))
        assertTrue(canOpenPage(AppPage.CoreWorkspace, true, access))
        assertTrue(canOpenPage(AppPage.Messages, true, access))
        assertTrue(canOpenPage(AppPage.Account, true, access))
    }
}
