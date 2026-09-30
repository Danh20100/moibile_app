package com.trooi.app.core.network.dto

/** Unmapped HTTP payload; no business DTO fields are assumed before the OpenAPI gate. */
data class TransportDocument(
    val rawBody: String,
    val contentType: String?,
)

/** Transport error is distinct from domain error and from an authorized empty projection. */
sealed interface TransportOutcome {
    data class Success(val status: Int, val document: TransportDocument) : TransportOutcome
    data class Failure(val kind: ErrorKind, val httpStatus: Int? = null) : TransportOutcome
}

enum class ErrorKind {
    UNCONFIGURED,
    NETWORK_UNAVAILABLE,
    AUTH_EXPIRED,
    FORBIDDEN,
    HTTP_ERROR,
}
