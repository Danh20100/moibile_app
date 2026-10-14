package com.trooi.app.features.organization

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.content.Context
import com.trooi.app.core.auth.GoogleCredentialAuth
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.dto.ApiOutcome
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.PublicGeoPoint
import com.trooi.app.core.network.dto.DashboardTransport
import com.trooi.app.core.network.dto.RoomOperationalHistoryTransport
import com.trooi.app.features.shared.*
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Nested route stack persists independently from the Compose visual composition. */
sealed interface OperatorRoute {
    data object Organizations : OperatorRoute
    data class Organization(val id: String) : OperatorRoute
    data class Dashboard(val organizationId: String) : OperatorRoute
    data class Properties(val organizationId: String) : OperatorRoute
    data class Property(val id: String, val organizationId: String) : OperatorRoute
    data class Rooms(val propertyId: String, val organizationId: String) : OperatorRoute
    data class Room(val id: String, val propertyId: String, val organizationId: String) : OperatorRoute
    data class RoomHistory(val id: String, val propertyId: String, val organizationId: String) : OperatorRoute
    data class Listing(val id: String, val roomId: String, val propertyId: String, val organizationId: String) : OperatorRoute
    data class Rentals(
        val roomId: String,
        val organizationId: String,
        val rentalSurface: String? = null,
        val tenancyId: String? = null,
        val focusId: String? = null,
        val sourceType: String? = null,
    ) : OperatorRoute
    data class Inquiries(val listingId: String) : OperatorRoute
    data class Inquiry(val id: String, val listingId: String) : OperatorRoute
}

data class OperatorUiState(
    val stack: List<OperatorRoute> = listOf(OperatorRoute.Organizations),
    val busy: Boolean = false,
    val error: String? = null,
    val errorKind: String? = null,
    val success: String? = null,
    val organizationCreatedRevision: Int = 0,
    val organizations: List<V1Organization> = emptyList(),
    val organization: V1Organization? = null,
    val dashboard: DashboardTransport? = null,
    val properties: List<V1Property> = emptyList(),
    val property: V1Property? = null,
    val rooms: List<V1Room> = emptyList(),
    val room: V1Room? = null,
    val roomHistory: RoomOperationalHistoryTransport? = null,
    val listing: V1Listing? = null,
    val inquiries: List<V1Inquiry> = emptyList(),
    val inquiry: V1Inquiry? = null,
) {
    val route: OperatorRoute get() = stack.last()
}

