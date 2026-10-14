package com.trooi.app.core.data

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.network.AuthTokenProvider
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.core.network.dto.TransportOutcome

internal class DemoBackendLogin(
    private val client: BackendClient,
    private val api: BackendApi,
    private val tokens: AuthTokenProvider,
) {
    suspend fun login(identifier: String, password: String): Result<UserSession> = runCatching {
        val payload = JsonObject().apply {
            addProperty("identifier", identifier.trim())
            addProperty("password", password)
        }.toString()
        val response = when (val outcome = client.postJson("demo/login", payload)) {
            is TransportOutcome.Success -> Gson().fromJson(
                BackendJsonCodec.unwrapResponseData(outcome.document.rawBody),
                DemoAccessTransport::class.java,
            )
            is TransportOutcome.Failure -> error("Demo backend login failed: ${outcome.kind}")
        }
        require(response.accessToken.isNotBlank()) { "Demo backend returned an empty session." }
        tokens.setToken(response.accessToken)
        try {
            val context = when (val outcome = api.getSessionContext(response.accessToken)) {
                is com.trooi.app.core.network.dto.ApiOutcome.Data -> outcome.value
                is com.trooi.app.core.network.dto.ApiOutcome.Failure -> error("Demo session context failed: ${outcome.kind}")
            }
            require(context.userId == response.userId)
            UserSession(
                userId = context.userId,
                displayName = context.name ?: response.displayName,
                email = context.email,
                pictureUrl = context.pictureUrl,
                access = AccessCapabilities(
                    linkedTenancyIds = context.linkedTenancyIds.toSet(),
                    operatedOrganizationIds = context.operatedOrganizationIds.toSet(),
                ),
            )
        } catch (error: RuntimeException) {
            tokens.clear()
            throw error
        }
    }

    private data class DemoAccessTransport(
        val accessToken: String,
        val userId: String,
        val displayName: String,
    )
}
