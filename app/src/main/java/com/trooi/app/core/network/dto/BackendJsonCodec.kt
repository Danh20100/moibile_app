package com.trooi.app.core.network.dto

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser

object BackendJsonCodec {
    fun unwrapResponseData(json: String): String {
        val root = JsonParser.parseString(json)
        if (!root.isJsonObject) return json
        val envelope = root.asJsonObject
        if (!envelope.has("success") || !envelope.has("data")) return json
        if (!envelope.get("success").asBoolean) {
            throw IllegalArgumentException("Backend response envelope reported failure")
        }
        return envelope.get("data").toString()
    }

    fun encodeGoogleToken(idToken: String): String = JsonObject().apply {
        addProperty("idToken", idToken)
    }.toString()

    fun encodeInquiry(listingId: String, message: String): String = JsonObject().apply {
        addProperty("listingId", listingId)
        addProperty("contactIntentOrMessage", message)
        addProperty("status", "NEW")
    }.toString()

    fun encodeRoomOperationalState(operationalState: String): String {
        require(operationalState in MANUAL_ROOM_STATES) {
            "Manual Room state must be one of $MANUAL_ROOM_STATES"
        }
        return JsonObject().apply {
            addProperty("operationalState", operationalState)
        }.toString()
    }

    fun encodeTenancyActivation(occurredAt: String): String = JsonObject().apply {
        addProperty("occurredAt", occurredAt)
    }.toString()

    fun encodeTermsAcknowledgement(tenancyParticipantId: String, acknowledgedAt: String): String =
        JsonObject().apply {
            addProperty("tenancyParticipantId", tenancyParticipantId)
            addProperty("acknowledgedAt", acknowledgedAt)
        }.toString()

    fun encodeNoticeIssue(noticeType: String, contentOrNote: String, issuedAt: String): String =
        JsonObject().apply {
            addProperty("noticeType", noticeType)
            addProperty("contentOrNote", contentOrNote)
            addProperty("issuedAt", issuedAt)
        }.toString()

    fun encodeNoticeAcknowledgement(occurredAt: String): String = JsonObject().apply {
        addProperty("occurredAt", occurredAt)
    }.toString()

    fun encodeDepositCreate(tenancyId: String): String = JsonObject().apply {
        addProperty("tenancyId", tenancyId)
    }.toString()

    fun encodeDepositSettlement(
        refundedAmount: String,
        retainedAmount: String,
        reasonOrNote: String,
        settledAt: String,
    ): String = JsonObject().apply {
        addProperty("refundedAmount", refundedAmount)
        addProperty("retainedAmount", retainedAmount)
        addProperty("reasonOrNote", reasonOrNote)
        addProperty("settledAt", settledAt)
    }.toString()

    fun publicListings(json: String): List<PublicListingTransport> =
        array(json) { obj ->
            val location = obj.requiredObject("publicLocationProjection")
            PublicListingTransport(
                id = obj.requiredString("id"),
                roomId = obj.requiredString("roomId"),
                status = obj.requiredEnumString("status", LISTING_STATES),
                publicTitle = obj.requiredString("publicTitle"),
                publicDescription = obj.requiredString("publicDescription"),
                publicPriceProjection = obj.requiredString("publicPriceProjection"),
                publicLocation = location.publicLocation(),
            )
        }

    fun listing(json: String): ListingTransport = listing(JsonParser.parseString(json).asJsonObject)

    fun publicSearchResults(json: String): List<PublicListingSearchResultTransport> =
        array(json, ::publicSearchResult)

    fun verifiedPrincipal(json: String): VerifiedPrincipalTransport {
        val obj = JsonParser.parseString(json).asJsonObject
        return VerifiedPrincipalTransport(
            userId = obj.requiredString("userId"),
            provider = obj.requiredString("provider"),
            issuer = obj.requiredString("issuer"),
            subject = obj.requiredString("subject"),
            email = obj.optionalString("email"),
            emailVerified = obj.optionalBoolean("emailVerified"),
            name = obj.optionalString("name"),
            pictureUrl = obj.optionalString("pictureUrl"),
        )
    }

