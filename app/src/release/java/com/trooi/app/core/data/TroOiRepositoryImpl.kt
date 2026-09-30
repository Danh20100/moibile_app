package com.trooi.app.core.data

import javax.inject.Inject

/** Production intentionally fails closed until Backend OpenAPI and authorization are integrated. */
class TroOiRepositoryImpl @Inject constructor() : TroOiRepository {
    override fun initialSnapshot() = TroOiSnapshot()
    override suspend fun login(identifier: String, password: String): Result<UserSession> = backendUnavailable()
    override suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession> = backendUnavailable()
    override suspend fun requestPasswordReset(identifier: String): Result<Unit> = backendUnavailable()
    override suspend fun submitInquiry(listingId: String, message: String): Result<Unit> = backendUnavailable()

    private fun <T> backendUnavailable(): Result<T> = Result.failure(
        IllegalStateException("Backend OpenAPI chưa được cấu hình cho bản Release."),
    )
}
