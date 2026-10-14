package com.trooi.app.core.network.dto

import com.google.gson.JsonElement
import com.google.gson.JsonObject

data class PublicLocationTransport(val latitude: Double, val longitude: Double)

data class PublicListingTransport(
    val id: String,
    val roomId: String,
    val status: String,
    val publicTitle: String,
    val publicDescription: String,
    val publicPriceProjection: String,
    val publicLocation: PublicLocationTransport,
    val publicPhotoIds: List<String> = emptyList(),
    val publicAmenityIds: List<String> = emptyList(),
)

data class ListingTransport(
    val id: String,
    val roomId: String,
    val status: String,
    val publicTitle: String,
    val publicDescription: String,
    val publicPriceProjection: String,
    val publicLocation: PublicLocationTransport,
)

data class ListingAssetDetailsTransport(
    val listingId: String, val managementStatus: String, val assetType: String?,
    val publicAreaLabel: String?, val areaSquareMeters: String?, val advertisedDeposit: String?,
    val bedrooms: Int?, val bathrooms: Int?, val furnishing: String?, val amenityIds: List<String>,
    val rules: List<String>, val electricityOffer: String?, val waterOffer: String?, val serviceOffer: String?,
    val minimumTermMonths: Int?, val availableFrom: String?, val bathroomArrangement: String?,
    val maxOccupants: Int?, val floorLabel: String?,
)

data class ListingAssetMediaTransport(val id: String, val contentType: String, val byteSize: Int, val position: Int, val createdAt: String, val isPublic: Boolean = false)
data class ListingAssetMediaContentTransport(val contentType: String, val base64: String)
data class ProfileAvatarUploadTransport(val contentType: String, val byteSize: Int, val updatedAt: String)
data class ProfileAvatarContentTransport(val contentType: String, val byteSize: Int, val updatedAt: String, val base64: String)

data class PublicListingSearchResultTransport(
    val listingId: String,
    val roomId: String,
    val publicTitle: String,
    val publicDescription: String,
    val publicPriceProjection: String,
    val publicLocation: PublicLocationTransport,
    val distanceMeters: Double,
    val publicPhotoIds: List<String> = emptyList(),
    val publicAmenityIds: List<String> = emptyList(),
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

data class IdentityAuthChallengeTransport(val purpose: String, val nonce: String, val expiresAt: String)
data class IdentitySessionTransport(
    val userId: String, val sessionId: String, val accessToken: String, val refreshToken: String,
    val tokenType: String, val expiresInSeconds: Int, val refreshExpiresAt: String,
)
data class ReauthenticationTransport(val nonce: String? = null, val proof: String? = null, val expiresAt: String)

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
    val operationalAddressText: String? = null,
    val operationalLocation: PublicLocationTransport? = null,
    val publicLocationProjection: PublicLocationTransport? = null,
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
    val billingDayOrDueDateRule: JsonElement = JsonObject(),
    val electricityArrangement: JsonObject = JsonObject(),
    val waterArrangement: JsonObject = JsonObject(),
    val minimalRentalConditions: JsonObject = JsonObject(),
)

data class TermsAcknowledgementTransport(
    val id: String,
    val tenancyTermsId: String,
    val tenancyParticipantId: String,
    val userId: String,
    val acknowledgedAt: String,
)

data class ChargeTransport(
    val id: String,
    val billingCycleId: String,
    val type: String,
    val amount: String,
    val outstandingAmount: String? = null,
)

