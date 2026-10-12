package com.trooi.app.core.demo

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.trooi.app.core.data.UserSession
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.model.ConversationMessage
import java.time.Instant

/** Debug data, never server authorization. Parsing needs strings, not an Android Context. */
data class FixtureAccount(val userId: String, val displayName: String, val email: String,
    val phone: String, val residentialAddress: String, val linkedTenancyIds: Set<String>,
    val operatedOrganizationIds: Set<String>) {
    fun session() = UserSession(userId, displayName, AccessCapabilities(linkedTenancyIds, operatedOrganizationIds))
}

data class FixtureConversation(val id: String, val roomId: String, val participantIds: List<String>,
    val messages: List<ConversationMessage>)

data class FixtureCatalog(val accounts: List<FixtureAccount>, val roles: Map<String, String>,
    val conversations: List<FixtureConversation>, val roomPropertyIds: Map<String, String>,
    val domains: FixtureDomains) {
    companion object {
        const val DIRECTORY = "fixtures/v1/"
        fun parse(manifest: String, readSource: (String) -> String): FixtureCatalog {
            val header = JsonParser.parseString(manifest).asJsonObject
            header.keys("schemaVersion", "catalogId", "scenario", "sources")
            require(header.get("schemaVersion").toString() == "1") { "Unsupported fixture schema version" }
            require(header.string("catalogId") == "trooi-debug-rental-v1")
            require(header.string("scenario") == "small-rental-lifecycle")
            val sources = header.getAsJsonObject("sources")
            sources.keys("accounts", "references", "conversations", "rentals", "operations", "finance")
            fun source(key: String) = JsonParser.parseString(readSource(sources.string(key).also {
                require(it == "$key.json") { "Unexpected fixture source" }
            }))
            val references = source("references").asJsonObject
            references.keys("roles", "organizationIds", "properties", "rooms", "tenancies", "externalUsers")
            val rolesJson = references.getAsJsonObject("roles")
            rolesJson.keys("organization", "property", "room", "tenancy", "apartment", "previousRoom", "previousTenancy")
            val roles = rolesJson.keySet().associateWith { rolesJson.string(it) }
            val organizations = references.strings("organizationIds").unique("organization")
            fun links(key: String, parent: String, parents: Set<String>): Set<String> =
                references.getAsJsonArray(key).map { element ->
                    val row = element.asJsonObject
                    row.keys("id", parent)
                    require(row.string(parent) in parents) { "Unknown $parent" }
                    row.string("id")
                }.unique(key)
            val properties = links("properties", "organizationId", organizations)
            val rooms = links("rooms", "propertyId", properties)
            val tenancies = links("tenancies", "roomId", rooms)
            fun parents(key: String, field: String) = references.getAsJsonArray(key).associate {
                it.asJsonObject.string("id") to it.asJsonObject.string(field)
            }
            val roomProperties = parents("rooms", "propertyId")
            require(roomProperties[roles.getValue("room")] == roles.getValue("property"))
            require(parents("properties", "organizationId")[roles.getValue("property")] == roles.getValue("organization"))
            require(parents("tenancies", "roomId")[roles.getValue("tenancy")] == roles.getValue("room"))
            require(roles.getValue("organization") in organizations && roles.getValue("property") in properties)
            require(roles.getValue("room") in rooms && roles.getValue("apartment") in rooms && roles.getValue("tenancy") in tenancies)
            require(roles.getValue("previousRoom") in rooms && roles.getValue("previousTenancy") in tenancies)
            require(parents("tenancies", "roomId")[roles.getValue("previousTenancy")] == roles.getValue("previousRoom"))
            (organizations + properties + rooms + tenancies).also {
                require(it.size == organizations.size + properties.size + rooms.size + tenancies.size) { "Duplicate entity ID" }
            }
            val accounts = source("accounts").asJsonArray.map { element ->
                val row = element.asJsonObject
                row.keys("userId", "displayName", "email", "phone", "residentialAddress", "linkedTenancyIds", "operatedOrganizationIds")
                FixtureAccount(row.string("userId"), row.string("displayName"), row.string("email"),
                    row.string("phone"), row.string("residentialAddress"), row.strings("linkedTenancyIds").unique("account tenancy"),
                    row.strings("operatedOrganizationIds").unique("account organization")).also {
                    require(it.email.endsWith("@trooi.local")) { "Fixture email must be sandbox-only" }
                    require(it.linkedTenancyIds.all(tenancies::contains) && it.operatedOrganizationIds.all(organizations::contains)) { "Unknown account access reference" }
                }
            }
            require(accounts.size == 3) { "Expected tenant, operator and onboarding accounts" }
            require(accounts[0].linkedTenancyIds == setOf(roles.getValue("tenancy")) && accounts[0].operatedOrganizationIds.isEmpty())
            require(accounts[1].operatedOrganizationIds == setOf(roles.getValue("organization")) && accounts[1].linkedTenancyIds.isEmpty())
            require(accounts[2].linkedTenancyIds.isEmpty() && accounts[2].operatedOrganizationIds.isEmpty())
            val users = accounts.map { it.userId }.unique("account")
            accounts.map { it.email }.unique("email")
            accounts.map { it.phone }.unique("phone")
            val conversations = source("conversations").asJsonArray.map { element ->
                val row = element.asJsonObject
                row.keys("id", "roomId", "participantIds", "messages")
                val participants = row.strings("participantIds")
                require(participants.unique("participant").size == 2 && participants.all(users::contains))
                require(row.string("roomId") in rooms) { "Unknown conversation room" }
                val messages = row.getAsJsonArray("messages").map { message ->
                    val entry = message.asJsonObject
                    entry.keys("id", "senderUserId", "text", "createdAt")
                    ConversationMessage(entry.string("id"), entry.string("senderUserId"), entry.string("text"), entry.string("createdAt")).also {
                        require(it.senderUserId in participants) { "Sender outside conversation" }
                        Instant.parse(it.createdAt)
                        require(it.text.length <= 500)
                    }
                }
                require(messages.isNotEmpty())
                require(messages.map { Instant.parse(it.createdAt) }.zipWithNext().all { (a, b) -> a <= b }) { "Unordered messages" }
                FixtureConversation(row.string("id"), row.string("roomId"), participants, messages)
            }
            conversations.map { it.id }.unique("conversation")
            conversations.flatMap { it.messages }.map { it.id }.unique("message")
            val domains = parseFixtureDomains(source("rentals").asJsonObject, source("operations").asJsonObject,
                source("finance").asJsonObject, references, accounts, roles)
            return FixtureCatalog(accounts, roles, conversations, roomProperties, domains)
        }
    }
}

