package com.trooi.app.features.profile

import com.trooi.app.core.demo.DebugFixtureCatalog

internal object MockPersonalInfo {
    fun value(userId: String, label: String): String {
        val account = DebugFixtureCatalog.current.accounts.firstOrNull { it.userId == userId } ?: return ""
        return when (label) {
            "Số điện thoại" -> account.phone
            "Email" -> account.email
            "Địa chỉ cư trú" -> account.residentialAddress
            else -> ""
        }
    }
}
