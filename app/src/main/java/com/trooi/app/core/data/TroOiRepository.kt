package com.trooi.app.core.data

import com.trooi.app.core.model.BookingUi
import com.trooi.app.core.model.ConversationUi
import com.trooi.app.core.model.FinanceEntryUi
import com.trooi.app.core.model.RoomUi
import com.trooi.app.core.model.TicketUi
import com.trooi.app.core.model.UserRole

data class TroOiSnapshot(
    val rooms: List<RoomUi> = emptyList(),
    val savedRoomIds: Set<Int> = emptySet(),
    val bookings: List<BookingUi> = emptyList(),
    val conversations: List<ConversationUi> = emptyList(),
    val tickets: List<TicketUi> = emptyList(),
    val finance: List<FinanceEntryUi> = emptyList(),
)

data class UserSession(
    val displayName: String,
    val role: UserRole,
)

interface TroOiRepository {
    fun initialSnapshot(): TroOiSnapshot

    suspend fun login(
        role: UserRole,
        identifier: String,
        password: String,
    ): Result<UserSession>

    suspend fun signUp(
        role: UserRole,
        fullName: String,
        phone: String,
        email: String,
        password: String,
    ): Result<UserSession>

    suspend fun requestPasswordReset(identifier: String): Result<Unit>
}
