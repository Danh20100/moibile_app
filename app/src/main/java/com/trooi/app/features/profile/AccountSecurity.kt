package com.trooi.app.features.profile

enum class ReauthenticationMethod { PIN, PASSWORD, RECOVERY, UNKNOWN }

fun reauthenticationMethod(pinConfigured: Boolean?, passwordConfigured: Boolean?): ReauthenticationMethod = when {
    pinConfigured == true -> ReauthenticationMethod.PIN
    pinConfigured == false && passwordConfigured == true -> ReauthenticationMethod.PASSWORD
    pinConfigured == false && passwordConfigured == false -> ReauthenticationMethod.RECOVERY
    else -> ReauthenticationMethod.UNKNOWN
}

fun validSecurityPin(value: String) = value.length == 6 && value.all { it in '0'..'9' }

data class SecurityRetry(val attempts: Int = 0, val retryAt: Long = 0) {
    fun failed(now: Long): SecurityRetry = if (attempts + 1 >= 5) SecurityRetry(0, now + 30_000) else copy(attempts = attempts + 1)
    fun canTry(now: Long) = now >= retryAt
}

const val REAUTH_UNAVAILABLE = "Chưa thể xác thực bảo mật cho thao tác này. Vui lòng thử lại sau; yêu cầu chưa được thực hiện."

// shortcut: no backend step-up proof contract; integrate server verification before allowing writes.
internal fun requireBackendReauthentication() { throw IllegalStateException(REAUTH_UNAVAILABLE) }

internal fun requiresEditReauthentication(page: String): Boolean =
    (page.startsWith("edit:") && page != "edit:Tên pháp lý") || page == "password" ||
        page == "visibility" || page.startsWith("channel:")
