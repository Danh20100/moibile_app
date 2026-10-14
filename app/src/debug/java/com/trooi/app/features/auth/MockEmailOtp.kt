package com.trooi.app.features.auth

/** No OTP fixture is accepted; verification requires a real delivery provider. */
internal object MockEmailOtp {
    const val available = false
    const val code = ""
}
