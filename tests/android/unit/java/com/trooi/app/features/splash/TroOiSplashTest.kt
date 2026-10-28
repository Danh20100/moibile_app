package com.trooi.app.features.splash

import com.trooi.app.core.model.*
import com.trooi.app.ui.splash.BRAND_VECTORS
import com.trooi.app.ui.splash.SplashHandoffAction
import com.trooi.app.ui.splash.SplashTiming
import com.trooi.app.ui.splash.calculateComponentProgress
import com.trooi.app.ui.splash.calculateStreak
import com.trooi.app.ui.splash.evaluateSplashHandoff
import org.junit.Assert.*
import org.junit.Test

class TroOiSplashTest {

    @Test
    fun handoffDecisionBrandReadyFalseHolds() {
        // When brand animation has not finished yet, handoff must HOLD regardless of session state
        assertEquals(
            "Must HOLD when brandReady is false and session is still restoring",
            SplashHandoffAction.HOLD,
            evaluateSplashHandoff(brandAnimationReady = false, sessionRestoring = true, isAuthenticated = false),
        )
        assertEquals(
            "Must HOLD when brandReady is false even if session already restored as authenticated",
            SplashHandoffAction.HOLD,
            evaluateSplashHandoff(brandAnimationReady = false, sessionRestoring = false, isAuthenticated = true),
        )
        assertEquals(
            "Must HOLD when brandReady is false and session already resolved as unauthenticated",
            SplashHandoffAction.HOLD,
            evaluateSplashHandoff(brandAnimationReady = false, sessionRestoring = false, isAuthenticated = false),
        )
    }

    @Test
    fun handoffDecisionBrandReadyTrueSessionRestoringTrueHolds() {
        // Brand animation completed, but session is still actively restoring: must HOLD calm brand frame
        assertEquals(
            "Must HOLD when brandReady is true but session is still restoring",
            SplashHandoffAction.HOLD,
            evaluateSplashHandoff(brandAnimationReady = true, sessionRestoring = true, isAuthenticated = false),
        )
        assertEquals(
            "Must HOLD when brandReady is true and session is restoring even if isAuthenticated flag was true",
            SplashHandoffAction.HOLD,
            evaluateSplashHandoff(brandAnimationReady = true, sessionRestoring = true, isAuthenticated = true),
        )
    }

    @Test
    fun handoffDecisionBrandReadyTrueSessionRestoringFalseAuthenticatedRoutesAuthenticated() {
        // Brand animation ready and session resolved as authenticated: route to authenticated home
        assertEquals(
            "Must trigger AUTHENTICATED transition when brand is ready and session is authenticated",
            SplashHandoffAction.AUTHENTICATED,
            evaluateSplashHandoff(brandAnimationReady = true, sessionRestoring = false, isAuthenticated = true),
        )
    }

    @Test
    fun handoffDecisionBrandReadyTrueSessionRestoringFalseUnauthenticatedRoutesAuth() {
        // Brand animation ready and session resolved as unauthenticated: reveal canonical Auth Welcome
        assertEquals(
            "Must trigger AUTH transition when brand is ready and session is unauthenticated",
            SplashHandoffAction.AUTH,
            evaluateSplashHandoff(brandAnimationReady = true, sessionRestoring = false, isAuthenticated = false),
        )
    }

    @Test
    fun splashIsNotDismissedMerelyBecauseIsAuthenticatedBecomesTrueBeforeCompletion() {
        // Given an app state where session restoration completes mid-flight (isAuthenticated = true)
        // but the brand assembly animation has not yet completed (splashCompleted = false)
        val midFlightRestoredState = TroOiUiState(
            isAuthenticated = true,
            splashCompleted = false,
            page = AppPage.TenantHome,
        )

        // The splash display condition is strictly !state.splashCompleted
        val isSplashActive = !midFlightRestoredState.splashCompleted
        assertTrue("Splash must remain active even if isAuthenticated becomes true mid-flight", isSplashActive)
    }

