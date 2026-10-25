package com.trooi.app.core.model

import com.google.gson.JsonParser
import com.google.gson.GsonBuilder
import com.google.gson.JsonElement
import com.google.gson.JsonPrimitive
import com.trooi.app.R
import com.trooi.app.core.demo.*
import com.trooi.app.core.model.PaymentCard
import com.trooi.app.features.profile.MockPersonalInfo
import org.junit.Assert.*
import org.junit.Test

class FixtureCatalogTest {
    private fun resource(name: String) = checkNotNull(javaClass.classLoader?.getResourceAsStream("fixtures/v1/$name"))
        .bufferedReader(Charsets.UTF_8).use { it.readText() }
    private fun parse(changes: Map<String, String> = emptyMap(), manifest: String = resource("manifest.json")) =
        FixtureCatalog.parse(manifest) { changes[it] ?: resource(it) }
    private fun rejects(changes: Map<String, String> = emptyMap(), manifest: String = resource("manifest.json")) {
        assertTrue(runCatching { parse(changes, manifest) }.isFailure)
    }

    @Test fun packagedJsonMapsToExistingLoginProfilesReferencesAndConversationSeeds() {
        val catalog = parse()
        assertEquals(catalog, DebugFixtureCatalog.current)
        assertEquals(listOf("fixture-user-lan", "fixture-user-ha", "fixture-user-linh"), DemoData.accounts.map { it.userId })
        assertEquals(listOf("Nguyễn Ngọc Lan", "Trần Thu Hà", "Phạm Thảo Linh"), DemoData.accounts.map { it.displayName })
        for (account in catalog.accounts) {
            assertEquals(account.session(), DemoData.authenticate(account.email.uppercase(), "TroOi2026!"))
            assertEquals(account.phone, MockPersonalInfo.value(account.userId, "Số điện thoại"))
            assertEquals(account.residentialAddress, MockPersonalInfo.value(account.userId, "Địa chỉ cư trú"))
            assertNull(DemoData.authenticate(account.email, "wrong"))
        }
        assertEquals("e0080000-0000-4000-8000-000000000006", DemoData.ROOM)
        assertEquals(DemoData.ROOM, DemoData.read.tenancies.single().roomId)
        assertEquals("32", DemoData.occupiedAsset.area)
        assertEquals("fixture-room-an-nhien", DemoRentalGraph.AN_NHIEN)
        assertEquals(listOf("conversation-a02", "conversation-an-nhien"), DemoData.conversations("fixture-user-lan").map { it.id })
        assertEquals(listOf("a02-message-1", "a02-message-2", "a02-message-3"), DemoData.conversations("fixture-user-ha").first().messages.map { it.id })
        assertEquals("2026-10-06T02:15:00Z", DemoData.conversations("fixture-user-lan").first().messages.first().createdAt)
        assertEquals(catalog.conversations.map { it.messages }, DemoData.conversations("fixture-user-lan").map { it.messages })
        assertEquals(listOf(3, 2), catalog.conversations.map { it.messages.size })
        assertTrue(DemoData.conversations("fixture-user-linh").isEmpty())
        assertTrue(DemoData.conversations("foreign-user").isEmpty())
        assertTrue(catalog.conversations.flatMap { it.messages }.none { it.localOnly })
    }

    @Test fun rejectsVersionPathMissingFieldsAndUnknownKeys() {
        rejects(manifest = resource("manifest.json").replace("\"schemaVersion\": 1", "\"schemaVersion\": 2"))
        rejects(manifest = resource("manifest.json").replace("accounts.json", "../accounts.json"))
        val missing = JsonParser.parseString(resource("accounts.json")).asJsonArray
        missing[0].asJsonObject.remove("userId")
        rejects(mapOf("accounts.json" to missing.toString()))
        val extra = JsonParser.parseString(resource("accounts.json")).asJsonArray
        extra[0].asJsonObject.addProperty("password", "forbidden")
        rejects(mapOf("accounts.json" to extra.toString()))
    }

