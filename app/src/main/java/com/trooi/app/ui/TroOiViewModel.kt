package com.trooi.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trooi.app.core.data.TroOiRepository
import com.trooi.app.core.model.AppPage
import com.trooi.app.core.model.BookingStatus
import com.trooi.app.core.model.BookingUi
import com.trooi.app.core.model.ChatMessageUi
import com.trooi.app.core.model.ConversationUi
import com.trooi.app.core.model.LandlordTab
import com.trooi.app.core.model.MessageFrom
import com.trooi.app.core.model.SubscriptionPlan
import com.trooi.app.core.model.TenantTab
import com.trooi.app.core.model.TroOiUiState
import com.trooi.app.core.model.UserRole
import com.trooi.app.features.auth.isValidIdentifier
import com.trooi.app.features.auth.isValidPassword
import com.trooi.app.features.auth.isValidSignup
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class TroOiViewModel @Inject constructor(
    private val repository: TroOiRepository,
) : ViewModel() {
    private val snapshot = repository.initialSnapshot()
    private val _state = MutableStateFlow(
        TroOiUiState(
            rooms = snapshot.rooms,
            savedRoomIds = snapshot.savedRoomIds,
            bookings = snapshot.bookings,
            conversations = snapshot.conversations,
            tickets = snapshot.tickets,
            finance = snapshot.finance,
        ),
    )
    val state: StateFlow<TroOiUiState> = _state.asStateFlow()

    fun openLogin() = updatePage(AppPage.AuthLogin)
    fun openRoleSelect() = updatePage(AppPage.AuthRoleSelect)
    fun openForgotPassword() = updatePage(AppPage.AuthForgotPassword)
    fun openSignUp(role: UserRole) = _state.update { it.copy(role = role, page = AppPage.AuthSignUp(role)) }

    fun requestPasswordReset(identifier: String) {
        if (identifier.isBlank()) return showMessage("Vui lòng nhập email hoặc số điện thoại.")
        viewModelScope.launch {
            repository.requestPasswordReset(identifier.trim()).fold(
                onSuccess = { _state.update { it.copy(page = AppPage.AuthLogin, snackbarMessage = "Đã gửi yêu cầu khôi phục mật khẩu.") } },
                onFailure = { showMessage(it.message ?: "Không thể gửi yêu cầu khôi phục mật khẩu.") },
            )
        }
    }

    fun login(role: UserRole, identifier: String, password: String) {
        if (!isValidIdentifier(identifier) || !isValidPassword(password)) return showMessage("Thông tin đăng nhập chưa hợp lệ.")
        viewModelScope.launch {
            repository.login(role, identifier.trim(), password).fold(
                onSuccess = { session ->
                    _state.update {
                        it.copy(
                            isAuthenticated = true,
                            role = session.role,
                            displayName = session.displayName,
                            page = homeFor(session.role),
                        )
                    }
                },
                onFailure = { showMessage(it.message ?: "Đăng nhập thất bại.") },
            )
        }
    }

    fun signUp(role: UserRole, fullName: String, phone: String, email: String, password: String) {
        if (!isValidSignup(fullName, phone, email, password, password, acceptedTerms = true)) {
            return showMessage("Thông tin đăng ký chưa hợp lệ.")
        }
        viewModelScope.launch {
            repository.signUp(role, fullName.trim(), phone.trim(), email.trim(), password).fold(
                onSuccess = { session ->
                    _state.update {
                        it.copy(
                            isAuthenticated = true,
                            role = session.role,
                            displayName = session.displayName,
                            page = homeFor(session.role),
                        )
                    }
                },
                onFailure = { showMessage(it.message ?: "Đăng ký thất bại.") },
            )
        }
    }

    fun logout() = _state.update {
        it.copy(
            isAuthenticated = false,
            displayName = "",
            role = UserRole.TENANT,
            page = AppPage.AuthWelcome,
            snackbarMessage = null,
        )
    }

    fun openTenantTab(tab: TenantTab) = _state.update { it.copy(role = UserRole.TENANT, page = AppPage.Tenant(tab)) }
    fun openLandlordTab(tab: LandlordTab) = _state.update { it.copy(role = UserRole.LANDLORD, page = AppPage.Landlord(tab)) }
    fun openRoom(roomId: Int) = updatePage(AppPage.TenantRoomDetail(roomId))
    fun openChat(conversationId: Long) = updatePage(AppPage.TenantChat(conversationId))
    fun openSubscription() = updatePage(AppPage.LandlordSubscription)

    fun goBack() = _state.update { current ->
        current.copy(
            page = when (current.page) {
                AppPage.AuthLogin, AppPage.AuthRoleSelect -> AppPage.AuthWelcome
                AppPage.AuthForgotPassword -> AppPage.AuthLogin
                is AppPage.AuthSignUp -> AppPage.AuthRoleSelect
                is AppPage.TenantRoomDetail -> AppPage.Tenant(TenantTab.HOME)
                is AppPage.TenantChat -> AppPage.Tenant(TenantTab.MESSAGES)
                AppPage.LandlordSubscription -> AppPage.Landlord(LandlordTab.PROFILE)
                else -> current.page
            },
        )
    }

    fun switchRole() = _state.update { current ->
        val role = if (current.role == UserRole.TENANT) UserRole.LANDLORD else UserRole.TENANT
        current.copy(role = role, page = homeFor(role))
    }

    fun toggleSaved(roomId: Int) = _state.update { current ->
        val next = current.savedRoomIds.toMutableSet().apply {
            if (!add(roomId)) remove(roomId)
        }
        current.copy(savedRoomIds = next)
    }

    fun openRoomConversation(roomId: Int) = _state.update { current ->
        val existing = current.conversations.firstOrNull { it.roomId == roomId }
        if (existing != null) return@update current.copy(page = AppPage.TenantChat(existing.id))
        val id = System.currentTimeMillis()
        val room = current.rooms.firstOrNull { it.id == roomId }
        val conversation = ConversationUi(
            id = id,
            roomId = roomId,
            landlord = room?.landlord.orEmpty(),
            messages = listOf(ChatMessageUi(MessageFrom.SYSTEM, "Cuộc trò chuyện về ${room?.name.orEmpty()}.")),
        )
        current.copy(conversations = listOf(conversation) + current.conversations, page = AppPage.TenantChat(id))
    }

    fun createBooking(roomId: Int, date: String, time: String) {
        if (date.isBlank() || time.isBlank()) return showMessage("Vui lòng chọn ngày và giờ.")
        _state.update { current ->
            val id = System.currentTimeMillis()
            val booking = BookingUi(id, roomId, date, time, BookingStatus.PENDING)
            current.copy(
                bookings = listOf(booking) + current.bookings,
                page = AppPage.Tenant(TenantTab.SCHEDULE),
                snackbarMessage = "Đã gửi yêu cầu xem phòng.",
            )
        }
    }

    fun sendMessage(conversationId: Long, text: String) {
        val clean = text.trim()
        if (clean.isEmpty()) return
        _state.update { current ->
            current.copy(
                conversations = current.conversations.map { conversation ->
                    if (conversation.id == conversationId) conversation.copy(
                        messages = conversation.messages + ChatMessageUi(MessageFrom.TENANT, clean),
                    ) else conversation
                },
            )
        }
    }

    fun confirmBooking(bookingId: Long) = updateBookingStatus(bookingId, BookingStatus.CONFIRMED)
    fun cancelBooking(bookingId: Long) = updateBookingStatus(bookingId, BookingStatus.CANCELLED)

    fun completeTicket(ticketId: String) = _state.update { current ->
        current.copy(tickets = current.tickets.map { if (it.id == ticketId) it.copy(status = "Hoàn tất") else it })
    }

    fun activatePlus() = _state.update { current ->
        current.copy(subscription = current.subscription.copy(plan = SubscriptionPlan.PLUS))
    }

    fun clearSnackbar() = _state.update { it.copy(snackbarMessage = null) }

    private fun updateBookingStatus(id: Long, status: BookingStatus) = _state.update { current ->
        current.copy(bookings = current.bookings.map { if (it.id == id) it.copy(status = status) else it })
    }

    private fun updatePage(page: AppPage) = _state.update { it.copy(page = page) }
    private fun showMessage(message: String) = _state.update { it.copy(snackbarMessage = message) }
    private fun homeFor(role: UserRole): AppPage = if (role == UserRole.TENANT) {
        AppPage.Tenant(TenantTab.HOME)
    } else {
        AppPage.Landlord(LandlordTab.DASHBOARD)
    }
}
