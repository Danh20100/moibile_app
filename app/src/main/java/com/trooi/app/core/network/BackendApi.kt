package com.trooi.app.core.network

import com.trooi.app.core.network.dto.TransportOutcome
import javax.inject.Inject

/**
 * Only GET /listings/public is used for raw transport diagnostics at this stage.
 * Google auth, /me and Inquiry DTO mapping are intentionally blocked pending OpenAPI gate.
 */
interface BackendApi {
    suspend fun getPublicListingsRaw(): TransportOutcome
}

class OkHttpBackendApi @Inject constructor(private val client: BackendClient) : BackendApi {
    override suspend fun getPublicListingsRaw(): TransportOutcome =
        client.get("listings/public", authenticated = false)
}