    @Test fun rejectsDuplicateIdsAndDanglingCapabilitiesRoomLinksAndMessageSenders() {
        rejects(mapOf("accounts.json" to resource("accounts.json").replace("fixture-user-ha", "fixture-user-lan")))
        rejects(mapOf("accounts.json" to resource("accounts.json").replace(DemoData.TENANCY, "foreign-tenancy")))
        rejects(mapOf("accounts.json" to resource("accounts.json").replace("tenant@trooi.local", "tenant@example.com")))
        rejects(mapOf("references.json" to resource("references.json").replace(DemoData.PROPERTY, "")))
        rejects(mapOf("conversations.json" to resource("conversations.json").replace("a02-message-2", "a02-message-1")))
        rejects(mapOf("conversations.json" to resource("conversations.json").replace("fixture-user-ha", "foreign-user")))
        rejects(mapOf("conversations.json" to resource("conversations.json").replace("2026-10-06T02:15:00Z", "not-a-clock")))
        val unknownRoom = JsonParser.parseString(resource("conversations.json")).asJsonArray
        unknownRoom[0].asJsonObject.addProperty("roomId", "foreign-room")
        rejects(mapOf("conversations.json" to unknownRoom.toString()))
        val wrongSender = JsonParser.parseString(resource("conversations.json")).asJsonArray
        wrongSender[0].asJsonObject.getAsJsonArray("messages")[0].asJsonObject.addProperty("senderUserId", "fixture-user-linh")
        rejects(mapOf("conversations.json" to wrongSender.toString()))
    }
    @Test fun mockLoginDoesNotAuthorizeBackendOrInstallBearerTokens() = kotlinx.coroutines.runBlocking {
        okhttp3.mockwebserver.MockWebServer().use { server ->
            server.start(java.net.InetAddress.getLoopbackAddress(), 0)
            val tokens = com.trooi.app.core.network.InMemoryAuthTokenProvider()
            val backend = com.trooi.app.core.data.BackendTroOiRepository(
                com.trooi.app.core.network.OkHttpBackendApi(com.trooi.app.core.network.BackendClient(
                    server.url("/").newBuilder().host("127.0.0.1").build().toString(), tokens, true)), tokens)
            assertNotNull(DemoData.authenticate("tenant@trooi.local", "TroOi2026!"))
            assertTrue(backend.login("tenant@trooi.local", "TroOi2026!").isFailure)
            assertNull(tokens.token())
            // Debug backend attempts local-demo auth over HTTP, but a rejected response
            // must never install a session token or gain fixture tenancy access.
            assertEquals(1, server.requestCount)
            assertTrue(backend.initialSnapshot().read.tenancies.isEmpty())
        }
    }

    @Test fun mockLedgerLoadsHistoricalFixtureWhenDemoPayIsOffline() = kotlinx.coroutines.runBlocking {
        val repository = com.trooi.app.core.data.FixtureTroOiRepository(
            null,
            com.trooi.app.core.demo.DemoPaymentClient("http://127.0.0.1:1/api/v1"),
        )
        val tenant = repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
        val tenantRead = repository.refreshAuthorizedRead(tenant.access).getOrThrow()
        assertTrue(tenantRead.tenancies.isNotEmpty())
        assertEquals("fixture-charge-rent-oct", tenantRead.tenantFinanceByTenancy.getValue(DemoData.TENANCY).charges.first().chargeId)
        assertTrue(repository.createDemoCheckout(DemoData.TENANCY, "5200000", "offline-checkout").isFailure)

        val owner = repository.login("owner@trooi.local", "TroOi2026!").getOrThrow()
        val ownerRead = repository.refreshAuthorizedRead(owner.access).getOrThrow()
        assertTrue(ownerRead.operationalRooms.isNotEmpty())
        assertEquals("fixture-charge-rent-oct", ownerRead.operatorFinanceByOrganization.getValue(DemoData.ORGANIZATION).charges.first().chargeId)
    }

