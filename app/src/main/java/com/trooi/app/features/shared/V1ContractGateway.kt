package com.trooi.app.features.shared

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.core.network.dto.DashboardTransport
import com.trooi.app.core.network.dto.ErrorKind
import com.trooi.app.core.network.dto.RoomOperationalHistoryTransport
import com.trooi.app.core.network.dto.TransportOutcome
import com.trooi.app.features.organization.legalRoomTargets
import com.trooi.app.features.organization.wireRoomOperationalState
import javax.inject.Inject

/** Errors preserve backend status so UI can distinguish 401/403/404/409/offline. */
class V1RequestException(val kind: ErrorKind, val status: Int? = null) :
    RuntimeException("Backend: $kind" + (status?.let { " (HTTP $it)" } ?: ""))

data class V1Organization(val id: String, val name: String)
data class V1Property(val id: String, val organizationId: String, val name: String)
data class V1Room(val id: String, val propertyId: String, val name: String, val state: String, val lifecycle: String)
data class V1Listing(val id: String, val roomId: String, val title: String, val description: String, val price: String, val status: String)
data class V1Inquiry(val id: String, val listingId: String, val message: String, val status: String, val senderUserId: String?)

/** Contract-first endpoint adapter; every method below matches a published OpenAPI operation. */
class V1ContractGateway @Inject constructor(private val client: BackendClient) {
    suspend fun sessionAccess(): AccessCapabilities = BackendJsonCodec.sessionContext(
        body(client.get("identity-access/me", true)),
    ).let { AccessCapabilities(it.linkedTenancyIds.toSet(), it.operatedOrganizationIds.toSet()) }
    suspend fun organizations(): List<V1Organization> = list(client.get("organizations", true), ::organization)
    suspend fun organization(id: String): V1Organization = read(client.get("organizations/${segment(id)}", true), ::organization)
    suspend fun createOrganization(name: String): V1Organization =
        read(client.postJson("organizations", fields("name" to name).toString(), true), ::organization)
    suspend fun editOrganization(id: String, name: String): V1Organization =
        read(client.patchJson("organizations/${segment(id)}", fields("name" to name).toString()), ::organization)

    suspend fun properties(organizationId: String): List<V1Property> =
        list(client.get("properties", true, mapOf("organizationId" to organizationId)), ::property)
    suspend fun property(id: String): V1Property = read(client.get("properties/${segment(id)}", true), ::property)
    suspend fun createProperty(
        organizationId: String, name: String, privateAddress: String,
        operationalLat: Double, operationalLng: Double, publicLat: Double, publicLng: Double,
    ): V1Property {
        val body = fields(
            "organizationId" to organizationId, "name" to name, "operationalAddressText" to privateAddress,
        ).apply {
            add("operationalLocation", geo(operationalLat, operationalLng))
            add("publicLocationProjection", geo(publicLat, publicLng))
        }
        return read(client.postJson("properties", body.toString(), true), ::property)
    }
    suspend fun editProperty(id: String, name: String): V1Property =
        read(client.patchJson("properties/${segment(id)}", fields("name" to name).toString()), ::property)

    suspend fun rooms(propertyId: String): List<V1Room> =
        list(client.get("rooms", true, mapOf("propertyId" to propertyId)), ::room)
    suspend fun room(id: String): V1Room = read(client.get("rooms/${segment(id)}", true), ::room)
    suspend fun roomScope(roomId: String): Pair<String, String> {
        val room = room(roomId)
        val parent = property(room.propertyId)
        return room.propertyId to parent.organizationId
    }
    suspend fun createRoom(propertyId: String, label: String): V1Room =
        read(client.postJson("rooms", fields("propertyId" to propertyId, "nameOrLabel" to label).toString(), true), ::room)
    suspend fun editRoom(id: String, label: String): V1Room =
        read(client.patchJson("rooms/${segment(id)}", fields("nameOrLabel" to label).toString()), ::room)
    suspend fun transitionRoomOperationalState(id: String, state: String, fromState: String? = null): V1Room {
        val target = state.trim().uppercase()
        require(target in setOf("VACANT", "MAINTENANCE", "INACTIVE")) {
            "Chỉ được chuyển Room thủ công sang vacant/maintenance/inactive"
        }
        if (fromState != null) {
            require(target in legalRoomTargets(fromState)) {
                "Chuyển trạng thái phòng không hợp lệ từ $fromState sang $target"
            }
        }
        return read(
            client.postJson(
                "rooms/${segment(id)}/operational-state",
                fields("operationalState" to wireRoomOperationalState(target)).toString(),
                true,
            ),
            ::room,
        )
    }

