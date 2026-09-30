package com.trooi.app.core.network

import javax.inject.Inject
import javax.inject.Singleton

/** In-memory Google ID token holder; this phase does not invent a session JWT. */
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
        require(token.isNotBlank()) { "Cannot store an empty Google ID token" }
        current = token
    }

    override fun clear() {
        current = null
    }
}