    @Test fun completeReadProjectionMatchesCapturedPreMigrationRuntime() {
        val expected = checkNotNull(javaClass.classLoader?.getResourceAsStream("fixtures/parity-v1.json"))
            .bufferedReader(Charsets.UTF_8).use { JsonParser.parseReader(it) }
        val actual = GsonBuilder().serializeNulls().create().toJsonTree(DemoData.read)
        val names = mapOf(R.drawable.rental_living to "rental_living", R.drawable.rental_bedroom to "rental_bedroom",
            R.drawable.rental_kitchen to "rental_kitchen", R.drawable.rental_studio to "rental_studio", R.drawable.rental_balcony to "rental_balcony")
        fun normalize(element: JsonElement) {
            if (element.isJsonObject) element.asJsonObject.entrySet().forEach { (key, value) ->
                if (key == "photoResources") value.asJsonArray.forEachIndexed { index, photo ->
                    value.asJsonArray.set(index, JsonPrimitive(names.getValue(photo.asInt)))
                } else normalize(value)
            } else if (element.isJsonArray) element.asJsonArray.forEach(::normalize)
        }
        normalize(actual)
        // New optional public copy is absent from the pre-migration fixture contract.
        // Compare the frozen projection while separately asserting the new field is empty.
        actual.asJsonObject.getAsJsonArray("publicListings").forEach { listing ->
            val copy = listing.asJsonObject
            assertEquals("", copy.get("publicDescription")?.asString)
            copy.remove("publicDescription")
        }
        assertEquals(expected, actual)
        assertEquals(listOf(DemoData.ROOM, DemoRentalGraph.AN_NHIEN), DemoData.ownerManagement.assets.map { it.id })
        assertEquals("fixture-history-an-nhien-capacity", DemoData.ownerManagement.entitlements.single().purchaseId)
        assertEquals(1822348800000L, DemoData.ownerManagement.entitlements.single().validUntilEpochMillis)
    }

    @Test fun everyDomainObjectRejectsMissingAndUnexpectedFields() {
        for (name in listOf("rentals.json", "operations.json", "finance.json")) {
            fun visit(element: JsonElement, path: List<String>) {
                if (element.isJsonObject) {
                    val row = element.asJsonObject
                    for (field in row.keySet()) {
                        val document = JsonParser.parseString(resource(name))
                        var target = document
                        for (segment in path) target = if (target.isJsonArray) target.asJsonArray[segment.toInt()] else target.asJsonObject.get(segment)
                        target.asJsonObject.remove(field)
                        // Map entries are optional; object schema fields are required.
                        if (path.lastOrNull() !in listOf("noticesByTenancy", "dashboardByOrganization", "roomsByState"))
                            assertTrue("$name $path missing $field", runCatching { parse(mapOf(name to document.toString())) }.isFailure)
                        visit(row.get(field), path + field)
                    }
                    if (path.lastOrNull() !in listOf("noticesByTenancy", "dashboardByOrganization", "roomsByState")) {
                        val document = JsonParser.parseString(resource(name))
                        var target = document
                        for (segment in path) target = if (target.isJsonArray) target.asJsonArray[segment.toInt()] else target.asJsonObject.get(segment)
                        target.asJsonObject.addProperty("unexpected", true)
                        assertTrue("$name $path extra field", runCatching { parse(mapOf(name to document.toString())) }.isFailure)
                    }
                } else if (element.isJsonArray) element.asJsonArray.forEachIndexed { index, child -> visit(child, path + index.toString()) }
            }
            visit(JsonParser.parseString(resource(name)), emptyList())
        }
    }

