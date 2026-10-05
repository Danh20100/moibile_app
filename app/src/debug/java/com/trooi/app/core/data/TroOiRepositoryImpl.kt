package com.trooi.app.core.data

import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.FrontendReadSnapshot
import com.trooi.app.core.model.NotificationCard
import com.trooi.app.core.model.PublicListingCard
import javax.inject.Inject

/** Debug identity is preview-only; no business command reports false success. */
class TroOiRepositoryImpl @Inject constructor() : TroOiRepository {
    override fun initialSnapshot() = TroOiSnapshot(read = DemoData.read, demoPreview = true)
    override fun clearSession() = Unit

    override suspend fun refreshSessionContext(): Result<UserSession> = Result.failure(UnsupportedOperationException())

    override suspend fun refreshPublicListings(): Result<List<PublicListingCard>> =
        Result.success(DemoData.read.publicListings)

    override suspend fun searchPublicListings(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        minPrice: String?,
        maxPrice: String?,
    ): Result<List<PublicListingCard>> = Result.success(DemoData.read.publicListings)

    override suspend fun authenticateWithGoogleIdToken(idToken: String): Result<UserSession> =
        Result.failure(IllegalStateException("Preview debug không dùng Google runtime authentication."))

    override suspend fun refreshAuthorizedRead(access: AccessCapabilities): Result<FrontendReadSnapshot> =
        Result.success(DemoData.read)

    override suspend fun login(identifier: String, password: String): Result<UserSession> =
        Result.success(
            UserSession(
                userId = "demo-user",
                displayName = "Tài khoản minh hoạ",
                access = AccessCapabilities(
                    linkedTenancyIds = setOf("demo-tenancy-1"),
                    operatedOrganizationIds = setOf("demo-organization-1"),
                ),
            ),
        )

    override suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession> =
        Result.success(UserSession("demo-user", fullName.trim(), AccessCapabilities()))

    override suspend fun requestPasswordReset(identifier: String): Result<Unit> =
        Result.failure(IllegalStateException("Preview chỉ hiển thị giao diện; chưa gửi yêu cầu khôi phục."))

    override suspend fun submitInquiry(listingId: String, message: String): Result<Unit> =
        Result.failure(IllegalStateException("Preview không tạo Inquiry thật."))

    override suspend fun loadNotification(notificationId: String): Result<NotificationCard> =
        Result.failure(IllegalStateException("Preview không tải Notification thật."))

    override suspend fun markNotificationRead(notificationId: String): Result<Unit> =
        Result.failure(IllegalStateException("Preview không cập nhật Notification thật."))
}
