package com.trooi.app.core.network

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/** A configured backend URL is mandatory; never silently use a production host or fixture. */
object BackendEnvironment {
    fun normalize(raw: String, allowLocalHttp: Boolean = false): HttpUrl {
        val value = raw.trim()
        require(value.isNotEmpty()) { "TROOI_API_BASE_URL is not configured" }
        val url = (if (value.endsWith("/")) value else "$value/").toHttpUrlOrNull()
            ?: throw IllegalArgumentException("Invalid backend base URL")
        require(url.username.isEmpty() && url.password.isEmpty()) { "Credentials in base URL are forbidden" }
        require(url.query == null && url.fragment == null) { "Backend URL must not contain query or fragment" }
        val localHost = url.host in setOf("localhost", "127.0.0.1", "::1", "10.0.2.2") ||
            url.host.startsWith("192.168.") || url.host.startsWith("10.") ||
            Regex("^172\\.(1[6-9]|2[0-9]|3[01])\\.").containsMatchIn(url.host)
        require(url.scheme == "https" || (allowLocalHttp && url.scheme == "http" && localHost)) {
            "Plain HTTP is only allowed for local/LAN hosts in the backend debug variant"
        }
        return url
    }
}