    @Test fun domainEnumsNumericTypesMediaAndScopeFailClosed() {
        fun invalid(name: String, mutate: (com.google.gson.JsonObject) -> Unit) {
            val source = JsonParser.parseString(resource(name)).asJsonObject
            mutate(source)
            rejects(mapOf(name to source.toString()))
        }
        invalid("rentals.json") { it.getAsJsonArray("rentals")[0].asJsonObject.getAsJsonObject("asset").addProperty("status", "UNKNOWN") }
        invalid("rentals.json") { it.getAsJsonArray("rentals")[0].asJsonObject.getAsJsonObject("asset").addProperty("occupied", "true") }
        invalid("rentals.json") { it.getAsJsonArray("rentals")[0].asJsonObject.getAsJsonObject("asset").addProperty("maxOccupants", 1.5) }
        invalid("rentals.json") { it.getAsJsonArray("rentals")[0].asJsonObject.getAsJsonObject("asset").getAsJsonArray("photoNames").set(0, JsonPrimitive("missing_photo")) }
        invalid("rentals.json") { it.getAsJsonArray("rentals")[0].asJsonObject.addProperty("ownerId", "fixture-user-lan") }
        invalid("rentals.json") { it.getAsJsonArray("rentals")[0].asJsonObject.getAsJsonObject("asset").addProperty("propertyId", "fixture-property-linh-trung") }
        invalid("rentals.json") { it.getAsJsonArray("rentals")[1].asJsonObject.getAsJsonObject("publicPoint").addProperty("latitude", 91) }
        invalid("rentals.json") { it.getAsJsonArray("rentals")[1].asJsonObject.getAsJsonObject("asset").add("photoNames", com.google.gson.JsonArray()) }
        invalid("rentals.json") { it.getAsJsonArray("rentals")[1].asJsonObject.getAsJsonObject("asset").addProperty("status", "ARCHIVED") }
        rejects(mapOf("references.json" to resource("references.json").replace("\"apartment\": \"fixture-room-an-nhien\"", "\"apartment\": \"fixture-room-window\"")))
        invalid("operations.json") { it.getAsJsonArray("tenancies")[0].asJsonObject.addProperty("primaryTenantUserId", "fixture-user-ha") }
        invalid("operations.json") { it.getAsJsonArray("tenancies")[0].asJsonObject.addProperty("roomId", DemoRentalGraph.AN_NHIEN) }
        invalid("operations.json") { it.getAsJsonArray("operationalRooms")[0].asJsonObject.addProperty("operationalState", "VACANT") }
        invalid("operations.json") { it.getAsJsonArray("incidents")[0].asJsonObject.getAsJsonArray("serverActions").add("RESOLVE") }
        invalid("operations.json") { it.getAsJsonObject("dashboardByOrganization").getAsJsonObject(DemoData.ORGANIZATION).addProperty("outstandingReceivableLabel", "-5đ") }
        invalid("operations.json") { it.getAsJsonObject("noticesByTenancy").getAsJsonArray(DemoData.TENANCY)[0].asJsonObject.addProperty("acknowledgedAtLabel", "not-a-date") }
        invalid("finance.json") { it.addProperty("projectionKind", "SERVER_CONFIRMED") }
        invalid("finance.json") { it.addProperty("organizationId", "fixture-organization-nam") }
        invalid("finance.json") { it.getAsJsonArray("charges")[0].asJsonObject.addProperty("amountLabel", "-5đ") }
        invalid("finance.json") { it.getAsJsonArray("deposits")[0].asJsonObject.addProperty("state", "UNKNOWN") }
        invalid("finance.json") { it.getAsJsonArray("deposits")[0].asJsonObject.addProperty("blockedByOpenPolicy", 0) }
    }

    @Test fun duplicatesAcrossEachDomainAreRejected() {
        for ((name, fields) in mapOf("rentals.json" to listOf("rentals"), "operations.json" to listOf("organizations", "properties", "operationalRooms", "operatorListings", "tenancies", "incidents", "rentalHistory"),
            "finance.json" to listOf("charges", "payments", "deposits"))) {
            for (field in fields) {
                val source = JsonParser.parseString(resource(name)).asJsonObject
                source.getAsJsonArray(field).add(source.getAsJsonArray(field)[0].deepCopy())
                rejects(mapOf(name to source.toString()))
            }
        }
    }

