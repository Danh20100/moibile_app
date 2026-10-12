package com.trooi.app.ui

import android.content.Intent
import android.os.SystemClock
import android.util.Base64

/**
 * Explicit ADB intent from the local HTML test harness.
 * Only compiled into debug APK; no manifest deeplink, exported receiver or network server.
 */
internal object DebugTestIntent {
    const val ACTION = "com.trooi.app.action.DEBUG_TEST_CONTROL"

    fun parse(intent: Intent?): DebugTestCommand? {
        if (intent?.action != ACTION) return null
        fun field(name: String) = intent.getStringExtra("trooi_test_" + name)
            .orEmpty().take(180)
        fun decodedField(name: String): String {
            val encoded = intent.getStringExtra("trooi_test_" + name + "_b64").orEmpty()
            if (encoded.length > 1000) return ""
            return runCatching {
                String(
                    Base64.decode(encoded, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP),
                    Charsets.UTF_8,
                ).take(180)
            }.getOrDefault("")
        }
        val route = field("route")
        val mode = field("mode")
        if (route.isBlank() && mode.isBlank()) return null
        return DebugTestCommand(
            id = SystemClock.elapsedRealtimeNanos(),
            route = route, mode = mode,
            identifier = decodedField("identifier"), password = decodedField("password"),
            fullName = decodedField("fullName"), phone = decodedField("phone"),
            email = decodedField("email"), listingId = decodedField("listingId"),
        )
    }
}
