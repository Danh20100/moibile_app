package com.trooi.app.core.network.dto

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

    fun publicListings(json: String): List<PublicListingTransport> =
        JsonParser.parseString(json).asJsonArray.map { element ->
            val obj = element.asJsonObject
            val location = obj.requiredObject("publicLocationProjection")
            PublicListingTransport(
                id = obj.requiredString("id"),
                roomId = obj.requiredString("roomId"),
                status = obj.requiredString("status"),
                publicTitle = obj.requiredString("publicTitle"),
                publicDescription = obj.requiredString("publicDescription"),
                publicPriceProjection = obj.requiredString("publicPriceProjection"),
                publicLocation = PublicLocationTransport(
                    latitude = location.requiredDouble("latitude"),
                    longitude = location.requiredDouble("longitude"),
                ),
            )
        }

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
    fun tenancies(json: String): List<TenancyTransport> = array(json, ::tenancy)
    fun tenancy(json: String): TenancyTransport = tenancy(JsonParser.parseString(json).asJsonObject)
    fun terms(json: String): List<TenancyTermsTransport> = array(json, ::terms)
    fun notices(json: String): List<TenancyNoticeTransport> = array(json, ::notice)
    fun billingCycles(json: String): List<BillingCycleTransport> = array(json, ::billingCycle)
    fun payment(json: String): PaymentTransport = payment(JsonParser.parseString(json).asJsonObject)
    fun receipts(json: String): List<ReceiptTransport> = array(json, ::receipt)
    fun incidents(json: String): List<IncidentTransport> = array(json, ::incident)
    fun inquiry(json: String): InquiryTransport = inquiry(JsonParser.parseString(json).asJsonObject)

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
        operationalState = obj.requiredString("operationalState"),
        recordLifecycle = obj.requiredString("recordLifecycle"),
    )

    private fun tenancy(obj: JsonObject) = TenancyTransport(
        id = obj.requiredString("id"),
        roomId = obj.requiredString("roomId"),
        status = obj.requiredString("status"),
        startedAt = obj.optionalString("startedAt"),
        endedAt = obj.optionalString("endedAt"),
        endReason = obj.optionalString("endReason"),
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
        charges = obj.getAsJsonArray("charges").map { charge(it.asJsonObject) },
    )

    private fun charge(obj: JsonObject) = ChargeTransport(
        id = obj.requiredString("id"),
        billingCycleId = obj.requiredString("billingCycleId"),
        type = obj.requiredString("type"),
        amount = obj.requiredString("amount"),
    )

    private fun payment(obj: JsonObject) = PaymentTransport(
        id = obj.requiredString("id"),
        tenancyId = obj.requiredString("tenancyId"),
        amount = obj.requiredString("amount"),
        source = obj.requiredString("source"),
        verification = obj.requiredString("verification"),
        confirmedAt = obj.requiredString("confirmedAt"),
    )

    private fun receipt(obj: JsonObject) = ReceiptTransport(
        id = obj.requiredString("id"),
        paymentId = obj.requiredString("paymentId"),
        status = obj.requiredString("status"),
        issuedAt = obj.requiredString("issuedAt"),
        voidedAt = obj.optionalString("voidedAt"),
        replacementReceiptId = obj.optionalString("replacementReceiptId"),
    )

    private fun incident(obj: JsonObject) = IncidentTransport(
        id = obj.requiredString("id"),
        roomId = obj.requiredString("roomId"),
        reportedByUserId = obj.optionalString("reportedByUserId"),
        category = obj.requiredString("category"),
        status = obj.requiredString("status"),
        closureReason = obj.optionalString("closureReason"),
        createdAt = obj.requiredString("createdAt"),
        closedAt = obj.optionalString("closedAt"),
    )

    private fun inquiry(obj: JsonObject) = InquiryTransport(
        id = obj.requiredString("id"),
        listingId = obj.requiredString("listingId"),
        senderUserId = obj.optionalString("senderUserId"),
        contactIntentOrMessage = obj.requiredString("contactIntentOrMessage"),
        status = obj.requiredString("status"),
        createdAt = obj.requiredString("createdAt"),
    )

    private fun <T> array(json: String, mapper: (JsonObject) -> T): List<T> =
        JsonParser.parseString(json).asJsonArray.map { mapper(it.asJsonObject) }

    private fun JsonObject.requiredString(name: String): String = required(name).asString
    private fun JsonObject.requiredDouble(name: String): Double = required(name).asDouble
    private fun JsonObject.requiredInt(name: String): Int = required(name).asInt
    private fun JsonObject.requiredObject(name: String): JsonObject = required(name).asJsonObject
    private fun JsonObject.requiredStringList(name: String): List<String> =
        required(name).asJsonArray.map { it.asString }

    private fun JsonObject.required(name: String): JsonElement =
        get(name)?.takeUnless { it.isJsonNull }
            ?: throw IllegalArgumentException("Missing required JSON field: $name")

    private fun JsonObject.optionalString(name: String): String? =
        get(name)?.takeUnless { it.isJsonNull }?.asString

    private fun JsonObject.optionalBoolean(name: String): Boolean? =
        get(name)?.takeUnless { it.isJsonNull }?.asBoolean
}
