package com.trooi.app.core.data

import com.trooi.app.core.network.AuthTokenProvider
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.TransportOutcome
import javax.inject.Inject

/**
 * Backend-backed, fail-closed repository: never returns DemoData.
 * No business payload is projected until Backend publishes passing OpenAPI schemas.
 */
class BackendTroOiRepository @Inject constructor(
    private val api: BackendApi,
    private val tokens: AuthTokenProvider,
) : TroOiRepository {
    override fun initialSnapshot() = TroOiSnapshot()

    /** Transport-only endpoint probe: no JSON is mapped into business projections. */
    suspend fun probePublicTransport(): TransportOutcome = api.getPublicListingsRaw()

    override suspend fun login(identifier: String, password: String): Result<UserSession> = unavailable()
    override suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession> = unavailable()
    override suspend fun requestPasswordReset(identifier: String): Result<Unit> = unavailable()
    override suspend fun submitInquiry(listingId: String, message: String): Result<Unit> = unavailable()

    override fun clearSession() = tokens.clear()

    private fun <T> unavailable(): Result<T> = Result.failure(
        IllegalStateException("Chưa có OpenAPI GREEN; Google sign-in/DTO production chưa được kết nối."),
    )
}
