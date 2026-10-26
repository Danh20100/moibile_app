package com.trooi.app.features.auth

/** Main-thread ownership of an OTP operation and its credential snapshot. */
internal class EmailOtpLifecycle {
    enum class Purpose { REGISTRATION, PASSWORD_RESET }
    data class Request(val generation: Long, val purpose: Purpose)

    private var generation = 0L
    private var current: Request? = null

    fun begin(purpose: Purpose): Request = Request(++generation, purpose).also { current = it }

    fun invalidate() {
        generation++
        current = null
    }

    fun isCurrent(request: Request): Boolean = current == request

    fun capture(purpose: Purpose): Request? = current?.takeIf { it.purpose == purpose }

    fun hasRequest(): Boolean = current != null

    fun hasPurpose(purpose: Purpose): Boolean = current?.purpose == purpose
}
