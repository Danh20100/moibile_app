package com.trooi.app.core.data

import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.UserRole
import javax.inject.Inject

class TroOiRepositoryImpl @Inject constructor() : TroOiRepository {
    override fun initialSnapshot() = TroOiSnapshot(
        rooms = DemoData.rooms,
        savedRoomIds = setOf(1, 2),
        bookings = DemoData.bookings,
        conversations = DemoData.conversations,
        tickets = DemoData.tickets,
        finance = DemoData.finance,
    )

    override suspend fun login(
        role: UserRole,
        identifier: String,
        password: String,
    ): Result<UserSession> = Result.success(
        UserSession(displayName = "Tài khoản demo", role = role),
    )

    override suspend fun signUp(
        role: UserRole,
        fullName: String,
        phone: String,
        email: String,
        password: String,
    ): Result<UserSession> = Result.success(
        UserSession(displayName = fullName.trim(), role = role),
    )

    override suspend fun requestPasswordReset(identifier: String): Result<Unit> = Result.success(Unit)
}
