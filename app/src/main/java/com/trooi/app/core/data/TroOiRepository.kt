package com.trooi.app.core.data

import com.trooi.app.core.model.BookingUi
import com.trooi.app.core.model.ConversationUi
import com.trooi.app.core.model.FinanceEntryUi
import com.trooi.app.core.model.RoomUi
import com.trooi.app.core.model.TicketUi
import com.trooi.app.core.model.AccessCapabilities

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
    val access: AccessCapabilities,
)

interface TroOiRepository {
    fun initialSnapshot(): TroOiSnapshot

    suspend fun login(
        identifier: String,
        password: String,
    ): Result<UserSession>

    suspend fun signUp(
        fullName: String,
        phone: String,
        email: String,
        password: String,
    ): Result<UserSession>

    suspend fun requestPasswordReset(identifier: String): Result<Unit>
}