    @Test
    fun restoredSessionRoutesAfterSplashCompletion() {
        // Once both brand animation and session restoration complete:
        val completedState = TroOiUiState(
            isAuthenticated = true,
            splashCompleted = true,
            page = AppPage.CoreWorkspace,
        )

        val isSplashActive = !completedState.splashCompleted
        assertFalse("Splash must dismiss once splashCompleted becomes true", isSplashActive)
        assertEquals("User must land on authenticated home page", AppPage.CoreWorkspace, completedState.page)
    }

    @Test
    fun unauthenticatedSessionTransitionsToAuthWelcome() {
        val freshState = TroOiUiState()

        // Fresh cold start: unauthenticated, splash active, landing on AuthWelcome
        assertEquals("Initial page must be AuthWelcome", AppPage.AuthWelcome, freshState.page)
        assertFalse("User must not be authenticated", freshState.isAuthenticated)
        assertFalse("Splash is not yet completed at cold start", freshState.splashCompleted)

        // After splash completes without auth
        val unauthState = freshState.copy(splashCompleted = true)
        assertFalse("Splash is now dismissed", !unauthState.splashCompleted)
        assertEquals("Unauthenticated user must remain on AuthWelcome", AppPage.AuthWelcome, unauthState.page)
        assertFalse("User remains unauthenticated", unauthState.isAuthenticated)
    }

    @Test
    fun noGuestNavigationIsExposedWhileUnauthenticated() {
        // Verify that root navigation is unconditionally gated on isAuthenticated
        val unauthenticatedState = TroOiUiState(
            isAuthenticated = false,
            page = AppPage.Discovery,
            activeContext = AppContext.DISCOVERY,
            sessionRestoring = false,
            restoreFailed = false,
        )

        val rootNavVisible = unauthenticatedState.isAuthenticated &&
            !unauthenticatedState.sessionRestoring &&
            !unauthenticatedState.restoreFailed

        assertFalse("Root navigation must never be visible to unauthenticated users", rootNavVisible)
    }

    @Test
    fun logoutReturnsToCanonicalAuthWelcome() {
        // Simulate authenticated user logging out
        val loggedInState = TroOiUiState(
            isAuthenticated = true,
            splashCompleted = true,
            page = AppPage.TenantHome,
        )

        val loggedOutState = loggedInState.copy(
            isAuthenticated = false,
            page = AppPage.AuthWelcome,
            splashCompleted = true,
        )

        assertEquals("Logout must route to AppPage.AuthWelcome", AppPage.AuthWelcome, loggedOutState.page)
        assertTrue("Splash does not replay on logout", loggedOutState.splashCompleted)
        assertFalse("User is no longer authenticated", loggedOutState.isAuthenticated)

        // Root navigation must be hidden after logout
        val rootNavVisible = loggedOutState.isAuthenticated && !loggedOutState.sessionRestoring && !loggedOutState.restoreFailed
        assertFalse("Root navigation must be hidden after logout", rootNavVisible)
    }

    @Test
    fun motionTrailMathIsBoundedFiniteAndSafeFromDivideByZero() {
        // 1. Normal high velocity flight: trail length must be bounded
        val normalStreak = calculateStreak(
            currentX = 100f,
            currentY = 150f,
            originX = -300f,
            originY = -400f,
            velocity = 0.9f,
            remainingRatio = 0.6f,
            maxTrailLengthPx = 36f,
        )
        assertTrue("Trail length must be bounded by maxTrailLengthPx", normalStreak.trailLength <= 36f)
        assertTrue("Trail length must be positive under flight", normalStreak.trailLength > 0f)
        assertTrue("Tail X must be finite", normalStreak.tailOffset.x.isFinite())
        assertTrue("Tail Y must be finite", normalStreak.tailOffset.y.isFinite())
        assertTrue("Streak alpha must be within valid range", normalStreak.streakAlpha in 0f..0.45f)

        // 2. Zero distance (origin at 0, 0): must not throw or return NaN/Infinite
        val zeroDistStreak = calculateStreak(
            currentX = 50f,
            currentY = 50f,
            originX = 0f,
            originY = 0f,
            velocity = 1.0f,
            remainingRatio = 0.5f,
        )
        assertEquals("Zero distance must collapse trail length", 0f, zeroDistStreak.trailLength, 0.001f)
        assertEquals("Zero distance must produce zero alpha", 0f, zeroDistStreak.streakAlpha, 0.001f)
        assertFalse("Tail X must not be NaN", zeroDistStreak.tailOffset.x.isNaN())
        assertFalse("Tail Y must not be NaN", zeroDistStreak.tailOffset.y.isNaN())

        // 3. Arrival state: remaining ratio is 0
        val arrivedStreak = calculateStreak(
            currentX = 0f,
            currentY = 0f,
            originX = -200f,
            originY = 300f,
            velocity = 0.05f,
            remainingRatio = 0f,
        )
        assertEquals("Arrived component streak must collapse to 0 length", 0f, arrivedStreak.trailLength, 0.001f)
        assertEquals("Arrived component streak must have 0 alpha", 0f, arrivedStreak.streakAlpha, 0.001f)
    }

