package com.trooi.app.core.data

import com.trooi.app.core.demo.DemoData
import com.trooi.app.core.model.AccessCapabilities
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
        identifier: String,
        password: String,
    ): Result<UserSession> = Result.success(
        UserSession(
            displayName = "Tài khoản demo",
            access = AccessCapabilities(
                linkedTenancyIds = setOf("demo-tenancy-1"),
                operatedOrganizationIds = setOf("demo-organization-1"),
            ),
        ),
    )

    override suspend fun signUp(
        fullName: String,
        phone: String,
        email: String,
        password: String,
    ): Result<UserSession> = Result.success(
        UserSession(displayName = fullName.trim(), access = AccessCapabilities()),
    )

    override suspend fun requestPasswordReset(identifier: String): Result<Unit> = Result.success(Unit)
}
