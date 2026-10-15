package com.trooi.app.core.data

import android.content.Context
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.trooi.app.core.auth.NoRestoreCredential
import com.trooi.app.core.auth.RefreshCredentialStore
import com.trooi.app.core.model.AccessCapabilities
import com.trooi.app.core.network.AuthTokenProvider
import com.trooi.app.core.network.BackendApi
import com.trooi.app.core.network.BackendClient
import com.trooi.app.core.network.dto.BackendJsonCodec
import com.trooi.app.core.network.dto.TransportOutcome
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

internal class DemoBackendLogin(
    private val client: BackendClient,
    private val api: BackendApi,
    private val tokens: AuthTokenProvider,
    @ApplicationContext context: Context,
) {
    private val refreshCredentials = RefreshCredentialStore(context)

    suspend fun login(identifier: String, password: String): Result<UserSession> = withContext(Dispatchers.IO) { runCatching {
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
            require(response.refreshToken.isNotBlank()) { "Demo backend returned no refresh credential." }
            refreshCredentials.write(response.refreshToken)
            resolve(response)
        } catch (error: RuntimeException) {
            tokens.clear()
            refreshCredentials.clear()
            throw error
        }
    } }

    suspend fun restore(): Result<UserSession> = withContext(Dispatchers.IO) { runCatching {
        val refreshToken = refreshCredentials.read() ?: throw NoRestoreCredential()
        val payload = JsonObject().apply {
            addProperty("refreshToken", refreshToken)
            addProperty("requestId", UUID.randomUUID().toString())
        }.toString()
        val response = when (val outcome = client.postJson("demo/refresh", payload, retryOnIOException = true)) {
            is TransportOutcome.Success -> Gson().fromJson(
                BackendJsonCodec.unwrapResponseData(outcome.document.rawBody),
                DemoAccessTransport::class.java,
            )
            is TransportOutcome.Failure -> {
                tokens.clear()
                refreshCredentials.clear()
                error("Demo session refresh failed: ${outcome.kind}")
            }
        }
        require(response.accessToken.isNotBlank() && response.refreshToken.isNotBlank())
        refreshCredentials.write(response.refreshToken)
        tokens.setToken(response.accessToken)
        resolve(response)
    }.onFailure {
        if (it !is NoRestoreCredential) {
            tokens.clear()
            refreshCredentials.clear()
        }
    } }

    suspend fun logout(): Result<Unit> = runCatching {
        val credential = tokens.token()
        if (credential != null) {
            when (val outcome = client.postJson("demo/logout", "{}", authenticated = true, expectedToken = credential)) {
                is TransportOutcome.Success -> Unit
                is TransportOutcome.Failure -> error("Demo session logout failed: ${outcome.kind}")
            }
        }
    }.also {
        tokens.clear()
        refreshCredentials.clear()
    }

    private suspend fun resolve(response: DemoAccessTransport): UserSession {
        require(response.accessToken.isNotBlank()) { "Demo backend returned an empty session." }
        val context = when (val outcome = api.getSessionContext(response.accessToken)) {
                is com.trooi.app.core.network.dto.ApiOutcome.Data -> outcome.value
                is com.trooi.app.core.network.dto.ApiOutcome.Failure -> error("Demo session context failed: ${outcome.kind}")
            }
            require(context.userId == response.userId)
        return UserSession(
            userId = context.userId,
            displayName = context.name ?: response.displayName,
            email = context.email,
            pictureUrl = context.pictureUrl,
            access = AccessCapabilities(
                linkedTenancyIds = context.linkedTenancyIds.toSet(),
                operatedOrganizationIds = context.operatedOrganizationIds.toSet(),
            ),
        )
    }

    private data class DemoAccessTransport(
        val accessToken: String,
        val refreshToken: String,
        val userId: String,
        val displayName: String,
    )
}