    fun sessionContext(json: String): SessionContextTransport {
        val obj = JsonParser.parseString(json).asJsonObject
        return SessionContextTransport(
            userId = obj.requiredString("userId"),
            operatedOrganizationIds = obj.requiredStringList("operatedOrganizationIds"),
            linkedTenancyIds = obj.requiredStringList("linkedTenancyIds"),
            email = obj.optionalString("email"),
            name = obj.optionalString("name"),
            pictureUrl = obj.optionalString("pictureUrl"),
        )
    }

    fun organizations(json: String): List<OrganizationTransport> = array(json, ::organization)
    fun properties(json: String): List<PropertyTransport> = array(json, ::property)
    fun rooms(json: String): List<RoomTransport> = array(json, ::room)
    fun room(json: String): RoomTransport = room(JsonParser.parseString(json).asJsonObject)
    fun tenancies(json: String): List<TenancyTransport> = array(json, ::tenancy)
    fun tenancy(json: String): TenancyTransport = tenancy(JsonParser.parseString(json).asJsonObject)
    fun terms(json: String): List<TenancyTermsTransport> = array(json, ::terms)
    fun termsAcknowledgement(json: String): TermsAcknowledgementTransport =
        termsAcknowledgement(JsonParser.parseString(json).asJsonObject)
    fun notices(json: String): List<TenancyNoticeTransport> = array(json, ::notice)
    fun notice(json: String): TenancyNoticeTransport = notice(JsonParser.parseString(json).asJsonObject)
    fun billingCycles(json: String): List<BillingCycleTransport> = array(json, ::billingCycle)
    fun payment(json: String): PaymentTransport = payment(JsonParser.parseString(json).asJsonObject)
    fun payments(json: String): List<PaymentTransport> = array(json, ::payment)
    fun receipts(json: String): List<ReceiptTransport> = array(json, ::receipt)
    fun incidents(json: String): List<IncidentTransport> = array(json, ::incident)
    fun incidentEvents(json: String): List<IncidentEventTransport> = array(json, ::incidentEvent)
    fun inquiry(json: String): InquiryTransport = inquiry(JsonParser.parseString(json).asJsonObject)
    fun notifications(json: String): List<NotificationTransport> = array(json, ::notification)
    fun notification(json: String): NotificationTransport =
        notification(JsonParser.parseString(json).asJsonObject)
    fun dashboard(json: String): DashboardTransport = dashboard(JsonParser.parseString(json).asJsonObject)
    fun deposit(json: String): DepositProjectionTransport = deposit(JsonParser.parseString(json).asJsonObject)
    fun depositEvents(json: String): List<DepositEventTransport> = array(json, ::depositEvent)
    fun depositSettlement(json: String): DepositSettlementTransport =
        depositSettlement(JsonParser.parseString(json).asJsonObject)
    fun rentalHistory(json: String): RentalHistoryTransport =
        rentalHistory(JsonParser.parseString(json).asJsonObject)
    fun roomHistory(json: String): RoomOperationalHistoryTransport =
        roomHistory(JsonParser.parseString(json).asJsonObject)

    private fun organization(obj: JsonObject) = OrganizationTransport(
        id = obj.requiredString("id"),
        name = obj.requiredString("name"),
        primaryOwnerUserId = obj.requiredString("primaryOwnerUserId"),
    )

    private fun property(obj: JsonObject) = PropertyTransport(
        id = obj.requiredString("id"),
        organizationId = obj.requiredString("organizationId"),
        name = obj.requiredString("name"),
        lifecycleStatus = obj.requiredString("lifecycleStatus"),
    )

    private fun room(obj: JsonObject) = RoomTransport(
        id = obj.requiredString("id"),
        propertyId = obj.requiredString("propertyId"),
        nameOrLabel = obj.requiredString("nameOrLabel"),
        operationalState = obj.requiredEnumString("operationalState", ROOM_STATES),
        recordLifecycle = obj.requiredEnumString("recordLifecycle", RECORD_LIFECYCLES),
    )

