package com.trooi.app.core.data

import com.trooi.app.core.model.UserRole
import javax.inject.Inject

class TroOiRepositoryImpl @Inject constructor() : TroOiRepository {
    override fun initialSnapshot() = TroOiSnapshot()

    override suspend fun login(
        role: UserRole,
        identifier: String,
        password: String,
    ): Result<UserSession> = backendUnavailable()

    override suspend fun signUp(
        role: UserRole,
        fullName: String,
        phone: String,
        email: String,
        password: String,
    ): Result<UserSession> = backendUnavailable()

    override suspend fun requestPasswordReset(identifier: String): Result<Unit> = backendUnavailable()

    private fun <T> backendUnavailable(): Result<T> = Result.failure(
        IllegalStateException("Backend OpenAPI chưa được cấu hình cho release build."),
    )
}
