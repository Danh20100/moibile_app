package com.trooi.app.features.auth

enum class EmailOtpStatus { UNVERIFIED, SENDING, SENT, VERIFYING, VERIFIED, EXPIRED, ERROR }

data class EmailOtpState(
    val email: String = "",
    val status: EmailOtpStatus = EmailOtpStatus.UNVERIFIED,
    val expiresAt: Long = 0,
    val resendAt: Long = 0,
    val attempts: Int = 0,
    val error: String = "",
) {
    fun changedEmail(value: String) = if (value.trim() == email) this else EmailOtpState(email = value.trim())
    fun sent(now: Long) = copy(status = EmailOtpStatus.SENT, expiresAt = now + 120_000, resendAt = now + 30_000, attempts = 0, error = "")
    fun expired(now: Long) = if (status in listOf(EmailOtpStatus.SENT, EmailOtpStatus.ERROR) && now >= expiresAt)
        copy(status = EmailOtpStatus.EXPIRED, error = "Mã đã hết hạn. Hãy gửi lại mã.") else this
    fun canResend(now: Long) = now >= resendAt && status !in listOf(EmailOtpStatus.SENDING, EmailOtpStatus.VERIFYING, EmailOtpStatus.VERIFIED)
    fun verify(code: String, now: Long, expectedCode: String): EmailOtpState = when {
        expiresAt == 0L -> copy(error = "Hãy gửi mã trước khi tiếp tục.")
        status == EmailOtpStatus.EXPIRED -> copy(error = "Mã đã hết hạn. Hãy gửi lại mã.")
        status !in listOf(EmailOtpStatus.SENT, EmailOtpStatus.ERROR, EmailOtpStatus.VERIFYING) -> this
        now >= expiresAt -> copy(status = EmailOtpStatus.EXPIRED, error = "Mã đã hết hạn. Hãy gửi lại mã.")
        attempts >= 5 -> copy(status = EmailOtpStatus.ERROR, error = "Đã vượt 5 lần thử. Hãy gửi lại mã khi hết thời gian chờ.")
        code.length != 6 || code.any { !it.isDigit() } -> copy(status = EmailOtpStatus.ERROR, error = "Nhập đủ 6 chữ số.")
        expectedCode.isBlank() || code != expectedCode -> copy(status = EmailOtpStatus.ERROR, attempts = attempts + 1, error = "Mã không đúng. Kiểm tra lại mã hoặc gửi lại.")
        else -> copy(status = EmailOtpStatus.VERIFIED, error = "")
    }
}