    private fun listing(obj: JsonObject): ListingTransport {
        val location = obj.requiredObject("publicLocationProjection")
        return ListingTransport(
            id = obj.requiredString("id"),
            roomId = obj.requiredString("roomId"),
            status = obj.requiredEnumString("status", LISTING_STATES),
            publicTitle = obj.requiredString("publicTitle"),
            publicDescription = obj.requiredString("publicDescription"),
            publicPriceProjection = obj.requiredString("publicPriceProjection"),
            publicLocation = location.publicLocation(),
        )
    }

    private fun publicSearchResult(obj: JsonObject): PublicListingSearchResultTransport {
        val location = obj.requiredObject("publicLocation")
        return PublicListingSearchResultTransport(
            listingId = obj.requiredString("listingId"),
            roomId = obj.requiredString("roomId"),
            publicTitle = obj.requiredString("publicTitle"),
            publicDescription = obj.requiredString("publicDescription"),
            publicPriceProjection = obj.requiredString("publicPriceProjection"),
            publicLocation = location.publicLocation(),
            distanceMeters = obj.requiredDouble("distanceMeters"),
        )
    }

    private fun tenancy(obj: JsonObject) = TenancyTransport(
        id = obj.requiredString("id"),
        roomId = obj.requiredString("roomId"),
        status = obj.requiredEnumString("status", TENANCY_STATES),
        startedAt = obj.optionalString("startedAt"),
        endedAt = obj.optionalString("endedAt"),
        endReason = obj.optionalEnumString("endReason", TENANCY_END_REASONS),
    )

    private fun terms(obj: JsonObject) = TenancyTermsTransport(
        id = obj.requiredString("id"),
        tenancyId = obj.requiredString("tenancyId"),
        version = obj.requiredInt("version"),
        rentAmount = obj.requiredString("rentAmount"),
        agreedDepositRequirement = obj.requiredString("agreedDepositRequirement"),
        termStart = obj.requiredString("termStart"),
        termEnd = obj.requiredString("termEnd"),
        effectiveFromCycleBoundary = obj.requiredString("effectiveFromCycleBoundary"),
        billingDayOrDueDateRule = obj.requiredObject("billingDayOrDueDateRule"),
        electricityArrangement = obj.requiredObject("electricityArrangement"),
        waterArrangement = obj.requiredObject("waterArrangement"),
        minimalRentalConditions = obj.requiredObject("minimalRentalConditions"),
    )

    private fun termsAcknowledgement(obj: JsonObject) = TermsAcknowledgementTransport(
        id = obj.requiredString("id"),
        tenancyTermsId = obj.requiredString("tenancyTermsId"),
        tenancyParticipantId = obj.requiredString("tenancyParticipantId"),
        userId = obj.requiredString("userId"),
        acknowledgedAt = obj.requiredString("acknowledgedAt"),
    )

    private fun notice(obj: JsonObject) = TenancyNoticeTransport(
        id = obj.requiredString("id"),
        tenancyId = obj.requiredString("tenancyId"),
        noticeType = obj.requiredString("noticeType"),
        issuedByUserId = obj.requiredString("issuedByUserId"),
        contentOrNote = obj.requiredString("contentOrNote"),
        issuedAt = obj.requiredString("issuedAt"),
        acknowledgedByUserId = obj.optionalString("acknowledgedByUserId"),
        acknowledgedAt = obj.optionalString("acknowledgedAt"),
    )

    private fun billingCycle(obj: JsonObject) = BillingCycleTransport(
        id = obj.requiredString("id"),
        tenancyId = obj.requiredString("tenancyId"),
        tenancyTermsId = obj.requiredString("tenancyTermsId"),
        periodStart = obj.requiredString("periodStart"),
        periodEnd = obj.requiredString("periodEnd"),
        charges = obj.requiredArray("charges").map { charge(it.asJsonObject) },
    )

    private fun charge(obj: JsonObject) = ChargeTransport(
        id = obj.requiredString("id"),
        billingCycleId = obj.requiredString("billingCycleId"),
        type = obj.requiredEnumString("type", CHARGE_TYPES),
        amount = obj.requiredString("amount"),
    )

