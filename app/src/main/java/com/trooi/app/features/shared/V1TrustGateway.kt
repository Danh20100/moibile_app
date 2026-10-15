package com.trooi.app.features.shared

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.trooi.app.core.model.AppPage
import com.trooi.app.core.model.TrustReportReceipt
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.core.network.dto.ErrorKind
import com.trooi.app.core.network.dto.TransportOutcome
import com.trooi.app.core.network.dto.TrustReportReceiptTransport
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject

/** Canonical TrustReportReason. Wire value is the enum name. */
enum class TrustReportReason(val label: String) {
    INCORRECT_INFORMATION("Thông tin không đúng"),
    MISLEADING_PRICE("Giá gây hiểu nhầm"),
    WRONG_LOCATION("Vị trí không đúng"),
    DUPLICATE_LISTING("Tin đăng trùng"),
    INAPPROPRIATE_CONTENT("Nội dung không phù hợp"),
    SUSPECTED_FRAUD("Nghi ngờ gian lận"),
    PRIVACY_VIOLATION("Vi phạm quyền riêng tư"),
    SPAM("Spam"),
    OTHER("Lý do khác"),
}

sealed interface TrustReportDestination {
    data class Login(val listingId: String) : TrustReportDestination
    data class Form(val listingId: String) : TrustReportDestination
    data object Unavailable : TrustReportDestination
}

/** Review reports stay closed until a published Review contract exists. */
fun reviewReportEnabled(): Boolean = false

/** Second tap while a submit is in flight is dropped. No client idempotency key. */
fun claimTrustSubmit(inFlight: AtomicBoolean): Boolean = inFlight.compareAndSet(false, true)

fun trustReportDestination(
    authenticated: Boolean,
    listingPublic: Boolean,
    listingId: String,
): TrustReportDestination = when {
    !listingPublic || listingId.isBlank() -> TrustReportDestination.Unavailable
    !authenticated -> TrustReportDestination.Login(listingId)
    else -> TrustReportDestination.Form(listingId)
}

fun trustTargetUnavailable(httpStatus: Int?): Boolean = httpStatus == 404

/** After login, open the report only while the Listing is still public. */
fun pageAfterTrustLogin(listingId: String?, listingPublic: Boolean): AppPage? = when {
    listingId.isNullOrBlank() -> null
    listingPublic -> AppPage.TrustReport(listingId)
    else -> AppPage.ListingDetail(listingId)
}

/** Form back returns the Listing. Login opened for a report returns that Listing too. */
fun trustBackPage(page: AppPage, authReturnListingId: String?): AppPage? = when {
    page is AppPage.TrustReport -> AppPage.ListingDetail(page.listingId)
    page == AppPage.AuthLogin && !authReturnListingId.isNullOrBlank() -> AppPage.ListingDetail(authReturnListingId)
    else -> null
}

fun encodeListingReport(listingId: String, reason: TrustReportReason, note: String?): String {
    val body = JsonObject()
    body.addProperty("listingId", listingId)
    body.addProperty("reason", reason.name)
    val clean = boundedTrustNote(note)
    if (clean.isNotEmpty()) body.addProperty("note", clean)
    return body.toString()
}

private fun boundedTrustNote(note: String?): String {
    val trimmed = note?.trim().orEmpty()
    if (trimmed.isEmpty()) return ""
    val count = trimmed.codePointCount(0, trimmed.length)
    if (count <= 2000) return trimmed
    return trimmed.substring(0, trimmed.offsetByCodePoints(0, 2000))
}

class V1TrustGateway @Inject constructor(private val client: BackendClient) {
    suspend fun submitListingReport(listingId: String, reason: String, note: String?): TrustReportReceipt {
        require(listingId.matches(LISTING_ID)) { "Listing ID không hợp lệ" }
        val parsed = TrustReportReason.entries.find { it.name == reason }
            ?: throw IllegalArgumentException("Lý do báo cáo không hợp lệ")
        val outcome = client.postJson(
            "audit-trust/reports",
            encodeListingReport(listingId, parsed, note),
            authenticated = true,
        )
        val raw = when (outcome) {
            is TransportOutcome.Failure -> throw V1RequestException(outcome.kind, outcome.httpStatus)
            is TransportOutcome.Success -> try {
                BackendJsonCodec.unwrapResponseData(outcome.document.rawBody)
            } catch (_: RuntimeException) {
                throw V1RequestException(ErrorKind.INVALID_RESPONSE, outcome.status)
            }
        }
        return receipt(JsonParser.parseString(raw).asJsonObject, listingId)
    }

    private fun receipt(raw: JsonObject, listingId: String): TrustReportReceipt {
        fun req(name: String) = raw.get(name)?.takeUnless { it.isJsonNull }?.asString
            ?: throw V1RequestException(ErrorKind.INVALID_RESPONSE)
        val transport = TrustReportReceiptTransport(
            id = req("id"),
            listingId = raw.get("listingId")?.takeUnless { it.isJsonNull }?.asString,
            reason = req("reason"),
            status = req("status"),
            createdAt = req("createdAt"),
        )
        if (transport.listingId != null && transport.listingId != listingId) {
            throw V1RequestException(ErrorKind.INVALID_RESPONSE)
        }
        return TrustReportReceipt(
            id = transport.id,
            listingId = listingId,
            reason = transport.reason,
            status = transport.status,
            createdAt = transport.createdAt,
        )
    }

    private companion object {
        val LISTING_ID = Regex("[A-Za-z0-9_-]{1,128}")
    }
}