@HiltViewModel
class OperatorViewModel @Inject constructor(
    private val api: V1ContractGateway,
    private val identityApi: BackendApi,
    private val googleCredentialAuth: GoogleCredentialAuth,
) : ViewModel() {
    private val _ui = MutableStateFlow(OperatorUiState())
    val ui: StateFlow<OperatorUiState> = _ui.asStateFlow()
    private var revision = 0
    private var access = AccessCapabilities()
    private var selectedOrganizationId = ""
    private var started = false
    private var entryKey = ""

    fun begin(capabilities: AccessCapabilities, organizationId: String, entry: OperatorRoute? = null) {
        val scoped = organizationId.takeIf { it in capabilities.operatedOrganizationIds }.orEmpty()
        val nextEntry = entry?.toString().orEmpty()
        if (started && access == capabilities && selectedOrganizationId == scoped && entryKey == nextEntry) return
        revision++
        started = true
        access = capabilities
        selectedOrganizationId = scoped
        entryKey = nextEntry
        val stack = buildList {
            add(OperatorRoute.Organizations)
            if (scoped.isNotEmpty()) add(OperatorRoute.Organization(scoped))
            if (entry != null && entry !is OperatorRoute.Organizations && entry !is OperatorRoute.Organization) add(entry)
        }
        _ui.value = OperatorUiState(stack = stack)
        load()
    }

    fun reset() {
        revision++
        access = AccessCapabilities()
        selectedOrganizationId = ""
        started = false
        entryKey = ""
        _ui.value = OperatorUiState()
    }

    fun open(route: OperatorRoute) {
        // Local scoping prevents accidental navigation; Backend remains final authority.
        val authorized = when (route) {
            is OperatorRoute.Organizations -> true
            is OperatorRoute.Organization -> route.id in access.operatedOrganizationIds
            is OperatorRoute.Dashboard -> route.organizationId in access.operatedOrganizationIds
            is OperatorRoute.Properties -> route.organizationId in access.operatedOrganizationIds
            is OperatorRoute.Property -> route.organizationId in access.operatedOrganizationIds
            is OperatorRoute.Rooms -> route.organizationId in access.operatedOrganizationIds
            is OperatorRoute.Room -> route.organizationId in access.operatedOrganizationIds
            is OperatorRoute.RoomHistory -> route.organizationId in access.operatedOrganizationIds
            is OperatorRoute.Listing -> route.organizationId in access.operatedOrganizationIds
            is OperatorRoute.Rentals -> route.organizationId in access.operatedOrganizationIds
            is OperatorRoute.Inquiries, is OperatorRoute.Inquiry -> true // Only reachable from an authorized Listing.
        }
        if (!authorized) {
            _ui.update { it.copy(error = "Không có quyền mở tài nguyên này.", errorKind = "FORBIDDEN") }
            return
        }
        _ui.update { it.copy(stack = it.stack + route, success = null, error = null, errorKind = null,
            organizations = emptyList(), organization = null, dashboard = null, properties = emptyList(), property = null,
            rooms = emptyList(), room = null, roomHistory = null, listing = null, inquiries = emptyList(), inquiry = null) }
        load()
    }

    fun back(): Boolean {
        if (_ui.value.stack.size <= 1) return false
        revision++
        _ui.update { it.copy(stack = it.stack.dropLast(1), success = null, error = null, errorKind = null) }
        load()
        return true
    }

    fun load() {
        val route = _ui.value.route
        if (access.operatedOrganizationIds.isEmpty() && route != OperatorRoute.Organizations) return
        val requestId = ++revision
        _ui.update { it.copy(busy = true, error = null, errorKind = null) }
        viewModelScope.launch {
            try {
                when (route) {
                    OperatorRoute.Organizations -> {
                        val data = api.organizations().filter {
                            it.id in access.operatedOrganizationIds &&
                                (selectedOrganizationId.isEmpty() || it.id == selectedOrganizationId)
                        }
                        publish(requestId) { it.copy(organizations = data) }
                    }
                    is OperatorRoute.Organization -> publish(requestId) { it.copy(organization = api.organization(route.id)) }
                    is OperatorRoute.Dashboard -> publish(requestId) {
                        val dashboard = api.dashboard(route.organizationId)
                        require(dashboard.organizationId == route.organizationId) { "Dashboard không thuộc Organization hiện tại." }
                        it.copy(dashboard = dashboard)
                    }
                    is OperatorRoute.Properties -> publish(requestId) {
                        it.copy(properties = api.properties(route.organizationId).filter { p -> p.organizationId == route.organizationId })
                    }
                    is OperatorRoute.Property -> publish(requestId) { it.copy(property = api.property(route.id)) }
                    is OperatorRoute.Rooms -> publish(requestId) {
                        it.copy(rooms = api.rooms(route.propertyId).filter { room -> room.propertyId == route.propertyId })
                    }
                    is OperatorRoute.Room -> publish(requestId) {
                        val room = api.room(route.id)
                        require(room.propertyId == route.propertyId) { "Room không thuộc Property hiện tại." }
                        val listing = api.currentListing(route.id)
                        require(listing == null || listing.roomId == room.id) { "Listing không thuộc Room hiện tại." }
                        it.copy(room = room, listing = listing)
                    }
                    is OperatorRoute.RoomHistory -> publish(requestId) {
                        val history = api.roomHistory(route.id)
                        require(history.room.id == route.id && history.room.propertyId == route.propertyId) {
                            "Room history không thuộc Room hiện tại."
                        }
                        it.copy(roomHistory = history)
                    }
                    is OperatorRoute.Listing -> publish(requestId) {
                        val listing = api.listing(route.id)
                        require(listing.roomId == route.roomId) { "Listing không thuộc Room hiện tại." }
                        it.copy(listing = listing)
                    }
                    is OperatorRoute.Rentals -> publish(requestId) { it }
                    is OperatorRoute.Inquiries -> publish(requestId) { it.copy(inquiries = api.inquiries(route.listingId).filter { q -> q.listingId == route.listingId }) }
                    is OperatorRoute.Inquiry -> publish(requestId) { it.copy(inquiry = api.inquiry(route.id)) }
                }
            } catch (error: Exception) { fail(requestId, error) }
        }
    }

    fun createOrganization(name: String, context: Context) = write {
        require(name.isNotBlank()) { "Nhập tên khu trọ" }
        val challenge = when (val result = identityApi.issueOrganizationCreateReauthChallenge()) {
            is ApiOutcome.Data -> result.value.nonce?.takeIf(String::isNotBlank)
                ?: error("Backend returned an invalid reauthentication challenge.")
            is ApiOutcome.Failure -> throw V1RequestException(result.kind, result.httpStatus)
        }
        val idToken = googleCredentialAuth.reacquireForReauthentication(context, challenge).getOrThrow()
        val proof = when (val result = identityApi.completeOrganizationCreateReauth(idToken, challenge)) {
            is ApiOutcome.Data -> result.value.proof?.takeIf(String::isNotBlank)
                ?: error("Google chưa xác nhận xác thực mới trong thời hạn cho phép.")
            is ApiOutcome.Failure -> throw V1RequestException(result.kind, result.httpStatus)
        }
        val created = api.createOrganization(name.trim(), proof)
        val refreshed = api.organization(created.id)
        val granted = api.sessionAccess()
        require(refreshed.id in granted.operatedOrganizationIds) { "Backend chưa cấp relationship cho Organization mới." }
        access = granted
        _ui.update { it.copy(organization = refreshed, stack = it.stack + OperatorRoute.Organization(refreshed.id),
            organizationCreatedRevision = it.organizationCreatedRevision + 1) }
    }

    fun renameOrganization(id: String, name: String) = write {
        require(id in access.operatedOrganizationIds && name.isNotBlank()) { "Khu trọ hoặc tên không hợp lệ" }
        api.editOrganization(id, name.trim())
        _ui.update { it.copy(organization = api.organization(id)) }
    }

    fun createProperty(
        organizationId: String,
        name: String,
        address: String,
        operational: PublicGeoPoint,
        public: PublicGeoPoint,
    ) = write {
        require(organizationId in access.operatedOrganizationIds && name.isNotBlank() && address.isNotBlank()) { "Điền đủ thông tin khu nhà" }
        val created = api.createProperty(organizationId, name.trim(), address.trim(), operational, public)
        _ui.update { it.copy(property = api.property(created.id), stack = it.stack + OperatorRoute.Property(created.id, organizationId)) }
    }

    fun renameProperty(id: String, organizationId: String, name: String) = write {
        require(organizationId in access.operatedOrganizationIds && name.isNotBlank()) { "Thông tin khu nhà không hợp lệ" }
        api.editProperty(id, name.trim())
        _ui.update { it.copy(property = api.property(id)) }
    }

    fun createRoom(propertyId: String, organizationId: String, label: String) = write {
        require(organizationId in access.operatedOrganizationIds && label.isNotBlank()) { "Thiếu tên phòng" }
        val created = api.createRoom(propertyId, label.trim())
        _ui.update { it.copy(room = api.room(created.id), stack = it.stack + OperatorRoute.Room(created.id, propertyId, organizationId)) }
    }

    fun renameRoom(id: String, label: String) = write {
        require(label.isNotBlank()) { "Thiếu tên phòng" }
        api.editRoom(id, label.trim())
        _ui.update { it.copy(room = api.room(id)) }
    }

    fun transitionRoomState(route: OperatorRoute.Room, state: String) = write {
        require(route.organizationId in access.operatedOrganizationIds) { "Không có quyền với Organization này." }
        val current = _ui.value.room
        require(current != null && current.id == route.id) { "Chưa tải Room từ Backend." }
        val target = state.trim().uppercase()
        require(target in legalRoomTargets(current.state)) {
            "Chuyển trạng thái phòng không hợp lệ từ ${current.state} sang $target"
        }
        try {
            val updated = api.transitionRoomOperationalState(route.id, target, current.state)
            require(updated.propertyId == route.propertyId) { "Room không thuộc Property hiện tại." }
            _ui.update { it.copy(room = updated) }
        } catch (error: Exception) {
            if (error is V1RequestException && error.status in setOf(403, 409)) {
                runCatching { api.room(route.id) }.getOrNull()?.let { fresh ->
                    require(fresh.propertyId == route.propertyId)
                    _ui.update { it.copy(room = fresh) }
                }
            }
            throw error
        }
    }

    fun createListing(
        room: OperatorRoute.Room,
        title: String,
        description: String,
        price: String,
        public: PublicGeoPoint,
    ) = write {
        require(title.isNotBlank() && description.isNotBlank() && price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?"))) {
            "Thiếu title/description hoặc giá không hợp lệ"
        }
        val created = api.createListing(room.id, title.trim(), description.trim(), price, public)
        _ui.update { it.copy(listing = api.listing(created.id), stack = it.stack + OperatorRoute.Listing(created.id, room.id, room.propertyId, room.organizationId)) }
    }

    fun editListing(route: OperatorRoute.Listing, title: String, description: String, price: String) = write {
        require(title.isNotBlank() && description.isNotBlank() && price.matches(Regex("\\d{1,16}(\\.\\d{1,2})?"))) { "Thông tin Listing không hợp lệ" }
        api.editListing(route.id, title.trim(), description.trim(), price)
        _ui.update { it.copy(listing = api.listing(route.id)) }
    }

    fun publishListing(route: OperatorRoute.Listing) = updateListing(route) { api.publishListing(route.id) }
    fun unpublishListing(route: OperatorRoute.Listing) = updateListing(route) { api.unpublishListing(route.id) }
    fun archiveListing(route: OperatorRoute.Listing) = updateListing(route) { api.archiveListing(route.id) }

    private fun updateListing(route: OperatorRoute.Listing, command: suspend () -> V1Listing) = write {
        require(route.organizationId in access.operatedOrganizationIds) { "Không có quyền với Organization này." }
        val updated = command()
        require(updated.id == route.id && updated.roomId == route.roomId) { "Backend trả Listing sai phạm vi Room." }
        _ui.update { it.copy(listing = updated) }
    }

    private fun write(operation: suspend () -> Unit) {
        if (_ui.value.busy) return
        val current = ++revision
        _ui.update { it.copy(busy = true, error = null, errorKind = null, success = null) }
        viewModelScope.launch {
            try {
                operation()
                if (revision == current) _ui.update { it.copy(busy = false, success = "Đã lưu thay đổi.") }
            } catch (error: Exception) { fail(current, error) }
        }
    }

    private suspend fun publish(requestId: Int, update: suspend (OperatorUiState) -> OperatorUiState) {
        if (revision != requestId) return
        val refreshed = update(_ui.value)
        if (revision == requestId) _ui.value = refreshed.copy(busy = false)
    }

    private fun fail(requestId: Int, error: Exception) {
        if (revision != requestId) return
        val kind = if (error is V1RequestException) error.kind.name else "VALIDATION_OR_RESPONSE"
        val status = if (error is V1RequestException) error.status else null
        val detail = when (status) {
            403 -> "Bạn không có quyền thực hiện thao tác này."
            404 -> "Không tìm thấy dữ liệu cần thao tác."
            409 -> "Dữ liệu đã thay đổi hoặc thao tác không còn hợp lệ. Hãy tải lại và thử lại."
            else -> error.message ?: "Không thể hoàn thành yêu cầu."
        }
        _ui.update { it.copy(busy = false, error = detail, errorKind = kind) }
    }
}
