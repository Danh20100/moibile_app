package com.trooi.app.core.network

import android.util.Log
import com.trooi.app.core.network.dto.ErrorKind
import com.trooi.app.core.network.dto.TransportDocument
import com.trooi.app.core.network.dto.TransportOutcome
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

private class BearerCall

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
    suspend fun get(
        path: String,
        authenticated: Boolean = false,
        query: Map<String, String> = emptyMap(),
    ): TransportOutcome = execute(path, authenticated, query, retryOnIOException = true) { builder -> builder.get() }

    suspend fun postJson(
        path: String,
        json: String,
        authenticated: Boolean = false,
        headers: Map<String, String> = emptyMap(),
    ): TransportOutcome = execute(path, authenticated, emptyMap(), retryOnIOException = false) { builder ->
        headers.forEach { (name, value) ->
            if (name.equals("Idempotency-Key", ignoreCase = true) && value.isNotBlank()) {
                builder.header("Idempotency-Key", value)
            }
        }
        builder.post(json.toRequestBody(JSON_MEDIA_TYPE))
    }

    suspend fun patchJson(
        path: String,
        json: String,
        authenticated: Boolean = true,
    ): TransportOutcome = execute(path, authenticated, emptyMap(), retryOnIOException = false) { builder ->
        builder.patch(json.toRequestBody(JSON_MEDIA_TYPE))
    }

    suspend fun postEmpty(path: String, authenticated: Boolean = true): TransportOutcome =
        execute(path, authenticated, emptyMap(), retryOnIOException = false) { builder ->
            builder.post(ByteArray(0).toRequestBody(null))
        }

    private suspend fun execute(
        path: String,
        authenticated: Boolean,
        query: Map<String, String>,
        retryOnIOException: Boolean,
        configure: (Request.Builder) -> Request.Builder,
    ): TransportOutcome = withContext(Dispatchers.IO) {
        val base = try {
            BackendEnvironment.normalize(rawBaseUrl, allowLocalHttp)
        } catch (_: IllegalArgumentException) {
            return@withContext TransportOutcome.Failure(ErrorKind.UNCONFIGURED)
        }
        if (!isSafeRelativePath(path) || query.keys.any { it.isBlank() }) {
            return@withContext TransportOutcome.Failure(ErrorKind.UNCONFIGURED)
        }
        val requestToken = if (authenticated) tokens.token() else null
        if (authenticated && requestToken.isNullOrBlank()) {
            return@withContext TransportOutcome.Failure(ErrorKind.AUTH_EXPIRED)
        }
        val targetBase = base.resolve(path)
            ?: return@withContext TransportOutcome.Failure(ErrorKind.UNCONFIGURED)
        val target = targetBase.newBuilder().apply {
            query.forEach { (name, value) -> addQueryParameter(name, value) }
        }.build()
        var builder = Request.Builder().url(target)
        if (authenticated) builder = builder.tag(BearerCall::class.java, BearerCall())
        val request = configure(builder).build()
        val attempts = if (retryOnIOException) 2 else 1
        repeat(attempts) { attempt ->
            try {
                return@withContext client.newCall(request).execute().use { response ->
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
            } catch (error: IOException) {
                if (attempt + 1 < attempts) {
                    warn("Transient GET I/O failure path=$path type=${error::class.java.simpleName}; retrying once")
                } else {
                    warn("I/O failure path=$path type=${error::class.java.simpleName} message=${error.message}")
                    return@withContext TransportOutcome.Failure(ErrorKind.NETWORK_UNAVAILABLE)
                }
            }
        }
        return@withContext TransportOutcome.Failure(ErrorKind.NETWORK_UNAVAILABLE)
    }

    private fun isSafeRelativePath(path: String): Boolean =
        path.isNotBlank() && !path.startsWith("/") && !path.contains("..") &&
            !path.contains('?') && !path.contains('#') && !path.contains("://")

    private fun warn(message: String) {
        runCatching { Log.w("TroOiBackendClient", message) }
    }

    private companion object {
        val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