data class BillingCycleTransport(
    val id: String,
    val tenancyId: String,
    val tenancyTermsId: String,
    val periodStart: String,
    val periodEnd: String,
    val dueDate: String? = null,
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

data class IncidentEventTransport(
    val id: String,
    val incidentId: String,
    val eventType: String,
    val actorUserId: String?,
    val note: String?,
    val attachmentReference: String?,
    val fromStatus: String?,
    val toStatus: String?,
    val occurredAt: String,
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
    val voidedOrReversedAt: String? = null,
    val correctionNote: String? = null,
    val replacementPaymentId: String? = null,
)

data class ReceiptTransport(
    val id: String,
    val paymentId: String,
    val status: String,
    val issuedAt: String,
    val voidedAt: String?,
    val replacementReceiptId: String?,
)

data class DashboardRoomStateCountsTransport(
    val vacant: Int,
    val occupied: Int,
    val maintenance: Int,
    val inactive: Int,
)

data class DashboardTransport(
    val organizationId: String,
    val roomsByState: DashboardRoomStateCountsTransport,
    val activeTenancyCount: Int,
    val outstandingReceivable: String?,
    val confirmedPaymentTotal: String?,
    val openIncidentCount: Int,
)

data class NotificationTransport(
    val id: String,
    val recipientUserId: String,
    val category: String,
    val messageOrPayloadReference: String,
    val sourceType: String?,
    val sourceId: String?,
    val deliveryStatus: String,
    val createdAt: String,
    val deliveredAt: JsonElement?,
    val readAt: JsonElement?,
)

data class DepositProjectionTransport(
    val id: String,
    val tenancyId: String,
    val requirementAmount: String?,
    val fundedAmount: String,
    val settledAmount: String,
    val heldAmount: String,
    val state: String?,
    val blockedByOpenPolicy: Boolean,
)

data class DepositEventTransport(
    val id: String,
    val depositId: String,
    val eventType: String,
    val amount: String,
    val occurredAt: String,
    val paymentApplicationId: String?,
    val settlementId: String?,
)

data class DepositSettlementTransport(
    val id: String,
    val depositId: String,
    val refundedAmount: String,
    val retainedAmount: String,
    val reasonOrNote: String,
    val actedByUserId: String,
    val settledAt: String,
)

data class RentalPaymentHistoryEntryTransport(
    val payment: PaymentTransport,
    val receipts: List<ReceiptTransport>,
)

data class RentalIncidentHistoryEntryTransport(
    val incident: IncidentTransport,
    val events: List<IncidentEventTransport>,
)

data class RentalDepositHistoryTransport(
    val projection: DepositProjectionTransport,
    val events: List<DepositEventTransport>,
)

data class RentalHistoryTransport(
    val tenancy: TenancyTransport,
    val terms: List<TenancyTermsTransport>,
    val payments: List<RentalPaymentHistoryEntryTransport>,
    val notices: List<TenancyNoticeTransport>,
    val incidents: List<RentalIncidentHistoryEntryTransport>,
    val deposit: RentalDepositHistoryTransport?,
)

data class ListingStatusEventTransport(
    val id: String,
    val listingId: String,
    val fromStatus: String,
    val toStatus: String,
    val reasonCode: String,
    val actorType: String,
    val actorUserId: String?,
    val trigger: String,
    val occurredAt: String,
    val metadata: JsonObject?,
)

data class ListingOperationalHistoryEntryTransport(
    val listing: ListingTransport,
    val events: List<ListingStatusEventTransport>,
)

data class TenancyFinanceHistoryEntryTransport(
    val tenancy: TenancyTransport,
    val billingCycles: List<BillingCycleTransport>,
    val payments: List<RentalPaymentHistoryEntryTransport>,
    val deposit: RentalDepositHistoryTransport?,
)

data class RoomOperationalHistoryTransport(
    val room: RoomTransport,
    val listings: List<ListingOperationalHistoryEntryTransport>,
    val tenancies: List<TenancyFinanceHistoryEntryTransport>,
    val incidents: List<RentalIncidentHistoryEntryTransport>,
)

data class TrustReportReceiptTransport(
    val id: String,
    val listingId: String?,
    val reason: String,
    val status: String,
    val createdAt: String,
)

data class GatewayCheckoutTransport(
    val id: String,
    val tenancyId: String,
    val amount: String,
    val referenceCode: String,
    val provider: String,
    val status: String,
    val createdAt: String,
    val replayAllowed: Boolean,
    val payUrl: String? = null,
    val resultingPaymentId: String? = null,
    val replayBlockedReason: String? = null,
)
