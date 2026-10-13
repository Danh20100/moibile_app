package com.trooi.app.core.demo

import com.google.gson.JsonObject
import com.trooi.app.R
import com.trooi.app.core.model.*
import java.time.LocalDate

data class FixtureRental(val ownerId: String, val ownerName: String, val organizationId: String,
    val asset: LocalRentalAsset, val publicPoint: PublicGeoPoint?)

data class FixtureDomains(val rentals: List<FixtureRental>, val ownerSeed: LocalManagement,
    val read: FrontendReadSnapshot)

/** Only resource bindings live in Kotlin; all scenario facts come from Debug JSON. */
internal fun fixturePhoto(name: String): Int = when (name) {
    "rental_living" -> R.drawable.rental_living
    "rental_bedroom" -> R.drawable.rental_bedroom
    "rental_kitchen" -> R.drawable.rental_kitchen
    "rental_studio" -> R.drawable.rental_studio
    "rental_balcony" -> R.drawable.rental_balcony
    else -> error("Unknown fixture photo: $name")
}

internal fun parseFixtureDomains(rentalSource: JsonObject, operations: JsonObject, finance: JsonObject,
    references: JsonObject, accounts: List<FixtureAccount>, roles: Map<String, String>): FixtureDomains {
    fun parents(key: String, field: String) = references.rows(key) { string("id") to string(field) }.toMap()
    val roomProperties = parents("rooms", "propertyId")
    val propertyOrganizations = parents("properties", "organizationId")
    val tenancyRooms = parents("tenancies", "roomId")
    val organizationIds = references.strings("organizationIds").toSet()
    val externalUsers = references.rows("externalUsers") {
        keys("userId", "displayName", "operatedOrganizationIds")
        val operated = strings("operatedOrganizationIds").unique("external user organization")
        require(operated.all(organizationIds::contains)) { "Unknown external organization" }
        Triple(string("userId"), string("displayName"), operated)
    }
    (accounts.map { it.userId } + externalUsers.map { it.first }).unique("user")
    val userNames = accounts.associate { it.userId to it.displayName } + externalUsers.associate { it.first to it.second }
    val userOrganizations = accounts.associate { it.userId to it.operatedOrganizationIds } + externalUsers.associate { it.first to it.third }
    rentalSource.keys("rentals", "ownerSeed")
    val rentals = rentalSource.rows("rentals") {
        keys("ownerId", "organizationId", "asset", "publicPoint")
        val ownerId = string("ownerId")
        val organizationId = string("organizationId")
        require(organizationId in userOrganizations.getValue(ownerId)) { "Rental owner/organization mismatch" }
        val row = getAsJsonObject("asset")
        row.keys("id", "propertyId", "type", "name", "operationalAddress", "publicArea", "area", "monthlyRent",
            "advertisedDeposit", "description", "bedrooms", "bathrooms", "furnishing", "amenities", "rules",
            "photoUris", "photoNames", "status", "listingStatus", "occupied", "electricityOffer", "waterOffer",
            "serviceOffer", "minimumTermMonths", "availableFrom", "operationalLatitude", "operationalLongitude",
            "bathroomArrangement", "maxOccupants", "floorLabel", "publicListingId")
        val asset = with(row) { LocalRentalAsset(
            id = string("id"), propertyId = string("propertyId"), type = string("type"), name = string("name"),
            operationalAddress = string("operationalAddress"), publicArea = string("publicArea"), area = string("area"),
            monthlyRent = string("monthlyRent"), advertisedDeposit = string("advertisedDeposit"), description = string("description"),
            bedrooms = string("bedrooms"), bathrooms = string("bathrooms"), furnishing = string("furnishing"),
            amenities = strings("amenities"), rules = strings("rules"), photoUris = strings("photoUris"),
            photoResources = strings("photoNames").also { it.unique("photo") }.map(::fixturePhoto),
            status = enumValueOf<ManagedAssetStatus>(string("status")), listingStatus = enumValueOf<ListingVisibility>(string("listingStatus")),
            occupied = boolean("occupied"), electricityOffer = text("electricityOffer"), waterOffer = text("waterOffer"),
            serviceOffer = text("serviceOffer"), minimumTermMonths = string("minimumTermMonths"), availableFrom = text("availableFrom"),
            operationalLatitude = text("operationalLatitude"), operationalLongitude = text("operationalLongitude"),
            bathroomArrangement = nullableString("bathroomArrangement")?.let { enumValueOf<BathroomArrangement>(it) },
            maxOccupants = nullableInt("maxOccupants"), floorLabel = nullableString("floorLabel"), publicListingId = string("publicListingId")) }
        require(asset.valid()) { "Invalid rental asset" }
        require(asset.bedrooms.toIntOrNull()?.let { it >= 0 } == true && asset.bathrooms.toIntOrNull()?.let { it >= 0 } == true)
        require(asset.minimumTermMonths.toIntOrNull()?.let { it > 0 } == true)
        if (asset.availableFrom.isNotEmpty()) LocalDate.parse(asset.availableFrom)
        require(roomProperties[asset.id] == asset.propertyId && propertyOrganizations[asset.propertyId] == organizationId) { "Rental relationship mismatch" }
        require(!asset.occupied || asset.listingStatus != ListingVisibility.PUBLISHED) { "Occupied public fixture" }
        require(asset.listingStatus != ListingVisibility.PUBLISHED || (asset.status == ManagedAssetStatus.ACTIVE && asset.readyToPublish())) { "Published fixture missing active presentation" }
        require(asset.photoUris.isEmpty() && asset.operationalLatitude.isEmpty() && asset.operationalLongitude.isEmpty()) { "Fixture must use bundled media and public-only points" }
        val point = get("publicPoint").takeUnless { it.isJsonNull }?.asJsonObject?.let {
            it.keys("latitude", "longitude")
            PublicGeoPoint(it.number("latitude"), it.number("longitude")).also { point ->
                require(point.latitude in -90.0..90.0 && point.longitude in -180.0..180.0)
            }
        }
        require(asset.listingStatus != ListingVisibility.PUBLISHED || point != null) { "Published fixture missing public point" }
        FixtureRental(ownerId, userNames.getValue(ownerId), organizationId, asset, point)
    }
    require(rentals.map { it.asset.id }.unique("rental") == roomProperties.keys) { "Rental/reference coverage mismatch" }
    rentals.map { it.asset.listingId }.unique("listing")
    val assets = rentals.associate { it.asset.id to it.asset }
    val seed = rentalSource.getAsJsonObject("ownerSeed")
    seed.keys("roomIds", "entitlements")
    val seedIds = seed.strings("roomIds").unique("owner seed room")
    require(seedIds.all { id -> rentals.single { it.asset.id == id }.ownerId == accounts[1].userId })
    require(roles.getValue("room") in seedIds && roles.getValue("apartment") in seedIds) { "Owner role outside seeded portfolio" }
    val entitlements = seed.rows("entitlements") {
        keys("purchaseId", "validUntilEpochMillis")
        LocalSlotEntitlement(string("purchaseId"), long("validUntilEpochMillis").also { require(it > 0) })
    }
    entitlements.map { it.purchaseId }.unique("historical entitlement")
    val ownerSeed = LocalManagement(seedIds.map(assets::getValue), entitlements)

    operations.keys("organizations", "properties", "operationalRooms", "operatorListings", "tenancies",
        "noticesByTenancy", "incidents", "dashboardByOrganization", "rentalHistory")
    val organizations = operations.rows("organizations") {
        keys("organizationId", "displayName")
        OrganizationCard(string("organizationId").also { require(it in organizationIds) }, string("displayName"))
    }
    organizations.map { it.organizationId }.unique("operational organization")
    val properties = operations.rows("properties") {
        keys("propertyId", "organizationId", "displayName")
        PropertyCard(string("propertyId"), string("organizationId"), string("displayName")).also {
            require(propertyOrganizations[it.propertyId] == it.organizationId && organizations.any { org -> org.organizationId == it.organizationId })
        }
    }
    properties.map { it.propertyId }.unique("operational property")
    val rooms = operations.rows("operationalRooms") {
        keys("roomId", "propertyId", "operationalState", "lifecycle")
        val asset = assets.getValue(string("roomId"))
        OperationalRoomCard(asset.id, string("propertyId"), asset.name, enumValueOf<RoomOperationalState>(string("operationalState")),
            enumValueOf<RecordLifecycle>(string("lifecycle"))).also {
            require(it.propertyId == asset.propertyId && properties.any { property -> property.propertyId == it.propertyId })
            require(asset.occupied == (it.operationalState == RoomOperationalState.OCCUPIED))
        }
    }
    rooms.map { it.roomId }.unique("operational room")
    val listings = operations.rows("operatorListings") {
        keys("listingId", "roomId", "visibility")
        val asset = assets.getValue(string("roomId"))
        OperatorListingCard(string("listingId"), asset.id, asset.name, enumValueOf<ListingVisibility>(string("visibility"))).also {
            require(it.listingId == asset.listingId && it.visibility == asset.listingStatus && rooms.any { room -> room.roomId == asset.id })
        }
    }
    listings.map { it.listingId }.unique("operator listing")
    val tenancies = operations.rows("tenancies") {
        keys("tenancyId", "roomId", "lifecycle", "termsVersionLabel", "primaryTenantUserId")
        val id = string("tenancyId")
        val asset = assets.getValue(string("roomId"))
        val tenant = accounts.single { it.userId == string("primaryTenantUserId") }
        require(id in tenant.linkedTenancyIds && tenancyRooms[id] == asset.id) { "Tenancy participant/room mismatch" }
        TenancyCard(id, asset.id, asset.name, enumValueOf<TenancyLifecycle>(string("lifecycle")), nullableString("termsVersionLabel"), tenant.displayName).also {
            require(it.lifecycle !in setOf(TenancyLifecycle.ACTIVE, TenancyLifecycle.ENDING) || asset.occupied)
        }
    }
    tenancies.map { it.tenancyId }.unique("operational tenancy")
    val notices = operations.getAsJsonObject("noticesByTenancy").entrySet().associate { (id, entries) ->
        require(tenancies.any { it.tenancyId == id })
        id to entries.asJsonArray.map { element -> with(element.asJsonObject) {
            keys("noticeId", "tenancyId", "type", "content", "issuedAtLabel", "acknowledgedAtLabel")
            require(string("tenancyId") == id)
            TenancyNoticeCard(string("noticeId"), id, string("type"), string("content"), dateLabel("issuedAtLabel"), nullableDateLabel("acknowledgedAtLabel"))
        } }
    }
    notices.values.flatten().map { it.noticeId }.unique("notice")
    val incidents = operations.rows("incidents") {
        keys("incidentId", "roomId", "title", "lifecycle", "timeline", "serverActions")
        val room = string("roomId").also { require(it in assets) }
        require(strings("serverActions").isEmpty()) { "Historical fixture cannot authorize server actions" }
        IncidentCard(string("incidentId"), room, string("title"), enumValueOf<IncidentLifecycle>(string("lifecycle")), rows("timeline") {
            keys("eventId", "description", "occurredAtLabel")
            IncidentEventCard(string("eventId"), string("description"), dateLabel("occurredAtLabel"))
        })
    }
    incidents.map { it.incidentId }.unique("incident")
    incidents.flatMap { it.timeline }.map { it.eventId }.unique("incident event")
    val dashboards = operations.getAsJsonObject("dashboardByOrganization").entrySet().associate { (id, element) ->
        require(organizations.any { it.organizationId == id })
        val row = element.asJsonObject
        row.keys("roomsByState", "activeTenancyCount", "outstandingReceivableLabel", "confirmedPaymentTotalLabel", "openIncidentCount")
        val counts = row.getAsJsonObject("roomsByState")
        val roomCounts = counts.keySet().associate { enumValueOf<RoomOperationalState>(it) to counts.int(it).also { count -> require(count >= 0) } }
        val activeCount = row.nullableInt("activeTenancyCount")
        id to DashboardReadModel(roomCounts, activeCount, row.nullableMoneyLabel("outstandingReceivableLabel"),
            row.nullableMoneyLabel("confirmedPaymentTotalLabel"), row.nullableInt("openIncidentCount"))
    }
    val history = operations.rows("rentalHistory") {
        keys("tenancyId", "roomId", "period", "endedState")
        val id = string("tenancyId")
        val asset = assets.getValue(string("roomId"))
        require(tenancyRooms[id] == asset.id && asset.status == ManagedAssetStatus.ARCHIVED)
        RentalHistoryCard(id, asset.id, asset.name, asset.publicArea, string("period"), string("endedState"), asset.photoResources)
    }
    history.map { it.tenancyId }.unique("rental history")

    finance.keys("projectionKind", "tenancyId", "organizationId", "roomId", "charges", "payments", "deposits")
    require(finance.string("projectionKind") == "HISTORICAL_DEMO") { "Fixture finance is historical projection only" }
    val tenancyId = finance.string("tenancyId")
    val roomId = finance.string("roomId")
    val organizationId = finance.string("organizationId")
    require(tenancies.any { it.tenancyId == tenancyId } && tenancyRooms[tenancyId] == roomId &&
        propertyOrganizations[roomProperties[roomId]] == organizationId) { "Finance scope mismatch" }
    val charges = finance.rows("charges") {
        keys("chargeId", "label", "amountLabel", "outstandingLabel")
        ChargeCard(string("chargeId"), string("label"), moneyLabel("amountLabel"), nullableMoneyLabel("outstandingLabel"))
    }
    val payments = finance.rows("payments") {
        keys("paymentId", "amountLabel", "confirmationLabel")
        PaymentCard(string("paymentId"), moneyLabel("amountLabel"), nullableString("confirmationLabel"))
    }
    val deposits = finance.rows("deposits") {
        keys("tenancyId", "requiredLabel", "fundedLabel", "settlementLabel", "depositId", "heldLabel", "state", "blockedByOpenPolicy")
        require(string("tenancyId") == tenancyId && string("state") == "HELD")
        DepositCard(tenancyId, nullableMoneyLabel("requiredLabel"), nullableMoneyLabel("fundedLabel"), nullableMoneyLabel("settlementLabel"),
            string("depositId"), nullableMoneyLabel("heldLabel"), string("state"), boolean("blockedByOpenPolicy"))
    }
    (charges.map { it.chargeId } + payments.map { it.paymentId } + deposits.map { requireNotNull(it.depositId) }).unique("finance entity")
    val tenantFinance = TenantFinanceProjection(tenancyId, charges, payments, deposits)
    val operatorFinance = OperatorFinanceProjection(charges, payments, deposits = deposits)
    val activeAsset = assets.getValue(roles.getValue("room"))
    return FixtureDomains(rentals, ownerSeed, FrontendReadSnapshot(
        publicListings = rentals.filter { it.asset.listingStatus == ListingVisibility.PUBLISHED && !it.asset.occupied }.map(::fixturePublicListing),
        rentalHistory = history, rentalAssetPresentationByRoom = mapOf(activeAsset.id to RentalAssetPresentation(activeAsset.type, activeAsset.publicArea, activeAsset.photoResources)),
        organizations = organizations, properties = properties, operationalRooms = rooms, operatorListings = listings, tenancies = tenancies,
        tenantFinanceByTenancy = mapOf(tenancyId to tenantFinance), operatorFinanceByOrganization = mapOf(organizationId to operatorFinance),
        operatorFinanceByRoom = mapOf(roomId to operatorFinance), noticesByTenancy = notices, incidents = incidents, dashboardByOrganization = dashboards))
}