    suspend fun currentListing(roomId: String): V1Listing? {
        val outcome = client.get("listings", true, mapOf("roomId" to roomId))
        if (outcome is TransportOutcome.Failure && outcome.httpStatus == 404) return null
        return read(outcome, ::listing)
    }
    suspend fun listing(id: String): V1Listing = read(client.get("listings/${segment(id)}", true), ::listing)
    suspend fun createListing(roomId: String, title: String, description: String, price: String, lat: Double, lng: Double): V1Listing {
        val body = fields(
            "roomId" to roomId, "publicTitle" to title, "publicDescription" to description,
            "publicPriceProjection" to price,
        ).apply { add("publicLocationProjection", geo(lat, lng)) }
        return read(client.postJson("listings", body.toString(), true), ::listing)
    }
    suspend fun editListing(id: String, title: String, description: String, price: String): V1Listing =
        read(client.patchJson("listings/${segment(id)}", fields(
            "publicTitle" to title, "publicDescription" to description, "publicPriceProjection" to price,
        ).toString()), ::listing)
    suspend fun publishListing(id: String): V1Listing =
        read(client.postEmpty("listings/${segment(id)}/publish", authenticated = true), ::listing)
    suspend fun unpublishListing(id: String): V1Listing =
        read(client.postEmpty("listings/${segment(id)}/unpublish", authenticated = true), ::listing)
    suspend fun archiveListing(id: String): V1Listing =
        read(client.postEmpty("listings/${segment(id)}/archive", authenticated = true), ::listing)

    suspend fun dashboard(organizationId: String): DashboardTransport =
        BackendJsonCodec.dashboard(body(client.get("organizations/${segment(organizationId)}/dashboard", true)))

    suspend fun roomHistory(roomId: String): RoomOperationalHistoryTransport =
        BackendJsonCodec.roomHistory(body(client.get("rooms/${segment(roomId)}/history", true)))

    suspend fun inquiries(listingId: String): List<V1Inquiry> =
        list(client.get("inquiries", true, mapOf("listingId" to listingId)), ::inquiry)
    suspend fun inquiry(id: String): V1Inquiry = read(client.get("inquiries/${segment(id)}", true), ::inquiry)

    private fun organization(x: JsonObject) = V1Organization(x.required("id"), x.required("name"))
    private fun property(x: JsonObject) = V1Property(x.required("id"), x.required("organizationId"), x.required("name"))
    private fun room(x: JsonObject) = V1Room(
        x.required("id"), x.required("propertyId"), x.required("nameOrLabel"),
        x.required("operationalState"), x.required("recordLifecycle"),
    )
    private fun listing(x: JsonObject) = V1Listing(
        x.required("id"), x.required("roomId"), x.required("publicTitle"),
        x.required("publicDescription"), x.required("publicPriceProjection"), x.required("status"),
    )
    private fun inquiry(x: JsonObject) = V1Inquiry(
        x.required("id"), x.required("listingId"), x.required("contactIntentOrMessage"),
        x.required("status"), x.get("senderUserId")?.takeUnless { it.isJsonNull }?.asString,
    )
    private fun fields(vararg p: Pair<String, String>): JsonObject = JsonObject().apply {
        p.forEach { (k, v) -> addProperty(k, v) }
    }
    private fun geo(lat: Double, lng: Double) = JsonObject().apply {
        require(lat in -90.0..90.0 && lng in -180.0..180.0) { "Tọa độ không hợp lệ" }
        addProperty("latitude", lat); addProperty("longitude", lng)
    }
    private fun segment(id: String): String {
        require(id.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "Resource ID không hợp lệ" }
        return id
    }
    private fun JsonObject.required(key: String): String =
        get(key)?.takeUnless { it.isJsonNull }?.asString ?: throw IllegalArgumentException("Missing API field: $key")

    private fun <T> read(outcome: TransportOutcome, mapper: (JsonObject) -> T): T =
        mapper(JsonParser.parseString(body(outcome)).asJsonObject)
    private fun <T> list(outcome: TransportOutcome, mapper: (JsonObject) -> T): List<T> =
        JsonParser.parseString(body(outcome)).asJsonArray.map { mapper(it.asJsonObject) }
    private fun body(outcome: TransportOutcome): String = when (outcome) {
        is TransportOutcome.Failure -> throw V1RequestException(outcome.kind, outcome.httpStatus)
        is TransportOutcome.Success -> try {
            BackendJsonCodec.unwrapResponseData(outcome.document.rawBody)
        } catch (_: RuntimeException) {
            throw V1RequestException(ErrorKind.INVALID_RESPONSE, outcome.status)
        }
    }
}
