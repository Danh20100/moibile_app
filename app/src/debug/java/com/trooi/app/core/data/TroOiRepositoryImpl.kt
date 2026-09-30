package com.trooi.app.core.data

import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.AccessCapabilities
import javax.inject.Inject

/** Debug identity is preview-only; no business command reports false success. */
class TroOiRepositoryImpl @Inject constructor() : TroOiRepository {
    override fun initialSnapshot() = TroOiSnapshot(read = DemoData.read, demoPreview = true)
    override fun clearSession() = Unit // Preview mode never persists Google tokens.

    override suspend fun login(identifier: String, password: String): Result<UserSession> =
        Result.success(
            UserSession(
                displayName = "Tài khoản minh hoạ",
                access = AccessCapabilities(
                    linkedTenancyIds = setOf("demo-tenancy-1"),
                    operatedOrganizationIds = setOf("demo-organization-1"),
                ),
            ),
        )

    override suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession> =
        Result.success(UserSession(fullName.trim(), AccessCapabilities()))

    override suspend fun requestPasswordReset(identifier: String): Result<Unit> =
        Result.failure(IllegalStateException("Preview chỉ hiển thị giao diện; chưa gửi yêu cầu khôi phục."))

    override suspend fun submitInquiry(listingId: String, message: String): Result<Unit> =
        Result.failure(IllegalStateException("Chức năng liên hệ sẽ khả dụng sau khi tích hợp API Inquiry."))
}
