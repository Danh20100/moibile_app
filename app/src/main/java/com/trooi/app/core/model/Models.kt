package com.trooi.app.core.model

enum class TenantTab { HOME, SAVED, SCHEDULE, MESSAGES, PROFILE }
enum class LandlordTab { DASHBOARD, ROOMS, FINANCE, TICKETS, PROFILE }

sealed interface AppPage {
    data object AuthWelcome : AppPage
    data object AuthLogin : AppPage
    data object AuthForgotPassword : AppPage
    data object AuthSignUp : AppPage
    data class Tenant(val tab: TenantTab) : AppPage
    data class TenantRoomDetail(val roomId: Int) : AppPage
    data class TenantChat(val conversationId: Long) : AppPage
    data class Landlord(val tab: LandlordTab) : AppPage
    data object LandlordSubscription : AppPage
}

data class RoomUi(
    val id: Int,
    val name: String,
    val area: String,
    val address: String,
    val price: Long,
    val deposit: Long,
    val electric: String,
    val water: String = "100.000đ/người",
    val serviceFee: String = "150.000đ/phòng",
    val wifi: String,
    val size: String,
    val distance: String,
    val type: String,
    val amenities: List<String>,
    val verification: String,
    val score: Double,
    val reviews: Int,
    val photos: Int,
    val scarcity: String? = null,
    val landlord: String,
    val tenant: String? = null,
    val tenantPhone: String? = null,
    val debt: Long = 0,
    val rented: Boolean = false,
    val discoverable: Boolean = true,
)

data class BookingUi(
    val id: Long,
    val roomId: Int,
    val date: String,
    val time: String,
    val status: BookingStatus,
)

enum class BookingStatus { CONFIRMED, PENDING, CANCELLED }

data class ChatMessageUi(
    val from: MessageFrom,
    val text: String,
)

enum class MessageFrom { TENANT, LANDLORD, SYSTEM }

data class ConversationUi(
    val id: Long,
    val roomId: Int,
    val bookingId: Long? = null,
    val landlord: String,
    val messages: List<ChatMessageUi>,
)

data class TicketUi(
    val id: String,
    val roomId: Int,
    val title: String,
    val priority: String,
    val status: String,
    val assignee: String,
    val timeline: List<String>,
)

data class FinanceEntryUi(
    val id: Long,
    val label: String,
    val note: String,
    val amount: Long,
    val incoming: Boolean,
    val time: String,
)

data class SubscriptionUi(
    val plan: SubscriptionPlan = SubscriptionPlan.TRIAL,
    val addBlocks: Int = 0,
    val autoRenew: Boolean = true,
    val trialExpiry: String = "31/07/2026",
    val plusExpiry: String = "30/06/2027",
)

enum class SubscriptionPlan { FREE, TRIAL, PLUS }

data class TroOiUiState(
    val access: AccessCapabilities = AccessCapabilities(),
    val isAuthenticated: Boolean = false,
    val displayName: String = "",
    val page: AppPage = AppPage.AuthWelcome,
    val rooms: List<RoomUi> = emptyList(),
    val savedRoomIds: Set<Int> = emptySet(),
    val bookings: List<BookingUi> = emptyList(),
    val conversations: List<ConversationUi> = emptyList(),
    val tickets: List<TicketUi> = emptyList(),
    val finance: List<FinanceEntryUi> = emptyList(),
    val subscription: SubscriptionUi = SubscriptionUi(),
    val snackbarMessage: String? = null,
)
