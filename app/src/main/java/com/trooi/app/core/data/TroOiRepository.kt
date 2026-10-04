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
    val displayName: String,
    /** Relationships/capabilities are issued by the authorized Backend, not selected at login. */
    val access: AccessCapabilities,
)

interface TroOiRepository {
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
