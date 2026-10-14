package com.trooi.app.core.network

import javax.inject.Inject
import javax.inject.Singleton

/** In-memory short-lived backend access token holder. Refresh credentials use Android Keystore storage. */
interface AuthTokenProvider {
    fun token(): String?
    fun setToken(token: String)
    fun clear()
}

@Singleton
class InMemoryAuthTokenProvider @Inject constructor() : AuthTokenProvider {
    @Volatile private var current: String? = null
    override fun token(): String? = current

    override fun setToken(token: String) {
        require(token.isNotBlank()) { "Cannot store an empty backend access token" }
        current = token
    }

    override fun clear() {
        current = null
    }
}
