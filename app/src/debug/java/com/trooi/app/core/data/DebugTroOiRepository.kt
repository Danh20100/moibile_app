package com.trooi.app.core.data

import android.content.Context
import android.content.SharedPreferences
import com.trooi.app.core.model.*
import com.trooi.app.core.demo.DemoPaymentClient
import com.trooi.app.core.network.AuthTokenProvider
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.BackendClient
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Debug-only routing facade. The release source set binds directly to BackendTroOiRepository.
 * Source is selected per call so changing mode never silently falls back to fixture data.
 */
@Singleton
class TroOiRepositoryImpl private constructor(
    private val fixture: Lazy<FixtureTroOiRepository>,
    private val backend: BackendTroOiRepository?,
    private val pinnedFixtureForTests: Boolean,
    private val demoLogin: DemoBackendLogin?,
) : TroOiRepository {
    @Inject constructor(
        @ApplicationContext context: Context,
        backend: BackendTroOiRepository,
        backendApi: BackendApi,
        backendClient: BackendClient,
        tokens: AuthTokenProvider,
    ) : this(
        lazy { initializeDebugFixtures(context); FixtureTroOiRepository(context) },
        backend,
        false,
        DemoBackendLogin(backendClient, backendApi, tokens, context),
    )

    // Retain fixture-only constructors for legacy instrumentation tests, regardless of DEV preference.
    constructor(context: Context) : this(lazy { initializeDebugFixtures(context); FixtureTroOiRepository(context) }, null, true, null)
    internal constructor(prefs: SharedPreferences?) : this(lazy { FixtureTroOiRepository(prefs) }, null, true, null)
    internal constructor() : this(lazy { FixtureTroOiRepository() }, null, true, null)

    private fun selected(): TroOiRepository = if (!pinnedFixtureForTests && RuntimeDataSource.isBackendBacked()) {
        checkNotNull(backend) { "Backend repository unavailable; cannot use fixture fallback." }
    } else fixture.value

    override fun initialSnapshot(): TroOiSnapshot = selected().initialSnapshot()

    override fun clearSession() {
        // Reset both boundaries on mode/account changes; no cross-mode auth reuse.
        if (fixture.isInitialized()) fixture.value.clearSession()
        backend?.clearSession()
    }

    override suspend fun refreshSessionContext() =
        if (!pinnedFixtureForTests && RuntimeDataSource.isBackendBacked() && com.trooi.app.BuildConfig.DEMO_BACKEND_ENABLED) {
            checkNotNull(demoLogin).restore()
        } else selected().refreshSessionContext()
    override suspend fun refreshPublicListings() = selected().refreshPublicListings()
    override suspend fun loadPublicListingPhotos(listingId: String, mediaIds: List<String>) = selected().loadPublicListingPhotos(listingId, mediaIds)
    override suspend fun searchPublicListings(
        latitude: Double, longitude: Double, radiusMeters: Double,
        minPrice: String?, maxPrice: String?,
    ) = selected().searchPublicListings(latitude, longitude, radiusMeters, minPrice, maxPrice)
    override suspend fun authenticateWithGoogleIdToken(idToken: String, nonce: String) =
        selected().authenticateWithGoogleIdToken(idToken, nonce)
    override suspend fun refreshAuthorizedRead(access: AccessCapabilities) =
        selected().refreshAuthorizedRead(access)
    override suspend fun loadNotification(notificationId: String) = selected().loadNotification(notificationId)
    override suspend fun markNotificationRead(notificationId: String) =
        selected().markNotificationRead(notificationId)
    override suspend fun login(identifier: String, password: String) =
        if (!pinnedFixtureForTests && RuntimeDataSource.isBackendBacked() && com.trooi.app.BuildConfig.DEMO_BACKEND_ENABLED) {
            checkNotNull(demoLogin).login(identifier, password)
        } else selected().login(identifier, password)
    override suspend fun signUp(fullName: String, phone: String, email: String, password: String) =
        selected().signUp(fullName, phone, email, password)
    override suspend fun requestPasswordReset(identifier: String) = selected().requestPasswordReset(identifier)
    override suspend fun submitInquiry(listingId: String, message: String) =
        selected().submitInquiry(listingId, message)
    override suspend fun loadLocalConversations() = selected().loadLocalConversations()
    override suspend fun sendMessage(expectedUserId: String, conversationId: String, text: String, images: List<com.trooi.app.core.model.LocalMessageImage>) = selected().sendMessage(expectedUserId, conversationId, text, images)
    override suspend fun openConversation(contextType: String, contextId: String) = selected().openConversation(contextType, contextId)
    override suspend fun readConversation(id: String) = selected().readConversation(id)
    override suspend fun messageAttachment(conversationId: String, attachmentId: String) = selected().messageAttachment(conversationId, attachmentId)
    override suspend fun saveLocalMessage(expectedUserId: String, conversationId: String, text: String) =
        selected().saveLocalMessage(expectedUserId, conversationId, text)
    override suspend fun createDemoCheckout(tenancyId: String, amount: String, key: String) =
        selected().createDemoCheckout(tenancyId, amount, key)
    override suspend fun getDemoCheckout(id: String) = selected().getDemoCheckout(id)
    override suspend fun completeLocalLandlordOnboarding(application: LocalLandlordApplication) =
        selected().completeLocalLandlordOnboarding(application)
    override suspend fun saveLocalAsset(asset: LocalRentalAsset, activate: Boolean, publish: Boolean) =
        selected().saveLocalAsset(asset, activate, publish)
    override suspend fun purchaseLocalCapacity(purchaseId: String) = selected().purchaseLocalCapacity(purchaseId)
    override suspend fun archiveLocalAsset(assetId: String) = selected().archiveLocalAsset(assetId)
}
