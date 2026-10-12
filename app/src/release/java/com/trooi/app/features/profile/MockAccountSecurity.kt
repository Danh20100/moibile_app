package com.trooi.app.features.profile

object MockAccountSecurity {
    fun method(userId: String) = ReauthenticationMethod.UNKNOWN
    fun matches(userId: String, method: ReauthenticationMethod, secret: String) = false
}
