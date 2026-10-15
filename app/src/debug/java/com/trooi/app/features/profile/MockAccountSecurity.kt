package com.trooi.app.features.profile

import com.trooi.app.core.demo.DemoData
import java.security.MessageDigest

/** Synthetic account metadata only; this never authorizes a backend operation. */
object MockAccountSecurity {
    fun method(userId: String) = when (userId) {
        "fixture-user-ha" -> reauthenticationMethod(true, true)
        "fixture-user-lan", "fixture-user-linh" -> reauthenticationMethod(false, true)
        "fixture-google-only" -> reauthenticationMethod(false, false)
        else -> reauthenticationMethod(null, null)
    }
    fun matches(userId: String, method: ReauthenticationMethod, secret: String): Boolean = when (method) {
        ReauthenticationMethod.PIN -> userId == "fixture-user-ha" && MessageDigest.getInstance("SHA-256")
            .digest(secret.toByteArray()).joinToString("") { "%02x".format(it) } == "ae14d14d7f99f8c89a789a31a076a701ee994301586edb154ad8c3c21f888f7c"
        ReauthenticationMethod.PASSWORD -> com.trooi.app.core.demo.DebugFixtureCatalog.current.accounts.firstOrNull { it.userId == userId }
            ?.let { DemoData.authenticate(it.email, secret)?.userId == userId } == true
        else -> false
    }
}
