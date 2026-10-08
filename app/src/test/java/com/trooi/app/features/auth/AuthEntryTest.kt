package com.trooi.app.features.auth

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class AuthEntryTest {
    @Test fun welcomeAndFirstEntryHaveNoGuestBypassAndKeepAuthActions() {
        fun source(path: String) = File("src/main/java/com/trooi/app/$path").readText()
        listOf("features/auth/AuthScreens.kt", "ui/splash/TroOiSplashScreen.kt").forEach {
            val text = source(it)
            assertFalse(text.contains("Khám phá phòng"))
            assertFalse(text.contains("onExplore"))
        }
        val app = source("ui/TroOiApp.kt")
        assertFalse(source("ui/TroOiViewModel.kt").contains("exploreAsGuest"))
        assertTrue(app.contains("!state.isAuthenticated && state.page !in setOf(AppPage.AuthLogin, AppPage.AuthSignUp, AppPage.AuthForgotPassword)"))
        assertTrue(app.contains("onLogin = viewModel::openLogin"))
        assertTrue(app.contains("onSignUp = viewModel::openSignUp"))
        assertTrue(app.contains("viewModel.bootstrapRestore(context)"))
    }
}
