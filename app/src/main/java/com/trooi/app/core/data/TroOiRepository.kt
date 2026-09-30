package com.trooi.app.core.data

import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.FrontendReadSnapshot

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
    suspend fun login(identifier: String, password: String): Result<UserSession>
    suspend fun signUp(fullName: String, phone: String, email: String, password: String): Result<UserSession>
    suspend fun requestPasswordReset(identifier: String): Result<Unit>

    /** Inquiry is contact intent (not booking). Adapter mapping waits for published OpenAPI. */
    suspend fun submitInquiry(listingId: String, message: String): Result<Unit>
}