    private fun payment(obj: JsonObject) = PaymentTransport(
        id = obj.requiredString("id"),
        tenancyId = obj.requiredString("tenancyId"),
        amount = obj.requiredString("amount"),
        source = obj.requiredEnumString("source", PAYMENT_SOURCES),
        verification = obj.requiredEnumString("verification", PAYMENT_VERIFICATIONS),
        confirmedAt = obj.requiredString("confirmedAt"),
        voidedOrReversedAt = obj.optionalString("voidedOrReversedAt"),
        correctionNote = obj.optionalString("correctionNote"),
        replacementPaymentId = obj.optionalString("replacementPaymentId"),
    )

    private fun receipt(obj: JsonObject) = ReceiptTransport(
        id = obj.requiredString("id"),
        paymentId = obj.requiredString("paymentId"),
        status = obj.requiredEnumString("status", RECEIPT_STATUSES),
        issuedAt = obj.requiredString("issuedAt"),
        voidedAt = obj.optionalString("voidedAt"),
        replacementReceiptId = obj.optionalString("replacementReceiptId"),
    )

    private fun incident(obj: JsonObject) = IncidentTransport(
        id = obj.requiredString("id"),
        roomId = obj.requiredString("roomId"),
        reportedByUserId = obj.optionalString("reportedByUserId"),
        category = obj.requiredEnumString("category", INCIDENT_CATEGORIES),
        status = obj.requiredEnumString("status", INCIDENT_STATUSES),
        closureReason = obj.optionalString("closureReason"),
        createdAt = obj.requiredString("createdAt"),
        closedAt = obj.optionalString("closedAt"),
    )

    private fun incidentEvent(obj: JsonObject) = IncidentEventTransport(
        id = obj.requiredString("id"),
        incidentId = obj.requiredString("incidentId"),
        eventType = obj.requiredString("eventType"),
        actorUserId = obj.optionalString("actorUserId"),
        note = obj.optionalString("note"),
        attachmentReference = obj.optionalString("attachmentReference"),
        fromStatus = obj.optionalEnumString("fromStatus", INCIDENT_STATUSES),
        toStatus = obj.optionalEnumString("toStatus", INCIDENT_STATUSES),
        occurredAt = obj.requiredString("occurredAt"),
    )

    private fun inquiry(obj: JsonObject) = InquiryTransport(
        id = obj.requiredString("id"),
        listingId = obj.requiredString("listingId"),
        senderUserId = obj.optionalString("senderUserId"),
        contactIntentOrMessage = obj.requiredString("contactIntentOrMessage"),
        status = obj.requiredString("status"),
        createdAt = obj.requiredString("createdAt"),
    )

    private fun notification(obj: JsonObject) = NotificationTransport(
        id = obj.requiredString("id"),
        recipientUserId = obj.requiredString("recipientUserId"),
        category = obj.requiredString("category"),
        messageOrPayloadReference = obj.requiredString("messageOrPayloadReference"),
        sourceType = obj.optionalString("sourceType"),
        sourceId = obj.optionalString("sourceId"),
        deliveryStatus = obj.requiredString("deliveryStatus"),
        createdAt = obj.requiredString("createdAt"),
        deliveredAt = obj.optionalJson("deliveredAt"),
        readAt = obj.optionalJson("readAt"),
    )

    private fun dashboard(obj: JsonObject): DashboardTransport {
        val counts = obj.requiredObject("roomsByState")
        return DashboardTransport(
            organizationId = obj.requiredString("organizationId"),
            roomsByState = DashboardRoomStateCountsTransport(
                vacant = counts.requiredInt("VACANT"),
                occupied = counts.requiredInt("OCCUPIED"),
                maintenance = counts.requiredInt("MAINTENANCE"),
                inactive = counts.requiredInt("INACTIVE"),
            ),
            activeTenancyCount = obj.requiredInt("activeTenancyCount"),
            outstandingReceivable = obj.optionalString("outstandingReceivable"),
            confirmedPaymentTotal = obj.optionalString("confirmedPaymentTotal"),
            openIncidentCount = obj.requiredInt("openIncidentCount"),
        )
    }

