package com.trooi.app.core.network.dto

data class PublicLocationTransport(val latitude: Double, val longitude: Double)
data class PublicListingTransport(
    val id: String,
    val roomId: String,
    val status: String,
    val publicTitle: String,
    val publicDescription: String,
    val publicPriceProjection: String,
    val publicLocation: PublicLocationTransport,
)

data class VerifiedPrincipalTransport(
    val userId: String,
    val provider: String,
    val issuer: String,
    val subject: String,
    val email: String?,
    val emailVerified: Boolean?,
    val name: String?,
    val pictureUrl: String?,
)

data class SessionContextTransport(
    val userId: String,
    val operatedOrganizationIds: List<String>,
    val linkedTenancyIds: List<String>,
    val email: String?,
    val name: String?,
    val pictureUrl: String?,
)

data class OrganizationTransport(val id: String, val name: String, val primaryOwnerUserId: String)
data class PropertyTransport(
    val id: String,
    val organizationId: String,
    val name: String,
    val lifecycleStatus: String,
)
data class RoomTransport(
    val id: String,
    val propertyId: String,
    val nameOrLabel: String,
    val operationalState: String,
    val recordLifecycle: String,
)
data class TenancyTransport(
    val id: String,
    val roomId: String,
    val status: String,
    val startedAt: String?,
    val endedAt: String?,
    val endReason: String?,
)
data class TenancyTermsTransport(
    val id: String,
    val tenancyId: String,
    val version: Int,
    val rentAmount: String,
    val agreedDepositRequirement: String,
    val termStart: String,
    val termEnd: String,
    val effectiveFromCycleBoundary: String,
)
data class ChargeTransport(val id: String, val billingCycleId: String, val type: String, val amount: String)
data class BillingCycleTransport(
    val id: String,
    val tenancyId: String,
    val tenancyTermsId: String,
    val periodStart: String,
    val periodEnd: String,
    val charges: List<ChargeTransport>,
)
data class IncidentTransport(
    val id: String,
    val roomId: String,
    val reportedByUserId: String?,
    val category: String,
    val status: String,
    val closureReason: String?,
    val createdAt: String,
    val closedAt: String?,
)
data class InquiryTransport(
    val id: String,
    val listingId: String,
    val senderUserId: String?,
    val contactIntentOrMessage: String,
    val status: String,
    val createdAt: String,
)

data class TenancyNoticeTransport(
    val id: String,
    val tenancyId: String,
    val noticeType: String,
    val issuedByUserId: String,
    val contentOrNote: String,
    val issuedAt: String,
    val acknowledgedByUserId: String?,
    val acknowledgedAt: String?,
)

data class PaymentTransport(
    val id: String,
    val tenancyId: String,
    val amount: String,
    val source: String,
    val verification: String,
    val confirmedAt: String,
)

data class ReceiptTransport(
    val id: String,
    val paymentId: String,
    val status: String,
    val issuedAt: String,
    val voidedAt: String?,
    val replacementReceiptId: String?,
)
