package com.trooi.app.core.data

import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.FrontendReadSnapshot
import com.trooi.app.core.model.NotificationCard
import com.trooi.app.core.model.PublicListingCard
import com.trooi.app.core.model.ConversationCard

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
    val email: String? = null,
)

data class EmailOtpIssue(
    val otpChallengeId: String,
    val expiresAtMillis: Long,
    val resendAtMillis: Long,
)

data class UserSession(
    val userId: String,
    val displayName: String,
    /** Relationships/capabilities are issued by the authorized Backend, not selected at login. */
    val access: AccessCapabilities,
    val pictureUrl: String? = null,
    val email: String? = null,
)

data class ProfileAvatarImage(val contentType: String, val bytes: ByteArray)

interface TroOiRepository {
    suspend fun sendMessage(expectedUserId: String, conversationId: String, text: String,
        images: List<com.trooi.app.core.model.LocalMessageImage>): Result<List<com.trooi.app.core.model.ConversationCard>> {
        if (images.isNotEmpty()) return Result.failure(IllegalStateException("Ảnh không khả dụng trong chế độ demo."))
        return saveLocalMessage(expectedUserId, conversationId, text).map { it.conversations }
    }
    suspend fun openConversation(contextType: String, contextId: String): Result<String> = Result.failure(IllegalStateException("Cần kết nối Backend."))
    suspend fun readConversation(id: String): Result<Unit> = Result.success(Unit)
    suspend fun messageAttachment(conversationId: String, attachmentId: String): Result<ByteArray> = Result.failure(IllegalStateException("Ảnh không khả dụng."))
    suspend fun loadLocalConversations(): Result<List<com.trooi.app.core.model.ConversationCard>> = Result.success(emptyList())
    suspend fun loadOlderMessages(conversationId: String): Result<ConversationCard> =
        Result.failure(IllegalStateException("Không thể tải trang tin nhắn cũ hơn."))
    suspend fun saveLocalMessage(expectedUserId: String, conversationId: String, text: String): Result<FrontendReadSnapshot> =
        Result.failure(IllegalStateException("Nhắn tin đang được phát triển."))
    suspend fun createDemoCheckout(tenancyId: String, amount: String, key: String): Result<com.trooi.app.features.shared.GatewayCheckout> =
        Result.failure(IllegalStateException("Thanh toán chưa khả dụng."))
    suspend fun getDemoCheckout(id: String): Result<com.trooi.app.features.shared.GatewayCheckout> =
        Result.failure(IllegalStateException("Thanh toán chưa khả dụng."))
    /** Adds one settled DemoPay payment to the fixture ledger. Deposits and receipts stay unchanged. */
    suspend fun readConfirmedDemoPayment(access: AccessCapabilities, paymentId: String): Result<FrontendReadSnapshot> =
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
    suspend fun revokeCurrentBackendSession() = Unit

    suspend fun updateDisplayName(displayName: String): Result<UserSession> =
        Result.failure(IllegalStateException("Cập nhật hồ sơ chưa khả dụng."))
    suspend fun loadOwnAvatar(expectedUserId: String): Result<ProfileAvatarImage?> =
        Result.failure(IllegalStateException("Ảnh hồ sơ chưa khả dụng."))
    suspend fun updateOwnAvatar(expectedUserId: String, contentType: String, bytes: ByteArray): Result<ProfileAvatarImage> =
        Result.failure(IllegalStateException("Ảnh hồ sơ chưa khả dụng."))
    suspend fun refreshSessionContext(): Result<UserSession>
    suspend fun refreshPublicListings(): Result<List<PublicListingCard>>
    suspend fun loadPublicListingPhotos(listingId: String, mediaIds: List<String>): Result<List<String>> =
        Result.failure(IllegalStateException("Ảnh tin đăng chưa khả dụng."))
    suspend fun searchPublicListings(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        minPrice: String? = null,
        maxPrice: String? = null,
    ): Result<List<PublicListingCard>>
    suspend fun authenticateWithGoogleIdToken(idToken: String, nonce: String): Result<UserSession>
    suspend fun registerWithGoogleIdToken(idToken: String, nonce: String): Result<UserSession> =
        Result.failure(IllegalStateException("Đăng ký Google chưa khả dụng."))
    suspend fun refreshAuthorizedRead(access: AccessCapabilities): Result<FrontendReadSnapshot>
    suspend fun loadNotification(notificationId: String): Result<NotificationCard>
    suspend fun markNotificationRead(notificationId: String): Result<Unit>

    /** Preview-only credential methods remain for the isolated demo debug source set. */
    suspend fun login(identifier: String, password: String): Result<UserSession>
    suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession>
    suspend fun requestEmailRegistration(email: String, password: String, displayName: String?): Result<EmailOtpIssue> =
        Result.failure(IllegalStateException("Email OTP chưa khả dụng."))
    suspend fun verifyEmailRegistration(challengeId: String, code: String): Result<UserSession> =
        Result.failure(IllegalStateException("Email OTP chưa khả dụng."))
    suspend fun requestPasswordResetOtp(email: String): Result<EmailOtpIssue> =
        Result.failure(IllegalStateException("OTP chưa khả dụng."))
    suspend fun verifyPasswordResetOtp(challengeId: String, code: String, password: String): Result<Unit> =
        Result.failure(IllegalStateException("OTP chưa khả dụng."))
    suspend fun requestPasswordReset(identifier: String): Result<Unit>

    /** Inquiry is contact intent, never booking/chat state. */
    suspend fun submitInquiry(listingId: String, message: String): Result<String>
}