    @Test fun confirmedDemoPaymentSurvivesRefreshAndRestart() = kotlinx.coroutines.runBlocking {
        val prefs = MemoryPrefs()
        val repository = com.trooi.app.core.data.FixtureTroOiRepository(prefs, null)
        val tenant = repository.login("tenant@trooi.local", "TroOi2026!").getOrThrow()
        val before = repository.refreshAuthorizedRead(tenant.access).getOrThrow().tenantFinanceByTenancy.getValue(DemoData.TENANCY)
        val card = PaymentCard("payment-confirmed-1", "1.000đ", "Đã xác nhận thanh toán · 19/10/2026 · 10:00")
        repository.rememberConfirmedPayment(card)
        val refreshed = repository.refreshAuthorizedRead(tenant.access).getOrThrow().tenantFinanceByTenancy.getValue(DemoData.TENANCY)
        assertEquals(before.payments.size + 1, refreshed.payments.size)
        assertTrue(refreshed.payments.any { it.paymentId == card.paymentId && it.amountLabel == "1.000đ" })
        assertEquals(before.charges, refreshed.charges)
        assertEquals(before.deposits, refreshed.deposits)
        assertEquals(before.receipts, refreshed.receipts)
        repository.rememberConfirmedPayment(card)
        assertEquals(1, repository.refreshAuthorizedRead(tenant.access).getOrThrow()
            .tenantFinanceByTenancy.getValue(DemoData.TENANCY).payments.count { it.paymentId == card.paymentId })
        val restarted = com.trooi.app.core.data.FixtureTroOiRepository(prefs, null)
        val restored = restarted.refreshAuthorizedRead(tenant.access).getOrThrow().tenantFinanceByTenancy.getValue(DemoData.TENANCY)
        assertTrue(restored.payments.any { it.paymentId == card.paymentId && it.amountLabel == "1.000đ" })
        assertEquals(before.charges, restored.charges)
        assertEquals(before.deposits, restored.deposits)
        assertEquals(before.receipts, restored.receipts)
    }

    @Test fun changedJsonIsConsumedByRuntimeProjectionWithoutKotlinFallback() {
        val source = JsonParser.parseString(resource("rentals.json")).asJsonObject
        source.getAsJsonArray("rentals")[0].asJsonObject.getAsJsonObject("asset").addProperty("name", "Tên từ JSON")
        val catalog = parse(mapOf("rentals.json" to source.toString()))
        assertEquals("Tên từ JSON", catalog.domains.ownerSeed.assets.first().name)
        assertEquals("Tên từ JSON", catalog.domains.read.operationalRooms.first().label)
        assertEquals("Tên từ JSON", catalog.domains.read.tenancies.first().roomLabel)
    }

}

private class MemoryPrefs : android.content.SharedPreferences {
    private val values = linkedMapOf<String, String>()
    override fun getAll(): MutableMap<String, *> = values.toMutableMap()
    override fun getString(key: String?, defValue: String?) = values[key] ?: defValue
    override fun getStringSet(key: String?, defValues: MutableSet<String>?) = defValues
    override fun getInt(key: String?, defValue: Int) = defValue
    override fun getLong(key: String?, defValue: Long) = defValue
    override fun getFloat(key: String?, defValue: Float) = defValue
    override fun getBoolean(key: String?, defValue: Boolean) = defValue
    override fun contains(key: String?) = values.containsKey(key)
    override fun edit(): android.content.SharedPreferences.Editor = Editor()
    override fun registerOnSharedPreferenceChangeListener(listener: android.content.SharedPreferences.OnSharedPreferenceChangeListener?) {}
    override fun unregisterOnSharedPreferenceChangeListener(listener: android.content.SharedPreferences.OnSharedPreferenceChangeListener?) {}
    private inner class Editor : android.content.SharedPreferences.Editor {
        private val edits = linkedMapOf<String, String?>()
        override fun putString(key: String, value: String?) = apply { edits[key] = value }
        override fun putStringSet(key: String, values: MutableSet<String>?) = this
        override fun putInt(key: String, value: Int) = this
        override fun putLong(key: String, value: Long) = this
        override fun putFloat(key: String, value: Float) = this
        override fun putBoolean(key: String, value: Boolean) = this
        override fun remove(key: String) = apply { edits[key] = null }
        override fun clear() = apply { values.clear() }
        override fun commit() = true.also { flush() }
        override fun apply() = flush()
        private fun flush() { edits.forEach { (key, value) -> if (value == null) values.remove(key) else values[key] = value } }
    }
}