    private fun deposit(obj: JsonObject) = DepositProjectionTransport(
        id = obj.requiredString("id"),
        tenancyId = obj.requiredString("tenancyId"),
        requirementAmount = obj.optionalString("requirementAmount"),
        fundedAmount = obj.requiredString("fundedAmount"),
        settledAmount = obj.requiredString("settledAmount"),
        heldAmount = obj.requiredString("heldAmount"),
        state = obj.optionalEnumString("state", DEPOSIT_STATES),
        blockedByOpenPolicy = obj.requiredBoolean("blockedByOpenPolicy"),
    )

    private fun depositEvent(obj: JsonObject) = DepositEventTransport(
        id = obj.requiredString("id"),
        depositId = obj.requiredString("depositId"),
        eventType = obj.requiredEnumString("eventType", DEPOSIT_EVENT_TYPES),
        amount = obj.requiredString("amount"),
        occurredAt = obj.requiredString("occurredAt"),
        paymentApplicationId = obj.optionalString("paymentApplicationId"),
        settlementId = obj.optionalString("settlementId"),
    )

    private fun depositSettlement(obj: JsonObject) = DepositSettlementTransport(
        id = obj.requiredString("id"),
        depositId = obj.requiredString("depositId"),
        refundedAmount = obj.requiredString("refundedAmount"),
        retainedAmount = obj.requiredString("retainedAmount"),
        reasonOrNote = obj.requiredString("reasonOrNote"),
        actedByUserId = obj.requiredString("actedByUserId"),
        settledAt = obj.requiredString("settledAt"),
    )

    private fun rentalHistory(obj: JsonObject) = RentalHistoryTransport(
        tenancy = tenancy(obj.requiredObject("tenancy")),
        terms = obj.requiredArray("terms").map { terms(it.asJsonObject) },
        payments = obj.requiredArray("payments").map { rentalPaymentHistory(it.asJsonObject) },
        notices = obj.requiredArray("notices").map { notice(it.asJsonObject) },
        incidents = obj.requiredArray("incidents").map { rentalIncidentHistory(it.asJsonObject) },
        deposit = obj.optionalObject("deposit")?.let(::rentalDepositHistory),
    )

    private fun rentalPaymentHistory(obj: JsonObject) = RentalPaymentHistoryEntryTransport(
        payment = payment(obj.requiredObject("payment")),
        receipts = obj.requiredArray("receipts").map { receipt(it.asJsonObject) },
    )

    private fun rentalIncidentHistory(obj: JsonObject) = RentalIncidentHistoryEntryTransport(
        incident = incident(obj.requiredObject("incident")),
        events = obj.requiredArray("events").map { incidentEvent(it.asJsonObject) },
    )

    private fun rentalDepositHistory(obj: JsonObject) = RentalDepositHistoryTransport(
        projection = deposit(obj.requiredObject("projection")),
        events = obj.requiredArray("events").map { depositEvent(it.asJsonObject) },
    )

    private fun roomHistory(obj: JsonObject) = RoomOperationalHistoryTransport(
        room = room(obj.requiredObject("room")),
        listings = obj.requiredArray("listings").map { listingOperationalHistory(it.asJsonObject) },
        tenancies = obj.requiredArray("tenancies").map { tenancyFinanceHistory(it.asJsonObject) },
        incidents = obj.requiredArray("incidents").map { rentalIncidentHistory(it.asJsonObject) },
    )

    private fun listingOperationalHistory(obj: JsonObject) = ListingOperationalHistoryEntryTransport(
        listing = listing(obj.requiredObject("listing")),
        events = obj.requiredArray("events").map { listingStatusEvent(it.asJsonObject) },
    )

    private fun listingStatusEvent(obj: JsonObject) = ListingStatusEventTransport(
        id = obj.requiredString("id"),
        listingId = obj.requiredString("listingId"),
        fromStatus = obj.requiredEnumString("fromStatus", LISTING_STATES),
        toStatus = obj.requiredEnumString("toStatus", LISTING_STATES),
        reasonCode = obj.requiredString("reasonCode"),
        actorType = obj.requiredString("actorType"),
        actorUserId = obj.optionalString("actorUserId"),
        trigger = obj.requiredString("trigger"),
        occurredAt = obj.requiredString("occurredAt"),
        metadata = obj.optionalObject("metadata"),
    )