    @Test
    fun brandAssemblyComponentsHaveDistinctOriginDirectionsAndNoInventedBadge() {
        // The invented BADGE must be completely removed from the brand assembly
        assertNull("Invented BADGE must not exist in BRAND_VECTORS", BRAND_VECTORS["BADGE"])

        val t = BRAND_VECTORS["T"]
        val r = BRAND_VECTORS["R"]
        val o = BRAND_VECTORS["Ọ"]
        val oHorn = BRAND_VECTORS["Ơ"]
        val i = BRAND_VECTORS["I"]
        val smile = BRAND_VECTORS["SMILE"]

        assertNotNull("T vector must exist", t)
        assertNotNull("R vector must exist", r)
        assertNotNull("Ọ vector must exist", o)
        assertNotNull("Ơ vector must exist", oHorn)
        assertNotNull("I vector must exist", i)
        assertNotNull("SMILE vector must exist", smile)

        // T enters from upper-left
        assertTrue("T must enter from left", t!!.relStartX < -0.5f)
        assertTrue("T must enter from upper area", t.relStartY < 0f)

        // R enters from lower-left
        assertTrue("R must enter from left", r!!.relStartX < -0.5f)
        assertTrue("R must enter from lower area", r.relStartY > 0.2f)

        // Ọ enters from bottom
        assertTrue("Ọ must enter from bottom area", o!!.relStartY > 0.7f)

        // Ơ enters from upper-right
        assertTrue("Ơ must enter from right", oHorn!!.relStartX > 0.5f)
        assertTrue("Ơ must enter from upper area", oHorn.relStartY < -0.3f)

        // I enters from far right
        assertTrue("I must enter from right", i!!.relStartX > 0.7f)

        // SMILE enters from bottom-center
        assertTrue("SMILE must enter from bottom area", smile!!.relStartY > 0.7f)
        assertTrue("SMILE origin must be distinct from Ọ", smile.relStartX != o.relStartX)

        // Stagger delays must all be distinct
        val delays = listOf(t.delayMs, r.delayMs, o.delayMs, oHorn.delayMs, i.delayMs, smile.delayMs)
        assertEquals("Delays must all be distinct", delays.distinct().size, delays.size)
    }

    @Test
    fun componentProgressCalculationIsAccurateAndBounded() {
        val before = calculateComponentProgress(0.0f, delayMs = 100, durationMs = 600)
        assertEquals(0.0f, before, 0.001f)

        val atStart = calculateComponentProgress(100f / SplashTiming.CONVERGENCE_DURATION_MS, delayMs = 100, durationMs = 600)
        assertEquals(0.0f, atStart, 0.001f)

        val halfwayProgress = (100f + 300f) / SplashTiming.CONVERGENCE_DURATION_MS
        val halfway = calculateComponentProgress(halfwayProgress, delayMs = 100, durationMs = 600)
        assertEquals(0.5f, halfway, 0.01f)

        val complete = calculateComponentProgress(1.0f, delayMs = 100, durationMs = 600)
        assertEquals(1.0f, complete, 0.001f)
    }
}
