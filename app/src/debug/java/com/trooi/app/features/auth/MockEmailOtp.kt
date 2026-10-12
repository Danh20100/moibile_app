package com.trooi.app.features.auth

/** Deterministic debug fixture; never sends email. */
internal object MockEmailOtp {
    const val available = true
    const val code = "123456"
}
