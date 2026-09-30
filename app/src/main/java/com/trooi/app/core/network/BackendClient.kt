package com.trooi.app.core.network

import com.trooi.app.core.network.dto.ErrorKind
import com.trooi.app.core.network.dto.TransportDocument
import com.trooi.app.core.network.dto.TransportOutcome
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

private class BearerCall

/** Attaches the current Google token only to explicitly protected requests. */
class BearerTokenInterceptor(private val tokens: AuthTokenProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): okhttp3.Response {
        val request = chain.request()
        val protected = request.tag(BearerCall::class.java) != null
        val token = if (protected) tokens.token()?.takeIf(String::isNotBlank) else null
        val next = request.newBuilder().removeHeader("Authorization").apply {
            if (token != null) header("Authorization", "Bearer $token")
        }.build()
        return chain.proceed(next)
    }
}

/** Wire-level transport only; no business response DTOs before OpenAPI is GREEN. */
class BackendClient(
    private val rawBaseUrl: String,
    private val tokens: AuthTokenProvider,
    private val allowLocalHttp: Boolean = false,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .addInterceptor(BearerTokenInterceptor(tokens))
        .build(),
) {
    suspend fun get(path: String, authenticated: Boolean = false): TransportOutcome = withContext(Dispatchers.IO) {
        val base = try { BackendEnvironment.normalize(rawBaseUrl, allowLocalHttp) }
            catch (_: IllegalArgumentException) { return@withContext TransportOutcome.Failure(ErrorKind.UNCONFIGURED) }
        // Never accept externally-supplied absolute URLs, traversal or queries.
        if (path.isBlank() || path.startsWith("/") || path.contains("..") || path.contains('?') || path.contains('#')) {
            return@withContext TransportOutcome.Failure(ErrorKind.UNCONFIGURED)
        }
        val requestToken = if (authenticated) tokens.token() else null
        if (authenticated && requestToken.isNullOrBlank()) {
            return@withContext TransportOutcome.Failure(ErrorKind.AUTH_EXPIRED)
        }
        val target = base.resolve(path) ?: return@withContext TransportOutcome.Failure(ErrorKind.UNCONFIGURED)
        val request = Request.Builder().url(target).apply {
            if (authenticated) tag(BearerCall::class.java, BearerCall())
        }.build()
        try {
            client.newCall(request).execute().use { response ->
                val status = response.code
                when {
                    status == 401 && authenticated -> {
                        if (tokens.token() == requestToken) tokens.clear()
                        TransportOutcome.Failure(ErrorKind.AUTH_EXPIRED, status)
                    }
                    status == 403 -> TransportOutcome.Failure(ErrorKind.FORBIDDEN, status)
                    !response.isSuccessful -> TransportOutcome.Failure(ErrorKind.HTTP_ERROR, status)
                    else -> TransportOutcome.Success(
                        status,
                        TransportDocument(response.body?.string().orEmpty(), response.header("Content-Type")),
                    )
                }
            }
        } catch (_: IOException) {
            TransportOutcome.Failure(ErrorKind.NETWORK_UNAVAILABLE)
        }
    }
}