internal fun JsonObject.keys(vararg expected: String) {
    require(keySet() == expected.toSet()) { "Missing or unexpected fixture fields: ${expected.joinToString()}" }
}
internal fun JsonObject.string(key: String): String {
    val value = get(key)
    require(value != null && value.isJsonPrimitive && value.asJsonPrimitive.isString) { "Required string: $key" }
    return value.asString.also { require(it.isNotBlank()) { "Blank fixture field: $key" } }
}
internal fun JsonObject.strings(key: String): List<String> = getAsJsonArray(key).map {
    require(it.isJsonPrimitive && it.asJsonPrimitive.isString && it.asString.isNotBlank())
    it.asString
}
internal fun List<String>.unique(kind: String): Set<String> = toSet().also {
    require(size == it.size) { "Duplicate $kind" }
}

/** Assets are installed with an available Context; JVM tests use the same JSON as resources. */
object DebugFixtureCatalog {
    @Volatile private var loaded: FixtureCatalog? = null
    val current: FixtureCatalog get() = loaded ?: synchronized(this) {
        loaded ?: read { path ->
            checkNotNull(DebugFixtureCatalog::class.java.classLoader?.getResourceAsStream(path)) {
                "Debug fixture assets must be initialized before use"
            }.bufferedReader(Charsets.UTF_8).use { it.readText() }
        }.also { loaded = it }
    }
    @Synchronized fun initialize(readAsset: (String) -> String) {
        if (loaded == null) loaded = read(readAsset)
    }
    private fun read(reader: (String) -> String) = FixtureCatalog.parse(reader(FixtureCatalog.DIRECTORY + "manifest.json")) {
        reader(FixtureCatalog.DIRECTORY + it)
    }
}
