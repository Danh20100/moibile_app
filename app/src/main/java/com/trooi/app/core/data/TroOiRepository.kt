package com.trooi.app.core.data

import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.FrontendReadSnapshot
import com.trooi.app.core.model.NotificationCard
import com.trooi.app.core.model.PublicListingCard

data class TroOiSnapshot(
    val read: FrontendReadSnapshot = FrontendReadSnapshot(),
    val demoPreview: Boolean = false,
)

data class UserSession(
    val userId: String,
    val displayName: String,
    /** Relationships/capabilities are issued by the authorized Backend, not selected at login. */
    val access: AccessCapabilities,
    val pictureUrl: String? = null,
)

interface TroOiRepository {
    suspend fun loadLocalConversations(): Result<List<com.trooi.app.core.model.ConversationCard>> = Result.success(emptyList())
    suspend fun saveLocalMessage(expectedUserId: String, conversationId: String, text: String): Result<FrontendReadSnapshot> =
        Result.failure(IllegalStateException("Nhắn tin đang được phát triển."))
    suspend fun createDemoCheckout(tenancyId: String, amount: String, key: String): Result<com.trooi.app.features.shared.GatewayCheckout> =
        Result.failure(IllegalStateException("Thanh toán chưa khả dụng."))
    suspend fun getDemoCheckout(id: String): Result<com.trooi.app.features.shared.GatewayCheckout> =
        Result.failure(IllegalStateException("Thanh toán chưa khả dụng."))
    suspend fun completeLocalLandlordOnboarding(application: com.trooi.app.core.model.LocalLandlordApplication): Result<UserSession> =
        Result.failure(IllegalStateException("Tính năng đang được phát triển."))
    suspend fun saveLocalAsset(asset: com.trooi.app.core.model.LocalRentalAsset, activate: Boolean, publish: Boolean): Result<FrontendReadSnapshot> =
        Result.failure(IllegalStateException("Tính năng đang được phát triển."))
    suspend fun purchaseLocalCapacity(purchaseId: String): Result<FrontendReadSnapshot> =
        Result.failure(IllegalStateException("Tính năng đang được phát triển."))
    suspend fun archiveLocalAsset(assetId: String): Result<FrontendReadSnapshot> =
        Result.failure(IllegalStateException("Tính năng đang được phát triển."))
    fun initialSnapshot(): TroOiSnapshot
    fun clearSession()

    suspend fun refreshSessionContext(): Result<UserSession>
    suspend fun refreshPublicListings(): Result<List<PublicListingCard>>
    suspend fun searchPublicListings(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        minPrice: String? = null,
        maxPrice: String? = null,
    ): Result<List<PublicListingCard>>
    suspend fun authenticateWithGoogleIdToken(idToken: String): Result<UserSession>
    suspend fun refreshAuthorizedRead(access: AccessCapabilities): Result<FrontendReadSnapshot>
    suspend fun loadNotification(notificationId: String): Result<NotificationCard>
    suspend fun markNotificationRead(notificationId: String): Result<Unit>

    /** Preview-only credential methods remain for the isolated demo debug source set. */
    suspend fun login(identifier: String, password: String): Result<UserSession>
    suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession>
    suspend fun requestPasswordReset(identifier: String): Result<Unit>

    /** Inquiry is contact intent, never booking/chat state. */
    suspend fun submitInquiry(listingId: String, message: String): Result<Unit>
}