internal fun fixturePublicListing(rental: FixtureRental, asset: LocalRentalAsset = rental.asset) = PublicListingCard(
    asset.listingId, asset.name, asset.publicArea, rental.publicPoint.takeIf { asset.publicArea == rental.asset.publicArea },
    "${asset.monthlyRent}đ/tháng", asset.listingStatus, asset.amenities, rentalDetails = asset.publicDetails(rental.ownerName))

private fun <T> JsonObject.rows(key: String, map: JsonObject.() -> T): List<T> = getAsJsonArray(key).map { it.asJsonObject.map() }
private fun JsonObject.text(key: String): String {
    val value = get(key)
    require(value != null && value.isJsonPrimitive && value.asJsonPrimitive.isString) { "Required text: $key" }
    return value.asString
}
private fun JsonObject.nullableString(key: String): String? = get(key).takeUnless { it.isJsonNull }?.let { string(key) }
private fun JsonObject.boolean(key: String): Boolean {
    require(get(key).isJsonPrimitive && get(key).asJsonPrimitive.isBoolean) { "Required boolean: $key" }
    return get(key).asBoolean
}
private fun JsonObject.number(key: String): Double {
    require(get(key).isJsonPrimitive && get(key).asJsonPrimitive.isNumber) { "Required number: $key" }
    return get(key).asDouble.also { require(it.isFinite()) }
}
private fun JsonObject.long(key: String): Long {
    require(get(key).isJsonPrimitive && get(key).asJsonPrimitive.isNumber) { "Required integer: $key" }
    return get(key).asBigDecimal.longValueExact()
}
private fun JsonObject.int(key: String): Int = long(key).also { require(it in Int.MIN_VALUE..Int.MAX_VALUE) }.toInt()
private fun JsonObject.nullableInt(key: String): Int? = get(key).takeUnless { it.isJsonNull }?.let { int(key).also { require(it >= 0) } }
private fun JsonObject.dateLabel(key: String): String = string(key).also { LocalDate.parse(it, java.time.format.DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(java.time.format.ResolverStyle.STRICT)) }
private fun JsonObject.nullableDateLabel(key: String): String? = nullableString(key)?.also { dateLabel(key) }
private fun JsonObject.moneyLabel(key: String): String = string(key).also { require(it.matches(Regex("(?:0|[1-9][0-9]{0,2}(?:\\.[0-9]{3})*)đ"))) { "Invalid fixture money label" } }
private fun JsonObject.nullableMoneyLabel(key: String): String? = nullableString(key)?.also { moneyLabel(key) }