    private fun tenancyFinanceHistory(obj: JsonObject) = TenancyFinanceHistoryEntryTransport(
        tenancy = tenancy(obj.requiredObject("tenancy")),
        billingCycles = obj.requiredArray("billingCycles").map { billingCycle(it.asJsonObject) },
        payments = obj.requiredArray("payments").map { rentalPaymentHistory(it.asJsonObject) },
        deposit = obj.optionalObject("deposit")?.let(::rentalDepositHistory),
    )

    private fun JsonObject.publicLocation() = PublicLocationTransport(
        latitude = requiredDouble("latitude"),
        longitude = requiredDouble("longitude"),
    )

    private fun <T> array(json: String, mapper: (JsonObject) -> T): List<T> =
        JsonParser.parseString(json).asJsonArray.map { mapper(it.asJsonObject) }

    private fun JsonObject.requiredString(name: String): String = required(name).asString
    private fun JsonObject.requiredDouble(name: String): Double = required(name).asDouble
    private fun JsonObject.requiredInt(name: String): Int = required(name).asInt
    private fun JsonObject.requiredBoolean(name: String): Boolean = required(name).asBoolean
    private fun JsonObject.requiredObject(name: String): JsonObject = required(name).asJsonObject
    private fun JsonObject.requiredArray(name: String): JsonArray = required(name).asJsonArray
    private fun JsonObject.requiredStringList(name: String): List<String> =
        requiredArray(name).map { it.asString }

    private fun JsonObject.requiredEnumString(name: String, allowed: Set<String>): String {
        val value = requiredString(name)
        require(value in allowed) { "Unknown enum value for $name: $value" }
        return value
    }

    private fun JsonObject.optionalEnumString(name: String, allowed: Set<String>): String? {
        val value = optionalString(name) ?: return null
        require(value in allowed) { "Unknown enum value for $name: $value" }
        return value
    }

    private fun JsonObject.required(name: String): JsonElement =
        get(name)?.takeUnless { it.isJsonNull }
            ?: throw IllegalArgumentException("Missing required JSON field: $name")

    private fun JsonObject.optionalString(name: String): String? =
        get(name)?.takeUnless { it.isJsonNull }?.asString

    private fun JsonObject.optionalBoolean(name: String): Boolean? =
        get(name)?.takeUnless { it.isJsonNull }?.asBoolean

    private fun JsonObject.optionalJson(name: String): JsonElement? =
        get(name)?.takeUnless { it.isJsonNull }

    private fun JsonObject.optionalObject(name: String): JsonObject? =
        get(name)?.takeUnless { it.isJsonNull }?.asJsonObject

    private val LISTING_STATES = setOf("draft", "published", "unpublished", "archived")
    private val ROOM_STATES = setOf("vacant", "occupied", "maintenance", "inactive")
    private val MANUAL_ROOM_STATES = setOf("vacant", "maintenance", "inactive")
    private val RECORD_LIFECYCLES = setOf("active", "archived")
    private val TENANCY_STATES = setOf("draft", "active", "ending", "ended", "cancelled")
    private val TENANCY_END_REASONS =
        setOf("TERM_ENDED", "TENANT_INITIATED", "OPERATOR_INITIATED", "MUTUAL", "OTHER")
    private val CHARGE_TYPES = setOf("RENT", "ELECTRICITY", "WATER")
    private val PAYMENT_SOURCES = setOf("MANUAL_CASH", "MANUAL_TRANSFER", "GATEWAY")
    private val PAYMENT_VERIFICATIONS = setOf("USER_RECORDED", "PROVIDER_VERIFIED")
    private val RECEIPT_STATUSES = setOf("ISSUED", "VOIDED")
    private val INCIDENT_CATEGORIES =
        setOf("ELECTRICAL", "PLUMBING", "ACCESS_SECURITY", "ROOM_FACILITY", "APPLIANCE", "OTHER")
    private val INCIDENT_STATUSES =
        setOf("REPORTED", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED")
    private val DEPOSIT_STATES =
        setOf("EXPECTED", "PARTIALLY_HELD", "HELD", "PENDING_SETTLEMENT", "SETTLED")
    private val DEPOSIT_EVENT_TYPES = setOf("RECEIVED", "REFUNDED", "RETAINED")
}
